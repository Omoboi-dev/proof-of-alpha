import { useCallback, useEffect, useState } from 'react';
import { formatUnits } from 'viem';
import { publicClient, CONTRACTS, USDG_DECIMALS } from './config';
import { factoryAbi, vaultAbi, validationAbi, identityAbi, controllerAbi } from './abis';
import { Agent, EpochRecord } from '../types';

export interface ProtocolStats {
  totalValueManaged: number; // sum of all vault assets (USDG)
  totalNav: number; // AllocationController NAV (USDG)
  idle: number; // undeployed USDG sitting in the index
  deployed: number; // USDG working inside agent vaults (= nav - idle)
  activeAgents: number;
  minScore: number;
  operator: string; // AllocationController owner (only address that can allocate)
}

export interface ProtocolData {
  agents: Agent[];
  stats: ProtocolStats;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

// Presentational name + strategy copy keyed by the agent URI slug. Risk is DERIVED from
// on-chain return volatility below — not hardcoded — so it stays honest.
const SLUG_META: Record<string, { name: string; strategy: string }> = {
  'momentum-alpha': {
    name: 'Momentum Alpha',
    strategy:
      'Momentum Alpha rides directional trends in tokenized equities, scaling into strength and realizing gains each epoch. Every trade settles on-chain inside its non-custodial vault.',
  },
  'steady-yield': {
    name: 'Steady Yield',
    strategy:
      'Steady Yield targets consistent, low-variance returns by harvesting small, repeatable edges. Conservative position sizing keeps drawdowns shallow across epochs.',
  },
  'mean-reversion': {
    name: 'Mean Reversion',
    strategy:
      'Mean Reversion fades short-term dislocations, betting price returns to fair value. An underperforming epoch here demonstrates the protocol excluding weaker agents from capital.',
  },
};

// Risk derived from the size of realized swings (volatility proxy): bigger moves = higher risk.
const deriveRisk = (returnRate: number, drawdownPct: number): Agent['riskProfile'] => {
  const vol = Math.max(Math.abs(returnRate), Math.abs(drawdownPct));
  return vol >= 25 ? 'High' : vol >= 8 ? 'Moderate' : 'Low';
};

const prettifySlug = (slug: string) =>
  slug.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const slugFromUri = (uri: string) => uri.replace(/^ipfs:\/\//, '').replace(/^https?:\/\//, '').split('/')[0];

const fmtUsd = (n: number) => {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
};

const toNum = (v: bigint) => Number(formatUnits(v, USDG_DECIMALS));

async function buildAgent(vault: `0x${string}`, index: number, minScore: number): Promise<Agent> {
  const [agentId, totalAssets, vaultTotalShares, epochActive, weightRaw] = await Promise.all([
    publicClient.readContract({ address: vault, abi: vaultAbi, functionName: 'agentId' }),
    publicClient.readContract({ address: vault, abi: vaultAbi, functionName: 'totalAssets' }),
    publicClient.readContract({ address: vault, abi: vaultAbi, functionName: 'totalShares' }),
    publicClient.readContract({ address: vault, abi: vaultAbi, functionName: 'epochActive' }),
    publicClient.readContract({ address: CONTRACTS.AllocationController as `0x${string}`, abi: controllerAbi, functionName: 'eligibleWeight', args: [vault] }),
  ]);

  const [summary, uri, controllerSharesRaw] = await Promise.all([
    publicClient.readContract({ address: CONTRACTS.ValidationRegistry as `0x${string}`, abi: validationAbi, functionName: 'getSummary', args: [agentId, [vault], ''] }),
    publicClient.readContract({ address: CONTRACTS.IdentityRegistry as `0x${string}`, abi: identityAbi, functionName: 'tokenURI', args: [agentId] }).catch(() => ''),
    publicClient.readContract({ address: CONTRACTS.AllocationController as `0x${string}`, abi: controllerAbi, functionName: 'controllerShares', args: [vault] }),
  ]);

  const count = Number((summary as readonly [bigint, number])[0]);
  const score = Number((summary as readonly [bigint, number])[1]);
  const weight = Number(weightRaw as bigint);

  // Epoch history from on-chain EpochSettled events (graceful fallback if the RPC limits ranges).
  let epochHistory: EpochRecord[] = [];
  try {
    const logs = await publicClient.getContractEvents({ address: vault, abi: vaultAbi, eventName: 'EpochSettled', fromBlock: 0n });
    epochHistory = logs
      .map((l) => {
        const a = l.args as { epochId?: bigint; realizedPnL?: bigint; score?: number };
        const pnl = a.realizedPnL ?? 0n;
        const s = Number(a.score ?? 0);
        return {
          epochId: Number(a.epochId ?? 0n),
          pnlValue: toNum(pnl < 0n ? -pnl : pnl),
          pnlNeg: pnl < 0n,
          score: s,
        };
      })
      .sort((x, y) => y.epochId - x.epochId)
      .map((r, i, arr) => ({
        epoch: i === 0 ? `${r.epochId} (Current)` : `${r.epochId}`,
        startCapital: '—',
        pnlPercentage: r.score - 50,
        pnlValue: `${r.pnlNeg ? '-' : '+'}${fmtUsd(r.pnlValue)}`,
        score: r.score,
      })) as EpochRecord[];
  } catch {
    epochHistory = [];
  }
  // Fallback single record so the detail view is never empty.
  if (epochHistory.length === 0 && count > 0) {
    epochHistory = [{ epoch: '1 (Current)', startCapital: '—', pnlPercentage: score - 50, pnlValue: `${score >= 50 ? '+' : '-'}—`, score }];
  }

  const slug = slugFromUri(uri as string);
  const meta = SLUG_META[slug] ?? { name: prettifySlug(slug) || `Agent #${agentId}`, strategy: 'A non-custodial AI trading vault. Performance is computed on-chain from realized P&L each epoch.' };

  const status: Agent['status'] = epochActive ? 'Evaluating' : count === 0 ? 'Syncing' : weight > 0 ? 'Eligible' : 'Excluded';

  // Derive honest secondary metrics from on-chain epoch history (no fabricated values).
  const positiveEpochs = epochHistory.filter((e) => e.pnlPercentage > 0).length;
  const winRate = epochHistory.length ? `${((positiveEpochs / epochHistory.length) * 100).toFixed(0)}%` : '—';
  const worst = epochHistory.reduce((m, e) => Math.min(m, e.pnlPercentage), 0);
  const maxDrawdown = worst < 0 ? `${worst.toFixed(1)}%` : '0.0%';
  const riskProfile = deriveRisk(score - 50, worst);

  const totalAssetsNum = toNum(totalAssets as bigint);
  const cShares = controllerSharesRaw as bigint;
  const vShares = vaultTotalShares as bigint;
  const positionNav = vShares > 0n ? totalAssetsNum * (Number(cShares) / Number(vShares)) : 0;

  return {
    id: vault.toLowerCase(),
    rank: String(index + 1).padStart(2, '0'),
    name: meta.name,
    score,
    returnRate: score - 50, // score is 50 + percentReturn, so this is the realized % return
    epochs: count,
    capital: fmtUsd(totalAssetsNum),
    status,
    vaultAddress: vault,
    riskProfile,
    maxDrawdown,
    sharpeRatio: '—',
    winRate,
    strategyProfile: meta.strategy,
    epochHistory,
    targetWeight: weight, // raw score-weight; normalized later against the eligible set
    actualWeight: positionNav,
  };
}

const EMPTY_STATS: ProtocolStats = { totalValueManaged: 0, totalNav: 0, idle: 0, deployed: 0, activeAgents: 0, minScore: 50, operator: '' };

export function useProtocol(pollMs = 15000): ProtocolData {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [stats, setStats] = useState<ProtocolStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [vaults, totalNavRaw, idleRaw, minScoreRaw, ownerRaw] = await Promise.all([
        publicClient.readContract({ address: CONTRACTS.VaultFactory as `0x${string}`, abi: factoryAbi, functionName: 'officialVaults' }),
        publicClient.readContract({ address: CONTRACTS.AllocationController as `0x${string}`, abi: controllerAbi, functionName: 'totalNAV' }),
        publicClient.readContract({ address: CONTRACTS.AllocationController as `0x${string}`, abi: controllerAbi, functionName: 'idleUSDG' }),
        publicClient.readContract({ address: CONTRACTS.AllocationController as `0x${string}`, abi: controllerAbi, functionName: 'minScore' }),
        publicClient.readContract({ address: CONTRACTS.AllocationController as `0x${string}`, abi: controllerAbi, functionName: 'owner' }),
      ]);
      const vaultList = vaults as readonly `0x${string}`[];
      const minScore = Number(minScoreRaw as number);

      const built = await Promise.all(vaultList.map((v, i) => buildAgent(v, i, minScore)));
      // Sort by score (desc) and re-rank so the leaderboard reads top-down.
      built.sort((a, b) => b.score - a.score);
      built.forEach((a, i) => (a.rank = String(i + 1).padStart(2, '0')));

      const totalValueManaged = built.reduce((sum, a) => {
        const raw = a.capital.replace(/[$,]/g, '');
        const mult = raw.endsWith('M') ? 1e6 : raw.endsWith('K') ? 1e3 : 1;
        return sum + parseFloat(raw) * mult;
      }, 0);

      const nav = toNum(totalNavRaw as bigint);
      const idle = toNum(idleRaw as bigint);
      setAgents(built);
      setStats({ totalValueManaged, totalNav: nav, idle, deployed: Math.max(0, nav - idle), activeAgents: vaultList.length, minScore, operator: (ownerRaw as string) });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to read on-chain data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, pollMs);
    return () => clearInterval(t);
  }, [load, pollMs]);

  return { agents, stats, loading, error, refresh: load };
}
