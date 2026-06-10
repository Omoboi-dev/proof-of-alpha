import { createPublicClient, defineChain, http } from 'viem';

// Robinhood Chain testnet (Arbitrum Orbit L2).
export const robinhoodTestnet = defineChain({
  id: 46630,
  name: 'Robinhood Chain Testnet',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.chain.robinhood.com/rpc'] },
  },
  blockExplorers: {
    default: { name: 'Blockscout', url: 'https://explorer.testnet.chain.robinhood.com' },
  },
  testnet: true,
});

export const EXPLORER = robinhoodTestnet.blockExplorers.default.url;
export const explorerAddress = (addr: string) => `${EXPLORER}/address/${addr}`;
export const explorerTx = (hash: string) => `${EXPLORER}/tx/${hash}`;

// Deployed contract addresses — kept in deployed.json, which the deploy script rewrites on every
// deploy so the frontend always points at the latest deployment. USDG has 6 decimals.
import deployed from './deployed.json';
export const CONTRACTS = deployed;
export const hasRunner = !!deployed.AgentRunner && deployed.AgentRunner.length > 0;

export const USDG_DECIMALS = 6;

// Reverse lookup: token address -> display symbol (for reconstructing trades from events).
export const SYMBOL_BY_ADDR: Record<string, string> = {
  [CONTRACTS.USDG.toLowerCase()]: 'USDG',
  [CONTRACTS.TSLA.toLowerCase()]: 'TSLA',
  [CONTRACTS.AMZN.toLowerCase()]: 'AMZN',
  [CONTRACTS.PLTR.toLowerCase()]: 'PLTR',
  [CONTRACTS.NFLX.toLowerCase()]: 'NFLX',
  [CONTRACTS.AMD.toLowerCase()]: 'AMD',
};
export const symbolOf = (addr: string) => SYMBOL_BY_ADDR[addr.toLowerCase()] ?? `${addr.slice(0, 6)}…`;

// The public, read-only client used for every on-chain read in the app.
export const publicClient = createPublicClient({
  chain: robinhoodTestnet,
  transport: http(),
});
