export type Page = 'leaderboard' | 'index' | 'how-it-works' | 'agent-detail';

export interface EpochRecord {
  epoch: string;
  startCapital: string;
  pnlPercentage: number;
  pnlValue: string;
  score: number;
  proofUrl?: string;
}

export interface TradeRecord {
  side: 'buy' | 'sell';
  symbol: string; // the stock symbol traded (e.g. TSLA)
  stockAmount: number; // whole tokens
  usdgAmount: number; // USDG spent (buy) or received (sell)
  price: number; // USDG per whole token
  timestamp?: number; // block time of the trade (unix seconds)
  blockNumber?: number; // block the trade was mined in
}

export interface Agent {
  id: string;
  rank: string;
  name: string;
  score: number;
  returnRate: number;
  epochs: number;
  capital: string;
  status: 'Eligible' | 'Evaluating' | 'Syncing' | 'Excluded';
  description?: string;
  avatarUrl?: string;
  vaultAddress: string;
  riskProfile: 'Low' | 'Moderate' | 'High';
  maxDrawdown: string;
  sharpeRatio: string;
  winRate: string;
  strategyProfile: string;
  epochHistory: EpochRecord[];
  trades?: TradeRecord[]; // real swaps reconstructed from on-chain Traded events
  tradedSymbols?: string[]; // distinct stocks this agent traded
  capitalUsd?: number; // vault trading capital (totalAssets) as a precise number
  targetWeight?: number;
  actualWeight?: number;
}

export interface IndexState {
  totalNav: number;
  userBalance: number; // Available USDG
  userShares: number;  // Deposited USDG
}
