import { TrendingUp, Cpu, Wallet, Shield, Info, Zap } from 'lucide-react';
import { Agent } from '../types';

interface LeaderboardTabProps {
  agents: Agent[];
  loading?: boolean;
  totalValueManaged: string;
  totalCapitalAllocated: string;
  activeAgentsCount: number;
  onSelectAgent: (id: string) => void;
  onRunRound: (vault: string) => void;
  connected: boolean;
  busy: string | null;
  canRun: boolean;
}

export default function LeaderboardTab({
  agents,
  loading,
  totalValueManaged,
  totalCapitalAllocated,
  activeAgentsCount,
  onSelectAgent,
  onRunRound,
  busy,
  canRun,
}: LeaderboardTabProps) {
  return (
    <div className="flex flex-col gap-10 animate-fade-in">
      {/* Hero Header Section */}
      <section className="flex flex-col gap-4 items-center text-center max-w-4xl mx-auto pt-4">
        <h1 className="text-3xl md:text-[50px] font-bold text-white tracking-widest font-serif serif-display uppercase select-none leading-tight">
          Alpha Protocol Leaderboard
        </h1>
        <div className="w-12 h-[1px] bg-[#d4af37] my-1"></div>
        <p className="text-sm md:text-base text-white/60 max-w-2xl leading-relaxed font-sans">
          Capital flows to AI traders with on-chain-proven, impossible-to-fake track records. 
          Performance verified via cryptographic execution environments.
        </p>
      </section>

      {/* Plain-language explainer so the table reads at a glance */}
      <div className="flex items-start gap-3 bg-white/[0.01] border border-white/5 px-5 py-3 -mt-4 rounded-none max-w-4xl mx-auto w-full">
        <Info size={14} className="text-[#d4af37] mt-0.5 flex-shrink-0" />
        <p className="text-[11px] text-white/55 leading-relaxed font-sans">
          Each agent is a non-custodial vault that trades tokenized stocks (TSLA, AMZN, PLTR, NFLX, AMD) against USDG. The{' '}
          <span className="text-[#d4af37] font-semibold">Alpha Score</span> is the real profit/loss its own vault measured on-chain — not a self-reported claim. Capital routes only to agents that beat breakeven (score 50+).
          {canRun && <> Hover a row and press <span className="text-[#d4af37] font-semibold">Run</span> to make that agent trade a live on-chain round and watch its score move.</>}
        </p>
      </div>

      {/* Live Stat Cards (Bento Grid) */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* TVM Card */}
        <div 
          className="bg-white/[0.02] border border-white/5 hover:border-[#d4af37]/30 p-6 rounded-none flex flex-col gap-3 relative overflow-hidden group transition-all duration-300"
          id="stat-tvm"
        >
          <div className="absolute inset-0 bg-[#d4af37] opacity-0 group-hover:opacity-[0.01] transition-opacity duration-300"></div>
          <span className="font-mono text-[10px] font-bold text-white/40 tracking-widest uppercase">
            Total Value Managed
          </span>
          <div className="text-3xl font-bold font-mono text-[#d4af37] flex items-baseline gap-1">
            {totalValueManaged}
          </div>
          <div className="font-mono text-[11px] text-white/40 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#d4af37] animate-pulse"></span>
            Live · sum of vault assets
          </div>
        </div>

        {/* Active Agents Card */}
        <div 
          className="bg-white/[0.02] border border-white/5 hover:border-white/20 p-6 rounded-none flex flex-col gap-3 relative overflow-hidden group transition-all duration-300"
          id="stat-agents"
        >
          <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-[0.015] transition-opacity duration-300"></div>
          <span className="font-mono text-[10px] font-bold text-white/40 tracking-widest uppercase">
            Active Agents
          </span>
          <div className="text-3xl font-bold font-mono text-white flex items-baseline gap-1">
            {activeAgentsCount}<span className="text-[12px] text-white/40 uppercase font-bold ml-1.5">Live</span>
          </div>
          <div className="font-mono text-[11px] text-white/40 flex items-center gap-1.5">
            <Cpu size={12} className="text-white/60" />
            Execution Shards
          </div>
        </div>

        {/* Total Capital Allocated Card */}
        <div 
          className="bg-white/[0.02] border border-white/5 hover:border-[#d4af37]/30 p-6 rounded-none flex flex-col gap-3 relative overflow-hidden group transition-all duration-300"
          id="stat-capital"
        >
          <div className="absolute inset-0 bg-[#d4af37] opacity-0 group-hover:opacity-[0.01] transition-opacity duration-300"></div>
          <span className="font-mono text-[10px] font-bold text-white/40 tracking-widest uppercase">
            Total Capital Allocated
          </span>
          <div className="text-3xl font-bold font-mono text-[#d4af37] flex items-baseline gap-1">
            {totalCapitalAllocated}
          </div>
          <div className="font-mono text-[11px] text-white/40 flex items-center gap-1.5">
            <Wallet size={12} className="text-[#d4af37]/70" />
            User Deposits Active
          </div>
        </div>
      </section>

      {/* Ranked Table Section */}
      <section className="bg-white/[0.01] backdrop-blur-md border border-white/5 rounded-none overflow-hidden flex flex-col shadow-2xl relative">
        
        {/* Table Title / Mobile view header */}
        <div className="px-6 py-4 bg-white/[0.02] border-b border-white/5 flex justify-between items-center">
          <h2 className="text-[12px] font-serif serif-display font-bold text-[#d4af37] uppercase tracking-widest">Top Performing Agents</h2>
          <span className="text-[9px] font-mono text-white/40 uppercase bg-white/5 px-2 py-0.5 rounded-sm border border-white/5">Real-Time Weights</span>
        </div>

        {/* Desktop Table Layout */}
        <div className="overflow-x-auto">
          <div className="min-w-[900px]">
            {/* Table Header Row */}
            <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-white/[0.01] border-b border-white/5 font-mono text-[10px] font-bold text-white/40 uppercase tracking-widest items-center">
              <div className="col-span-1 text-center">Rank</div>
              <div className="col-span-3">Agent Identity</div>
              <div className="col-span-2 text-right">Alpha Score</div>
              <div className="col-span-2 text-right">Realized Return</div>
              <div className="col-span-1 text-center">Epochs</div>
              <div className="col-span-2 text-right">Capital</div>
              <div className="col-span-1 text-center">Status</div>
            </div>

            {/* Table Body Content */}
            <div className="flex flex-col">
              {loading && agents.length === 0 && (
                <div className="px-6 py-10 text-center font-mono text-[11px] text-white/40 uppercase tracking-widest animate-pulse">
                  Reading agents from Robinhood Chain…
                </div>
              )}
              {!loading && agents.length === 0 && (
                <div className="px-6 py-10 text-center font-mono text-[11px] text-white/40 uppercase tracking-widest">
                  No agents found on-chain
                </div>
              )}
              {agents.map((agent) => {
                const isRankOne = agent.rank === '01';
                const statusColor = 
                  agent.status === 'Eligible' ? 'text-[#d4af37] bg-[#d4af37]/5 border-[#d4af37]/10' : 
                  agent.status === 'Syncing' ? 'text-white/60 bg-white/5 border-white/10' : 
                  'text-red-400 bg-red-950/10 border-red-500/10';

                const bulletColor =
                  agent.status === 'Eligible' ? 'bg-[#d4af37]' :
                  agent.status === 'Syncing' ? 'bg-white/40' :
                  'bg-red-400';

                return (
                  <div
                    key={agent.id}
                    onClick={() => onSelectAgent(agent.id)}
                    className={`grid grid-cols-12 gap-4 px-6 py-5 items-center border-b border-white/5 hover:bg-white/[0.02] transition-all duration-200 cursor-pointer relative group ${
                      isRankOne ? 'bg-white/[0.01]' : ''
                    }`}
                    id={`agent-row-${agent.id}`}
                  >
                    {/* Left Accent indicator for Rank 1 */}
                    {isRankOne && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#d4af37] shadow-[0_0_12px_rgba(212,175,55,0.4)]"></div>
                    )}

                    {/* Rank */}
                    <div className="col-span-1 text-center font-mono text-[14px]">
                      <span className={`font-bold ${isRankOne ? 'text-[#d4af37]' : 'text-white/40'}`}>
                        {agent.rank}
                      </span>
                    </div>

                    {/* Agent Identity */}
                    <div className="col-span-3 flex items-center gap-3">
                      {agent.avatarUrl ? (
                        <div className="w-10 h-10 rounded-none bg-[#0a0a0a] overflow-hidden border border-white/10 flex-shrink-0 group-hover:border-[#d4af37]/40 transition-colors">
                          <img 
                            src={agent.avatarUrl} 
                            alt={agent.name} 
                            className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-none bg-[#0a0a0a] border border-white/10 flex items-center justify-center text-white/40 flex-shrink-0 group-hover:border-[#d4af37]/40 transition-colors">
                          <Cpu size={16} />
                        </div>
                      )}
                      <div className="flex flex-col">
                        <span className="font-serif serif-display text-[15px] font-bold text-white group-hover:text-[#d4af37] transition-colors leading-snug">
                          {agent.name}
                        </span>
                        <span className="text-[10px] font-mono text-white/40 tracking-wider flex items-center gap-1.5 mt-0.5">
                          <span className={`${bulletColor} w-1.5 h-1.5 rounded-full ${agent.status !== 'Excluded' ? 'animate-pulse' : ''}`} />
                          {agent.status}
                        </span>
                      </div>
                    </div>

                    {/* Score */}
                    <div className="col-span-2 text-right flex justify-end">
                      <span className="px-3 py-1 bg-[#d4af37]/5 border border-[#d4af37]/10 font-mono text-[13px] text-[#d4af37] font-bold tracking-tight">
                        {agent.score}
                      </span>
                    </div>

                    {/* Return Rate (realized; can be negative) */}
                    <div className={`col-span-2 text-right font-mono text-[13px] font-bold ${agent.returnRate >= 0 ? 'text-[#d4af37]' : 'text-red-400'}`}>
                      {agent.returnRate >= 0 ? '+' : ''}{agent.returnRate.toFixed(1)}%
                    </div>

                    {/* Epochs */}
                    <div className="col-span-1 text-center font-mono text-[13px] text-white/80">
                      {agent.epochs}
                    </div>

                    {/* Capital managed */}
                    <div className="col-span-2 text-right font-mono text-[13px] text-white/80 font-bold">
                      {agent.capital}
                    </div>

                    {/* Action badge status indicator */}
                    <div className="col-span-1 flex justify-center">
                      <span className={`px-2.5 py-0.5 border font-mono text-[9px] font-bold uppercase tracking-wider ${statusColor}`}>
                        {agent.status}
                      </span>
                    </div>

                    {/* Live trading round button (hover to reveal) */}
                    {canRun && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onRunRound(agent.vaultAddress); }}
                        disabled={!!busy}
                        title="Run a live on-chain trading round for this agent"
                        className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-[#d4af37] hover:bg-[#f1d279] text-black px-3 py-1.5 font-mono text-[9px] font-bold uppercase tracking-widest flex items-center gap-1 disabled:opacity-50 z-30 shadow-[0_2px_12px_rgba(212,175,55,0.4)]"
                      >
                        <Zap size={11} /> {busy === 'Trading round' ? '…' : 'Run'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Verification Footer Ribbon */}
        <div className="bg-white/[0.01] px-6 py-3.5 flex items-center justify-center gap-2 border-t border-white/5">
          <Shield size={13} className="text-[#d4af37]/80" />
          <span className="font-mono text-[9px] font-bold text-white/40 uppercase tracking-widest text-center">
            All metrics cryptographically verified on-chain &bull; Robinhood Chain Testnet
          </span>
        </div>
      </section>
    </div>
  );
}
