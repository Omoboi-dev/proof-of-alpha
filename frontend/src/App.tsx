import { useState } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import LeaderboardTab from './components/LeaderboardTab';
import AgentDetailTab from './components/AgentDetailTab';
import IndexAllocationTab from './components/IndexAllocationTab';
import HowItWorksTab from './components/HowItWorksTab';
import { Page, IndexState } from './types';
import { Check, Copy, ExternalLink, X, FileText, Loader2, AlertTriangle } from 'lucide-react';
import { useProtocol } from './web3/useProtocol';
import { useWallet } from './web3/useWallet';
import { CONTRACTS, explorerAddress, hasRunner } from './web3/config';

const fmtUsd = (n: number) => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
};

export default function App() {
  const [activePage, setActivePage] = useState<Page>('how-it-works');
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [showContractsModal, setShowContractsModal] = useState(false);
  const [copiedContractId, setCopiedContractId] = useState<string | null>(null);

  // Live on-chain data + real injected wallet (wallet refreshes protocol after each tx).
  const protocol = useProtocol();
  const wallet = useWallet(protocol.refresh);
  const { agents, stats } = protocol;

  const indexState: IndexState = {
    totalNav: stats.totalNav,
    userBalance: wallet.usdgBalance,
    userShares: wallet.userShares,
  };

  const handleSelectAgent = (agentId: string) => {
    setSelectedAgentId(agentId);
    setActivePage('agent-detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const handleBackToLeaderboard = () => {
    setSelectedAgentId(null);
    setActivePage('leaderboard');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleIndexAllocation = (amount: number, isDeposit: boolean) =>
    isDeposit ? wallet.depositIndex(amount) : wallet.withdrawIndex(amount);

  const handleAgentVaultDeposit = (agentId: string, amount: number) => wallet.depositVault(agentId, amount);

  const selectedAgent = agents.find((ag) => ag.id === selectedAgentId) || agents[0];

  const handleCopyContract = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedContractId(id);
    setTimeout(() => setCopiedContractId(null), 2000);
  };

  const verifiedContracts: { title: string; address: string }[] = [
    { title: 'Vault Factory (trust anchor)', address: CONTRACTS.VaultFactory },
    { title: 'Allocation Controller', address: CONTRACTS.AllocationController },
    { title: 'Validation Registry (scoreboard)', address: CONTRACTS.ValidationRegistry },
    { title: 'Identity Registry', address: CONTRACTS.IdentityRegistry },
    { title: 'Reputation Registry', address: CONTRACTS.ReputationRegistry },
    { title: 'USDG (demo dollar)', address: CONTRACTS.USDG },
    { title: 'Mock DEX', address: CONTRACTS.DEX },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#050505] text-[#e5e5e5] selection:bg-[#d4af37]/15 selection:text-[#d4af37]">
      <Header
        activePage={activePage}
        setActivePage={setActivePage}
        connected={wallet.connected}
        address={wallet.address}
        usdgBalance={wallet.usdgBalance}
        onConnect={wallet.connect}
        onDisconnect={wallet.disconnect}
        onFaucet={() => wallet.faucet(2500)}
        busy={wallet.busy}
      />

      <main className="flex-grow pt-24 pb-16 px-4 md:px-8 max-w-[1440px] mx-auto w-full flex flex-col gap-8">
        {/* Error banner if the chain can't be read */}
        {protocol.error && (
          <div className="flex items-center gap-3 bg-red-950/20 border border-red-500/20 text-red-300 px-4 py-3 font-mono text-[11px]">
            <AlertTriangle size={15} /> Could not read on-chain data: {protocol.error}
          </div>
        )}

        {activePage === 'leaderboard' && (
          <LeaderboardTab
            agents={agents}
            loading={protocol.loading}
            totalValueManaged={fmtUsd(stats.totalValueManaged)}
            totalCapitalAllocated={fmtUsd(stats.totalNav)}
            activeAgentsCount={stats.activeAgents}
            onSelectAgent={handleSelectAgent}
            onRunRound={wallet.runRound}
            connected={wallet.connected}
            busy={wallet.busy}
            canRun={hasRunner}
          />
        )}

        {activePage === 'agent-detail' && selectedAgent && (
          <AgentDetailTab
            agent={selectedAgent}
            onBack={handleBackToLeaderboard}
            connected={wallet.connected}
            usdgBalance={wallet.usdgBalance}
            onDeposit={handleAgentVaultDeposit}
            onRunRound={wallet.runRound}
            canRun={hasRunner}
            busy={wallet.busy}
          />
        )}

        {activePage === 'index' && (
          <IndexAllocationTab
            indexState={indexState}
            agents={agents}
            minScore={stats.minScore}
            idle={stats.idle}
            deployed={stats.deployed}
            connected={wallet.connected}
            busy={wallet.busy}
            isOperator={!!wallet.address && !!stats.operator && wallet.address.toLowerCase() === stats.operator.toLowerCase()}
            onConnect={wallet.connect}
            onAllocate={handleIndexAllocation}
            onAllocateCapital={wallet.allocate}
            onRefresh={protocol.refresh}
          />
        )}

        {activePage === 'how-it-works' && (
          <HowItWorksTab agents={agents} stats={stats} setActivePage={setActivePage} onConnect={wallet.connect} connected={wallet.connected} />
        )}
      </main>

      <Footer activePage={activePage} setActivePage={setActivePage} openContractsModal={() => setShowContractsModal(true)} />

      {/* Global pending-transaction toast */}
      {wallet.busy && (
        <div className="fixed bottom-5 right-5 bg-[#050505] border border-[#d4af37]/35 text-[#d4af37] font-mono text-[10px] tracking-widest px-4 py-3 z-50 uppercase font-bold flex items-center gap-2 shadow-2xl">
          <Loader2 size={13} className="animate-spin" /> {wallet.busy}… confirm in wallet
        </div>
      )}

      {/* Verified contracts modal — real addresses on the Robinhood Chain explorer */}
      {showContractsModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0a0a0a] border border-white/10 rounded-none max-w-xl w-full p-6 text-left relative shadow-2xl animate-scale-up">
            <button onClick={() => setShowContractsModal(false)} className="absolute top-4 right-4 text-white/40 hover:text-[#d4af37] transition-colors" title="Close modal">
              <X size={16} />
            </button>
            <h3 className="font-serif serif-display text-sm font-bold text-[#d4af37] uppercase tracking-wider flex items-center gap-2.5 mb-2">
              <FileText className="text-[#d4af37]" size={18} /> Verified Smart Contracts
            </h3>
            <p className="text-xs text-white/40 leading-relaxed mb-6 font-sans">
              All contracts are deployed and source-verified on the Robinhood Chain Testnet. Click any address to inspect the code and live state on the block explorer.
            </p>
            <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
              {verifiedContracts.map((contract, index) => {
                const isCopied = copiedContractId === contract.title;
                return (
                  <div key={index} className="bg-white/[0.01] border border-white/5 p-3 rounded-none flex flex-col gap-1 text-left">
                    <span className="text-[11px] font-bold text-white uppercase tracking-wider font-serif serif-display">{contract.title}</span>
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-[11px] text-[#d4af37] select-all truncate">{contract.address}</span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button onClick={() => handleCopyContract(contract.address, contract.title)} className="text-white/40 hover:text-[#d4af37] transition-colors p-1.5 rounded-none hover:bg-white/5" title="Copy Address">
                          {isCopied ? <Check size={13} className="text-[#d4af37]" /> : <Copy size={13} />}
                        </button>
                        <a href={explorerAddress(contract.address)} target="_blank" rel="noreferrer" className="text-white/40 hover:text-[#d4af37] transition-colors p-1.5 rounded-none hover:bg-white/5" title="Open on block explorer">
                          <ExternalLink size={13} />
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-6 flex justify-end">
              <button onClick={() => setShowContractsModal(false)} className="px-5 py-2 rounded-none bg-white/5 border border-white/10 text-white/70 hover:text-white font-mono text-[10px] uppercase font-bold tracking-wider transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
