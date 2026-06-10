#!/usr/bin/env bash
#
# deploy_testnet.sh — deploy Proof of Alpha to Robinhood Chain testnet (chain 46630).
#
# WHY THIS EXISTS (not a forge script): forge 1.5.1's `forge script` can't fork chain 46630
# ("Chain not supported"), but `forge create` + `cast` both work on it. So we deploy each
# contract with `forge create` and seed the demo agents with `cast send`. Same result as
# DeployDemo.s.sol, just driven from bash.
#
# Usage:
#   cd contract
#   ./script/deploy_testnet.sh deployer            # 'deployer' = your cast keystore account name
#
# Requirements: an imported keystore (`cast wallet import deployer`) whose address has testnet
# gas. The keystore is decrypted ONCE (one password prompt); the key lives only in this
# script's memory and is never written to disk or shell history.
set -euo pipefail

ACCOUNT="${1:-deployer}"
RPC="${RPC:-https://rpc.testnet.chain.robinhood.com/rpc}"
OUT="deployments.txt"

# ---- amounts (USDG = 6 decimals, stocks = 18) --------------------------------------------
PRICE_BASE=100000000            # 100 USDG per whole stock token
FUND=1000000000                 # 1,000 USDG traded per demo agent
DEX_USDG_LIQ=1000000000000      # 1,000,000 USDG liquidity in the DEX
DEX_STOCK_LIQ=100000000000000000000000  # 100,000 stock tokens liquidity
DEPLOYER_SEED=3000000000        # 3,000 USDG minted to deployer for seeding

# PK can be supplied via env (testing/CI); otherwise the keystore is decrypted once.
if [ -z "${PK:-}" ]; then
  echo "==> Unlocking keystore '$ACCOUNT' (one password prompt)…"
  PK=$(cast wallet decrypt-keystore "$ACCOUNT" | grep -oiE '0x[0-9a-f]{64}' | head -1)
fi
[ -n "$PK" ] || { echo "Failed to obtain private key"; exit 1; }
SENDER=$(cast wallet address --private-key "$PK")
echo "    deployer = $SENDER"
echo "    balance  = $(cast balance "$SENDER" --rpc-url "$RPC") wei"
echo

# ---- helpers (all retry — the public testnet RPC occasionally resets connections) --------
# create <Path:Name> [constructor-args...] -> echoes the deployed address
create() {
  local what="$1"; shift
  local addr i
  for i in 1 2 3 4 5 6; do
    addr=$(forge create "$what" --rpc-url "$RPC" --private-key "$PK" --broadcast --json "$@" 2>/dev/null \
            | jq -r '.deployedTo' 2>/dev/null)
    [ -n "$addr" ] && [ "$addr" != "null" ] && { echo "$addr"; return 0; }
    sleep 3
  done
  echo "  !! deploy failed after retries: $what" >&2; exit 1
}
send() {
  local i pre post
  # Baseline nonce: a mined tx advances it by exactly 1.
  pre=$(cast nonce "$SENDER" --rpc-url "$RPC" 2>/dev/null)
  for i in 1 2 3 4 5 6; do
    cast send "$@" --rpc-url "$RPC" --private-key "$PK" >/dev/null 2>&1 && return 0
    sleep 3
    # Lost-response guard: if the public RPC dropped the reply but the tx actually mined,
    # the account nonce will have advanced — so don't re-send (which would just revert).
    post=$(cast nonce "$SENDER" --rpc-url "$RPC" 2>/dev/null)
    if [ -n "$pre" ] && [ -n "$post" ] && [ "$post" -gt "$pre" ]; then return 0; fi
  done
  echo "  !! tx failed after retries: $*" >&2; exit 1
}
# cast call annotates big numbers ("1e19 [1e19]"); keep only the raw first token.
read_call() {
  local out i
  for i in 1 2 3 4 5 6; do
    out=$(cast call "$@" --rpc-url "$RPC" 2>/dev/null | awk '{print $1}')
    [ -n "$out" ] && { echo "$out"; return 0; }
    sleep 2
  done
  echo "0x0000000000000000000000000000000000000000"
}

: > "$OUT"
record() { echo "$1=$2" | tee -a "$OUT"; }

echo "==> 1/4  Deploying base assets…"
USDG=$(create src/mocks/MockERC20.sol:MockERC20 --constructor-args "Global Dollar" "USDG" 6); record USDG "$USDG"
TSLA=$(create src/mocks/MockERC20.sol:MockERC20 --constructor-args "Tesla" "TSLA" 18);        record TSLA "$TSLA"
AMZN=$(create src/mocks/MockERC20.sol:MockERC20 --constructor-args "Amazon" "AMZN" 18);       record AMZN "$AMZN"
PLTR=$(create src/mocks/MockERC20.sol:MockERC20 --constructor-args "Palantir" "PLTR" 18);     record PLTR "$PLTR"

