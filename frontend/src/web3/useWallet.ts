import { useCallback, useEffect, useState } from 'react';
import { createWalletClient, custom, formatUnits, parseUnits } from 'viem';

// Loose wallet-client surface (only writeContract is used) — avoids viem's deep generic instantiation.
type WClient = { writeContract: (args: Record<string, unknown>) => Promise<`0x${string}`> };
import { publicClient, robinhoodTestnet, CONTRACTS, USDG_DECIMALS } from './config';
import { erc20Abi, controllerAbi, vaultAbi, factoryAbi } from './abis';

type Eth = { request: (a: { method: string; params?: unknown[] }) => Promise<unknown>; on?: (e: string, cb: (...a: unknown[]) => void) => void; removeListener?: (e: string, cb: (...a: unknown[]) => void) => void };
const getEth = (): Eth | undefined => (typeof window !== 'undefined' ? (window as unknown as { ethereum?: Eth }).ethereum : undefined);

export interface WalletApi {
  hasWallet: boolean;
  connected: boolean;
  address: string | null;
  usdgBalance: number; // human USDG
  userShares: number; // human USDG value of index shares (1 share ~ initial 1 USDG)
  busy: string | null; // current pending action label, or null
  lastTxHash: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  faucet: (amount?: number) => Promise<void>;
  depositIndex: (amount: number) => Promise<void>;
  withdrawIndex: (amount: number) => Promise<void>;
  depositVault: (vault: string, amount: number) => Promise<void>;
  allocate: (amount: number) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useWallet(onChange?: () => void): WalletApi {
  const [address, setAddress] = useState<string | null>(null);
  const [usdgBalance, setUsdgBalance] = useState(0);
  const [userShares, setUserShares] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const hasWallet = !!getEth();

  const walletClient = useCallback((): WClient => {
    const eth = getEth();
    if (!eth) throw new Error('No Ethereum wallet found. Install MetaMask.');
    return createWalletClient({ chain: robinhoodTestnet, transport: custom(eth) }) as unknown as WClient;
  }, []);

  const refresh = useCallback(async () => {
    if (!address) return;
    const [bal, sh] = await Promise.all([
      publicClient.readContract({ address: CONTRACTS.USDG as `0x${string}`, abi: erc20Abi, functionName: 'balanceOf', args: [address as `0x${string}`] }),
      publicClient.readContract({ address: CONTRACTS.AllocationController as `0x${string}`, abi: controllerAbi, functionName: 'shares', args: [address as `0x${string}`] }),
    ]);
    setUsdgBalance(Number(formatUnits(bal as bigint, USDG_DECIMALS)));
    setUserShares(Number(formatUnits(sh as bigint, USDG_DECIMALS)));
  }, [address]);

  useEffect(() => { refresh(); }, [refresh]);

  // Ensure the wallet is on Robinhood Chain; add it if unknown.
  const ensureChain = useCallback(async () => {
    const eth = getEth();
    if (!eth) return;
    const hexId = `0x${robinhoodTestnet.id.toString(16)}`;
    try {
      await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: hexId }] });
    } catch {
      await eth.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: hexId,
          chainName: robinhoodTestnet.name,
          nativeCurrency: robinhoodTestnet.nativeCurrency,
          rpcUrls: robinhoodTestnet.rpcUrls.default.http,
          blockExplorerUrls: [robinhoodTestnet.blockExplorers.default.url],
        }],
      });
    }
  }, []);

  const connect = useCallback(async () => {
    const eth = getEth();
    if (!eth) { alert('No Ethereum wallet found. Install MetaMask to interact.'); return; }
    setBusy('Connecting');
    try {
      const accts = (await eth.request({ method: 'eth_requestAccounts' })) as string[];
      await ensureChain();
      setAddress(accts[0]);
    } finally { setBusy(null); }
  }, [ensureChain]);

  const disconnect = useCallback(() => { setAddress(null); setUsdgBalance(0); setUserShares(0); }, []);

  // Send a tx, wait for receipt, refresh balances, notify the app to re-read protocol data.
  const run = useCallback(async (label: string, fn: (wc: WClient, acct: `0x${string}`) => Promise<`0x${string}`>) => {
    if (!address) { await connect(); return; }
    setBusy(label);
    try {
      await ensureChain();
      const wc = walletClient();
      const hash = await fn(wc, address as `0x${string}`);
      setLastTxHash(hash);
      await publicClient.waitForTransactionReceipt({ hash });
      await refresh();
      onChange?.();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      alert(`${label} failed: ${msg.split('\n')[0]}`);
    } finally { setBusy(null); }
  }, [address, connect, ensureChain, walletClient, refresh, onChange]);

  const faucet = useCallback(async (amount = 2500) => {
    await run('Faucet', async (wc, acct) => wc.writeContract({
      chain: robinhoodTestnet, account: acct,
      address: CONTRACTS.USDG as `0x${string}`, abi: erc20Abi, functionName: 'mint',
      args: [acct, parseUnits(String(amount), USDG_DECIMALS)],
    }));
  }, [run]);

  const depositIndex = useCallback(async (amount: number) => {
    const amt = parseUnits(String(amount), USDG_DECIMALS);
    await run('Deposit', async (wc, acct) => {
      // Approve only if needed, then deposit.
      const allowance = (await publicClient.readContract({ address: CONTRACTS.USDG as `0x${string}`, abi: erc20Abi, functionName: 'allowance', args: [acct, CONTRACTS.AllocationController as `0x${string}`] })) as bigint;
      if (allowance < amt) {
        const ah = await wc.writeContract({ chain: robinhoodTestnet, account: acct, address: CONTRACTS.USDG as `0x${string}`, abi: erc20Abi, functionName: 'approve', args: [CONTRACTS.AllocationController as `0x${string}`, amt] });
        await publicClient.waitForTransactionReceipt({ hash: ah });
      }
      return wc.writeContract({ chain: robinhoodTestnet, account: acct, address: CONTRACTS.AllocationController as `0x${string}`, abi: controllerAbi, functionName: 'deposit', args: [amt] });
    });
  }, [run]);

  const withdrawIndex = useCallback(async (amount: number) => {
    const amt = parseUnits(String(amount), USDG_DECIMALS);
    await run('Withdraw', async (wc, acct) => wc.writeContract({ chain: robinhoodTestnet, account: acct, address: CONTRACTS.AllocationController as `0x${string}`, abi: controllerAbi, functionName: 'withdraw', args: [amt] }));
  }, [run]);

  const depositVault = useCallback(async (vault: string, amount: number) => {
    const amt = parseUnits(String(amount), USDG_DECIMALS);
    await run('Vault deposit', async (wc, acct) => {
      const allowance = (await publicClient.readContract({ address: CONTRACTS.USDG as `0x${string}`, abi: erc20Abi, functionName: 'allowance', args: [acct, vault as `0x${string}`] })) as bigint;
      if (allowance < amt) {
        const ah = await wc.writeContract({ chain: robinhoodTestnet, account: acct, address: CONTRACTS.USDG as `0x${string}`, abi: erc20Abi, functionName: 'approve', args: [vault as `0x${string}`, amt] });
        await publicClient.waitForTransactionReceipt({ hash: ah });
      }
      return wc.writeContract({ chain: robinhoodTestnet, account: acct, address: vault as `0x${string}`, abi: vaultAbi, functionName: 'deposit', args: [amt] });
    });
  }, [run]);

  // Operator-only: deploy idle pool USDG across eligible vaults, weighted by score.
  const allocate = useCallback(async (amount: number) => {
    const amt = parseUnits(String(amount), USDG_DECIMALS);
    await run('Allocate', async (wc, acct) => {
      // Candidates must be strictly ascending official-vault addresses (contract requirement).
      const vaults = (await publicClient.readContract({ address: CONTRACTS.VaultFactory as `0x${string}`, abi: factoryAbi, functionName: 'officialVaults' })) as `0x${string}`[];
      const sorted = [...vaults].sort((a, b) => (a.toLowerCase() < b.toLowerCase() ? -1 : 1));
      return wc.writeContract({ chain: robinhoodTestnet, account: acct, address: CONTRACTS.AllocationController as `0x${string}`, abi: controllerAbi, functionName: 'allocate', args: [sorted, amt] });
    });
  }, [run]);

  // React to account/chain changes in the wallet.
  useEffect(() => {
    const eth = getEth();
    if (!eth?.on) return;
    const onAccts = (...a: unknown[]) => { const accts = a[0] as string[]; setAddress(accts?.[0] ?? null); };
    eth.on('accountsChanged', onAccts);
    return () => eth.removeListener?.('accountsChanged', onAccts);
  }, []);

  return { hasWallet, connected: !!address, address, usdgBalance, userShares, busy, lastTxHash, connect, disconnect, faucet, depositIndex, withdrawIndex, depositVault, allocate, refresh };
}
