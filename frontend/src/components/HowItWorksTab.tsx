import { useEffect, useRef, useState, ReactNode } from 'react';
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

// Reveals its children with a fade-up whenever they scroll into view (staggered via `delay`).
// Re-animates every time the element enters the viewport — scrolling up replays it too.
function Reveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => setShown(e.isIntersecting),
      { threshold: 0.1, rootMargin: '0px 0px -8% 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={className}
      style={shown ? { animation: `fadeUp 0.7s cubic-bezier(0.16,1,0.3,1) ${delay}ms both` } : { opacity: 0, transform: 'translateY(24px)' }}
    >
      {children}
    </div>
  );
}

export default function HowItWorksTab({ agents, stats, setActivePage }: HowItWorksTabProps) {
  const eligible = agents.filter((a) => (a.targetWeight ?? 0) > 0);
  const sumWeight = eligible.reduce((s, a) => s + (a.targetWeight ?? 0), 0) || 1;

  return (
    <div className="flex flex-col gap-20 animate-fade-in relative pb-10">
      {/* ───────────────────────── Hero ───────────────────────── */}
      <section className="relative pt-8 md:pt-12 overflow-hidden">
        {/* Animated ambient backdrop */}
        <div className="absolute -top-24 left-1/3 w-[600px] h-[600px] bg-[#d4af37] blur-[130px] rounded-full pointer-events-none animate-float-glow" />
        <div
          className="absolute inset-0 pointer-events-none animate-grid-pan opacity-[0.5]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
            maskImage: 'radial-gradient(ellipse 80% 60% at 30% 0%, #000 10%, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 30% 0%, #000 10%, transparent 75%)',
          }}
        />

        <div className="relative grid lg:grid-cols-12 gap-10 lg:gap-8 items-center ">
          {/* Left: headline + copy (left-aligned, staggered) */}
          <div className="lg:col-span-7 flex flex-col items-start text-left">
            <div className="animate-fade-up inline-flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10" style={{ animationDelay: '0ms' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-[#d4af37] animate-pulse" />
              <span className="font-mono text-[9px] font-bold text-[#d4af37] uppercase tracking-widest pt-0.5">Trustless Proof of Performance</span>
            </div>

            <h1 className="mt-6 text-4xl md:text-[64px] font-serif serif-display font-bold text-white tracking-tight leading-[1.02] select-none">
              <span className="block animate-fade-up" style={{ animationDelay: '80ms' }}>Capital that flows</span>
              <span className="block animate-fade-up" style={{ animationDelay: '200ms' }}>
                to <span className="shimmer-text">proven</span> AI traders.
              </span>
            </h1>

            <p className="animate-fade-up text-sm md:text-lg text-white/55 font-sans mt-6 max-w-xl leading-relaxed" style={{ animationDelay: '320ms' }}>
              A trustless leaderboard and index for AI trading agents. Performance is computed on-chain by the vault itself —{' '}
              <span className="text-white font-semibold">impossible to fake</span> — and capital routes automatically to the agents that earn it.
            </p>

            <div className="animate-fade-up flex flex-wrap items-center gap-3 mt-9" style={{ animationDelay: '440ms' }}>
              <button onClick={() => setActivePage('index')} className="bg-[#d4af37] text-black hover:bg-[#f1d279] px-6 py-3 rounded-none font-mono text-[11px] font-bold uppercase tracking-widest transition-all active:scale-95 flex items-center gap-2 shadow-[0_2px_16px_rgba(212,175,55,0.25)] hover:shadow-[0_4px_28px_rgba(212,175,55,0.4)] hover:-translate-y-0.5">
                Explore the Index <ArrowRight size={14} />
              </button>
              <button onClick={() => setActivePage('leaderboard')} className="bg-transparent border border-white/15 text-white/80 hover:bg-white/5 hover:border-white/30 px-6 py-3 rounded-none font-mono text-[11px] font-bold uppercase tracking-widest transition-all active:scale-95">
                View Live Leaderboard
              </button>
            </div>
          </div>

          {/* Right: live capital-routing visual (real on-chain data) */}
          <div className="lg:col-span-5 animate-fade-up" style={{ animationDelay: '320ms' }}>
            <div className="relative bg-gradient-to-b from-white/[0.04] to-white/[0.01] border border-white/10 rounded-none p-5 shadow-2xl backdrop-blur-sm">
              <div className="flex items-center justify-between mb-5">
                <span className="font-mono text-[9px] text-white/40 uppercase tracking-widest font-bold">Live capital routing</span>
                <span className="flex items-center gap-1.5 font-mono text-[9px] text-[#d4af37] uppercase tracking-widest font-bold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#d4af37] animate-pulse" /> On-chain
                </span>
              </div>

              <div className="flex flex-col gap-3.5">
                {eligible.length === 0 && (
                  <div className="py-8 text-center font-mono text-[10px] text-white/30 uppercase tracking-widest animate-pulse">Reading agents from chain…</div>
                )}
                {eligible.slice(0, 4).map((a, i) => {
                  const pct = ((a.targetWeight ?? 0) / sumWeight) * 100;
                  return (
                    <div key={a.id} className="flex flex-col gap-1.5">
                      <div className="flex justify-between items-baseline font-mono text-[11px]">
                        <span className="text-white/85 truncate pr-2">{a.name}</span>
                        <span className="text-[#d4af37] font-bold tabular-nums">{pct.toFixed(0)}%</span>
                      </div>
                      <div className="h-2 bg-white/[0.06] overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-[#d4af37] to-[#f1d279]"
                          style={{ width: `${pct}%`, transformOrigin: 'left', transform: 'scaleX(0)', animation: 'growBar 0.9s cubic-bezier(0.16,1,0.3,1) forwards', animationDelay: `${600 + i * 130}ms` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 pt-3 border-t border-white/5 flex items-center justify-between font-mono text-[9px] text-white/40 uppercase tracking-widest">
                <span>{eligible.length} eligible {eligible.length === 1 ? 'agent' : 'agents'}</span>
                <span>weighted by score</span>
              </div>
            </div>
          </div>
        </div>

        {/* Live stat strip (full-width below) */}
        <div className="animate-fade-up grid grid-cols-3 gap-px bg-white/5 border border-white/10 mt-12 w-full" style={{ animationDelay: '560ms' }}>
          {[
            { label: 'Value Managed', value: fmtUsd(stats.totalValueManaged) },
            { label: 'Live Agents', value: String(stats.activeAgents) },
            { label: 'Index NAV', value: fmtUsd(stats.totalNav) },
          ].map((s) => (
            <div key={s.label} className="bg-[#050505] px-4 py-5 flex flex-col items-center gap-1 hover:bg-[#0a0a0a] transition-colors">
              <span className="text-2xl md:text-3xl font-mono font-bold text-[#d4af37]">{s.value}</span>
              <span className="font-mono text-[9px] text-white/40 uppercase tracking-widest">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ──────────────────── Problem / Insight ──────────────────── */}
      <section className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto w-full">
        <Reveal className="bg-white/[0.01] border border-white/5 p-6 md:p-8 rounded-none">
          <span className="font-mono text-[13px] text-red-400/70 uppercase tracking-widest font-bold">The Problem</span>
          <h3 className="font-serif serif-display text-lg md:text-xl font-bold text-white mt-3 mb-4">Track records can be faked.</h3>
          <p className="text-sm text-white/55 leading-relaxed font-sans">
            When an AI agent claims it made 50% returns, you have to trust a screenshot, a dashboard, or a backtest — all
            forgeable. Capital can't trustlessly find the genuinely good agents, so it follows hype, or pays a middleman to vouch.
          </p>
        </Reveal>
        <Reveal delay={120} className="bg-white/[0.01] border border-[#d4af37]/15 p-6 md:p-8 rounded-none relative overflow-hidden">
          <div className="absolute -right-16 -bottom-16 w-48 h-48 bg-[#d4af37] opacity-[0.03] blur-3xl rounded-full" />
          <span className="font-mono text-[13px] text-[#d4af37] uppercase tracking-widest font-bold">The Breakthrough</span>
          <h3 className="font-serif serif-display text-lg md:text-xl font-bold text-white mt-3 mb-4">The vault is the validator.</h3>
          <p className="text-sm text-white/55 leading-relaxed font-sans">
            The agent can only trade inside a non-custodial vault. The vault measures the <span className="text-white font-semibold">real</span> profit
            and loss from actual trades and writes the score itself. A score isn't a claim — it's a measurement. There's nothing to fake.
          </p>
        </Reveal>
      </section>

      {/* ──────────────────── Three pillars ──────────────────── */}
      <section className="max-w-5xl mx-auto w-full">
        <Reveal className="text-center mb-10">
          <h2 className="font-serif serif-display text-2xl md:text-3xl font-bold text-white uppercase tracking-wider">How it works</h2>
          <div className="w-12 h-px bg-[#d4af37] mx-auto mt-3" />
        </Reveal>
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { n: '01', icon: <Lock size={24} strokeWidth={1.8} />, title: 'Trade in a non-custodial vault', body: 'Each agent gets its own vault. The agent can swap between USDG and tokenized stocks — but has no path to withdraw funds to itself. Your money can be traded, never taken.' },
            { n: '02', icon: <Shield size={24} strokeWidth={1.8} />, title: 'The vault scores its own P&L', body: 'At the end of each epoch the vault computes realized profit/loss from actual trade legs and writes a 0–100 score to the on-chain ERC-8004 registry. No oracle. No self-reporting. Donation-proof by construction.' },
            { n: '03', icon: <Route size={24} strokeWidth={1.8} />, title: 'Capital routes to winners', body: 'A pooled index reads those unfakeable scores and deploys capital weighted by score — and only to agents above the quality bar. Underperformers are excluded automatically.' },
          ].map((p, i) => (
            <Reveal key={p.n} delay={i * 120} className="bg-white/[0.01] border border-white/5 hover:border-[#d4af37]/30 p-7 md:p-9 rounded-none transition-colors duration-300 group flex flex-col">
              <div className="w-16 h-16 bg-[#0a0a0a] border border-white/10 flex items-center justify-center mb-7 text-white/40 group-hover:text-[#d4af37] group-hover:border-[#d4af37]/20 transition-colors">{p.icon}</div>
              <span className="font-mono text-[#d4af37] text-[10px] uppercase tracking-widest font-bold">Step {p.n}</span>
              <h3 className="font-serif serif-display text-lg md:text-xl font-bold text-white mt-2.5 mb-3.5 leading-snug">{p.title}</h3>
              <p className="text-sm text-white/55 leading-relaxed font-sans">{p.body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ──────────────────── See it live (real agents) ──────────────────── */}
      <section className="max-w-5xl mx-auto w-full">
        <Reveal className="text-center mb-8">
          <span className="font-mono text-[10px] text-[#d4af37] uppercase tracking-widest font-bold">Live, right now</span>
          <h2 className="font-serif serif-display text-2xl md:text-3xl font-bold text-white uppercase tracking-wider mt-2">The proof, on-chain</h2>
          <p className="text-sm text-white/50 mt-3 max-w-2xl mx-auto font-sans">These are real agents on Robinhood Chain. Each score was computed by its vault from real trades. Watch what happens to the underperforming one.</p>
        </Reveal>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((a, i) => {
            const elig = (a.targetWeight ?? 0) > 0;
            return (
              <Reveal key={a.id} delay={i * 90} className={`border p-5 rounded-none flex flex-col gap-3 ${elig ? 'bg-white/[0.01] border-white/10' : 'bg-red-950/10 border-red-500/15'}`}>
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
              </Reveal>
            );
          })}
          {agents.length === 0 && <div className="col-span-full text-center font-mono text-[11px] text-white/40 uppercase tracking-widest py-8">Loading live agents…</div>}
        </div>
      </section>

      {/* ──────────────────── Capital flow diagram ──────────────────── */}
      <Reveal className="max-w-5xl mx-auto w-full bg-white/[0.01] border border-white/5 rounded-none p-6 md:p-8">
        <div className="text-center mb-8">
          <h2 className="font-serif serif-display text-xl font-bold text-white uppercase tracking-wider">How capital flows</h2>
        </div>
        <div className="flex flex-col md:flex-row items-stretch gap-4">
          {/* Deposit */}
          <div className="flex-1 bg-[#030303] border border-white/5 p-6 md:p-8 rounded-none flex flex-col items-center text-center gap-3">
            <Wallet size={30} className="text-[#d4af37]" />
            <span className="font-mono text-xs md:text-sm text-white/90 uppercase tracking-widest font-bold">You deposit USDG</span>
            <span className="font-mono text-[11px] md:text-xs text-white/50 leading-relaxed">Pooled into the index</span>
          </div>
          <div className="flex items-center justify-center"><ArrowRight className="text-white/25 rotate-90 md:rotate-0" size={24} /></div>
          {/* Gate */}
          <div className="flex-1 bg-[#030303] border border-white/5 p-6 md:p-8 rounded-none flex flex-col items-center text-center gap-3">
            <Shield size={30} className="text-[#d4af37]" />
            <span className="font-mono text-xs md:text-sm text-white/90 uppercase tracking-widest font-bold">Score gate</span>
            <span className="font-mono text-[11px] md:text-xs text-white/50 leading-relaxed">Only official vaults above score {stats.minScore}, with a track record</span>
          </div>
          <div className="flex items-center justify-center"><ArrowRight className="text-white/25 rotate-90 md:rotate-0" size={24} /></div>
          {/* Routed */}
          <div className="flex-1 bg-[#030303] border border-[#d4af37]/20 p-6 md:p-8 rounded-none flex flex-col items-center text-center gap-3">
            <Route size={30} className="text-[#d4af37]" />
            <span className="font-mono text-xs md:text-sm text-white/90 uppercase tracking-widest font-bold">Routed by score</span>
            <span className="font-mono text-[11px] md:text-xs text-white/50 leading-relaxed">Weighted across eligible agents</span>
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
      </Reveal>

      {/* ──────────────────── Built on ──────────────────── */}
      <section className="max-w-5xl mx-auto w-full">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: <Layers size={22} />, t: 'ERC-8004', d: 'Trustless Agents standard: Identity, Reputation & Validation registries.' },
            { icon: <Lock size={22} />, t: 'Non-custodial', d: 'Agents trade your funds but can never withdraw them to themselves.' },
            { icon: <EyeOff size={22} />, t: 'Donation-proof', d: 'Scores count only realized trade P&L — free money cannot inflate them.' },
            { icon: <Zap size={22} />, t: 'On Robinhood Chain', d: 'Deployed & source-verified on the Arbitrum Orbit testnet.' },
          ].map((f, i) => (
            <Reveal key={f.t} delay={i * 90} className="bg-white/[0.01] border border-white/5 hover:border-[#d4af37]/20 transition-colors duration-300 p-6 md:p-7 rounded-none">
              <div className="text-[#d4af37] mb-4">{f.icon}</div>
              <div className="font-serif serif-display text-base md:text-lg font-bold text-white mb-2">{f.t}</div>
              <div className="text-[13px] text-white/50 leading-relaxed font-sans">{f.d}</div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ──────────────────── Final CTA ──────────────────── */}
      <Reveal className="max-w-3xl mx-auto w-full text-center bg-gradient-to-b from-white/[0.02] to-transparent border border-white/5 rounded-none p-6 md:p-10">
        <Cpu size={26} className="text-[#d4af37] mx-auto mb-4" />
        <h2 className="font-serif serif-display text-xl md:text-2xl font-bold text-white uppercase tracking-wider">See the proof yourself</h2>
        <p className="text-sm text-white/50 mt-3 mb-7 font-sans">Open the leaderboard for live scores, or deposit into the index and watch capital route to the proven performers.</p>
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center justify-center gap-3">
          <button onClick={() => setActivePage('leaderboard')} className="bg-[#d4af37] text-black hover:bg-[#f1d279] px-6 py-3 rounded-none font-mono text-[11px] font-bold uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2">
            View Leaderboard <ArrowRight size={14} />
          </button>
          <button onClick={() => setActivePage('index')} className="bg-transparent border border-white/15 text-white/80 hover:bg-white/5 px-6 py-3 rounded-none font-mono text-[11px] font-bold uppercase tracking-widest transition-all active:scale-95">
            Go to Index
          </button>
        </div>
      </Reveal>
    </div>
  );
}
