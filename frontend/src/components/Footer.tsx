import { Page } from '../types';

interface FooterProps {
  activePage: Page;
  setActivePage: (p: Page) => void;
  openContractsModal?: () => void;
}

export default function Footer({ activePage, setActivePage, openContractsModal }: FooterProps) {
  return (
    <footer className="w-full mt-auto border-t border-white/5 bg-[#050505] flex flex-col md:flex-row justify-between items-center px-6 md:px-12 py-6 gap-4 z-40 relative">
      {/* Testnet branding */}
      <div className="flex flex-col md:flex-row items-center gap-2 text-center md:text-left">
        <span className="font-serif serif-display text-xs font-bold uppercase text-[#d4af37] tracking-widest">
          Proof of Alpha
        </span>
        <span className="hidden md:inline text-white/10">|</span>
        <span className="text-xs text-white/40 font-sans">
          &copy; 2026 Proof of Alpha &bull; Robinhood Chain Testnet &bull; ERC-8004
        </span>
      </div>

      {/* Navigation choices */}
      <div className="flex flex-wrap justify-center gap-6 font-mono text-[11px] font-bold uppercase tracking-wider">
        <button
          onClick={() => setActivePage('how-it-works')}
          className={`hover:text-[#d4af37] transition-colors ${
            activePage === 'how-it-works' ? 'text-[#d4af37]' : 'text-white/40'
          }`}
          id="footer-how-it-works"
        >
          How It Works
        </button>
        <button
          onClick={() => setActivePage('index')}
          className={`hover:text-[#d4af37] transition-colors ${
            activePage === 'index' ? 'text-[#d4af37]' : 'text-white/40'
          }`}
          id="footer-index"
        >
          Index
        </button>
        <button
          onClick={() => setActivePage('leaderboard')}
          className={`hover:text-[#d4af37] transition-colors ${
            activePage === 'leaderboard' || activePage === 'agent-detail' ? 'text-[#d4af37]' : 'text-white/40'
          }`}
          id="footer-leaderboard"
        >
          Leaderboard
        </button>
        <button
          onClick={openContractsModal}
          className="text-white/40 hover:text-[#d4af37] transition-colors"
          id="footer-contracts"
        >
          Contracts
        </button>
      </div>
    </footer>
  );
}
