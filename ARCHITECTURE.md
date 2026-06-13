# Proof of Alpha — technical notes

Proof of Alpha is an allocation layer for AI trading agents. Capital routes to the agents whose
performance is verifiable on-chain, because every trade flows through a vault that computes the
agent's realized P&L itself and publishes it as an ERC-8004 validation score. The best-proven
agents earn the capital. The point isn't to keep an agent inside the rules, it's to prove it's
actually any good.

- Chain: Robinhood Chain testnet (Arbitrum Orbit L2), chain id 46630
- Standard: ERC-8004 (Identity / Reputation / Validation)
- Language: Solidity 0.8.24, Foundry, OpenZeppelin
- Base asset: USDG (`0xBb7dDDc00Eab60fcE13EfeeceD7cAa52712B17A8`, 6 decimals), a mintable demo
  token deployed for the testnet
- Traded assets: tokenized stocks (TSLA, AMZN, PLTR, NFLX, AMD)

## 1. Problem and positioning

AI agents will manage tokenized-equity portfolios on chains like this one, and two problems are
still unsolved:

1. Can you trust what the agent did? An agent can claim any return. There's no trustless,
   standard, on-chain record of how it actually performed.
2. Where should capital go? Across many agents, money should flow to the ones with a proven edge,
   not the ones with the best marketing.

How this differs from nearby work:

- Pre-trade compliance and guardrail layers constrain an agent with allowlists, position caps,
  and kill switches. That's prevention. It keeps an agent in bounds but doesn't measure
  performance or allocate capital. Complementary, not the same thing.
- Enzyme and dHEDGE offer crypto vault policies, but there's no agent-performance standard, no
  allocation by proven skill, and they aren't RWA or agent native.
- Almanak and Velvet offer non-custodial agent vaults with leaderboards, but the performance
  number is platform-reported rather than a trustless, standards-based on-chain primitive.

The wedge here is to make agent performance a trustless, ERC-8004-standard primitive, and then
allocate capital by it.

## 2. Core design principle: score realized P&L only

The integrity claim rests on one decision: the vault scores only realized P&L from swaps it
actually executed, denominated in USDG. It never scores mark-to-market or unrealized value.

A realized round-trip (USDG to a stock and back to USDG) means the vault witnessed the exact USDG
that went out and came back. That number needs no price oracle and no trust, it's a fact the
contract recorded. Mark-to-market would need a trusted price feed and reintroduce the trust
problem the system exists to remove. Open positions are shown in the UI for context but never
affect the on-chain score. In production, valuing open positions would use a real RWA oracle; for
the trust story, realized-only is the airtight choice.

## 3. System architecture

```
                            ERC-8004 registries (canonical singletons)
        ┌───────────────────────────────────────────────────────────────────┐
        │  IdentityRegistry      ReputationRegistry      ValidationRegistry   │
        │  (ERC-721 agentId)     (client feedback)       (0-100 perf score)   │
        └───────▲───────────────────────────────────────────▲────────────────┘
                │ register(agent)                            │ validationResponse(score)
                │                                            │  (vault is the validator)
   ┌────────────┴───────────┐                   ┌────────────┴───────────────┐
   │   Agent owner / driver  │                   │       StrategyVault        │
   │  (AgentRunner today)    │── trade() ───────▶│  • holds USDG + stock toks │
   └─────────────────────────┘                   │  • trader-only trade()     │
                                                 │  • realized-PnL accounting │
   ┌─────────────────────────┐  deposit/withdraw │  • settleEpoch() → score   │
   │   Capital providers      │──USDG────────────▶│  • non-custodial           │
   └─────────────────────────┘                   └───────────┬────────────────┘
                │ deposit USDG into the index                │ swaps via
                ▼                                            ▼
   ┌─────────────────────────┐  reads scores     ┌────────────────────────────┐
   │   AllocationController   │◀─────────────────│          Market            │
   │  routes pooled capital   │  from Validation  │  oracle-priced swap venue  │
   │  to top-scored agents    │  Registry         │  (USDG <-> stocks)         │
   └─────────────────────────┘                   └────────────────────────────┘
```

## 4. Contracts

### 4.1 IdentityRegistry (ERC-8004 Identity)
ERC-721 where `tokenId == agentId`, built on OZ ERC-721 + URIStorage. Tracks an optional
`agentWallet` per agent (the operational signer, which may differ from the owner). Functions:
`register(agentURI, metadata)` / `register(agentURI)` / `register()` mint to the caller, plus
`setAgentURI`, `setAgentWallet`, `getAgentWallet`, and standard `ownerOf`. Events: `Registered`,
`URIUpdated`.

### 4.2 ReputationRegistry (ERC-8004 Reputation)
Links to the IdentityRegistry. Clients (for example a depositor) post scored feedback about an
agent via `giveFeedback(...)`, and `getSummary(...)` aggregates it. The owner, the operational
wallet, and any approved operator are blocked from rating their own agent. This is the secondary,
social signal; the primary score lives in Validation.

