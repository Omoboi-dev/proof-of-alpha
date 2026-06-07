# Proof of Alpha — Technical Specification

> **The allocation layer for agent finance.** Capital routes to AI trading agents whose
> performance is **mathematically impossible to fake** — because every trade flows through
> a vault that computes the agent's *realized* P&L on-chain and publishes it as an ERC-8004
> validation score. The best-proven agents earn the capital.
>
> *It's not enough to keep an agent within the rules — you have to prove it's actually good.*

- **Chain:** Robinhood Chain testnet (Arbitrum Orbit L2) · chainId `46630`
- **Standard:** ERC-8004 (Trustless Agents — Identity / Reputation / Validation)
- **Language:** Solidity `0.8.24`, Foundry, OpenZeppelin
- **Base asset:** USDG (`0x7E955252E15c84f5768B83c41a71F9eba181802F`, **6 decimals**) · **Traded assets:** tokenized stocks (TSLA, AMZN, PLTR, NFLX, AMD)

---

## 1. Problem & positioning

AI agents will manage tokenized-equity portfolios on Robinhood Chain. Two unsolved problems:

1. **Can you trust what the agent did?** An agent can *claim* any return. There is no
   trustless, standard, on-chain record of how a given agent actually performed.
2. **Where should capital go?** Across many agents, capital should flow to the ones with a
   *proven* edge — not the ones with the best marketing.

**Prior art (acknowledged):**
- **Pre-trade compliance / guardrail layers** — *prevention*: constrain an agent with
  allowlists, position caps, and kill switches. Complementary, but they do **not** measure
  performance or allocate capital — they keep an agent in bounds, not prove it's any good.
- **Enzyme / dHEDGE** — crypto vault policies; no agent-performance standard, no allocation
  by proven skill, not RWA/agent-native.
- **Almanak / Velvet** — non-custodial agent vaults with leaderboards, but performance is
  platform-reported, not a trustless on-chain primitive, and not standards-based.

**Our wedge:** make agent performance a **trustless, ERC-8004-standard primitive**, then
**allocate capital by it.** Nobody in the buildathon (and no production system) does
trustless, standard, on-chain *proof-of-performance → allocation* on Robinhood Chain.

---

## 2. Core design principle — score *realized* P&L only

The integrity claim ("impossible to fake") rests on one decision:

> **We score only *realized* P&L from swaps the vault actually executed**, denominated in
> USDG. We never score mark-to-market/unrealized value.

Why this matters: a realized round-trip (USDG → TSLA → USDG) means the vault *witnessed* the
exact USDG that went out and came back. That number needs **no price oracle and no trust** —
it is a fact recorded by the contract. Mark-to-market would require a trusted price feed and
reintroduce the very trust problem we are eliminating. Unrealized positions are shown in the
UI for context but are clearly labelled and never affect the on-chain score.

*(In production, open-position valuation would use a real RWA oracle; for the trust story and
the hackathon, realized-only is the airtight choice.)*

---

## 3. System architecture

```
                            ERC-8004 REGISTRIES (our canonical singletons)
        ┌───────────────────────────────────────────────────────────────────┐
        │  IdentityRegistry      ReputationRegistry      ValidationRegistry   │
        │  (ERC-721 agentId)     (client feedback)       (0-100 perf score)   │
        └───────▲───────────────────────────────────────────▲────────────────┘
                │ register(agent)                            │ validationResponse(score)
                │                                            │  (vault is the validator)
   ┌────────────┴───────────┐                   ┌────────────┴───────────────┐
   │   Agent owner / AI      │                   │       StrategyVault        │
   │  (off-chain LLM crew)   │── trade() ───────▶│  • holds USDG + stock toks │
   └─────────────────────────┘                   │  • agent-only trade()      │
                                                 │  • realized-PnL accounting │
   ┌─────────────────────────┐  deposit/withdraw │  • settleEpoch()→score     │
   │   Capital providers      │──USDG────────────▶│  • non-custodial           │
   └─────────────────────────┘                   └───────────┬────────────────┘
                │ deposit USDG into the index                │ swaps via
                ▼                                            ▼
   ┌─────────────────────────┐  reads scores     ┌────────────────────────────┐
   │   AllocationController   │◀─────────────────│          MockDEX           │
   │  routes pooled capital   │  from Validation  │  settable prices (demo:    │
   │  to top-scored agents    │  Registry         │  trigger a live crash)     │
   └─────────────────────────┘                   └────────────────────────────┘
```

---

## 4. Contracts

### 4.1 `IdentityRegistry.sol` (ERC-8004 Identity)
- **Basis:** ERC-721; `tokenId == agentId`. Minimal OZ ERC-721 + URIStorage.
- **State:** `mapping(uint256 => address) agentWallet` (operational signer, may ≠ owner).
- **Functions:** `register(agentURI, metadata)` / `register(agentURI)` / `register()` →
  mints to caller; `setAgentURI`; `getAgentWallet`; standard `ownerOf`.
