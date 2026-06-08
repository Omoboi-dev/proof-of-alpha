import React, { useState } from 'react';
import { Landmark, TrendingUp, RefreshCw, Settings } from 'lucide-react';
import { IndexState, Agent } from '../types';

interface IndexAllocationTabProps {
  indexState: IndexState;
  agents: Agent[];
  minScore: number;
  idle: number;
  deployed: number;
  connected: boolean;
  busy: string | null;
  isOperator: boolean;
  onConnect: () => void;
  onAllocate: (amount: number, isDeposit: boolean) => void;
  onAllocateCapital: (amount: number) => void;
  onRefresh: () => void;
}

const PALETTE = ['bg-[#d4af37]', 'bg-white/60', 'bg-white/30', 'bg-white/15'];

export default function IndexAllocationTab({
  indexState,
  agents,
  minScore,
  idle,
  deployed,
  connected,
  busy,
  isOperator,
  onConnect,
  onAllocate,
  onAllocateCapital,
  onRefresh,
}: IndexAllocationTabProps) {
  const [allocationMode, setAllocationMode] = useState<'deposit' | 'withdraw'>('deposit');
  const [amount, setAmount] = useState('500');
  const [allocAmount, setAllocAmount] = useState('');

  // Real eligible set + score-weighted target distribution.
  const eligible = agents.filter((a) => (a.targetWeight ?? 0) > 0);
  const excluded = agents.filter((a) => (a.targetWeight ?? 0) === 0);
  const sumWeight = eligible.reduce((s, a) => s + (a.targetWeight ?? 0), 0) || 1;
  const totalDeployed = agents.reduce((s, a) => s + (a.actualWeight ?? 0), 0);

  const rows = eligible.map((a, i) => ({
    name: a.name,
    sub: a.riskProfile + ' risk',
    target: ((a.targetWeight ?? 0) / sumWeight) * 100,
    actual: totalDeployed > 0 ? ((a.actualWeight ?? 0) / totalDeployed) * 100 : 0,
    actualUsd: a.actualWeight ?? 0, // real USDG currently deployed into this agent
    color: PALETTE[i % PALETTE.length],
  }));

  const handleActionClick = () => {
    if (!connected) { onConnect(); return; }
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) { alert('Please enter a valid amount.'); return; }
    if (allocationMode === 'deposit' && val > indexState.userBalance) { alert('Insufficient wallet USDG balance. Use the faucet in the wallet menu.'); return; }
    if (allocationMode === 'withdraw' && val > indexState.userShares) { alert('Insufficient deposited balance.'); return; }
    onAllocate(val, allocationMode === 'deposit');
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in relative pb-16">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-3 pb-2">
        <div className="space-y-1 text-left">
          <h1 className="text-3xl font-bold text-white tracking-widest font-serif serif-display uppercase">Index Allocation</h1>
          <p className="text-xs text-white/50 leading-relaxed font-sans">
            Deposit USDG into the pooled index. Capital is routed only to official vaults that pass the on-chain score and track-record gates.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-white/5 px-3.5 py-1.5 rounded-none border border-white/10 shadow-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-[#d4af37] animate-pulse"></span>
          <span className="font-mono text-[9px] font-bold text-[#d4af37] tracking-widest uppercase">On-Chain Live</span>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6 items-start">
        <div className="col-span-12 lg:col-span-8 flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white/[0.01] border border-white/5 p-6 rounded-none relative overflow-hidden group hover:border-[#d4af37]/30 transition-colors duration-300 text-left">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Landmark className="text-[#d4af37]" size={64} />
              </div>
              <span className="font-mono text-[10px] text-white/40 uppercase tracking-widest block mb-2 font-bold">Total Index NAV</span>
              <div className="text-3xl font-bold font-mono text-white tracking-tight">
                ${indexState.totalNav.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </div>
              <div className="flex items-center gap-2 mt-3 font-mono text-[10px] text-[#d4af37] font-bold">
                <TrendingUp size={13} />
                <span className="tracking-wider uppercase">Donation-proof NAV</span>
              </div>
            </div>

            <div className="bg-white/[0.01] border border-white/10 hover:border-[#d4af37]/30 p-6 rounded-none relative overflow-hidden group transition-all duration-300 text-left">
              <span className="font-mono text-[10px] text-white/40 uppercase tracking-widest block mb-2 font-bold">Your Allocated Shares</span>
              <div className="text-3xl font-bold font-mono text-[#d4af37] tracking-tight">
                ${indexState.userShares.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className="flex justify-between items-center mt-3 font-mono text-[10px] text-white/40">
                <span>Share: {indexState.totalNav > 0 ? ((indexState.userShares / indexState.totalNav) * 100).toFixed(4) : '0.0000'}%</span>
              </div>
            </div>
          </div>

          {/* Idle vs Deployed breakdown — shows where pooled capital actually sits */}
          <div className="bg-white/[0.01] border border-white/5 p-6 rounded-none text-left">
            <div className="flex justify-between items-end mb-3">
              <span className="font-mono text-[10px] text-white/40 uppercase tracking-widest font-bold">Capital Status</span>
              <span className="font-mono text-[10px] text-white/40">Total: ${indexState.totalNav.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
            </div>
            <div className="h-5 w-full rounded-none overflow-hidden flex bg-white/5 border border-white/10 p-0.5 mb-3">
              <div className="h-full bg-[#d4af37] transition-all duration-700" style={{ width: `${indexState.totalNav > 0 ? (deployed / indexState.totalNav) * 100 : 0}%` }} title={`Deployed $${deployed.toFixed(2)}`} />
              <div className="h-full bg-white/20 transition-all duration-700" style={{ width: `${indexState.totalNav > 0 ? (idle / indexState.totalNav) * 100 : 100}%` }} title={`Idle $${idle.toFixed(2)}`} />
            </div>
            <div className="grid grid-cols-2 gap-4 font-mono">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-[#d4af37]" />
                <div>
                  <div className="text-[9px] text-white/40 uppercase tracking-widest">Deployed in agents</div>
                  <div className="text-sm font-bold text-[#d4af37]">${deployed.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-white/30" />
                <div>
                  <div className="text-[9px] text-white/40 uppercase tracking-widest">Idle (undeployed)</div>
                  <div className="text-sm font-bold text-white/80">${idle.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                </div>
              </div>
            </div>
            <p className="font-mono text-[9px] text-white/30 uppercase tracking-wider leading-relaxed mt-3">
              Nothing is lost on allocation — capital moves from idle into agent vaults. NAV = deployed + idle.
            </p>
          </div>

          <div className="bg-white/[0.01] border border-white/5 rounded-none p-6 text-left shadow-xl animate-fade-in">
            <div className="flex justify-between items-center mb-6 border-b border-white/5 pb-4">
              <h3 className="font-serif serif-display text-sm font-bold text-white uppercase tracking-wider">Manage Capital</h3>
              <div className="flex bg-white/5 rounded-none p-0.5 border border-white/10">
                {(['deposit', 'withdraw'] as const).map((m) => (
                  <button key={m} onClick={() => setAllocationMode(m)} className={`px-4 py-1.5 rounded-none font-mono text-[9px] font-bold uppercase tracking-widest transition-all duration-150 ${allocationMode === m ? 'bg-white/10 text-[#d4af37] shadow-md' : 'text-white/40 hover:text-white'}`}>
                    {m}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col md:flex-row items-stretch gap-4">
                <div className="flex-grow bg-[#030303] px-4 py-3 border border-white/5 rounded-none focus-within:border-[#d4af37]/40 transition-colors flex items-center justify-between">
                  <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="bg-transparent border-none text-left font-mono text-sm font-semibold text-white focus:ring-0 p-0 w-full outline-none" placeholder="0.00" min="1" step="any" />
                  <span className="font-mono text-[10px] font-bold text-white/40 uppercase ml-4">USDG</span>
                </div>
                <button onClick={handleActionClick} disabled={!!busy} className="bg-[#d4af37] text-black hover:bg-[#f1d279] disabled:opacity-60 px-8 py-3.5 rounded-none font-mono text-[11px] font-bold uppercase tracking-widest transition-all duration-200 active:scale-95 whitespace-nowrap shadow-[0_2px_12px_rgba(212,175,55,0.2)]">
                  {!connected ? 'Connect Wallet' : busy ? `${busy}…` : allocationMode === 'deposit' ? 'Deposit USDG' : 'Withdraw USDG'}
                </button>
              </div>

              <div className="flex justify-between items-center font-mono text-[10.5px] text-white/40 uppercase tracking-wider">
                <span>
                  {allocationMode === 'deposit'
                    ? `Wallet: ${indexState.userBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })} USDG`
                    : `Deposited: ${indexState.userShares.toLocaleString(undefined, { minimumFractionDigits: 2 })} USDG`}
                </span>
                <button onClick={() => setAmount(Math.floor(allocationMode === 'deposit' ? indexState.userBalance : indexState.userShares).toString())} className="text-[#d4af37] hover:text-[#f1d279] uppercase font-bold text-[10px] tracking-widest">
                  Max
                </button>
              </div>
              <p className="font-mono text-[9px] text-white/30 uppercase tracking-wider leading-relaxed">
                No USDG? Connect a wallet and use the faucet in the wallet menu to mint demo USDG, then deposit here.
              </p>
            </div>
          </div>

          {/* Operator-only: deploy idle capital across agents (the on-chain `allocate`). */}
          {isOperator && (
            <div className="bg-white/[0.01] border border-[#d4af37]/20 rounded-none p-6 text-left">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-[9px] text-black bg-[#d4af37] px-1.5 py-0.5 uppercase tracking-widest font-bold">Operator</span>
                <h3 className="font-serif serif-display text-sm font-bold text-white uppercase tracking-wider">Allocate Idle Capital</h3>
              </div>
              <p className="text-[11px] text-white/45 leading-relaxed font-sans mb-4">
                You're connected as the index operator. Deploy idle USDG across eligible agents, weighted by on-chain score — underperforming agents are skipped automatically.
              </p>
              <div className="flex flex-col md:flex-row items-stretch gap-3">
                <div className="flex-grow bg-[#030303] px-4 py-3 border border-white/5 rounded-none focus-within:border-[#d4af37]/40 flex items-center justify-between">
                  <input type="number" value={allocAmount} onChange={(e) => setAllocAmount(e.target.value)} placeholder={`Max ${idle.toFixed(2)}`} className="bg-transparent border-none text-left font-mono text-sm font-semibold text-white focus:ring-0 p-0 w-full outline-none" min="1" step="any" />
                  <span className="font-mono text-[10px] font-bold text-white/40 uppercase ml-4">USDG</span>
                </div>
                <button
                  onClick={() => {
                    const v = parseFloat(allocAmount || String(idle));
                    if (isNaN(v) || v <= 0) { alert('Enter an amount to allocate.'); return; }
                    if (v > idle) { alert('Amount exceeds idle USDG. Deposit more, or lower the amount.'); return; }
                    onAllocateCapital(v);
                  }}
                  disabled={!!busy || idle <= 0}
                  className="bg-[#d4af37] text-black hover:bg-[#f1d279] disabled:opacity-50 px-6 py-3 rounded-none font-mono text-[11px] font-bold uppercase tracking-widest transition-all active:scale-95 whitespace-nowrap"
                >
                  {busy === 'Allocate' ? 'Allocating…' : 'Allocate'}
                </button>
              </div>
              <div className="flex justify-between items-center mt-2 font-mono text-[10px] text-white/40 uppercase tracking-wider">
                <span>Idle available: {idle.toLocaleString(undefined, { minimumFractionDigits: 2 })} USDG</span>
                <button onClick={() => setAllocAmount(Math.floor(idle).toString())} className="text-[#d4af37] hover:text-[#f1d279] font-bold tracking-widest">Max</button>
              </div>
            </div>
          )}
        </div>

        {/* Capital split — real score-weighted distribution */}
        <div className="col-span-12 lg:col-span-4 flex flex-col h-full">
          <div className="bg-white/[0.01] border border-white/5 rounded-none flex flex-col h-full shadow-2xl relative overflow-hidden">
            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
              <div className="text-left">
                <h3 className="font-serif serif-display text-sm font-bold text-[#d4af37] uppercase tracking-wider">Capital Split</h3>
                <p className="font-mono text-[9px] text-white/40 mt-1 uppercase tracking-widest">Score-weighted across eligible vaults</p>
              </div>
              <Settings size={15} className="text-white/40" />
            </div>

            <div className="p-6 flex-grow flex flex-col gap-6">
              <div>
                <div className="flex justify-between items-end mb-2.5 font-mono text-[10px] uppercase tracking-widest">
                  <span className="text-white/40">Target Distribution</span>
                  <span className="text-[#d4af37] font-bold">{eligible.length} eligible</span>
                </div>
                <div className="h-6 w-full rounded-none overflow-hidden flex bg-white/5 border border-white/10 p-0.5">
                  {rows.length === 0 ? (
                    <div className="h-full w-full flex items-center justify-center font-mono text-[8px] text-white/30 uppercase tracking-widest">No eligible agents</div>
                  ) : rows.map((r, i) => (
                    <div key={i} className={`h-full ${r.color} border-r border-[#050505] transition-all duration-1000`} style={{ width: `${r.target}%` }} title={`${r.name} (${r.target.toFixed(1)}%)`}></div>
                  ))}
                </div>
              </div>

              <div className="flex-grow max-h-[320px] overflow-y-auto pr-1">
                <div className="flex justify-between items-center font-mono text-[9px] text-white/40 uppercase pb-2 border-b border-white/5 mb-3 tracking-widest">
                  <span>Agent</span>
                  <div className="flex gap-4"><span>Target</span><span className="w-12 text-right">Actual</span></div>
                </div>

                <div className="flex flex-col gap-4 font-mono text-[12px]">
                  {rows.map((row, index) => (
                    <div key={index} className="flex flex-col gap-1.5 group">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full ${row.color}`} />
                          <div className="flex flex-col text-left">
                            <span className="text-white font-serif serif-display group-hover:text-[#d4af37] transition-colors font-bold text-[13px]">{row.name}</span>
                            <span className="text-[10px] text-[#d4af37]/80 leading-none mt-0.5 font-mono">${row.actualUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })} deployed</span>
                          </div>
                        </div>
                        <div className="flex gap-4 font-mono text-xs">
                          <span className="text-white/40">{row.target.toFixed(1)}%</span>
                          <span className="text-white font-bold w-12 text-right">{row.actual.toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="w-full h-[3px] bg-white/5 rounded-none overflow-hidden relative">
                        <div className={`h-full ${row.color}`} style={{ width: `${row.actual}%` }}></div>
                        <div className="absolute h-full w-[2px] bg-white z-10 top-0" style={{ left: `${row.target}%` }} title="Target" />
                      </div>
                    </div>
                  ))}

                  {excluded.map((a) => (
                    <div key={a.id} className="opacity-40 flex justify-between items-center pt-2 border-t border-white/5 mt-1">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                        <div className="flex flex-col text-left font-sans">
                          <span className="text-white/80 line-through text-xs font-bold font-serif serif-display">{a.name}</span>
                          <span className="text-[9px] text-red-300">{a.status === 'Syncing' ? 'No track record yet' : `Excluded (score < ${minScore})`}</span>
                        </div>
                      </div>
                      <div className="flex gap-4 font-mono text-[11px]"><span className="text-white/40">0.0%</span><span className="text-white/40 w-12 text-right">0.0%</span></div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-white/10 bg-white/[0.02]">
              <button onClick={onRefresh} disabled={!!busy} className="w-full py-3 border border-white/10 hover:bg-white/5 text-white/80 font-mono text-[9px] font-bold uppercase tracking-widest rounded-none transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50">
                <RefreshCw size={12} className={busy ? 'animate-spin text-[#d4af37]' : ''} /> Sync On-Chain Weights
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
