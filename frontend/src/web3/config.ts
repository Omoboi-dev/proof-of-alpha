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

// Deployed contract addresses (see contract/deployments.txt). USDG has 6 decimals.
export const CONTRACTS = {
  USDG: '0xFD154FcF3D576B7a40EbC0b834f2A9b10FC04635',
  TSLA: '0x1f57f19e95d318CAC53E16bC98Ec364A6c859c5B',
  AMZN: '0x2C92f232B45915dF58c5aFbbCEA3a245CfDefE12',
  PLTR: '0x7b504225857eD969F8C4917fF21B49B6fD9603EE',
  DEX: '0x953Aae7fCcbDfA78E8FD5edf137A254c1EFBb580',
  IdentityRegistry: '0x41617bccb9d2999494834196c70233d755Db286f',
  ReputationRegistry: '0xE6BA8cF462fb348228DBB438cc51C9c0D08c4866',
  ValidationRegistry: '0x4A001353499667e2b830F15537B2B69C50A9Ec0A',
  VaultFactory: '0x8F4e1d3C80d159D1B71FAC0EBf29f58C63CF36fC',
  AllocationController: '0xb0B33b9b33B77c268b28680e937E28DbF3779c0B',
} as const;

export const USDG_DECIMALS = 6;

// The public, read-only client used for every on-chain read in the app.
export const publicClient = createPublicClient({
  chain: robinhoodTestnet,
  transport: http(),
});
