export type Page = 'leaderboard' | 'index' | 'how-it-works' | 'agent-detail';

export interface EpochRecord {
  epoch: string;
  startCapital: string;
  pnlPercentage: number;
  pnlValue: string;
  score: number;
  proofUrl?: string;
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
  targetWeight?: number;
  actualWeight?: number;
}

export interface IndexState {
  totalNav: number;
  userBalance: number; // Available USDG
  userShares: number;  // Deposited USDG
}