### 4.3 ValidationRegistry (ERC-8004 Validation), the trust anchor
`validationRequest(validator, agentId, requestURI, requestHash)` opens an epoch's validation, and
`validationResponse(requestHash, response, responseURI, responseHash, tag)` can be called only by
the named validator. `response` is in `[0,100]`. Each agent's registered validator is its own
StrategyVault, so only the vault can write a score and only the value its accounting computed.
Reads: `getValidationStatus`, `getSummary(agentId, validators, tag)`.

### 4.4 StrategyVault, the core
One vault per agent, deployed by the VaultFactory. It holds capital, executes the agent's trades,
computes realized P&L, and reports its own score to the ValidationRegistry.

State:
```solidity
IERC20  public immutable usdg;            // base asset (6 decimals)
uint256 public immutable agentId;         // ERC-8004 identity
address public immutable trader;          // the only key allowed to call trade()
IIdentityRegistry   public immutable identity;
IValidationRegistry public immutable validation;
IMarket public immutable dex;

mapping(address => uint256) public shares; // depositor => shares
uint256 public totalShares;
uint256 public totalManagedUSDG;           // accounted principal (donation-proof, not balanceOf)

address[] public stockTokens;              // whitelisted tradable tokens
mapping(address => bool) public isStock;

bool    public epochActive;
uint256 public epochId;
uint256 public epochStartUSDG;             // managed-USDG snapshot at epoch open
int256  public epochTradePnL;              // realized P&L from USDG trade legs this epoch
uint256 public tradableUSDG;               // ring-fenced USDG spendable this epoch
mapping(address => uint256) public accountedStock; // ring-fenced holdings per token
```

Core functions:

| Function | Caller | Effect |
|---|---|---|
| `deposit(amount)` | anyone, between epochs | pull USDG, mint shares priced off `totalManagedUSDG` |
| `withdraw(shareAmount)` | shareholder, between epochs | burn shares, return USDG pro-rata of accounted principal |
| `startEpoch(requestURI)` | trader or owner | snapshot start USDG, freeze flows, open the validation request |
| `trade(tokenIn, tokenOut, amountIn, minOut)` | trader only | swap via Market; ring-fenced; book USDG legs into `epochTradePnL` |
| `settleEpoch(responseURI, responseHash)` | trader or owner | require flat, map realized P&L to a score, write `validationResponse` |

Non-custodial guarantee: `trade()` only moves funds through the Market between whitelisted tokens.
There's no path for the trader key to send funds to itself. Only `withdraw()` moves value out, and
only to the proportional shareholder. The agent can trade your money, never take it.

Donation-proofing: scoring and share pricing read `totalManagedUSDG` and the accounted ledgers,
not `balanceOf`. The epoch can only spend `tradableUSDG`, and only `accountedStock` can be sold, so
tokens transferred straight into the vault are inert.

### 4.5 VaultFactory
`launchAgent(agentURI, trader)` does the whole setup in one transaction: registers the agent
(the factory is the momentary owner), deploys the StrategyVault, wires the vault as the agent's
operational wallet so it can open and answer its own validations, marks it in `isOfficialVault`,
and transfers the agent NFT to the caller. `isOfficialVault` is the trust anchor every consumer
filters on.

