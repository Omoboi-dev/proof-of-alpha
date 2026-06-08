import React, { useState } from 'react';
import { Terminal, Check, Copy } from 'lucide-react';
import { Page } from '../types';

interface HeaderProps {
  activePage: Page;
  setActivePage: (p: Page) => void;
  connected: boolean;
  address: string | null;
  usdgBalance: number;
  onConnect: () => void;
  onDisconnect: () => void;
  onFaucet: () => void;
  busy: string | null;
}

export default function Header({
  activePage,
  setActivePage,
  connected,
  address,
  usdgBalance,
  onConnect,
  onDisconnect,
  onFaucet,
  busy,
}: HeaderProps) {
  const [copied, setCopied] = useState(false);
  const [showWalletMenu, setShowWalletMenu] = useState(false);
  const addr = address ?? '';

  const copyAddress = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!addr) return;
    navigator.clipboard.writeText(addr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const navBtn = (page: Page, label: string, alsoActive?: Page) => (
    <button
      onClick={() => setActivePage(page)}
      className={`h-full flex items-center px-5 font-mono text-[11px] font-bold uppercase tracking-wider transition-all duration-200 border-b-2 active:scale-95 ${
        activePage === page || activePage === alsoActive
          ? 'text-[#d4af37] border-[#d4af37] bg-white/5'
          : 'text-white/60 border-transparent hover:text-white hover:bg-white/5'
      }`}
    >
      {label}
    </button>
  );

  return (
    <header className="fixed top-0 left-0 w-full z-50 border-b border-white/5 bg-[#050505]/95 backdrop-blur-md shadow-[0_4px_24px_rgba(0,0,0,0.6)] h-16">
      <div className="max-w-[1440px] mx-auto h-full px-4 md:px-8 flex justify-between items-center">
        <div onClick={() => setActivePage('leaderboard')} className="flex items-center gap-2.5 cursor-pointer hover:opacity-85 transition-opacity">
          <Terminal className="text-[#d4af37]" size={20} strokeWidth={2.5} />
          <span className="text-lg font-bold text-[#d4af37] tracking-wider font-serif serif-display uppercase">Proof of Alpha</span>
        </div>

        <nav className="hidden md:flex gap-1 h-full items-center">
          {navBtn('how-it-works', 'How It Works')}
          {navBtn('index', 'Index')}
          {navBtn('leaderboard', 'Leaderboard', 'agent-detail')}
        </nav>

        <div className="relative">
          {connected ? (
            <button
              onClick={() => setShowWalletMenu(!showWalletMenu)}
              className="bg-white/5 border border-white/10 text-white/90 px-3 py-1.5 rounded-sm flex items-center gap-2 hover:bg-white/10 transition-colors active:scale-95 font-mono text-[12px]"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#d4af37] animate-pulse"></span>
              <span>{addr.slice(0, 6)}...{addr.slice(-4)}</span>
            </button>
          ) : (
            <button
              onClick={onConnect}
              disabled={!!busy}
              className="bg-[#d4af37] text-black hover:bg-[#f1d279] disabled:opacity-60 px-4 py-2 rounded-sm font-mono text-[11px] font-bold uppercase tracking-widest transition-all duration-200 active:scale-95 shadow-[0_2px_12px_rgba(212,175,55,0.25)]"
            >
              {busy === 'Connecting' ? 'Connecting…' : 'Connect Wallet'}
            </button>
          )}

          {connected && showWalletMenu && (
            <div className="absolute right-0 mt-2 w-64 bg-[#0a0a0a] border border-white/10 rounded-sm shadow-2xl p-4 z-50 text-left">
              <div className="flex justify-between items-center mb-3">
                <span className="text-[10px] font-mono font-bold text-white/60 uppercase tracking-widest">Connected Wallet</span>
                <span className="bg-[#d4af37]/10 text-[#d4af37] text-[9px] px-1.5 py-0.5 rounded-sm font-bold font-mono">LIVE</span>
              </div>
              <div className="flex items-center justify-between bg-white/[0.02] px-2.5 py-2 rounded-sm border border-white/5 mb-4">
                <span className="font-mono text-[11px] text-white/80 select-all">{addr.slice(0, 10)}...{addr.slice(-8)}</span>
                <button onClick={copyAddress} className="text-white/40 hover:text-[#d4af37] transition-colors" title="Copy address">
                  {copied ? <Check size={13} className="text-[#d4af37]" /> : <Copy size={13} />}
                </button>
              </div>
              <div className="space-y-1 mb-4">
                <div className="flex justify-between text-[11px] text-white/60 font-sans">
                  <span>Balance:</span>
                  <span className="font-mono text-[#d4af37] font-bold">
                    {usdgBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDG
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <button onClick={onFaucet} disabled={!!busy} className="w-full text-center py-2 rounded-sm bg-white/5 border border-white/10 hover:border-[#d4af37]/40 text-[10px] font-mono font-bold uppercase text-white/80 transition-all hover:text-white disabled:opacity-50">
                  + Faucet 2.5k
                </button>
                <button onClick={() => { onDisconnect(); setShowWalletMenu(false); }} className="w-full text-center py-2 rounded-sm bg-red-950/20 border border-red-500/15 hover:bg-red-500/20 text-[10px] font-mono font-bold uppercase text-red-400 transition-all">
                  Disconnect
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
