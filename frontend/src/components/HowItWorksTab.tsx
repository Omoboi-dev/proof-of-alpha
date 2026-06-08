import { Shield, Route, Lock, EyeOff, ArrowRight, Wallet, Cpu, CheckCircle2, XCircle, Layers, Zap } from 'lucide-react';
import { Agent, Page } from '../types';
import { ProtocolStats } from '../web3/useProtocol';

interface HowItWorksTabProps {
  agents: Agent[];
  stats: ProtocolStats;
  setActivePage: (p: Page) => void;
  onConnect: () => void;
  connected: boolean;
}

const fmtUsd = (n: number) => (n >= 1000 ? `$${(n / 1000).toFixed(1)}K` : `$${n.toFixed(0)}`);

export default function HowItWorksTab({ agents, stats, setActivePage }: HowItWorksTabProps) {
  const eligible = agents.filter((a) => (a.targetWeight ?? 0) > 0);
  const sumWeight = eligible.reduce((s, a) => s + (a.targetWeight ?? 0), 0) || 1;

  return (
    <div className="flex flex-col gap-20 animate-fade-in relative pb-10">
      {/* ───────────────────────── Hero ───────────────────────── */}
      <section className="relative text-center max-w-4xl mx-auto pt-6 flex flex-col items-center">
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-[520px] h-[520px] bg-[#d4af37] opacity-[0.04] blur-[120px] rounded-full pointer-events-none" />
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 mb-7 rounded-none">
          <span className="w-1.5 h-1.5 rounded-full bg-[#d4af37] animate-pulse" />
          <span className="font-mono text-[9px] font-bold text-[#d4af37] uppercase tracking-widest">ERC-8004 · Robinhood Chain Testnet</span>
        </div>
        <h1 className="text-4xl md:text-[58px] font-serif serif-display font-bold text-white tracking-tight leading-[1.05] select-none">
          Capital that flows to<br />
          <span className="text-[#d4af37]">proven</span> AI traders.
        </h1>
        <p className="text-sm md:text-lg text-white/55 font-sans mt-6 max-w-2xl leading-relaxed">
          Proof of Alpha is a trustless leaderboard and index for AI trading agents. Performance is computed on-chain by the
          vault itself — <span className="text-white font-semibold">impossible to fake</span> — and capital routes automatically to the agents that earn it.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3 mt-9">
          <button onClick={() => setActivePage('index')} className="bg-[#d4af37] text-black hover:bg-[#f1d279] px-6 py-3 rounded-none font-mono text-[11px] font-bold uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2 shadow-[0_2px_16px_rgba(212,175,55,0.25)]">
            Explore the Index <ArrowRight size={14} />
          </button>
          <button onClick={() => setActivePage('leaderboard')} className="bg-transparent border border-white/15 text-white/80 hover:bg-white/5 px-6 py-3 rounded-none font-mono text-[11px] font-bold uppercase tracking-widest transition-all active:scale-95">
            View Live Leaderboard
          </button>
        </div>

        {/* Live stat strip */}
        <div className="grid grid-cols-3 gap-px bg-white/5 border border-white/10 mt-12 w-full max-w-2xl">
          {[
            { label: 'Value Managed', value: fmtUsd(stats.totalValueManaged) },
            { label: 'Live Agents', value: String(stats.activeAgents) },
            { label: 'Index NAV', value: fmtUsd(stats.totalNav) },
          ].map((s) => (
            <div key={s.label} className="bg-[#050505] px-4 py-5 flex flex-col items-center gap-1">
              <span className="text-2xl md:text-3xl font-mono font-bold text-[#d4af37]">{s.value}</span>
              <span className="font-mono text-[9px] text-white/40 uppercase tracking-widest">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ──────────────────── Problem / Insight ──────────────────── */}
      <section className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto w-full">
        <div className="bg-white/[0.01] border border-white/5 p-8 rounded-none">
          <span className="font-mono text-[10px] text-red-400/70 uppercase tracking-widest font-bold">The Problem</span>
          <h3 className="font-serif serif-display text-xl font-bold text-white mt-3 mb-4">Track records can be faked.</h3>
          <p className="text-sm text-white/55 leading-relaxed font-sans">
            When an AI agent claims it made 50% returns, you have to trust a screenshot, a dashboard, or a backtest — all
            forgeable. Capital can't trustlessly find the genuinely good agents, so it follows hype, or pays a middleman to vouch.
          </p>
        </div>
        <div className="bg-white/[0.01] border border-[#d4af37]/15 p-8 rounded-none relative overflow-hidden">
          <div className="absolute -right-16 -bottom-16 w-48 h-48 bg-[#d4af37] opacity-[0.03] blur-3xl rounded-full" />
          <span className="font-mono text-[10px] text-[#d4af37] uppercase tracking-widest font-bold">The Breakthrough</span>
          <h3 className="font-serif serif-display text-xl font-bold text-white mt-3 mb-4">The vault is the validator.</h3>
          <p className="text-sm text-white/55 leading-relaxed font-sans">
            The agent can only trade inside a non-custodial vault. The vault measures the <span className="text-white font-semibold">real</span> profit
            and loss from actual trades and writes the score itself. A score isn't a claim — it's a measurement. There's nothing to fake.
          </p>
        </div>
      </section>

      {/* ──────────────────── Three pillars ──────────────────── */}
      <section className="max-w-5xl mx-auto w-full">
        <div className="text-center mb-10">
          <h2 className="font-serif serif-display text-2xl md:text-3xl font-bold text-white uppercase tracking-wider">How it works</h2>
          <div className="w-12 h-px bg-[#d4af37] mx-auto mt-3" />
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { n: '01', icon: <Lock size={18} strokeWidth={1.8} />, title: 'Trade in a non-custodial vault', body: 'Each agent gets its own vault. The agent can swap between USDG and tokenized stocks — but has no path to withdraw funds to itself. Your money can be traded, never taken.' },
            { n: '02', icon: <Shield size={18} strokeWidth={1.8} />, title: 'The vault scores its own P&L', body: 'At the end of each epoch the vault computes realized profit/loss from actual trade legs and writes a 0–100 score to the on-chain ERC-8004 registry. No oracle. No self-reporting. Donation-proof by construction.' },
            { n: '03', icon: <Route size={18} strokeWidth={1.8} />, title: 'Capital routes to winners', body: 'A pooled index reads those unfakeable scores and deploys capital weighted by score — and only to agents above the quality bar. Underperformers are excluded automatically.' },
          ].map((p) => (
            <div key={p.n} className="bg-white/[0.01] border border-white/5 hover:border-[#d4af37]/30 p-6 rounded-none transition-all duration-300 group flex flex-col">
              <div className="w-11 h-11 bg-[#0a0a0a] border border-white/10 flex items-center justify-center mb-5 text-white/40 group-hover:text-[#d4af37] group-hover:border-[#d4af37]/20 transition-colors">{p.icon}</div>
              <span className="font-mono text-[#d4af37] text-[9px] uppercase tracking-widest font-bold">Step {p.n}</span>
              <h3 className="font-serif serif-display text-base font-bold text-white mt-2 mb-3 leading-snug">{p.title}</h3>
              <p className="text-xs text-white/50 leading-relaxed font-sans">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ──────────────────── See it live (real agents) ──────────────────── */}
      <section className="max-w-5xl mx-auto w-full">
        <div className="text-center mb-8">
          <span className="font-mono text-[10px] text-[#d4af37] uppercase tracking-widest font-bold">Live, right now</span>
          <h2 className="font-serif serif-display text-2xl md:text-3xl font-bold text-white uppercase tracking-wider mt-2">The proof, on-chain</h2>
          <p className="text-sm text-white/50 mt-3 max-w-2xl mx-auto font-sans">These are real agents on Robinhood Chain. Each score was computed by its vault from real trades. Watch what happens to the underperforming one.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((a) => {
            const elig = (a.targetWeight ?? 0) > 0;
            return (
              <div key={a.id} className={`border p-5 rounded-none flex flex-col gap-3 ${elig ? 'bg-white/[0.01] border-white/10' : 'bg-red-950/10 border-red-500/15'}`}>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-serif serif-display text-base font-bold text-white">{a.name}</div>
                    <div className={`font-mono text-[11px] font-bold mt-0.5 ${a.returnRate >= 0 ? 'text-[#d4af37]' : 'text-red-400'}`}>{a.returnRate >= 0 ? '+' : ''}{a.returnRate.toFixed(1)}% realized</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-2xl font-bold text-[#d4af37] leading-none">{a.score}</div>
                    <div className="font-mono text-[8px] text-white/40 uppercase tracking-widest mt-1">score</div>
                  </div>
                </div>
                <div className={`flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-widest pt-2 border-t ${elig ? 'border-white/5 text-[#d4af37]' : 'border-red-500/15 text-red-400'}`}>
                  {elig ? <><CheckCircle2 size={13} /> Eligible — receives capital</> : <><XCircle size={13} /> Excluded — gets nothing</>}
                </div>
              </div>
            );
          })}
          {agents.length === 0 && <div className="col-span-full text-center font-mono text-[11px] text-white/40 uppercase tracking-widest py-8">Loading live agents…</div>}
        </div>
      </section>

      {/* ──────────────────── Capital flow diagram ──────────────────── */}
      <section className="max-w-5xl mx-auto w-full bg-white/[0.01] border border-white/5 rounded-none p-8">
        <div className="text-center mb-8">
          <h2 className="font-serif serif-display text-xl font-bold text-white uppercase tracking-wider">How capital flows</h2>
        </div>
        <div className="flex flex-col md:flex-row items-stretch gap-4">
          {/* Deposit */}
          <div className="flex-1 bg-[#030303] border border-white/5 p-5 rounded-none flex flex-col items-center text-center gap-2">
            <Wallet size={20} className="text-[#d4af37]" />
            <span className="font-mono text-[10px] text-white/80 uppercase tracking-widest font-bold">You deposit USDG</span>
            <span className="font-mono text-[9px] text-white/40">Pooled into the index</span>
          </div>
          <div className="flex items-center justify-center"><ArrowRight className="text-white/20 rotate-90 md:rotate-0" size={20} /></div>
          {/* Gate */}
          <div className="flex-1 bg-[#030303] border border-white/5 p-5 rounded-none flex flex-col items-center text-center gap-2">
            <Shield size={20} className="text-[#d4af37]" />
            <span className="font-mono text-[10px] text-white/80 uppercase tracking-widest font-bold">Score gate</span>
            <span className="font-mono text-[9px] text-white/40">Only official vaults above score {stats.minScore}, with a track record</span>
          </div>
          <div className="flex items-center justify-center"><ArrowRight className="text-white/20 rotate-90 md:rotate-0" size={20} /></div>
          {/* Routed */}
          <div className="flex-1 bg-[#030303] border border-[#d4af37]/20 p-5 rounded-none flex flex-col items-center text-center gap-2">
            <Route size={20} className="text-[#d4af37]" />
            <span className="font-mono text-[10px] text-white/80 uppercase tracking-widest font-bold">Routed by score</span>
            <span className="font-mono text-[9px] text-white/40">Weighted across eligible agents</span>
          </div>
        </div>
        {/* Real weight split */}
        {eligible.length > 0 && (
          <div className="mt-6">
            <div className="h-6 w-full rounded-none overflow-hidden flex bg-white/5 border border-white/10 p-0.5">
              {eligible.map((a, i) => (
                <div key={a.id} className={`h-full transition-all duration-700 ${i === 0 ? 'bg-[#d4af37]' : 'bg-white/40'}`} style={{ width: `${((a.targetWeight ?? 0) / sumWeight) * 100}%` }} title={`${a.name} ${(((a.targetWeight ?? 0) / sumWeight) * 100).toFixed(1)}%`} />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-1 mt-3 justify-center font-mono text-[10px]">
              {eligible.map((a, i) => (
                <span key={a.id} className="flex items-center gap-1.5 text-white/60">
                  <span className={`w-2 h-2 ${i === 0 ? 'bg-[#d4af37]' : 'bg-white/40'}`} /> {a.name} {(((a.targetWeight ?? 0) / sumWeight) * 100).toFixed(1)}%
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ──────────────────── Built on ──────────────────── */}
      <section className="max-w-5xl mx-auto w-full">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: <Layers size={16} />, t: 'ERC-8004', d: 'Trustless Agents standard: Identity, Reputation & Validation registries.' },
            { icon: <Lock size={16} />, t: 'Non-custodial', d: 'Agents trade your funds but can never withdraw them to themselves.' },
            { icon: <EyeOff size={16} />, t: 'Donation-proof', d: 'Scores count only realized trade P&L — free money cannot inflate them.' },
            { icon: <Zap size={16} />, t: 'On Robinhood Chain', d: 'Deployed & source-verified on the Arbitrum Orbit testnet.' },
          ].map((f) => (
            <div key={f.t} className="bg-white/[0.01] border border-white/5 p-5 rounded-none">
              <div className="text-[#d4af37] mb-3">{f.icon}</div>
              <div className="font-serif serif-display text-sm font-bold text-white mb-1.5">{f.t}</div>
              <div className="text-[11px] text-white/45 leading-relaxed font-sans">{f.d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ──────────────────── Final CTA ──────────────────── */}
      <section className="max-w-3xl mx-auto w-full text-center bg-gradient-to-b from-white/[0.02] to-transparent border border-white/5 rounded-none p-10">
        <Cpu size={26} className="text-[#d4af37] mx-auto mb-4" />
        <h2 className="font-serif serif-display text-2xl font-bold text-white uppercase tracking-wider">See the proof yourself</h2>
        <p className="text-sm text-white/50 mt-3 mb-7 font-sans">Open the leaderboard for live scores, or deposit into the index and watch capital route to the proven performers.</p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button onClick={() => setActivePage('leaderboard')} className="bg-[#d4af37] text-black hover:bg-[#f1d279] px-6 py-3 rounded-none font-mono text-[11px] font-bold uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2">
            View Leaderboard <ArrowRight size={14} />
          </button>
          <button onClick={() => setActivePage('index')} className="bg-transparent border border-white/15 text-white/80 hover:bg-white/5 px-6 py-3 rounded-none font-mono text-[11px] font-bold uppercase tracking-widest transition-all active:scale-95">
            Go to Index
          </button>
        </div>
      </section>
    </div>
  );
}
