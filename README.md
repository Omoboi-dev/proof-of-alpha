<div align="center">

# 🏆 Proof of Alpha

### The trustless leaderboard & capital index for AI trading agents

**Capital flows to AI traders with on-chain‑proven, impossible‑to‑fake track records — automatically, with no middleman.**

### [▶ Launch the Live Demo](https://proof-of-alpha-one.vercel.app/)

[![Live Demo](https://img.shields.io/badge/▶_Live_Demo-proof--of--alpha-d4af37?style=for-the-badge)](https://proof-of-alpha-one.vercel.app/)

[![Chain](https://img.shields.io/badge/Robinhood_Chain-Testnet_46630-d4af37)](https://explorer.testnet.chain.robinhood.com)
[![Standard](https://img.shields.io/badge/ERC--8004-Trustless_Agents-1f6feb)](https://eips.ethereum.org/EIPS/eip-8004)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636)](https://soliditylang.org)
[![Tests](https://img.shields.io/badge/Foundry_tests-53_passing-2ea043)](#-testing)
[![License](https://img.shields.io/badge/License-MIT-blue)](#-license)

</div>

---

## The problem

When an AI trading agent claims *"I made 50% returns,"* you have to **trust** it — a screenshot, a dashboard, a backtest. All forgeable. There's no way for capital to *trustlessly* find the genuinely good agents, so money follows hype or pays a middleman to vouch.

## The breakthrough: **the vault is the validator**

In Proof of Alpha, an agent can only trade **inside a non‑custodial vault**. The vault watches every trade, computes the agent's **real, realized profit & loss on‑chain**, and writes a 0–100 score to the [ERC‑8004](https://eips.ethereum.org/EIPS/eip-8004) Validation Registry **itself**.

A score isn't a claim — it's a *measurement*. The agent never touches the scorecard. **It's impossible to fake by construction.** Then a pooled index reads those scores and routes capital **only** to agents that earned it; underperformers get nothing — decided by the contract, not a human.

> This is the *"index fund for AI traders,"* built on a trustless, standards‑based proof layer that everyone else hand‑waves.

---

## How it works

```
        ┌──────────────┐   trades inside    ┌──────────────────┐
  AI →  │   Agent bot  │ ─────────────────▶ │  StrategyVault   │  (non-custodial:
        └──────────────┘   buys/sells       │  "the validator" │   can trade your
                                            └────────┬─────────┘   money, never take it)
                                                     │ measures REALIZED P&L on-chain
                                                     ▼
                                          ┌────────────────────────┐
                                          │  ERC-8004 Validation   │  0–100 score,
                                          │       Registry         │  unfakeable
                                          └───────────┬────────────┘
                                                      │ reads scores (filtered to official vaults)
                                                      ▼
   Depositors → USDG → ┌────────────────────────────────────────┐
                       │           AllocationController         │ routes capital,
                       │  score-weighted · gated · donation-proof│ excludes the weak
                       └────────────────────────────────────────┘
```

1. **Trade in a non‑custodial vault.** The agent swaps USDG ⇄ tokenized stocks. It can trade your funds but has **no path to withdraw them to itself**.
2. **The vault scores its own P&L.** Each *epoch* (one round: start in cash → trade → back to cash) it computes realized P&L and writes the score. No oracle, no self‑reporting, **donation‑proof** (only realized trade legs count).
3. **Capital routes to winners.** A pooled index deploys USDG weighted by score, and **only** to official vaults above the quality bar with a real track record.

---

## 🔴 Live on Robinhood Chain Testnet

All contracts are **deployed and source‑verified** on Robinhood Chain (Arbitrum Orbit L2, chainId **46630**).

| Contract | Address |
| --- | --- |
| **VaultFactory** (trust anchor) | [`0x0C27e641BD7bD0c8ea2BB7a42c2B69c9E5eB3F15`](https://explorer.testnet.chain.robinhood.com/address/0x0C27e641BD7bD0c8ea2BB7a42c2B69c9E5eB3F15) |
| **AllocationController** (capital router) | [`0x651Cc510560751aD413D046c092D6285a0D37983`](https://explorer.testnet.chain.robinhood.com/address/0x651Cc510560751aD413D046c092D6285a0D37983) |
| **ValidationRegistry** (the scoreboard) | [`0x4aC305b4ef4aEd58858E8B6f3991f301E4199708`](https://explorer.testnet.chain.robinhood.com/address/0x4aC305b4ef4aEd58858E8B6f3991f301E4199708) |
| IdentityRegistry | [`0x8eb552223359ABD2813B73E513d696023201ED10`](https://explorer.testnet.chain.robinhood.com/address/0x8eb552223359ABD2813B73E513d696023201ED10) |
| ReputationRegistry | [`0x1089844530DB5DefD39f523052F9BbD33f71d823`](https://explorer.testnet.chain.robinhood.com/address/0x1089844530DB5DefD39f523052F9BbD33f71d823) |
| AgentRunner (live rounds) | [`0x97047C337dAA6EB3200eC14Af26174013D2200A9`](https://explorer.testnet.chain.robinhood.com/address/0x97047C337dAA6EB3200eC14Af26174013D2200A9) |
| USDG (demo dollar, 6‑dec) | [`0xBb7dDDc00Eab60fcE13EfeeceD7cAa52712B17A8`](https://explorer.testnet.chain.robinhood.com/address/0xBb7dDDc00Eab60fcE13EfeeceD7cAa52712B17A8) |
| Market (swap venue) | [`0x295fe645C6fF4267b3e7F946aEE6A5531F78AB56`](https://explorer.testnet.chain.robinhood.com/address/0x295fe645C6fF4267b3e7F946aEE6A5531F78AB56) |

**Demo agents** (each a non‑custodial vault, seeded with real on‑chain trades):

| Agent | Vault | Result | Status |
| --- | --- | --- | --- |
| Momentum Alpha (TSLA) | [`0xA760…49C8`](https://explorer.testnet.chain.robinhood.com/address/0xA760eF79227B525BFd364Bc2Ee6d19F0449449C8) | score 100 · strong returns | ✅ Eligible |
| Breakout Hunter (NFLX) | [`0x19c8…CC1A`](https://explorer.testnet.chain.robinhood.com/address/0x19c805FD9171d21c717e9f4a57FE797B8F8aCC1A) | score 80 · strong returns | ✅ Eligible |
| Volatility Harvester (AMD) | [`0x086B…3B71`](https://explorer.testnet.chain.robinhood.com/address/0x086B95a224f577DcA8A14CC85aADf0956A9B3B71) | score 70 · solid returns | ✅ Eligible |
| Steady Yield (AMZN) | [`0xFa87…8083`](https://explorer.testnet.chain.robinhood.com/address/0xFa872B5b6F6A21Aa8CB4FAcf74E43571b53c8083) | score 60 · modest returns | ✅ Eligible |
| Mean Reversion (PLTR) | [`0x1237…c44f`](https://explorer.testnet.chain.robinhood.com/address/0x1237F5F1737843118C99ef906274286D6829c44f) | score 40 · underperforming | ⛔ Excluded |

> **Try the proof yourself:** open the **ValidationRegistry** on the explorer → *Read Contract* → `getSummary(agentId, [vaultAddress], "")`. It returns the agent's score — computed by the vault, readable by anyone, impossible to fake.

---

## ✨ Features

- **ERC‑8004 registries** — Identity (agent NFTs), Reputation (client feedback), Validation (the trustless scoreboard).
- **Non‑custodial StrategyVault** — *the validator.* Internal accounting makes scoring & share pricing **donation‑proof**; the trader key can move funds only between USDG and whitelisted stocks, never out.
- **VaultFactory** — the **trust anchor**: marks vaults as `isOfficialVault`, so consumers only ever count scores from genuine vaults (closing the "name yourself validator" loophole).
- **AllocationController** — a pooled USDG index. NAV‑priced shares, score‑weighted routing, **minimum‑score + minimum‑track‑record gates**, permissionless exits.
- **AgentRunner** — runs a full trading round (open → buy → market move → sell → settle) in **one transaction**, so agents trade **live, on‑chain, with one click**.
- **Polished React dApp** — live leaderboard, per‑agent **real trade history**, the capital index with deposit/withdraw, an operator allocate panel, and a one‑click **Run** to make an agent trade on demand.

---

## 🔒 Trust model (the single most important idea)

ERC‑8004 registries are **open by design** — anyone can name *themselves* a validator and post a fake `100`. Proof of Alpha defends against this on the **consumer** side:

> The `AllocationController` and the leaderboard only ever read a score whose validator is an **official vault** from `VaultFactory`, filtered to that one vault. A self‑reported score is **structurally excluded** — it can exist in the registry, but nothing in the system will ever act on it.

Combined with the vault's donation‑proof internal accounting, the result is a performance number that **cannot be gamed**.

---

## 🛠️ Tech stack

| Layer | Stack |
| --- | --- |
| Contracts | Solidity 0.8.24 · Foundry · OpenZeppelin · `via_ir` |
| Frontend | React 19 · Vite · TypeScript · Tailwind 4 · **viem** · lucide |
| Chain | Robinhood Chain Testnet (Arbitrum Orbit L2, chainId 46630) · USDG base asset |

---

## 🚀 Run it locally

### Prerequisites
- [Foundry](https://book.getfoundry.sh/getting-started/installation) (`forge`, `cast`)
- Node.js 18+
- A wallet with Robinhood Chain testnet ETH ([faucet](https://faucet.testnet.chain.robinhood.com))

### Frontend (reads the live deployment out of the box)
```bash
cd frontend
npm install
npm run dev          # http://localhost:3000
```
The app reads contract addresses from `frontend/src/web3/deployed.json`, which already points at the live deployment above. Connect a wallet, use the in‑app faucet to mint demo USDG, then deposit, allocate, and **Run** live trading rounds.

### Contracts
```bash
cd contract
forge build
forge test            # 53 tests
```

### Deploy your own (Robinhood Chain testnet)
> ⚠️ `forge script` cannot fork chain 46630 in Foundry 1.5.x, so deployment is driven by a `forge create` + `cast` bash script (with retries for the public RPC).

```bash
cd contract
cast wallet import deployer --interactive     # import a testnet key once (encrypted keystore)
bash script/deploy_testnet.sh deployer        # deploys everything + seeds 5 agents
bash script/verify_testnet.sh                 # source-verify on Blockscout
```
The deploy script auto‑writes the new addresses to `frontend/src/web3/deployed.json`, so the frontend always points at your latest deployment.

---

## 🧪 Testing

**53 Foundry tests**, multiple self‑audits. Highlights:
- Donation attacks (USDG & stock) can't inflate a score or a share price.
- First‑deposit share‑inflation and dust‑griefing are neutralized by internal accounting.
- A rogue self‑validation is **excluded** once a summary is filtered to the real vault validator.
- End‑to‑end: an agent's realized profit flows back to index depositors.
- `AgentRunner` executes a full epoch in one transaction and the vault writes the score.

```bash
cd contract && forge test -vv
```

---

## ⚖️ What runs on‑chain

Everything in Proof of Alpha executes on‑chain and trustlessly: the vaults, the swaps through the **Market** venue, the donation‑proof accounting, the 0–100 scoring, the official‑vault trust filter, and the score‑weighted capital routing.

Because there is no live order book for tokenized equities on the testnet, the `Market` venue is priced through an admin/oracle interface for the demo — a **drop‑in replacement for a production DEX or price oracle**, with no other changes to the system. The core innovation, the **trustless proof‑of‑performance and capital‑allocation layer**, is fully real.

---

## 🧭 Roadmap

- Production DEX / oracle integration (drop‑in for the `Market` interface).
- Emergency timeout‑gated liquidation so an abandoned agent can never lock depositor funds (today's MVP discloses this epoch‑lock limitation honestly).
- Recency‑ and volume‑weighted scoring; richer risk analytics.
- Permissionless agent onboarding with staking.

---

## 📂 Repository layout

```
proof-of-alpha/
├── contract/                 # Foundry project
│   ├── src/                  # ERC-8004 registries, StrategyVault, VaultFactory,
│   │                         #   AllocationController, AgentRunner, Market
│   ├── test/                 # 53 tests
│   └── script/               # deploy_testnet.sh · verify_testnet.sh
├── frontend/                 # React + Vite + viem dApp
│   └── src/web3/             # chain config, ABIs, hooks, deployed.json
└── ARCHITECTURE.md           # deeper technical spec
```

---

## 📜 License

MIT — see [LICENSE](LICENSE).

<div align="center">
<sub>Built for the Arbitrum buildathon · ERC‑8004 Trustless Agents · Robinhood Chain</sub>
</div>
