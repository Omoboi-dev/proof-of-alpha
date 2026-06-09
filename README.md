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
| **VaultFactory** (trust anchor) | [`0x5c75900dF72cF0276afe75883a0A1221F391b38C`](https://explorer.testnet.chain.robinhood.com/address/0x5c75900dF72cF0276afe75883a0A1221F391b38C) |
| **AllocationController** (capital router) | [`0x5606D102eAe1308ac86e76496E5686449f17e654`](https://explorer.testnet.chain.robinhood.com/address/0x5606D102eAe1308ac86e76496E5686449f17e654) |
| **ValidationRegistry** (the scoreboard) | [`0xD61C614Fb6C7e3BCBB1e0d874739b37E427ACe41`](https://explorer.testnet.chain.robinhood.com/address/0xD61C614Fb6C7e3BCBB1e0d874739b37E427ACe41) |
| IdentityRegistry | [`0xa4974dbA20AA282FBFFfFc2AE45a216da8304d6b`](https://explorer.testnet.chain.robinhood.com/address/0xa4974dbA20AA282FBFFfFc2AE45a216da8304d6b) |
| ReputationRegistry | [`0x9E1E031a0653D806f1db4a3eD7E577c700507314`](https://explorer.testnet.chain.robinhood.com/address/0x9E1E031a0653D806f1db4a3eD7E577c700507314) |
| AgentRunner (live rounds) | [`0x70cBF8040b6A1802960F0A02Bb6751E4C317255c`](https://explorer.testnet.chain.robinhood.com/address/0x70cBF8040b6A1802960F0A02Bb6751E4C317255c) |
| USDG (demo dollar, 6‑dec) | [`0x9DBcDDe666790897f9fD72621E7Bb18B551118a2`](https://explorer.testnet.chain.robinhood.com/address/0x9DBcDDe666790897f9fD72621E7Bb18B551118a2) |
| MockDEX | [`0x46820853221463E7E1005cF9480fd2949a2d9927`](https://explorer.testnet.chain.robinhood.com/address/0x46820853221463E7E1005cF9480fd2949a2d9927) |

**Demo agents** (each a non‑custodial vault, seeded with real on‑chain trades):

| Agent | Vault | Result | Status |
| --- | --- | --- | --- |
| Momentum Alpha | [`0x44C8…4954`](https://explorer.testnet.chain.robinhood.com/address/0x44C814d949649B0e994DD01b384016C7307a4954) | strong returns | ✅ Eligible |
| Steady Yield | [`0xe968…2D1d`](https://explorer.testnet.chain.robinhood.com/address/0xe968a34066490F7f6FB2285EA093Ae78cBF52D1d) | modest returns | ✅ Eligible |
| Mean Reversion | [`0x1a86…eb2c`](https://explorer.testnet.chain.robinhood.com/address/0x1a8687e3540468a21ab3d4A7d7973ccffDD4eb2C) | underperforming | ⛔ Excluded |

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
bash script/deploy_testnet.sh deployer        # deploys everything + seeds 3 agents
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

## ⚖️ What's real vs. simulated (full transparency)

- ✅ **Real & on‑chain:** the vaults, the swaps, the donation‑proof accounting, the 0–100 scoring, the official‑vault trust filter, and the score‑weighted capital routing.
- ⚠️ **Simulated for the testnet demo:** the **market price**. There's no live market for tokenized equities on testnet, so the `MockDEX` price is set by the `AgentRunner` (a pseudo‑random move around each agent's skill bias). In production, the MockDEX is swapped for a real DEX or price oracle — **nothing else in the design changes.**

The innovation is the **trustless proof‑of‑performance and allocation layer**, which is fully real.

---

## 🧭 Roadmap

- Real DEX / oracle integration (drop‑in replacement for MockDEX).
- Emergency timeout‑gated liquidation so an abandoned agent can never lock depositor funds (today's MVP discloses this epoch‑lock limitation honestly).
- Recency‑ and volume‑weighted scoring; richer risk analytics.
- Permissionless agent onboarding with staking.

---

## 📂 Repository layout

```
proof-of-alpha/
├── contract/                 # Foundry project
│   ├── src/                  # ERC-8004 registries, StrategyVault, VaultFactory,
│   │                         #   AllocationController, AgentRunner, mocks
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
