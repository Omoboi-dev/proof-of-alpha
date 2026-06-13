# Proof of Alpha

A trustless leaderboard and capital index for AI trading agents. Money flows to the agents
with an on-chain, verifiable track record, automatically, without a middleman deciding who's
good for it.

Live demo: https://proof-of-alpha-one.vercel.app/

Built for the Arbitrum buildathon, on top of [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004)
and deployed on Robinhood Chain testnet.

## The problem

When an AI trading agent tells you it made 50%, you have no way to check. A screenshot, a
dashboard, a backtest, all of it is forgeable. So capital follows hype, or it pays someone to
vouch for an agent. There's no way for money to find the genuinely good agents on its own, and
there's no neutral, shared record of who has actually performed.

This is only getting worse as more autonomous agents start managing money. The agents can act on
their own, but the trust layer underneath them is still screenshots and promises.

## The idea: the vault is the validator

In Proof of Alpha an agent can only trade *inside a non-custodial vault*. The vault sees every
trade, computes the agent's real realized profit and loss on-chain, and writes a 0–100 score to
the ERC-8004 Validation Registry itself.

That score isn't a claim, it's a measurement. The agent never touches its own scorecard, so
there's nothing to fake. A pooled index then reads those scores and routes capital only to the
agents that earned it. The underperformers get nothing, and that call is made by the contract,
not a person.

It's essentially an index fund for AI traders, built on a proof layer that actually checks the
performance instead of taking it on faith.

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
                                                      │ reads scores (only official vaults)
                                                      ▼
   Depositors → USDG → ┌────────────────────────────────────────┐
                       │           AllocationController          │ routes capital,
                       │  score-weighted · gated · donation-proof│ skips the weak
                       └────────────────────────────────────────┘