### 4.6 AllocationController
A pooled USDG index. `deposit`/`withdraw` mint and burn NAV-priced shares, where NAV is idle USDG
plus the value of deployed positions (using each vault's donation-proof `totalAssets`). `allocate`
(owner only) routes idle capital across a caller-supplied, strictly ascending list of candidate
vaults, weighted by score, skipping any that are unofficial, mid-epoch, below the minimum score,
or short of the minimum track record. `recall` (permissionless) pulls capital back from
between-epochs vaults. Eligibility weight comes from `ValidationRegistry.getSummary` filtered to
that one vault as validator.

### 4.7 Market and demo tokens
An oracle-priced swap venue: `setPrice(token, usdgPerToken)` (admin only) and
`swap(tokenIn, tokenOut, amountIn, minOut)`. The pricing interface is a drop-in for a production
DEX or price oracle. The stock tokens and USDG are mintable demo ERC-20s (`MockERC20`) so the
testnet has liquidity and a faucet. No AMM curve is needed; the price is a controlled input.

### 4.8 AgentRunner
A convenience contract that runs a full epoch (open, buy, market move, sell, settle) in one
transaction, so the UI can trigger a live on-chain round with one click. For the demo it produces
each agent's move from a configured per-agent bias plus a pseudo-random draw, then drives the
Market price and the vault's trades. It must be each vault's `trader` and the Market owner.

## 5. The math

Realized P&L. During an epoch, every buy (USDG to a stock) subtracts the USDG spent and every sell
(stock to USDG) adds the USDG received, into `epochTradePnL`. Because the vault must be flat (all
stock sold back to USDG) before it can settle, `epochTradePnL` at settle equals the epoch's true
realized P&L. There's no per-lot cost-basis bookkeeping and no oracle, just the net of the USDG
legs the vault executed.

Epoch return, with deposits and withdrawals frozen during the epoch:
```
epochReturnBps = epochTradePnL * 10_000 / epochStartUSDG
```

Score, a monotonic clamped map centered at 50:
```
score = clamp( 50 + epochReturnBps / 100 , 0 , 100 )
// +50% (5000 bps) -> 100,  0% -> 50,  -50% -> 0
```
It's stored as the ERC-8004 `response` (uint8); `responseURI` and `responseHash` can point to the
full trade log for audit.

Allocation weight over eligible agents: `w_i = score_i / Σ score_j`, and capital in is
`w_i * amountToDeploy`.

## 6. Key flows

Launch an agent:
```
owner → VaultFactory.launchAgent(agentURI, trader)
        → registers the agent (ERC-721), deploys its StrategyVault,
          wires the vault as operator, marks it official, hands the NFT to owner
```

Capital in:
```
user → AllocationController.deposit(USDG)   → index shares
user → StrategyVault.deposit(USDG)          → vault shares (direct backing of one agent)
```

A trading round (today, via AgentRunner; the trader key can also do the steps directly):
```
AgentRunner.runEpoch(vault)
        → startEpoch  → buy (USDG→stock) → price move → sell (stock→USDG) → settleEpoch
```

Settle to a provable score:
```
StrategyVault.settleEpoch(...)
        → computes epochReturnBps → score
        → ValidationRegistry.validationResponse(hash, score, logURI, logHash, "realizedPnL")
        → emits ValidationResponse (the leaderboard updates from this event)
```

Allocate:
```
operator → AllocationController.allocate(candidates, amount)
        → reads getSummary for each candidate (filtered to that vault)
        → routes pooled USDG to eligible vaults by weight
```

## 7. Trust and threat model

| Concern | Mitigation |
|---|---|
| Agent steals funds | `trade()` has no self-transfer path; only `withdraw()` exits, pro-rata to shareholders. Non-custodial by construction. |
| Agent fakes returns | The score derives from realized USDG flows the vault executed, with no self-reported numbers and no oracle. |
| Compromised or misbehaving driver | The worst it can do is make bad trades, which show up as a low score. It can't exceed `trade()`'s powers. |
| Reentrancy | `nonReentrant` plus checks-effects-interactions on deposit, withdraw, trade, and settle. |
| Score spoofing | Only the vault is the registered validator for its agent, and `validationResponse` enforces caller == validator. Consumers additionally filter to official vaults. |
| Donation / inflation griefing | Scoring and pricing use internal accounting, not `balanceOf`, and trading is ring-fenced, so donated tokens are inert. |
| Wash-trading to pump a score | Realized P&L through a fair venue nets to roughly zero minus fees. The Market price is admin-gated on the testnet, documented as a demo-only simplification. |
| Epoch-flow gaming | Deposits and withdrawals are frozen during an epoch, giving a clean return denominator. |

Honest limitations: valuing open positions needs a real oracle in production; the Market venue is
an admin-priced stand-in for a real RWA market; while an epoch is open the vault is locked, so an
abandoned agent could leave capital stuck until it's settled (timeout-gated liquidation is
roadmap).

## 8. Off-chain components

- Driver. In the live demo, the agents are driven by `AgentRunner`, which seeds each round from a
  per-agent bias plus a pseudo-random market move. A real off-chain AI driver — a strategist model
  that reads prices and a risk check that vets the trade, calling `trade()` from the trader key —
  is intended future work. The `trade()` interface is the integration point, so swapping the
  seeded driver for a model changes nothing on-chain.
- Frontend. A Vite + React app using viem. It reads `ValidationResponse` and other events to build
  the leaderboard ranked by provable score, links each row to the explorer transaction that proves
  it, and provides the deposit/withdraw, allocate, and one-click Run interfaces.

## 9. Scope: what shipped vs the roadmap

Shipped for the buildathon: the three ERC-8004 registries, StrategyVault (deposit, withdraw,
trade, epoch lifecycle, realized-PnL scoring), VaultFactory, AllocationController, AgentRunner,
Market plus demo tokens, a 53-test Foundry suite, deployment and source verification on Robinhood
Chain, five seeded demo agents, and the React leaderboard and capital-index UI.

Roadmap: a real off-chain AI driver behind `trade()`; a production DEX or RWA oracle behind the
Market interface; drawdown- and recency-adjusted scoring; permissionless agent onboarding with
staking; and cross-chain reputation via ERC-8004 portability.

## 10. Network reference

- RPC `https://rpc.testnet.chain.robinhood.com/rpc`, chain id 46630, gas paid in ETH
- Explorer `https://explorer.testnet.chain.robinhood.com`
- Faucet `https://faucet.testnet.chain.robinhood.com`
- Deploy guide `https://docs.robinhood.com/chain/deploy-smart-contracts/`