- **Events:** `Registered`, `URIUpdated`.

### 4.2 `ReputationRegistry.sol` (ERC-8004 Reputation)
- Links to IdentityRegistry. Clients post scored feedback (e.g. a depositor rating an agent).
- **Functions:** `giveFeedback(agentId, value, valueDecimals, tag1, tag2, endpoint, feedbackURI, feedbackHash)`,
  `getSummary(agentId, clients, tag1, tag2)`. Submitter must not be the agent owner/operator.
- **MVP role:** secondary signal (human/depositor feedback). The *primary* score is Validation.

### 4.3 `ValidationRegistry.sol` (ERC-8004 Validation) — the trust anchor
- **Functions:** `validationRequest(validator, agentId, requestURI, requestHash)` (agent
  owner opens an epoch validation), `validationResponse(requestHash, response, responseURI,
  responseHash, tag)` (callable **only** by the named validator → our vault), plus
  `getValidationStatus`, `getSummary(agentId, validators, tag)`.
- `response ∈ [0,100]`. The vault is the registered `validator` for its agent → only the
  vault can write a score, and it can only write what its own accounting computed.

### 4.4 `StrategyVault.sol` — **the star**
One vault instance per agent (deployed by `VaultFactory`). Holds capital, executes the
agent's trades, computes realized P&L, and self-reports the score to ValidationRegistry.

**State**
```solidity
IERC20  public immutable usdg;            // base asset
uint256 public immutable agentId;         // ERC-8004 identity
address public immutable agentWallet;     // the only address allowed to trade()
IIdentityRegistry  public immutable identity;
IValidationRegistry public immutable validation;
IMockDEX public immutable dex;

mapping(address => uint256) public shares; // depositor → vault shares
uint256 public totalShares;

// epoch accounting (realized-only)
uint256 public epochId;
uint256 public epochStartUSDG;     // realized USDG basis at epoch open
int256  public epochRealizedPnL;   // running realized P&L this epoch (USDG)
uint256 public allowedAssets;      // bitmap/set of tradable stock tokens
```

**Core functions**
| Function | Caller | Effect |
|---|---|---|
| `deposit(amount)` | anyone | pull USDG, mint shares; allowed **between** epochs only |
| `withdraw(shares)` | shareholder | burn shares, return USDG pro-rata; between epochs only |
| `trade(tokenIn, tokenOut, amountIn, minOut)` | **agentWallet only** | swap via DEX; if a USDG-out leg, book realized P&L into `epochRealizedPnL` |
| `settleEpoch()` | anyone/keeper | compute epoch return from realized P&L, map to `score∈[0,100]`, call `validation.validationResponse(...)`, roll to next epoch |

**Non-custodial guarantee:** `trade()` can only move funds *through the DEX* between
whitelisted tokens; there is **no path** for `agentWallet` to transfer funds to itself. Only
`withdraw()` moves value out, and only to the proportional shareholder. The agent can trade
your money; it can never take it.

### 4.5 `AllocationController.sol`
- A pooled "index" users deposit USDG into.
- Each epoch, reads agent scores via `ValidationRegistry.getSummary` and computes target
  weights `w_i = score_i / Σ score_j` over eligible agents (score ≥ threshold, min track
  record length).
- Routes capital toward target weights by depositing into the top agents' `StrategyVault`s.
- **MVP simplification:** weight *new* inflows by score (no forced rebalancing of existing
  positions). Full continuous rebalancing is post-hackathon. *(See open question Q3.)*

### 4.6 `MockDEX.sol` + mock/faucet tokens
- Constant-price (admin-settable) swap venue: `setPrice(token, usdgPerToken)`,
  `swap(tokenIn, tokenOut, amountIn, minOut)`. Lets us trigger a deterministic crash on
  stage. Uses real Robinhood faucet stock tokens where available; otherwise simple ERC-20
  mocks. (No AMM curve needed for the demo; price is a controlled input.)

---

## 5. The math

**Realized P&L (per trade with a USDG-out leg).** When the vault sells a stock token back to
USDG, the realized gain on that lot is `usdgReceived − usdgCostOfLotSold` (cost basis tracked
per token via weighted-average). `epochRealizedPnL += gain`.

**Epoch return.** With deposits/withdrawals frozen during an epoch:
```
epochReturnBps = epochRealizedPnL * 10_000 / epochStartUSDG
```

**Score mapping `[return] → [0,100]`.** A monotonic, clamped map centered at 50:
```
score = clamp( 50 + epochReturnBps / SCALE , 0 , 100 )
// e.g. SCALE = 100  ⇒ +50% (5000bps) → 100,  0% → 50,  −50% → 0
```
Stored as the ERC-8004 `response` (uint8). `responseURI`/`responseHash` point to the full
trade log for audit. *(Optional v2: subtract a drawdown penalty term.)*

**Allocation weight.** Over eligible agents: `w_i = score_i / Σ score_j`. Capital in =
`w_i · poolInflow`.

