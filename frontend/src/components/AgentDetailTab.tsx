import React, { useState, useEffect } from 'react';
import { ArrowLeft, Shield, Copy, Check, ExternalLink, Coins, Repeat, Info, Zap, Landmark } from 'lucide-react';
import { Agent } from '../types';
import { explorerAddress, publicClient } from '../web3/config';
import { vaultAbi } from '../web3/abis';

// Human "x ago" for a trade's block time; full timestamp shown on hover.
const relTime = (ts?: number) => {
  if (!ts) return '';
  const s = Math.floor(Date.now() / 1000) - ts;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};
const absTime = (ts?: number) => (ts ? new Date(ts * 1000).toLocaleString() : '');

interface AgentDetailTabProps {
  agent: Agent;
  onBack: () => void;
  connected: boolean;
  userAddress: string | null;
  usdgBalance: number;
  onDeposit: (vaultAddress: string, amount: number) => void;
  onRunRound: (vaultAddress: string) => void;
  canRun: boolean;
  busy: string | null;
}

export default function AgentDetailTab({
  agent,
  onBack,
  connected,
  userAddress,
  usdgBalance,
  onDeposit,
  onRunRound,
  canRun,
  busy,
}: AgentDetailTabProps) {
  // Your stake in this specific vault = your vault shares' slice of its trading capital.
  const [stake, setStake] = useState<number | null>(null);
  useEffect(() => {
    if (!userAddress) { setStake(null); return; }
    let cancelled = false;
    (async () => {
      try {
        const [sh, ts] = await Promise.all([
          publicClient.readContract({ address: agent.vaultAddress as `0x${string}`, abi: vaultAbi, functionName: 'shares', args: [userAddress as `0x${string}`] }),
          publicClient.readContract({ address: agent.vaultAddress as `0x${string}`, abi: vaultAbi, functionName: 'totalShares' }),
        ]);
        if (cancelled) return;
        const shN = Number(sh); const tsN = Number(ts);
        setStake(tsN > 0 ? (agent.capitalUsd ?? 0) * (shN / tsN) : 0);
      } catch { if (!cancelled) setStake(null); }
    })();
    return () => { cancelled = true; };
  }, [userAddress, agent.vaultAddress, agent.capitalUsd, busy]);
  const [copied, setCopied] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositAmount, setDepositAmount] = useState('1000');

  // Per-epoch realized-return bars (oldest -> newest). Breakeven (0%) is the centre line.
  const bars = [...agent.epochHistory].reverse();

  const handleCopy = () => {
    navigator.clipboard.writeText(agent.vaultAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Inline deposit validation (never submit a doomed tx).
  const depNum = parseFloat(depositAmount);
  const depInvalid = isNaN(depNum) || depNum <= 0 || depNum > usdgBalance;
  const depMsg = usdgBalance <= 0
    ? 'You have no USDG — use the faucet in the wallet menu first.'
    : isNaN(depNum) || depNum <= 0
    ? 'Enter an amount greater than zero.'
    : depNum > usdgBalance
    ? 'Amount is more than your wallet balance.'
    : '';

  const handleDepositSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!connected) { onDeposit(agent.vaultAddress, depNum); return; } // triggers connect in the hook
    if (depInvalid) return;
    onDeposit(agent.vaultAddress, depNum);
    setShowDepositModal(false);
  };

  const statusColor = agent.status === 'Eligible' ? 'text-[#d4af37]' : agent.status === 'Excluded' ? 'text-red-400' : 'text-white/70';

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-16">
      <div>
        <button onClick={onBack} className="flex items-center gap-2 text-white/50 hover:text-[#d4af37] font-mono text-[10px] font-bold uppercase tracking-widest transition-colors active:scale-95">
          <ArrowLeft size={14} /> Back to Leaderboard
        </button>
      </div>

      {/* Header */}
      <div className="bg-white/[0.01] border border-white/5 p-6 rounded-none flex flex-col gap-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-none bg-[#0a0a0a] flex items-center justify-center border border-white/10">
              <span className="w-2 h-2 rounded-full bg-[#d4af37]" />
            </div>
            <div>
              <h1 className="text-xl md:text-3xl font-bold font-serif serif-display text-white flex items-center gap-3">
                {agent.name}
                <span className="px-2 py-0.5 border border-white/10 text-mono text-[9px] font-bold text-[#d4af37] uppercase tracking-widest flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#d4af37] animate-pulse" /> Live
                </span>
              </h1>
              <div className="flex items-center gap-2 mt-1.5 font-mono text-[11px] text-white/40">
                <span>Vault:</span>
                <span className="text-white/80 select-all">{agent.vaultAddress.slice(0, 8)}...{agent.vaultAddress.slice(-8)}</span>
                <button onClick={handleCopy} className="text-white/40 hover:text-[#d4af37] transition-colors" title="Copy Address">
                  {copied ? <Check size={13} className="text-[#d4af37]" /> : <Copy size={13} />}
                </button>
                <a href={explorerAddress(agent.vaultAddress)} target="_blank" rel="noreferrer" className="text-white/40 hover:text-[#d4af37] transition-colors" title="View on Explorer">
                  <ExternalLink size={13} />
                </a>
              </div>
            </div>
          </div>

          <div className="flex gap-4 self-stretch md:self-auto justify-between">
            <div className="bg-white/[0.02] border border-white/5 px-5 py-2 rounded-none flex flex-col items-end">
              <span className="font-mono text-[9px] text-white/40 uppercase tracking-wider">On-Chain Score</span>
              <div className="flex items-baseline gap-0.5 mt-0.5">
                <span className="text-2xl font-bold font-mono text-[#d4af37]">{agent.score}</span>
                <span className="text-[11px] font-mono text-white/40">/100</span>
              </div>
            </div>
            <div className="bg-white/[0.02] border border-white/5 px-5 py-2 rounded-none flex flex-col items-end min-w-[100px]">
              <span className="font-mono text-[9px] text-white/40 uppercase tracking-wider">Status</span>
              <span className={`font-mono text-[13px] font-bold uppercase tracking-widest mt-1.5 ${statusColor}`}>{agent.status}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Trading capital + your stake — where deposits land */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="bg-white/[0.01] border border-white/5 p-4 rounded-none flex items-center gap-3">
          <Landmark size={18} className="text-[#d4af37] flex-shrink-0" />
          <div>
            <div className="font-mono text-[9px] text-white/40 uppercase tracking-widest">Trading Capital</div>
            <div className="font-mono text-lg font-bold text-white">${(agent.capitalUsd ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
            <div className="font-mono text-[8px] text-white/30 uppercase tracking-widest">what this agent trades with</div>
          </div>
        </div>
        <div className="bg-white/[0.01] border border-white/5 p-4 rounded-none flex items-center gap-3">
          <Coins size={18} className="text-[#d4af37] flex-shrink-0" />
          <div>
            <div className="font-mono text-[9px] text-white/40 uppercase tracking-widest">Your Stake</div>
            <div className="font-mono text-lg font-bold text-[#d4af37]">{connected && stake != null ? `$${stake.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—'}</div>
            <div className="font-mono text-[8px] text-white/30 uppercase tracking-widest">{connected ? 'your deposits in this vault' : 'connect wallet to see'}</div>
          </div>
        </div>
        <div className="bg-white/[0.01] border border-white/5 p-4 rounded-none flex items-center gap-3">
          <Repeat size={18} className="text-[#d4af37] flex-shrink-0" />
          <div>
            <div className="font-mono text-[9px] text-white/40 uppercase tracking-widest">Settled Epochs</div>
            <div className="font-mono text-lg font-bold text-white">{agent.epochs}</div>
            <div className="font-mono text-[8px] text-white/30 uppercase tracking-widest">trading rounds completed</div>
          </div>
        </div>
      </div>

      {/* Trust box */}
      <div className="bg-white/[0.02] border border-white/5 rounded-none p-5 flex items-start gap-4 shadow-lg">
        <Shield className="text-[#d4af37] mt-0.5 flex-shrink-0" size={18} />
        <div className="space-y-1">
          <h3 className="font-serif serif-display text-sm font-bold text-white uppercase tracking-wider">Why you can trust this</h3>
          <p className="text-xs text-white/50 leading-relaxed max-w-4xl font-sans">
            This score was computed by the vault itself from real executed trades — no oracle, no self-reporting. The vault is the agent's designated validator
            and can only report the realized P&amp;L its own accounting measured, settled on the{' '}
            <strong className="text-[#d4af37] font-semibold">Robinhood Chain Testnet</strong>. Impossible to fake by construction.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* What this agent trades — real swaps from on-chain events */}
          <div className="bg-white/[0.01] border border-white/5 p-6 rounded-none flex flex-col gap-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-sm font-serif serif-display font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Repeat size={15} className="text-[#d4af37]" /> What this agent trades
              </h2>
              {agent.tradedSymbols && agent.tradedSymbols.length > 0 && (
                <span className="font-mono text-[10px] text-[#d4af37] bg-[#d4af37]/10 border border-[#d4af37]/15 px-2 py-1 uppercase tracking-widest">
                  {agent.tradedSymbols.join(' · ')} ⇄ USDG
                </span>
              )}
            </div>
            <p className="text-xs text-white/50 leading-relaxed font-sans">
              This agent swaps <strong className="text-white">USDG</strong> (a digital dollar) for tokenized stocks and back again.
              Its profit or loss is simply the USDG it ends with minus what it started with — measured on-chain by the vault itself.
            </p>

            {agent.trades && agent.trades.length > 0 ? (
              <div className="flex flex-col gap-2">
                {agent.trades.map((t, i) => (
                  <div key={i} className="flex items-center justify-between bg-[#030303] border border-white/5 px-4 py-3 rounded-none font-mono text-[12px]">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className={`px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest ${t.side === 'buy' ? 'bg-white/10 text-white/70' : 'bg-[#d4af37]/15 text-[#d4af37]'}`}>{t.side}</span>
                      {i === 0 && <span className="px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-widest bg-[#d4af37]/15 text-[#d4af37] border border-[#d4af37]/25 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#d4af37] animate-pulse" /> Latest</span>}
                      <span className="text-white">{t.stockAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} {t.symbol}</span>
                      <span className="text-white/40">@ ${t.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                      <span className={t.side === 'buy' ? 'text-white/60' : 'text-[#d4af37] font-bold'}>
                        {t.side === 'buy' ? '−' : '+'}${t.usdgAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDG
                      </span>
                      {t.timestamp && (
                        <span className="text-white/30 text-[9px] tracking-wider" title={absTime(t.timestamp)}>{relTime(t.timestamp)}</span>
                      )}
                    </div>
                  </div>
                ))}
                <p className="font-mono text-[10px] text-[#d4af37] leading-relaxed mt-1">
                  Bought low, sold {agent.returnRate >= 0 ? 'higher' : 'lower'} → realized {agent.returnRate >= 0 ? '+' : ''}{agent.returnRate.toFixed(1)}% in USDG. That difference is what produced the on-chain score of {agent.score}.
                </p>
              </div>
            ) : (
              <p className="font-mono text-[11px] text-white/30 uppercase tracking-widest">No trades recorded yet</p>
            )}
          </div>

          {/* Performance chart (real epochs) */}
          <div className="bg-white/[0.01] border border-white/5 p-6 rounded-none flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-serif serif-display font-bold text-white uppercase tracking-wider">
                Realized P&amp;L ({agent.epochHistory.length} {agent.epochHistory.length === 1 ? 'Epoch' : 'Epochs'})
              </h2>
            </div>

            <div className="w-full h-64 border border-white/5 bg-[#030303] relative rounded-none overflow-hidden select-none" style={{ backgroundImage: `linear-gradient(to bottom, rgba(255,255,255,0.02) 1px, transparent 1px)`, backgroundSize: '100% 24px' }}>
              {/* Axis labels */}
              <span className="absolute top-2 left-3 font-mono text-[8px] text-[#d4af37]/50 uppercase tracking-widest">+50%</span>
              <span className="absolute bottom-2 left-3 font-mono text-[8px] text-red-400/50 uppercase tracking-widest">-50%</span>
              {/* Breakeven centre line */}
              <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-[#d4af37]/25" />
              <span className="absolute top-1/2 right-3 -translate-y-1/2 font-mono text-[8px] text-white/30 uppercase tracking-widest bg-[#030303] px-1">breakeven</span>

              {/* Bars */}
              <div className="absolute inset-0 flex items-stretch justify-center gap-3 px-6">
                {bars.length === 0 && (
                  <div className="self-center font-mono text-[10px] text-white/30 uppercase tracking-widest">No settled epochs yet</div>
                )}
                {bars.map((b, i) => {
                  const pos = b.pnlPercentage >= 0;
                  const h = (Math.min(Math.abs(b.pnlPercentage), 50) / 50) * 46; // % of full height per side
                  return (
                    <div key={i} className="relative flex-1 max-w-[80px] group" title={`Epoch ${i + 1}: ${pos ? '+' : ''}${b.pnlPercentage}% · score ${b.score}`}>
                      <div
                        className={`absolute left-1/2 -translate-x-1/2 w-7 md:w-10 rounded-none transition-all duration-700 ${pos ? 'bg-[#d4af37] shadow-[0_0_12px_rgba(212,175,55,0.35)]' : 'bg-red-500/80 shadow-[0_0_12px_rgba(248,113,113,0.3)]'}`}
                        style={pos ? { bottom: '50%', height: `${Math.max(h, 2)}%` } : { top: '50%', height: `${Math.max(h, 2)}%` }}
                      />
                      {/* value label */}
                      <div
                        className={`absolute left-1/2 -translate-x-1/2 font-mono text-[10px] font-bold ${pos ? 'text-[#d4af37]' : 'text-red-400'}`}
                        style={pos ? { bottom: `calc(50% + ${Math.max(h, 2)}% + 4px)` } : { top: `calc(50% + ${Math.max(h, 2)}% + 4px)` }}
                      >
                        {pos ? '+' : ''}{b.pnlPercentage}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/5 text-left">
              <div>
                <span className="font-mono text-[9px] text-white/40 uppercase tracking-widest">Realized Return</span>
                <div className={`font-mono text-[15px] font-bold ${agent.returnRate >= 0 ? 'text-[#d4af37]' : 'text-red-400'}`}>
                  {agent.returnRate >= 0 ? '+' : ''}{agent.returnRate.toFixed(1)}%
                </div>
              </div>
              <div>
                <span className="font-mono text-[9px] text-white/40 uppercase tracking-widest">Win Rate</span>
                <div className="font-mono text-[15px] font-bold text-white">{agent.winRate}</div>
              </div>
              <div>
                <span className="font-mono text-[9px] text-white/40 uppercase tracking-widest">Max Drawdown</span>
                <div className="font-mono text-[15px] font-bold text-red-400">{agent.maxDrawdown}</div>
              </div>
            </div>
          </div>

          {/* Epoch history (real) */}
          <div className="bg-white/[0.01] border border-white/5 rounded-none overflow-hidden">
            <div className="px-6 py-4 bg-white/[0.02] border-b border-white/5 flex justify-between items-center">
              <h2 className="text-[12px] font-serif serif-display font-bold text-[#d4af37] uppercase tracking-widest">Epoch History</h2>
              <a href={explorerAddress(agent.vaultAddress)} target="_blank" rel="noreferrer" className="font-mono text-[9px] font-bold text-[#d4af37] hover:text-[#f1d279] uppercase flex items-center gap-1.5 transition-colors">
                <ExternalLink size={12} /> Vault on Explorer
              </a>
            </div>
            <div className="px-6 py-2.5 bg-[#d4af37]/[0.04] border-b border-[#d4af37]/10 flex items-start gap-2">
              <Info size={12} className="text-[#d4af37] mt-0.5 flex-shrink-0" />
              <span className="font-mono text-[10px] text-white/50 leading-relaxed">
                An <strong className="text-[#d4af37]">epoch</strong> is one round of trading: the vault snapshots starting cash, the agent trades, then returns to cash. End − start = realized P&L, mapped to a 0–100 score.
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[560px]">
                <thead>
                  <tr className="bg-white/[0.01] border-b border-white/5 font-mono text-[10px] text-white/40 uppercase tracking-widest">
                    <th className="px-6 py-4">Epoch</th>
                    <th className="px-6 py-4">Realized P&amp;L</th>
                    <th className="px-6 py-4">Score</th>
                    <th className="px-6 py-4 text-right">Validation</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-xs text-white/80">
                  {agent.epochHistory.length === 0 && (
                    <tr><td colSpan={4} className="px-6 py-6 text-center text-white/40 uppercase tracking-widest text-[11px]">No settled epochs yet</td></tr>
                  )}
                  {agent.epochHistory.map((rec, idx) => {
                    const isPositive = rec.pnlPercentage >= 0;
                    return (
                      <tr key={idx} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                        <td className="px-6 py-4 font-bold text-white">
                          <div className="flex items-center gap-2">
                            {idx === 0 && <span className="w-1.5 h-1.5 rounded-full bg-[#d4af37] animate-pulse" />}
                            {rec.epoch}
                          </div>
                        </td>
                        <td className={`px-6 py-4 font-bold ${isPositive ? 'text-[#d4af37]' : 'text-red-400'}`}>{rec.pnlValue}</td>
                        <td className="px-6 py-4 text-white/80">{rec.score}</td>
                        <td className="px-6 py-4 text-right">
                          <a href={explorerAddress(agent.vaultAddress)} target="_blank" rel="noreferrer" className="text-[#d4af37] hover:text-[#f1d279] underline decoration-[#d4af37]/25 hover:decoration-[#d4af37]/60 tracking-wider inline-flex items-center gap-1 text-[11px]">
                            On-chain ✓
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-white/[0.01] border border-white/5 p-6 rounded-none flex flex-col gap-5">
            <h2 className="font-serif serif-display text-xs font-bold text-[#d4af37] uppercase tracking-widest border-b border-white/5 pb-2">Strategy Profile</h2>
            <p className="text-xs text-white/70 leading-relaxed font-sans">{agent.strategyProfile}</p>
            <div className="grid grid-cols-2 gap-4 mt-2 pt-4 border-t border-white/5">
              <div>
                <span className="block font-mono text-[9px] text-white/40 uppercase tracking-widest">Risk Profile</span>
                <span className="font-mono text-xs font-bold text-white/90">{agent.riskProfile}</span>
              </div>
              <div>
                <span className="block font-mono text-[9px] text-white/40 uppercase tracking-widest">Max Drawdown</span>
                <span className="font-mono text-xs font-bold text-red-400">{agent.maxDrawdown}</span>
              </div>
              <div className="mt-1">
                <span className="block font-mono text-[9px] text-white/40 uppercase tracking-widest">Settled Epochs</span>
                <span className="font-mono text-xs font-bold text-white/90">{agent.epochs}</span>
              </div>
              <div className="mt-1">
                <span className="block font-mono text-[9px] text-white/40 uppercase tracking-widest">Win Rate</span>
                <span className="font-mono text-xs font-bold text-white/90">{agent.winRate}</span>
              </div>
            </div>
          </div>

          <div className="bg-white/[0.01] border border-white/5 hover:border-[#d4af37]/20 text-left rounded-none p-6 flex flex-col gap-4 relative overflow-hidden group transition-all shadow-xl">
            <h2 className="font-serif serif-display text-xs font-bold text-white/40 uppercase tracking-widest border-b border-white/5 pb-2">Vault Interaction</h2>
            <div className="flex flex-col gap-3 z-10 relative">
              {canRun && (
                <>
                  <button onClick={() => onRunRound(agent.vaultAddress)} disabled={!!busy} className="w-full bg-[#d4af37] hover:bg-[#f1d279] disabled:opacity-60 text-black font-mono text-[11px] font-bold uppercase tracking-widest py-3.5 rounded-none transition-all duration-200 active:scale-95 text-center shadow-[0_2px_16px_rgba(212,175,55,0.3)] flex items-center justify-center gap-2">
                    <Zap size={14} /> {busy === 'Trading round' ? 'Trading on-chain…' : 'Run Live Trading Round'}
                  </button>
                  <p className="font-mono text-[9px] text-white/35 leading-relaxed -mt-1">
                    Fires a real on-chain epoch: the agent buys, the market moves, it sells, and the vault re-scores it live. Watch the score and trades below update.
                  </p>
                </>
              )}
              <button onClick={() => setShowDepositModal(true)} disabled={!!busy} className="w-full bg-transparent border border-white/15 hover:bg-white/5 disabled:opacity-60 text-white/80 font-mono text-[11px] font-bold uppercase tracking-widest py-3 rounded-none transition-all duration-200 active:scale-95 text-center">
                Deposit Liquidity
              </button>
              <a href={explorerAddress(agent.vaultAddress)} target="_blank" rel="noreferrer" className="w-full bg-transparent border border-white/10 text-white/70 font-mono text-[10px] font-bold uppercase tracking-widest py-3 rounded-none hover:bg-white/5 transition-colors active:scale-95 text-center">
                View Contract
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Deposit modal (real vault deposit) */}
      {showDepositModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0c0c0c] border border-white/10 rounded-none max-w-sm w-full p-6 text-left relative shadow-2xl animate-scale-up">
            <h3 className="font-serif serif-display text-sm font-bold text-[#d4af37] uppercase tracking-wider flex items-center gap-2 mb-3">
              <Coins className="text-[#d4af37]" /> Deposit in {agent.name}
            </h3>
            <p className="text-xs text-white/40 leading-relaxed mb-4 font-sans">
              Allocate USDG directly into the non-custodial {agent.name} vault. You'll approve and deposit in your wallet; shares are minted to you on-chain.
            </p>
            <form onSubmit={handleDepositSubmit} className="space-y-4">
              <div className="space-y-1">
                <div className="flex justify-between text-[9px] font-mono font-bold text-white/40 uppercase tracking-widest">
                  <span>Deposit Amount</span>
                  <span onClick={() => setDepositAmount(Math.floor(usdgBalance).toString())} className="text-[#d4af37] cursor-pointer hover:underline">
                    Max: {usdgBalance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="flex bg-white/[0.01] border border-white/5 rounded-none focus-within:border-[#d4af37]/40 transition-colors p-3 items-center justify-between">
                  <input type="number" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} className="bg-transparent border-none text-left font-mono text-sm text-white focus:ring-0 p-0 w-full outline-none" placeholder="0.00" min="1" step="any" required />
                  <span className="font-mono text-[10px] font-bold text-white/40 uppercase ml-2 select-none">USDG</span>
                </div>
              </div>
              {!connected ? (
                <p className="text-[10px] text-[#d4af37]/80 font-mono uppercase tracking-wider">Connect your wallet to deposit.</p>
              ) : depMsg ? (
                <p className="text-[10px] text-red-400 font-mono uppercase tracking-wider">⚠ {depMsg}</p>
              ) : null}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button type="button" onClick={() => setShowDepositModal(false)} className="py-2.5 rounded-none bg-white/5 border border-white/15 text-white/60 hover:text-white font-mono text-[10px] font-bold uppercase transition-colors">Cancel</button>
                <button type="submit" disabled={!!busy || (connected && depInvalid)} className="py-2.5 rounded-none bg-[#d4af37] text-black font-mono text-[10px] font-bold uppercase tracking-wider transition-colors hover:bg-[#f1d279] disabled:opacity-40 disabled:cursor-not-allowed">
                  {busy ? `${busy}…` : 'Confirm Deposit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
