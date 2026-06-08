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

# ---- helpers -----------------------------------------------------------------------------
# create <Path:Name> [constructor-args...] -> echoes the deployed address
create() {
  local what="$1"; shift
  local addr
  addr=$(forge create "$what" --rpc-url "$RPC" --private-key "$PK" --broadcast --json "$@" \
          | jq -r '.deployedTo')
  [ -n "$addr" ] && [ "$addr" != "null" ] || { echo "  !! deploy failed: $what" >&2; exit 1; }
  echo "$addr"
}
send() { cast send "$@" --rpc-url "$RPC" --private-key "$PK" >/dev/null; }
# cast call annotates big numbers ("1e19 [1e19]"); keep only the raw first token.
read_call() { cast call "$@" --rpc-url "$RPC" | awk '{print $1}'; }

: > "$OUT"
record() { echo "$1=$2" | tee -a "$OUT"; }

echo "==> 1/4  Deploying base assets…"
USDG=$(create src/mocks/MockERC20.sol:MockERC20 --constructor-args "Global Dollar" "USDG" 6); record USDG "$USDG"
TSLA=$(create src/mocks/MockERC20.sol:MockERC20 --constructor-args "Tesla" "TSLA" 18);        record TSLA "$TSLA"
AMZN=$(create src/mocks/MockERC20.sol:MockERC20 --constructor-args "Amazon" "AMZN" 18);       record AMZN "$AMZN"
PLTR=$(create src/mocks/MockERC20.sol:MockERC20 --constructor-args "Palantir" "PLTR" 18);     record PLTR "$PLTR"

echo "==> 2/4  Deploying DEX + registries + factory + controller…"
DEX=$(create src/mocks/MockDEX.sol:MockDEX --constructor-args "$USDG");                       record DEX "$DEX"
IDENTITY=$(create src/IdentityRegistry.sol:IdentityRegistry);                                 record IDENTITY "$IDENTITY"
REPUTATION=$(create src/ReputationRegistry.sol:ReputationRegistry --constructor-args "$IDENTITY"); record REPUTATION "$REPUTATION"
VALIDATION=$(create src/ValidationRegistry.sol:ValidationRegistry --constructor-args "$IDENTITY"); record VALIDATION "$VALIDATION"
FACTORY=$(create src/VaultFactory.sol:VaultFactory \
  --constructor-args "$USDG" "$IDENTITY" "$VALIDATION" "$DEX" "[$TSLA,$AMZN,$PLTR]");          record FACTORY "$FACTORY"
CONTROLLER=$(create src/AllocationController.sol:AllocationController \
  --constructor-args "$USDG" "$FACTORY" "$VALIDATION" 50 1);                                   record CONTROLLER "$CONTROLLER"

echo "==> 3/4  Pricing + funding the DEX, minting seed capital…"
for T in "$TSLA" "$AMZN" "$PLTR"; do send "$DEX" "setPrice(address,uint256)" "$T" "$PRICE_BASE"; done
send "$USDG" "mint(address,uint256)" "$DEX" "$DEX_USDG_LIQ"
for T in "$TSLA" "$AMZN" "$PLTR"; do send "$T" "mint(address,uint256)" "$DEX" "$DEX_STOCK_LIQ"; done
send "$USDG" "mint(address,uint256)" "$SENDER" "$DEPLOYER_SEED"

# seed_agent <stock> <uri> <sellPrice> <idx> -> echoes vault address
seed_agent() {
  local STOCK="$1" URI="$2" SELL="$3" IDX="$4"
  send "$FACTORY" "launchAgent(string,address)" "$URI" "$SENDER"
  local VAULT; VAULT=$(read_call "$FACTORY" "allVaults(uint256)(address)" "$IDX")
  send "$USDG" "approve(address,uint256)" "$VAULT" "$FUND"
  send "$VAULT" "deposit(uint256)" "$FUND"
  send "$DEX" "setPrice(address,uint256)" "$STOCK" "$PRICE_BASE"
  send "$VAULT" "startEpoch(string)" "$URI"
  send "$VAULT" "trade(address,address,uint256,uint256)" "$USDG" "$STOCK" "$FUND" 0
  send "$DEX" "setPrice(address,uint256)" "$STOCK" "$SELL"
  local HELD; HELD=$(read_call "$VAULT" "accountedStock(address)(uint256)" "$STOCK")
  send "$VAULT" "trade(address,address,uint256,uint256)" "$STOCK" "$USDG" "$HELD" 0
  send "$VAULT" "settleEpoch(string,bytes32)" "$URI" "$(cast keccak "$URI")"
  echo "$VAULT"
}

echo "==> 4/4  Launching + seeding 3 demo agents (real epochs)…"
V_MOM=$(seed_agent "$TSLA" "ipfs://momentum-alpha"  150000000 0); record VAULT_MOMENTUM "$V_MOM"
V_STD=$(seed_agent "$AMZN" "ipfs://steady-yield"     110000000 1); record VAULT_STEADY   "$V_STD"
V_MRV=$(seed_agent "$PLTR" "ipfs://mean-reversion"    90000000 2); record VAULT_MEANREV  "$V_MRV"

echo
echo "==> Done. Eligible weights (capital-allocation gate):"
echo "    Momentum (+50% -> score 100): $(read_call "$CONTROLLER" "eligibleWeight(address)(uint256)" "$V_MOM")"
echo "    Steady   (+10% -> score 60) : $(read_call "$CONTROLLER" "eligibleWeight(address)(uint256)" "$V_STD")"
echo "    MeanRev  (-10% -> score 40) : $(read_call "$CONTROLLER" "eligibleWeight(address)(uint256)" "$V_MRV")  (0 = correctly excluded, below minScore 50)"
echo
echo "All addresses saved to: $OUT"