---

## 6. Key flows (sequence)

**A. Register & open epoch**
```
agentOwner → IdentityRegistry.register()            → agentId (ERC-721)
agentOwner → VaultFactory.createVault(agentId)      → StrategyVault
agentOwner → ValidationRegistry.validationRequest(vault, agentId, epochURI, hash)
```

**B. Capital in**
```
user → StrategyVault.deposit(USDG)                  → shares minted
```

**C. Trade cycle (repeats, off-chain AI drives it)**
```
AI(Strategist+Risk) → reads prices → decides
agentWallet → StrategyVault.trade(USDG, TSLA, ...)  → buy
agentWallet → StrategyVault.trade(TSLA, USDG, ...)  → sell → books realized P&L
```

**D. Settle → provable score (the money shot)**
```
keeper → StrategyVault.settleEpoch()
        → computes epochReturnBps → score
        → ValidationRegistry.validationResponse(hash, score, logURI, logHash, "realizedPnL")
        → emits ValidationResponse  (leaderboard updates from this event)
```

**E. Allocate**
```
AllocationController.rebalance()
        → reads getSummary(agentId) for each agent
        → routes pooled USDG to top-scored vaults by weight
```

---

## 7. Trust & threat model

| Concern | Mitigation |
|---|---|
| Agent steals funds | `trade()` has no self-transfer path; only `withdraw()` exits, pro-rata to shareholders. Non-custodial by construction. |
| Agent fakes returns | Score derives from **realized** USDG flows the vault executed; no self-reported numbers, no oracle. |
| Prompt-injection / compromised AI | Worst case the AI makes *bad trades* (reflected in a low score) — it cannot exceed `trade()`'s powers. (Optional: bolt on pre-trade risk caps later.) |
| Reentrancy | `nonReentrant` + Checks-Effects-Interactions on deposit/withdraw/trade/settle. |
| Score spoofing | Only the vault is the registered `validator` for its agentId; `validationResponse` enforces caller == validator. |
| Wash-trading to pump score | Realized P&L through a fair DEX nets ~0 minus fees; can't manufacture gains. (MockDEX fee + price control documented as a demo-only simplification.) |
| Epoch flow gaming | Deposits/withdrawals frozen during an epoch → clean return denominator. |

**Honest limitations (state them in the pitch):** open-position valuation needs a real oracle
in production; MockDEX is a controlled stand-in for a real RWA market; allocation MVP weights
inflows rather than continuously rebalancing.

---

## 8. Off-chain components
- **AI agent (per vault):** a two-role crew — *Strategist* (reads prices, forms targets) and
  *Risk Officer* (vets the proposed trade) — calling `trade()` from `agentWallet`. Uses Claude
  (Anthropic API) for reasoning. 3+ demo agents with different strategies to populate the board.
- **Indexer/Frontend:** Vite + React. Reads `ValidationResponse` events → leaderboard ranked by
  provable score; each row links to the Blockscout tx that proves it. Vault deposit/withdraw UI.

---

## 9. Scope — MVP vs vision

**MVP (hackathon, must-ship):** 3 ERC-8004 registries · `StrategyVault` (deposit/withdraw/
trade/settle, realized-PnL) · `VaultFactory` · `MockDEX` + tokens · full Foundry test suite ·
deploy+verify on Robinhood Chain · 3 demo agents · React leaderboard + one-vault deposit UI ·
demo video showing a live crash → divergent scores → leaderboard reorders on-chain.

**Vision (pitch as roadmap):** continuous score-weighted allocation; real RWA price oracle;
drawdown-adjusted scoring; permissionless agent onboarding; compose with a pre-trade
guardrail layer for the full "constrained **and** proven" stack; cross-chain reputation via
ERC-8004 portability.

---

## 10. Open design decisions
- **Q1 — Vault topology:** one `StrategyVault` per agent via `VaultFactory` *(recommended,
  clean isolation)* vs a single multi-tenant vault *(fewer deploys, more complex accounting)*.
- **Q2 — Base asset:** ✅ canonical USDG `0x7E955252E15c84f5768B83c41a71F9eba181802F` (6 dec)
  confirmed on chain 46630 → use on-chain; 6-decimal `MockUSDG` for local tests.
- **Q3 — Allocation depth for MVP:** ✅ score-weighted **inflows only**.
- **Q4 — Score formula:** ✅ linear `SCALE` map (drawdown penalty deferred to v2).
- **Q5 — Repo/folder rename:** ✅ renamed to `proof-of-alpha/`.

*(Q1 ✅ per-agent vaults via `VaultFactory`.)*

## 11. Network reference
- RPC `https://rpc.testnet.chain.robinhood.com/rpc` · chainId `46630` · gas = ETH
- Explorer `https://explorer.testnet.chain.robinhood.com` · Faucet `https://faucet.testnet.chain.robinhood.com`
- Deploy guide: `https://docs.robinhood.com/chain/deploy-smart-contracts/`
