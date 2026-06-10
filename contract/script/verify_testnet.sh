#!/usr/bin/env bash
#
# verify_testnet.sh — publish & verify all deployed contracts on the Robinhood Chain
# Blockscout explorer, so judges see clean, readable source at every address.
#
# Usage (from contract/):
#   bash script/verify_testnet.sh
#
# Reads addresses from deployments.txt. No private key, no password — verification only needs
# the address, the source, and the constructor args (which we encode from on-chain/known values).
set -uo pipefail

RPC="https://rpc.testnet.chain.robinhood.com/rpc"
VERIFIER="blockscout"
VURL="https://explorer.testnet.chain.robinhood.com/api"

[ -f deployments.txt ] || { echo "deployments.txt not found — run the deploy first."; exit 1; }
# shellcheck disable=SC1091
source deployments.txt

STOCKS="[$TSLA,$AMZN,$PLTR]"
PASS=0; FAIL=0

# verify <address> <path:Name> <abiEncodedConstructorArgsHex|"">
verify() {
  local addr="$1" target="$2" args="${3:-}"
  echo "── verifying $target  $addr"
  local cmd=(forge verify-contract "$addr" "$target"
    --verifier "$VERIFIER" --verifier-url "$VURL" --rpc-url "$RPC" --watch)
  [ -n "$args" ] && cmd+=(--constructor-args "$args")
  if "${cmd[@]}"; then PASS=$((PASS+1)); else echo "  !! failed: $target"; FAIL=$((FAIL+1)); fi
  echo
}

enc() { cast abi-encode "$@"; }
call() { cast call "$@" --rpc-url "$RPC" | awk '{print $1}'; }

echo "==> Verifying tokens, DEX, registries, factory, controller…"
verify "$USDG" src/mocks/MockERC20.sol:MockERC20 "$(enc 'constructor(string,string,uint8)' 'Global Dollar' 'USDG' 6)"
verify "$TSLA" src/mocks/MockERC20.sol:MockERC20 "$(enc 'constructor(string,string,uint8)' 'Tesla' 'TSLA' 18)"
verify "$AMZN" src/mocks/MockERC20.sol:MockERC20 "$(enc 'constructor(string,string,uint8)' 'Amazon' 'AMZN' 18)"
verify "$PLTR" src/mocks/MockERC20.sol:MockERC20 "$(enc 'constructor(string,string,uint8)' 'Palantir' 'PLTR' 18)"
verify "$DEX" src/Market.sol:Market "$(enc 'constructor(address)' "$USDG")"
verify "$IDENTITY" src/IdentityRegistry.sol:IdentityRegistry ""
verify "$REPUTATION" src/ReputationRegistry.sol:ReputationRegistry "$(enc 'constructor(address)' "$IDENTITY")"
verify "$VALIDATION" src/ValidationRegistry.sol:ValidationRegistry "$(enc 'constructor(address)' "$IDENTITY")"
verify "$FACTORY" src/VaultFactory.sol:VaultFactory \
  "$(enc 'constructor(address,address,address,address,address[])' "$USDG" "$IDENTITY" "$VALIDATION" "$DEX" "$STOCKS")"
verify "$CONTROLLER" src/AllocationController.sol:AllocationController \
  "$(enc 'constructor(address,address,address,uint8,uint64)' "$USDG" "$FACTORY" "$VALIDATION" 50 1)"
verify "$RUNNER" src/AgentRunner.sol:AgentRunner "$(enc 'constructor(address,address)' "$DEX" "$USDG")"

echo "==> Verifying the 3 agent vaults (constructor args read from chain)…"
for V in "$VAULT_MOMENTUM" "$VAULT_STEADY" "$VAULT_MEANREV"; do
  AID=$(call "$V" 'agentId()(uint256)')
  TRADER=$(call "$V" 'trader()(address)')
  verify "$V" src/StrategyVault.sol:StrategyVault \
    "$(enc 'constructor(address,address,address,address,uint256,address,address[])' \
        "$USDG" "$IDENTITY" "$VALIDATION" "$DEX" "$AID" "$TRADER" "$STOCKS")"
done

echo "================================================"
echo "Verified: $PASS   Failed: $FAIL"
echo "Explorer: https://explorer.testnet.chain.robinhood.com/address/$FACTORY"
[ "$FAIL" -eq 0 ]