echo "==> 2/4  Deploying market + registries + factory + runner + controller…"
DEX=$(create src/Market.sol:Market --constructor-args "$USDG");                               record DEX "$DEX"
IDENTITY=$(create src/IdentityRegistry.sol:IdentityRegistry);                                 record IDENTITY "$IDENTITY"
REPUTATION=$(create src/ReputationRegistry.sol:ReputationRegistry --constructor-args "$IDENTITY"); record REPUTATION "$REPUTATION"
VALIDATION=$(create src/ValidationRegistry.sol:ValidationRegistry --constructor-args "$IDENTITY"); record VALIDATION "$VALIDATION"
FACTORY=$(create src/VaultFactory.sol:VaultFactory \
  --constructor-args "$USDG" "$IDENTITY" "$VALIDATION" "$DEX" "[$TSLA,$AMZN,$PLTR]");          record FACTORY "$FACTORY"
RUNNER=$(create src/AgentRunner.sol:AgentRunner --constructor-args "$DEX" "$USDG");            record RUNNER "$RUNNER"
CONTROLLER=$(create src/AllocationController.sol:AllocationController \
  --constructor-args "$USDG" "$FACTORY" "$VALIDATION" 50 1);                                   record CONTROLLER "$CONTROLLER"

echo "==> 3/4  Funding the DEX and handing pricing to the runner…"
send "$USDG" "mint(address,uint256)" "$DEX" "$DEX_USDG_LIQ"
for T in "$TSLA" "$AMZN" "$PLTR"; do send "$T" "mint(address,uint256)" "$DEX" "$DEX_STOCK_LIQ"; done
# The runner owns the DEX so it can move prices during a one-tx trading round.
send "$DEX" "transferOwnership(address)" "$RUNNER"
send "$USDG" "mint(address,uint256)" "$SENDER" "$DEPLOYER_SEED"

# seed_agent <stock> <uri> <biasBps> <seedMoveBps> <idx> -> echoes vault address
seed_agent() {
  local STOCK="$1" URI="$2" BIAS="$3" MOVE="$4" IDX="$5"
  # Launch with the RUNNER as trader, so trading rounds are one-click & on-chain.
  send "$FACTORY" "launchAgent(string,address)" "$URI" "$RUNNER"
  local VAULT; VAULT=$(read_call "$FACTORY" "allVaults(uint256)(address)" "$IDX")
  send "$RUNNER" "configureAgent(address,address,int256)" "$VAULT" "$STOCK" "$BIAS"
  # Fund the vault, then seed one clean epoch through the runner (single tx).
  send "$USDG" "approve(address,uint256)" "$VAULT" "$FUND"
  send "$VAULT" "deposit(uint256)" "$FUND"
  send "$RUNNER" "runEpochManual(address,int256)" "$VAULT" "$MOVE"
  echo "$VAULT"
}

echo "==> 4/4  Launching + seeding 3 demo agents (live one-tx rounds)…"
V_MOM=$(seed_agent "$TSLA" "ipfs://momentum-alpha"  1500  5000 0); record VAULT_MOMENTUM "$V_MOM"
V_STD=$(seed_agent "$AMZN" "ipfs://steady-yield"      400  1000 1); record VAULT_STEADY   "$V_STD"
V_MRV=$(seed_agent "$PLTR" "ipfs://mean-reversion"   -800 -1000 2); record VAULT_MEANREV  "$V_MRV"

echo
echo "==> Done. Eligible weights (capital-allocation gate):"
echo "    Momentum (seed +50% -> score 100): $(read_call "$CONTROLLER" "eligibleWeight(address)(uint256)" "$V_MOM")"
echo "    Steady   (seed +10% -> score 60) : $(read_call "$CONTROLLER" "eligibleWeight(address)(uint256)" "$V_STD")"
echo "    MeanRev  (seed -10% -> score 40) : $(read_call "$CONTROLLER" "eligibleWeight(address)(uint256)" "$V_MRV")  (0 = correctly excluded)"
echo
echo "Anyone can now trigger a LIVE round on-chain: runner.runEpoch(vault) — one transaction."
echo "All addresses saved to: $OUT"

# Sync addresses into the frontend so the React app always points at the latest deploy.
FE_DIR="../frontend/src/web3"
if [ -d "$FE_DIR" ]; then
  cat > "$FE_DIR/deployed.json" <<EOF
{
  "USDG": "$USDG",
  "TSLA": "$TSLA",
  "AMZN": "$AMZN",
  "PLTR": "$PLTR",
  "DEX": "$DEX",
  "IdentityRegistry": "$IDENTITY",
  "ReputationRegistry": "$REPUTATION",
  "ValidationRegistry": "$VALIDATION",
  "VaultFactory": "$FACTORY",
  "AllocationController": "$CONTROLLER",
  "AgentRunner": "$RUNNER"
}
EOF
  echo "Frontend addresses synced -> $FE_DIR/deployed.json"
fi