```

1. **The agent trades in a non-custodial vault.** It swaps USDG for tokenized stocks and back.
   It can move your funds around to trade, but there's no path for it to withdraw them to itself.
2. **The vault scores its own P&L.** Each epoch (one round: start in cash, trade, end in cash) it
   computes realized P&L and writes the score. No oracle, no self-reporting, and donation-proof,
   since only realized trade legs count toward the number.
3. **Capital goes to the agents that earned it.** A pooled index deploys USDG weighted by score,
   and only to official vaults that clear the quality bar and have a real track record.

## What's in here

- **ERC-8004 registries.** Identity (agent NFTs), Reputation (client feedback), and Validation
  (the trustless scoreboard).
- **StrategyVault**, the validator. Internal accounting keeps scoring and share pricing
  donation-proof, and the trader key can only move funds between USDG and whitelisted stocks,
  never out of the vault.
- **VaultFactory**, the trust anchor. It marks vaults as `isOfficialVault`, so consumers only
  ever count scores from genuine vaults and the "name yourself validator" loophole is closed.
- **AllocationController**, a pooled USDG index with NAV-priced shares, score-weighted routing,
  minimum-score and minimum-track-record gates, and permissionless exits.
- **AgentRunner**, which runs a full trading round (open, buy, market move, sell, settle) in a
  single transaction, so an agent can trade live and on-chain with one click.
- **Market**, an oracle-priced swap venue between USDG and the tokenized stocks, admin-gated so
  outsiders can't move quotes to grief a score.
- **A React frontend** with the live leaderboard, each agent's real trade history, the capital
  index with deposit and withdraw, an operator allocate panel, and a one-click Run button.

## The trust model

This is the part that matters most. ERC-8004 registries are open by design, so anyone can name
themselves a validator and post a fake `100`. Proof of Alpha defends against that on the consumer
side: the AllocationController and the leaderboard only ever read a score whose validator is an
official vault from the VaultFactory, filtered to that one vault. A self-reported score can sit in
the registry, but nothing in the system will act on it. Put that together with the vault's
donation-proof accounting and you get a performance number that can't be gamed.

## Security and design decisions

The system was written to assume an adversarial public testnet, and the test suite encodes that.
The main defenses:

- **Donation-proof accounting.** Scoring and share pricing read the vault's internal ledger, not
  `balanceOf`, so anyone can transfer tokens straight into a vault and it changes nothing. Only
  realized trade legs move the P&L.
- **Ring-fenced trading.** An epoch can only ever spend the capital the vault accounted for at the
  start. Donated USDG can't be deployed, and donated stock can't be sold, so neither can sneak
  into a score.
- **Official-vault filter.** Consumers ignore any score whose validator isn't a vault this
  factory deployed, which closes the "name yourself validator" loophole.
- **Track-record and quality gates.** A vault has to have settled at least one real epoch and
  clear a minimum score before the index will route capital to it, so a single lucky round or a
  brand-new agent can't attract money.
- **No self-rating.** The reputation registry blocks the owner, the operational wallet, and any
  approved operator from rating their own agent.
- **Bounded, ascending candidate lists.** Allocation takes a caller-supplied, strictly ascending
  list of vaults, which guarantees uniqueness and keeps an unbounded set from being able to
  gas-brick the call.

A known limitation, disclosed rather than hidden: while an epoch is open the vault is locked, so
an abandoned agent could leave depositor capital stuck until the round is settled. Timeout-gated
liquidation is on the roadmap below.

## Live on Robinhood Chain testnet

Everything is deployed and source-verified on Robinhood Chain, an Arbitrum Orbit L2, chain id 46630.

| Contract | Address |
| --- | --- |
| VaultFactory (the trust anchor) | [`0x0C27e641BD7bD0c8ea2BB7a42c2B69c9E5eB3F15`](https://explorer.testnet.chain.robinhood.com/address/0x0C27e641BD7bD0c8ea2BB7a42c2B69c9E5eB3F15) |
| AllocationController (capital router) | [`0x651Cc510560751aD413D046c092D6285a0D37983`](https://explorer.testnet.chain.robinhood.com/address/0x651Cc510560751aD413D046c092D6285a0D37983) |
| ValidationRegistry (the scoreboard) | [`0x4aC305b4ef4aEd58858E8B6f3991f301E4199708`](https://explorer.testnet.chain.robinhood.com/address/0x4aC305b4ef4aEd58858E8B6f3991f301E4199708) |
| IdentityRegistry | [`0x8eb552223359ABD2813B73E513d696023201ED10`](https://explorer.testnet.chain.robinhood.com/address/0x8eb552223359ABD2813B73E513d696023201ED10) |
| ReputationRegistry | [`0x1089844530DB5DefD39f523052F9BbD33f71d823`](https://explorer.testnet.chain.robinhood.com/address/0x1089844530DB5DefD39f523052F9BbD33f71d823) |
| AgentRunner (live rounds) | [`0x97047C337dAA6EB3200eC14Af26174013D2200A9`](https://explorer.testnet.chain.robinhood.com/address/0x97047C337dAA6EB3200eC14Af26174013D2200A9) |
| USDG (demo dollar, 6 decimals) | [`0xBb7dDDc00Eab60fcE13EfeeceD7cAa52712B17A8`](https://explorer.testnet.chain.robinhood.com/address/0xBb7dDDc00Eab60fcE13EfeeceD7cAa52712B17A8) |
| Market (swap venue) | [`0x295fe645C6fF4267b3e7F946aEE6A5531F78AB56`](https://explorer.testnet.chain.robinhood.com/address/0x295fe645C6fF4267b3e7F946aEE6A5531F78AB56) |

The five demo agents, each a non-custodial vault seeded with real on-chain trades:

| Agent | Vault | Result | Status |
| --- | --- | --- | --- |
| Momentum Alpha (TSLA) | [`0xA760…49C8`](https://explorer.testnet.chain.robinhood.com/address/0xA760eF79227B525BFd364Bc2Ee6d19F0449449C8) | score 100, strong returns | Eligible |
| Breakout Hunter (NFLX) | [`0x19c8…CC1A`](https://explorer.testnet.chain.robinhood.com/address/0x19c805FD9171d21c717e9f4a57FE797B8F8aCC1A) | score 80, strong returns | Eligible |
| Volatility Harvester (AMD) | [`0x086B…3B71`](https://explorer.testnet.chain.robinhood.com/address/0x086B95a224f577DcA8A14CC85aADf0956A9B3B71) | score 70, solid returns | Eligible |
| Steady Yield (AMZN) | [`0xFa87…8083`](https://explorer.testnet.chain.robinhood.com/address/0xFa872B5b6F6A21Aa8CB4FAcf74E43571b53c8083) | score 60, modest returns | Eligible |
| Mean Reversion (PLTR) | [`0x1237…c44f`](https://explorer.testnet.chain.robinhood.com/address/0x1237F5F1737843118C99ef906274286D6829c44f) | score 40, underperforming | Excluded |

You can check a score yourself: open the ValidationRegistry on the explorer, go to Read Contract,
and call `getSummary(agentId, [vaultAddress], "")`. It returns the score the vault computed.
Anyone can read it, nobody can fake it.

## Tech stack

| Layer | Stack |
| --- | --- |
| Contracts | Solidity 0.8.24, Foundry, OpenZeppelin, `via_ir` |
| Frontend | React 19, Vite, TypeScript, Tailwind 4, viem, lucide |
| Chain | Robinhood Chain testnet (Arbitrum Orbit L2, chain id 46630), USDG base asset |

## Running it locally

You'll need [Foundry](https://book.getfoundry.sh/getting-started/installation) (`forge`, `cast`),
Node.js 18+, and a wallet with Robinhood Chain testnet ETH from the
[faucet](https://faucet.testnet.chain.robinhood.com).

The frontend reads the live deployment out of the box:

```bash
cd frontend
npm install
npm run dev          # http://localhost:3000
```

It pulls contract addresses from `frontend/src/web3/deployed.json`, which already points at the
live deployment above. Connect a wallet, mint some demo USDG with the in-app faucet, then deposit,
allocate, and run live trading rounds.

For the contracts:

```bash
cd contract
forge build
forge test            # 53 tests
```

To deploy your own copy on Robinhood Chain testnet:

```bash
cd contract
cast wallet import deployer --interactive     # import a testnet key once (encrypted keystore)
bash script/deploy_testnet.sh deployer        # deploys everything and seeds 5 agents
bash script/verify_testnet.sh                 # source-verify on Blockscout
```

The deploy script writes the new addresses straight into `frontend/src/web3/deployed.json`, so the
frontend always points at your latest deployment. Note that `forge script` can't fork chain 46630
in Foundry 1.5.x, which is why deployment runs through a `forge create` + `cast` bash script with
retries for the public RPC. `DeployDemo.s.sol` is kept for local or forkable chains where
`forge script` works normally.

## Tests

53 Foundry tests, plus a few rounds of self-auditing. By file:

- **Registries.t.sol** covers access control across the three registries and the trust filter,
  including the case where a rogue self-validation is excluded once the summary is filtered to the
  real vault validator.
- **StrategyVault.t.sol** is the adversarial suite: USDG and stock donations can't inflate a score
  or a share price, first-deposit share inflation and dust griefing are neutralized, and a
  depositor still recovers their fair principal after an attack.
- **AgentRunner.t.sol** checks that a full epoch runs in one transaction and the vault writes the
  expected score for a win and for a loss.
- **VaultFactory.t.sol** checks the official-vault wiring and that a self-deployed look-alike vault
  is correctly treated as unofficial.
- **AllocationController.t.sol** checks score-weighted routing, the eligibility gates, and that an
  agent's realized profit flows all the way back to an index depositor.

```bash
cd contract && forge test -vv
```

## What actually runs on-chain

The vaults, the swaps through the Market venue, the donation-proof accounting, the 0–100 scoring,
the official-vault trust filter, and the score-weighted capital routing all run on-chain.

Since there's no live order book for tokenized equities on the testnet, the Market venue is priced
through an admin/oracle interface for the demo. That's a drop-in for a production DEX or price
oracle, and nothing else in the system changes when you swap it out. The core of the project, the
trustless proof-of-performance and capital-allocation layer, is fully real.

## Roadmap

**Production price source.** Replace the admin-priced Market with a real DEX or price oracle behind
the same `IMarket` interface. Nothing else in the system has to change, since the vault never
trusts a price for scoring, only for executing a swap.

**Timeout-gated liquidation.** Add a safety valve so that if an agent abandons an open epoch, the
position can be force-settled after a timeout and depositors are never locked out. This removes the
one limitation the current MVP discloses honestly.

**Richer scoring.** Move beyond a single per-epoch percent return to recency-weighted and
volume-weighted scores, plus risk-adjusted metrics like drawdown and volatility, so the leaderboard
rewards consistency rather than one lucky round.

**Permissionless onboarding with staking.** Let anyone launch an agent by staking, so there's
real skin in the game and spam or griefing agents have a cost. Slashing ties bad behavior back to
the stake.

**Cross-market agents.** Whitelist more tradable assets per vault and let an agent allocate across
several at once, so strategies aren't limited to a single ticker.

**Multi-chain deployment.** The contracts are standard EVM and chain-agnostic, so the same proof
layer can run on other rollups and aggregate reputation across them.

## Repository layout

```
proof-of-alpha/
├── contract/                          # Foundry project: all on-chain code
│   ├── foundry.toml                   # solc 0.8.24, via_ir, optimizer, RPC + verifier config
│   ├── src/
│   │   ├── IdentityRegistry.sol       # ERC-8004 Identity: agents as ERC-721 NFTs
│   │   ├── ReputationRegistry.sol     # ERC-8004 Reputation: client feedback signals
│   │   ├── ValidationRegistry.sol     # ERC-8004 Validation: the 0–100 scoreboard
│   │   ├── StrategyVault.sol          # the validator: non-custodial vault + epoch scoring
│   │   ├── VaultFactory.sol           # launches official vaults; the trust anchor
│   │   ├── AllocationController.sol    # pooled USDG index; score-weighted routing
│   │   ├── AgentRunner.sol            # runs a full trading round in one transaction
│   │   ├── Market.sol                 # oracle-priced swap venue (USDG <-> stocks)
│   │   ├── interfaces/                # IIdentityRegistry, IReputationRegistry,
│   │   │                              #   IValidationRegistry, IMarket
│   │   └── mocks/MockERC20.sol        # mintable demo USDG and tokenized stocks
│   ├── test/                          # 53 Foundry tests
│   │   ├── Registries.t.sol           # registry access control + the trust filter
│   │   ├── StrategyVault.t.sol        # donation / inflation / griefing attacks
│   │   ├── AgentRunner.t.sol          # one-transaction epoch + scoring
│   │   ├── VaultFactory.t.sol         # official-vault wiring and trust anchor
│   │   └── AllocationController.t.sol # score-weighted routing + profit flow
│   └── script/
│       ├── deploy_testnet.sh          # forge create + cast deploy (seeds 5 agents)
│       ├── verify_testnet.sh          # source-verify every contract on Blockscout
│       └── DeployDemo.s.sol           # forge-script deploy for local / forkable chains
├── frontend/                          # React + Vite + viem dApp
│   ├── src/
│   │   ├── App.tsx                    # top-level layout and tab routing
│   │   ├── components/                # Header, Footer, LeaderboardTab, AgentDetailTab,
│   │   │                              #   IndexAllocationTab, HowItWorksTab
│   │   ├── web3/
│   │   │   ├── config.ts              # chain config, explorer URLs, token symbols
│   │   │   ├── abis.ts                # contract ABIs
│   │   │   ├── deployed.json          # live contract addresses (read by the app)
│   │   │   ├── useWallet.ts           # connect / reconnect / faucet
│   │   │   └── useProtocol.ts         # contract reads and writes
│   │   └── types.ts                   # shared TypeScript types
│   └── index.html
├── ARCHITECTURE.md                    # deeper technical notes on the design
├── IMPLEMENTATION.md                  # build notes and decisions
└── LICENSE                            # MIT
```

## License

MIT, see [LICENSE](LICENSE).
