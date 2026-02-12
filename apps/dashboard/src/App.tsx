import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LayoutGrid,
  Bot,
  Zap,
  Settings,
  LogOut,
  Plus,
  ChevronRight,
  CircleDot,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  DollarSign,
  User,
  ArrowRight,
  FileText,
  Send,
  ToggleLeft,
  ToggleRight,
  Wallet,
  Trash2,
  Loader2,
} from 'lucide-react';

const GATEWAY_URL = 'http://localhost:3000';
const WALLET_STORAGE_KEY = 'harbor_wallet_address';
const AUTOMATIONS_STORAGE_KEY = 'harbor_automations';

type UserType = 'HUMAN' | 'AGENT' | 'UNKNOWN';
type SubType = 'BUSINESS' | 'PERSONAL' | 'AUTONOMOUS';
type AskStatus = 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
type BidStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';
type AuthState = 'loading' | 'unauthenticated' | 'onboarding' | 'authenticated';
type View = 'tasks' | 'new-ask' | 'automations' | 'agents' | 'settings';
type TaskGroup = 'Needs Review' | 'Open' | 'In Progress' | 'Completed' | 'Canceled';

interface UserData {
  id: string;
  email: string;
  name: string;
  userType: UserType;
  subType: SubType;
  onboardingCompleted: boolean;
}

interface Agent {
  id: string;
  userId: string;
  name: string;
  type: 'BUYER' | 'SELLER' | 'DUAL';
  capabilities?: Record<string, unknown>;
}

interface Ask {
  id: string;
  title: string;
  description: string;
  requirements: Record<string, unknown>;
  minBudget: number;
  maxBudget: number;
  budgetFlexibilityAmount?: number;
  createdBy: string;
  status: AskStatus;
  deliveryData?: Record<string, unknown>;
}

interface Bid {
  id: string;
  askId: string;
  agentId: string;
  proposedPrice: number;
  estimatedDuration: number;
  proposal: string;
  status: BidStatus;
}

interface WalletData {
  id: string;
  agentId: string;
  blockchainAddress?: string;
  createdAt: string;
}

interface WalletWithBalance extends WalletData {
  balance?: string;
  agentName?: string;
}

interface TaskEntry {
  ask: Ask;
  buyerAgentId?: string;
  sellerAgentId?: string;
  sellerBid?: Bid;
}

interface AutomationRule {
  id: string;
  agentId: string;
  tags: string[];
  maxPrice?: number;
  enabled: boolean;
}

// ─── Utility components ────────────────────────────────────────────

function StatusBadge({ status }: { status: AskStatus }) {
  const config: Record<AskStatus, { label: string; className: string; icon: typeof CircleDot }> = {
    OPEN: { label: 'Open', className: 'bg-warning-muted text-warning', icon: CircleDot },
    IN_PROGRESS: { label: 'In Progress', className: 'bg-accent-muted text-accent', icon: Clock },
    COMPLETED: { label: 'Completed', className: 'bg-success-muted text-success', icon: CheckCircle2 },
    CANCELLED: { label: 'Cancelled', className: 'bg-danger-muted text-danger', icon: XCircle },
  };
  const { label, className, icon: Icon } = config[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${className}`}>
      <Icon size={12} />
      {label}
    </span>
  );
}

function StatusDot({ status }: { status: AskStatus }) {
  const colors: Record<AskStatus, string> = {
    OPEN: 'bg-warning',
    IN_PROGRESS: 'bg-accent',
    COMPLETED: 'bg-success',
    CANCELLED: 'bg-danger',
  };
  return <span className={`w-2 h-2 rounded-full shrink-0 ${colors[status]}`} />;
}

function EmptyState({ icon: Icon, title, description }: { icon: typeof FileText; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-12 h-12 rounded-xl bg-surface-2 flex items-center justify-center mb-4">
        <Icon size={20} className="text-text-tertiary" />
      </div>
      <h3 className="text-sm font-medium text-text-primary mb-1">{title}</h3>
      <p className="text-xs text-text-tertiary max-w-[240px]">{description}</p>
    </div>
  );
}

function Toast({ message, onDismiss }: { message: { type: 'success' | 'error'; text: string }; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 px-4 py-3 rounded-lg border text-sm font-medium animate-[slideUp_0.2s_ease] ${
        message.type === 'success'
          ? 'bg-success-muted border-success/20 text-success'
          : 'bg-danger-muted border-danger/20 text-danger'
      }`}
    >
      {message.text}
    </div>
  );
}

// ─── Nav items ─────────────────────────────────────────────────────

const NAV_ITEMS: { view: View; label: string; icon: typeof LayoutGrid }[] = [
  { view: 'tasks', label: 'Tasks', icon: LayoutGrid },
  { view: 'agents', label: 'Agents', icon: Bot },
  { view: 'automations', label: 'Automations', icon: Zap },
];

// ─── App ───────────────────────────────────────────────────────────

function App() {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [user, setUser] = useState<UserData | null>(null);
  const [activeView, setActiveView] = useState<View>('tasks');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [agents, setAgents] = useState<Agent[]>([]);
  const [tasks, setTasks] = useState<TaskEntry[]>([]);
  const [askBidsMap, setAskBidsMap] = useState<Record<string, Bid[]>>({});
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const [walletAddress, setWalletAddress] = useState('');
  const [automations, setAutomations] = useState<AutomationRule[]>([]);

  // New ask form
  const [askTitle, setAskTitle] = useState('');
  const [askDescription, setAskDescription] = useState('');
  const [askTags, setAskTags] = useState('');
  const [askMinBudget, setAskMinBudget] = useState('100');
  const [askMaxBudget, setAskMaxBudget] = useState('500');
  const [askDeadline, setAskDeadline] = useState('');
  const [askAgentId, setAskAgentId] = useState('');

  // Delivery form
  const [deliveryNote, setDeliveryNote] = useState('');

  // Agent create form
  const [agentName, setAgentName] = useState('');
  const [agentType, setAgentType] = useState<'BUYER' | 'SELLER' | 'DUAL'>('BUYER');

  // Automation form
  const [automationAgentId, setAutomationAgentId] = useState('');
  const [automationTags, setAutomationTags] = useState('');
  const [automationMaxPrice, setAutomationMaxPrice] = useState('');

  // Wallet view
  const [wallets, setWallets] = useState<WalletWithBalance[]>([]);

  // Onboarding
  const [onboardingStep, setOnboardingStep] = useState<0 | 1>(0);

  const clearMessage = () => setMessage(null);

  const getStoredWallet = () => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(WALLET_STORAGE_KEY) || '';
  };

  const storeWallet = (address: string) => {
    localStorage.setItem(WALLET_STORAGE_KEY, address);
    setWalletAddress(address);
  };

  // ─── Data fetching ───────────────────────────────────────────────

  const fetchAgents = useCallback(async (userId: string) => {
    try {
      const response = await fetch(`${GATEWAY_URL}/users/${userId}/agents`, { credentials: 'include' });
      if (!response.ok) return [] as Agent[];
      const data = await response.json();
      setAgents(data);
      return data as Agent[];
    } catch (error) {
      console.error('Failed to fetch agents', error);
      return [] as Agent[];
    }
  }, []);

  const fetchWallets = useCallback(async (agentsList: Agent[]) => {
    const results = await Promise.all(
      agentsList.map(async (agent) => {
        try {
          const response = await fetch(`${GATEWAY_URL}/wallets/agent/${agent.id}`, { credentials: 'include' });
          if (!response.ok) return null;
          const wallet = await response.json();
          try {
            const balanceResponse = await fetch(`${GATEWAY_URL}/wallets/agent/${agent.id}/balance`, { credentials: 'include' });
            if (balanceResponse.ok) {
              const balanceData = await balanceResponse.json();
              return { ...wallet, balance: balanceData.balance, agentName: agent.name } as WalletWithBalance;
            }
          } catch { /* ignore */ }
          return { ...wallet, agentName: agent.name } as WalletWithBalance;
        } catch {
          return null;
        }
      })
    );
    setWallets(results.filter((w): w is WalletWithBalance => w !== null));
  }, []);

  const fetchBuyerAsks = useCallback(async (buyerAgents: Agent[]) => {
    const results = await Promise.all(
      buyerAgents.map(async (agent) => {
        try {
          const response = await fetch(`${GATEWAY_URL}/dashboard/asks?agentId=${agent.id}`, { credentials: 'include' });
          if (response.ok) return (await response.json()) as Ask[];
        } catch (error) {
          console.error('Failed to fetch asks', error);
        }
        return [] as Ask[];
      })
    );
    return results.flat();
  }, []);

  const fetchBidsForAsks = useCallback(async (asks: Ask[]) => {
    const entries = await Promise.all(
      asks.map(async (ask) => {
        try {
          const response = await fetch(`${GATEWAY_URL}/dashboard/asks/${ask.id}/bids`, { credentials: 'include' });
          if (response.ok) {
            const bids = await response.json();
            return [ask.id, bids] as const;
          }
        } catch (error) {
          console.error('Failed to fetch bids for ask', error);
        }
        return [ask.id, []] as const;
      })
    );
    const map: Record<string, Bid[]> = {};
    for (const [askId, bids] of entries) {
      map[askId] = bids;
    }
    return map;
  }, []);

  const fetchSellerBids = useCallback(async (sellerAgents: Agent[]) => {
    const results = await Promise.all(
      sellerAgents.map(async (agent) => {
        try {
          const response = await fetch(`${GATEWAY_URL}/dashboard/bids?agentId=${agent.id}`, { credentials: 'include' });
          if (response.ok) return (await response.json()) as Bid[];
        } catch (error) {
          console.error('Failed to fetch seller bids', error);
        }
        return [] as Bid[];
      })
    );
    return results.flat();
  }, []);

  const fetchAskById = useCallback(async (askId: string) => {
    try {
      const response = await fetch(`${GATEWAY_URL}/asks/${askId}`, { credentials: 'include' });
      if (response.ok) return (await response.json()) as Ask;
    } catch (error) {
      console.error('Failed to fetch ask', error);
    }
    return null;
  }, []);

  const buildTasks = useCallback(
    async (buyerAsks: Ask[], sellerBids: Bid[]) => {
      const entries = new Map<string, TaskEntry>();
      for (const ask of buyerAsks) {
        entries.set(ask.id, { ask, buyerAgentId: ask.createdBy });
      }
      const acceptedBids = sellerBids.filter((bid) => bid.status === 'ACCEPTED');
      for (const bid of acceptedBids) {
        let entry = entries.get(bid.askId);
        if (!entry) {
          const ask = await fetchAskById(bid.askId);
          if (!ask) continue;
          entry = { ask };
        }
        entry.sellerAgentId = bid.agentId;
        entry.sellerBid = bid;
        entries.set(bid.askId, entry);
      }
      return Array.from(entries.values());
    },
    [fetchAskById]
  );

  const refreshDashboard = useCallback(async () => {
    if (!user) return;
    const agentList = await fetchAgents(user.id);
    const buyerAgents = agentList.filter((a) => a.type === 'BUYER' || a.type === 'DUAL');
    const sellerAgents = agentList.filter((a) => a.type === 'SELLER' || a.type === 'DUAL');
    const [buyerAsks, sellerBids] = await Promise.all([
      fetchBuyerAsks(buyerAgents),
      fetchSellerBids(sellerAgents),
    ]);
    const [bidsMap, builtTasks] = await Promise.all([
      fetchBidsForAsks(buyerAsks),
      buildTasks(buyerAsks, sellerBids),
    ]);
    setTasks(builtTasks);
    setAskBidsMap(bidsMap);
    setSelectedTaskId((prev) => {
      const hasSelected = prev && builtTasks.some((t) => t.ask.id === prev);
      return hasSelected ? prev : (builtTasks[0]?.ask.id || null);
    });
    if (agentList.length > 0) fetchWallets(agentList);
  }, [user, fetchAgents, fetchBuyerAsks, fetchBidsForAsks, fetchSellerBids, buildTasks, fetchWallets]);

  // ─── Auth ────────────────────────────────────────────────────────

  const checkAuth = useCallback(async () => {
    try {
      const response = await fetch(`${GATEWAY_URL}/auth/me`, { credentials: 'include' });
      if (!response.ok) { setAuthState('unauthenticated'); return; }
      const data = await response.json();
      if (!data.authenticated) { setAuthState('unauthenticated'); return; }
      setUser(data.user);
      const storedWallet = getStoredWallet();
      setWalletAddress(storedWallet);
      const agentList = await fetchAgents(data.user.id);
      if (!data.user.onboardingCompleted || !storedWallet || agentList.length === 0) {
        setAuthState('onboarding');
        setOnboardingStep(storedWallet ? 1 : 0);
      } else {
        setAuthState('authenticated');
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setAuthState('unauthenticated');
    }
  }, [fetchAgents]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');
    if (error) {
      setMessage({ type: 'error', text: 'Authentication failed. Please try again.' });
      window.history.replaceState({}, '', window.location.pathname);
    }
    const storedWallet = getStoredWallet();
    if (storedWallet) setWalletAddress(storedWallet);
    try {
      const storedAutomations = localStorage.getItem(AUTOMATIONS_STORAGE_KEY);
      if (storedAutomations) setAutomations(JSON.parse(storedAutomations));
    } catch {
      setAutomations([]);
    }
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    if (authState === 'authenticated') refreshDashboard();
  }, [authState, refreshDashboard]);

  useEffect(() => {
    if (authState !== 'authenticated') return;
    const interval = setInterval(refreshDashboard, 15000);
    return () => clearInterval(interval);
  }, [authState, refreshDashboard]);

  // ─── Handlers ────────────────────────────────────────────────────

  const handleLogin = () => { window.location.href = `${GATEWAY_URL}/auth/login`; };

  const handleLogout = async () => {
    try { await fetch(`${GATEWAY_URL}/auth/logout`, { method: 'POST', credentials: 'include' }); } catch { /* ignore */ }
    setUser(null);
    setAuthState('unauthenticated');
  };

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessage();
    if (!user) return;
    try {
      const response = await fetch(`${GATEWAY_URL}/users/${user.id}/agents`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ name: agentName, type: agentType, capabilities: {} }),
      });
      if (!response.ok) { const error = await response.json(); throw new Error(error.message || 'Failed to create agent'); }
      setAgentName('');
      setMessage({ type: 'success', text: 'Agent created.' });
      await refreshDashboard();
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to create agent' });
    }
  };

  const handlePostAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessage();
    if (!askAgentId) { setMessage({ type: 'error', text: 'Select a buyer agent.' }); return; }
    const tags = askTags.split(',').map((t) => t.trim()).filter(Boolean);
    try {
      const response = await fetch(`${GATEWAY_URL}/dashboard/asks`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({
          agentId: askAgentId, title: askTitle, description: askDescription,
          requirements: { tags, deadline: askDeadline || undefined },
          minBudget: Number(askMinBudget), maxBudget: Number(askMaxBudget),
        }),
      });
      if (!response.ok) { const error = await response.json(); throw new Error(error.message || 'Failed to post task'); }
      setAskTitle(''); setAskDescription(''); setAskTags(''); setAskDeadline('');
      setAskMinBudget('100'); setAskMaxBudget('500');
      setMessage({ type: 'success', text: 'Task posted.' });
      setActiveView('tasks');
      await refreshDashboard();
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to post task' });
    }
  };

  const handleAcceptBid = async (bid: Bid, ask: Ask) => {
    clearMessage();
    try {
      const response = await fetch(`${GATEWAY_URL}/dashboard/bids/accept`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ agentId: ask.createdBy, bidId: bid.id }),
      });
      if (!response.ok) { const error = await response.json(); throw new Error(error.message || 'Failed to accept bid'); }
      setMessage({ type: 'success', text: 'Bid accepted.' });
      await refreshDashboard();
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to accept bid' });
    }
  };

  const handleCancelAsk = async (ask: Ask) => {
    clearMessage();
    try {
      const response = await fetch(`${GATEWAY_URL}/dashboard/asks/${ask.id}/cancel`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ agentId: ask.createdBy }),
      });
      if (!response.ok) { const error = await response.json(); throw new Error(error.message || 'Failed to cancel task'); }
      setMessage({ type: 'success', text: 'Task cancelled.' });
      await refreshDashboard();
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to cancel task' });
    }
  };

  const handleSubmitDelivery = async (task: TaskEntry) => {
    if (!task.sellerAgentId || !task.sellerBid) return;
    clearMessage();
    try {
      const response = await fetch(`${GATEWAY_URL}/dashboard/delivery`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ agentId: task.sellerAgentId, bidId: task.sellerBid.id, deliveryProof: { note: deliveryNote } }),
      });
      if (!response.ok) { const error = await response.json(); throw new Error(error.message || 'Failed to submit delivery'); }
      setDeliveryNote('');
      setMessage({ type: 'success', text: 'Delivery submitted.' });
      await refreshDashboard();
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to submit delivery' });
    }
  };

  const saveAutomations = (rules: AutomationRule[]) => {
    setAutomations(rules);
    localStorage.setItem(AUTOMATIONS_STORAGE_KEY, JSON.stringify(rules));
  };

  const handleAddAutomation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!automationAgentId) return;
    const tags = automationTags.split(',').map((t) => t.trim()).filter(Boolean);
    const rule: AutomationRule = {
      id: crypto.randomUUID(), agentId: automationAgentId, tags,
      maxPrice: automationMaxPrice ? Number(automationMaxPrice) : undefined, enabled: true,
    };
    saveAutomations([rule, ...automations]);
    setAutomationTags(''); setAutomationMaxPrice('');
  };

  const handleOnboardingWallet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!walletAddress.trim()) return;
    storeWallet(walletAddress.trim());
    setOnboardingStep(1);
  };

  const handleCompleteOnboarding = async () => {
    if (!user) return;
    try {
      const response = await fetch(`${GATEWAY_URL}/api/onboarding/complete`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include',
        body: JSON.stringify({ userType: 'HUMAN', subType: 'PERSONAL' }),
      });
      if (!response.ok) { const error = await response.json(); throw new Error(error.message || 'Failed to complete onboarding'); }
      const updatedUser = await response.json();
      setUser(updatedUser);
      setAuthState('authenticated');
      setMessage({ type: 'success', text: 'Welcome to Harbor.' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to complete onboarding' });
    }
  };

  // ─── Derived state ───────────────────────────────────────────────

  const selectedTask = useMemo(
    () => tasks.find((t) => t.ask.id === selectedTaskId) || null,
    [tasks, selectedTaskId]
  );

  const groupedTasks = useMemo(() => {
    const groups: Record<TaskGroup, TaskEntry[]> = {
      'Needs Review': [], Open: [], 'In Progress': [], Completed: [], Canceled: [],
    };
    for (const task of tasks) {
      const ask = task.ask;
      if (ask.status === 'OPEN') {
        const bids = askBidsMap[ask.id] || [];
        groups[bids.length > 0 ? 'Needs Review' : 'Open'].push(task);
      } else if (ask.status === 'IN_PROGRESS') {
        groups['In Progress'].push(task);
      } else if (ask.status === 'COMPLETED') {
        groups.Completed.push(task);
      } else {
        groups.Canceled.push(task);
      }
    }
    return groups;
  }, [tasks, askBidsMap]);

  const buyerAgents = agents.filter((a) => a.type === 'BUYER' || a.type === 'DUAL');

  useEffect(() => {
    if (!askAgentId && buyerAgents.length > 0) setAskAgentId(buyerAgents[0].id);
  }, [askAgentId, buyerAgents]);

  useEffect(() => {
    if (!automationAgentId && agents.length > 0) setAutomationAgentId(agents[0].id);
  }, [automationAgentId, agents]);

  const agentNameById = useMemo(() => {
    const map: Record<string, string> = {};
    agents.forEach((a) => { map[a.id] = a.name; });
    return map;
  }, [agents]);

  // Count tasks needing attention
  const reviewCount = groupedTasks['Needs Review'].length;

  // ─── Task detail (split: metadata + activity) ────────────────────

  const renderTaskDetail = () => {
    if (!selectedTask) {
      return (
        <EmptyState
          icon={LayoutGrid}
          title="No task selected"
          description="Select a task from the list or create a new task to get started."
        />
      );
    }

    const { ask, sellerBid, sellerAgentId } = selectedTask;
    const bids = askBidsMap[ask.id] || [];
    const isBuyerTask = buyerAgents.some((a) => a.id === ask.createdBy);

    return (
      <div className="flex flex-col gap-8 animate-[fadeIn_0.15s_ease]">
        {/* ── Header ── */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-text-primary truncate">{ask.title}</h2>
            <p className="text-sm text-text-secondary mt-3 line-clamp-2">{ask.description}</p>
          </div>
          <StatusBadge status={ask.status} />
        </div>

        {/* ── Metadata cards ── */}
        <div className="grid grid-cols-3 gap-6">
          <div className="ui-card-comfortable bg-surface-1">
            <div className="flex items-center gap-2 text-text-tertiary mb-2">
              <User size={13} />
              <span className="text-[11px] font-medium uppercase tracking-wide">Buyer</span>
            </div>
            <p className="ui-card-title truncate">
              {agentNameById[ask.createdBy] || ask.createdBy}
            </p>
          </div>
          <div className="ui-card-comfortable bg-surface-1">
            <div className="flex items-center gap-2 text-text-tertiary mb-2">
              <DollarSign size={13} />
              <span className="text-[11px] font-medium uppercase tracking-wide">Budget</span>
            </div>
            <p className="ui-card-title">
              ${ask.minBudget} – ${ask.maxBudget}
            </p>
          </div>
          {sellerBid && (
            <div className="ui-card-comfortable bg-surface-1">
              <div className="flex items-center gap-2 text-text-tertiary mb-2">
                <Bot size={13} />
                <span className="text-[11px] font-medium uppercase tracking-wide">Seller</span>
              </div>
              <p className="ui-card-title truncate">
                {agentNameById[sellerAgentId || sellerBid.agentId] || sellerBid.agentId}
              </p>
            </div>
          )}
        </div>

        {/* ── Activity section ── */}
        <div className="border-t border-border pt-5">
          <h3 className="text-xs font-medium uppercase tracking-wide text-text-tertiary mb-4">Activity</h3>

          <div className="flex flex-col gap-4">
            {/* Timeline: Created */}
            <div className="flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-surface-2 flex items-center justify-center shrink-0 mt-0.5">
                <Plus size={13} className="text-text-tertiary" />
              </div>
              <div>
                <p className="text-sm text-text-primary">Task created by <span className="font-medium">{agentNameById[ask.createdBy] || 'agent'}</span></p>
                <p className="text-xs text-text-tertiary">Budget: ${ask.minBudget} – ${ask.maxBudget}</p>
              </div>
            </div>

            {/* Timeline: Bids (buyer view) */}
            {isBuyerTask && bids.length > 0 && (
              <>
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-warning-muted flex items-center justify-center shrink-0 mt-0.5">
                    <AlertCircle size={13} className="text-warning" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-text-primary font-medium mb-2">
                      {bids.length} bid{bids.length !== 1 ? 's' : ''} received
                    </p>
                    <div className="flex flex-col gap-4">
                      {bids.map((bid) => (
                        <div key={bid.id} className="ui-card-comfortable bg-surface-1">
                          <div className="flex items-center justify-between gap-4">
                            <div className="ui-card-content">
                              <div className="flex items-center gap-2">
                                <span className="ui-card-title">
                                  {agentNameById[bid.agentId] || bid.agentId}
                                </span>
                                <span className="text-xs font-mono text-accent">${bid.proposedPrice}</span>
                              </div>
                              <p className="ui-card-meta text-text-secondary line-clamp-2">{bid.proposal}</p>
                            </div>
                            <button
                              onClick={() => handleAcceptBid(bid, ask)}
                              className="ui-btn ui-btn-md shrink-0 bg-accent hover:bg-accent-hover text-white"
                            >
                              Accept
                              <ArrowRight size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Waiting for bids */}
            {isBuyerTask && ask.status === 'OPEN' && bids.length === 0 && (
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-surface-2 flex items-center justify-center shrink-0 mt-0.5">
                  <Clock size={13} className="text-text-tertiary" />
                </div>
                <p className="text-sm text-text-secondary">Waiting for bids...</p>
              </div>
            )}

            {/* Seller assigned work */}
            {!isBuyerTask && sellerBid && (
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-accent-muted flex items-center justify-center shrink-0 mt-0.5">
                  <Bot size={13} className="text-accent" />
                </div>
                <div className="flex-1">
                  <p className="text-sm text-text-primary">
                    Assigned to <span className="font-medium">{agentNameById[sellerAgentId || sellerBid.agentId] || sellerBid.agentId}</span>
                    <span className="text-xs font-mono text-accent ml-2">${sellerBid.proposedPrice}</span>
                  </p>
                </div>
              </div>
            )}

            {/* Delivery form (seller, in progress) */}
            {!isBuyerTask && sellerBid && ask.status === 'IN_PROGRESS' && (
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-surface-2 flex items-center justify-center shrink-0 mt-0.5">
                  <Send size={13} className="text-text-tertiary" />
                </div>
                <form
                  className="flex-1 ui-card-comfortable ui-form-stack bg-surface-1"
                  onSubmit={(e) => { e.preventDefault(); handleSubmitDelivery(selectedTask); }}
                >
                  <textarea
                    placeholder="Delivery note / proof..."
                    value={deliveryNote}
                    onChange={(e) => setDeliveryNote(e.target.value)}
                    className="w-full bg-surface-0 border border-border-subtle rounded-md p-2.5 text-sm min-h-[80px]"
                  />
                  <button type="submit" className="ui-btn ui-btn-md bg-accent hover:bg-accent-hover text-white">
                    <Send size={12} />
                    Submit Delivery
                  </button>
                </form>
              </div>
            )}

            {/* Delivery complete */}
            {ask.status === 'COMPLETED' && ask.deliveryData && (
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-success-muted flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 size={13} className="text-success" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-success mb-2">Delivered</p>
                  <pre className="text-xs">{JSON.stringify(ask.deliveryData, null, 2)}</pre>
                </div>
              </div>
            )}

            {/* Cancelled */}
            {ask.status === 'CANCELLED' && (
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-danger-muted flex items-center justify-center shrink-0 mt-0.5">
                  <XCircle size={13} className="text-danger" />
                </div>
                <p className="text-sm text-danger">Task was cancelled.</p>
              </div>
            )}
          </div>
        </div>

        {/* ── Actions ── */}
        {isBuyerTask && ask.status === 'OPEN' && (
          <div className="border-t border-border pt-5">
            <button onClick={() => handleCancelAsk(ask)} className="ui-btn ui-btn-md text-danger hover:bg-danger-muted">
              <XCircle size={12} />
              Cancel Task
            </button>
          </div>
        )}
      </div>
    );
  };

  // ─── Loading ─────────────────────────────────────────────────────

  if (authState === 'loading') {
    return (
      <div className="dashboard-root min-h-screen flex items-center justify-center bg-bg">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={24} className="text-accent animate-spin" />
          <p className="text-sm text-text-secondary">Loading Harbor...</p>
        </div>
      </div>
    );
  }

  // ─── Unauthenticated ─────────────────────────────────────────────

  if (authState === 'unauthenticated') {
    return (
      <div className="dashboard-root min-h-screen flex items-center justify-center bg-bg p-10">
        <div className="bg-surface-0 border border-border rounded-xl p-10 w-[400px] flex flex-col items-center gap-5 text-center">
          <div className="w-12 h-12 rounded-xl bg-surface-2 flex items-center justify-center text-lg font-semibold">
            H
          </div>
          <div>
            <h1 className="text-xl font-semibold">Harbor</h1>
            <p className="ui-subtitle">Agent marketplace dashboard</p>
          </div>
          <button
            onClick={handleLogin}
            className="ui-btn ui-btn-lg w-full bg-accent hover:bg-accent-hover text-white"
          >
            Sign in with Google
            <ArrowRight size={14} />
          </button>
          {message && <Toast message={message} onDismiss={clearMessage} />}
        </div>
      </div>
    );
  }

  // ─── Onboarding ──────────────────────────────────────────────────

  if (authState === 'onboarding') {
    return (
      <div className="dashboard-root min-h-screen grid grid-cols-[56px_1fr] bg-bg">
        {/* Mini rail */}
        <aside className="bg-surface-0 border-r border-border flex flex-col items-center pt-4">
          <div className="w-8 h-8 rounded-lg bg-surface-2 flex items-center justify-center text-sm font-semibold">H</div>
        </aside>

        <main className="flex items-center justify-center p-10">
          <div className="w-full max-w-md">
            <div className="mb-8">
              <h2 className="text-lg font-semibold">Welcome to Harbor</h2>
              <p className="ui-subtitle">Complete setup to unlock the dashboard.</p>
            </div>

            {/* Steps indicator */}
            <div className="flex items-center gap-2 mb-6">
              <div className={`h-1 flex-1 rounded-full ${onboardingStep >= 0 ? 'bg-accent' : 'bg-surface-2'}`} />
              <div className={`h-1 flex-1 rounded-full ${onboardingStep >= 1 ? 'bg-accent' : 'bg-surface-2'}`} />
            </div>

            {onboardingStep === 0 && (
              <form onSubmit={handleOnboardingWallet} className="ui-form-stack">
                <div className="ui-field">
                  <label className="ui-label">Wallet Address</label>
                  <input
                    type="text"
                    placeholder="0x..."
                    value={walletAddress}
                    onChange={(e) => setWalletAddress(e.target.value)}
                    className="w-full font-mono text-xs"
                  />
                </div>
                <button type="submit" className="ui-btn ui-btn-lg bg-accent hover:bg-accent-hover text-white">
                  Connect Wallet
                  <ArrowRight size={14} />
                </button>
              </form>
            )}

            {onboardingStep === 1 && (
              <div className="ui-form-stack">
                <form onSubmit={handleCreateAgent} className="ui-form-stack">
                  <div className="ui-field">
                    <label className="ui-label">Agent Name</label>
                    <input
                      type="text"
                      placeholder="My Agent"
                      value={agentName}
                      onChange={(e) => setAgentName(e.target.value)}
                      required
                      className="w-full"
                    />
                  </div>
                  <div className="ui-field">
                    <label className="ui-label">Type</label>
                    <select value={agentType} onChange={(e) => setAgentType(e.target.value as 'BUYER' | 'SELLER' | 'DUAL')} className="w-full">
                      <option value="BUYER">Buyer</option>
                      <option value="SELLER">Seller</option>
                      <option value="DUAL">Dual</option>
                    </select>
                  </div>
                  <button type="submit" className="ui-btn ui-btn-lg bg-surface-2 hover:bg-surface-3 text-text-primary border border-border">
                    <Plus size={14} />
                    Create Agent
                  </button>
                </form>
                {agents.length > 0 && (
                  <button onClick={handleCompleteOnboarding} className="ui-btn ui-btn-lg bg-accent hover:bg-accent-hover text-white">
                    Enter Dashboard
                    <ArrowRight size={14} />
                  </button>
                )}
              </div>
            )}
          </div>
        </main>
        {message && <Toast message={message} onDismiss={clearMessage} />}
      </div>
    );
  }

  // ─── Authenticated shell ─────────────────────────────────────────

  return (
    <div className="dashboard-root h-screen bg-bg">
      <div className="grid h-full grid-cols-[64px_360px_minmax(0,1fr)] overflow-hidden border border-border bg-surface-0 shadow-[0_16px_48px_rgba(0,0,0,0.42)]">
      {/* ── Rail ── */}
      <aside className="bg-surface-0 border-r border-border flex flex-col justify-between py-6 px-3">
        <div className="flex flex-col items-center gap-1">
          <div className="w-8 h-8 rounded-lg bg-surface-2 flex items-center justify-center text-sm font-semibold mb-3">
            H
          </div>
          {NAV_ITEMS.map(({ view, label, icon: Icon }) => (
            <button
              key={view}
              onClick={() => setActiveView(view)}
              title={label}
              className={`w-11 h-11 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                activeView === view
                  ? 'bg-surface-2 text-text-primary'
                  : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-1'
              }`}
            >
              <Icon size={18} />
            </button>
          ))}
        </div>
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={() => setActiveView('settings')}
            title="Settings"
            className={`w-11 h-11 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
              activeView === 'settings'
                ? 'bg-surface-2 text-text-primary'
                : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-1'
            }`}
          >
            <Settings size={18} />
          </button>
          <button
            onClick={handleLogout}
            title="Logout"
            className="w-11 h-11 rounded-lg flex items-center justify-center text-text-tertiary hover:text-danger hover:bg-danger-muted transition-colors cursor-pointer"
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      {/* ── List panel ── */}
      <aside className="bg-surface-0 border-r border-border flex flex-col overflow-hidden">
        <div
          className="border-b border-border flex items-center justify-between gap-5"
          style={{ padding: '30px 34px' }}
        >
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-text-primary">Tasks</h3>
            <p className="text-xs text-text-tertiary">{tasks.length} total</p>
          </div>
          <button
            onClick={() => setActiveView('new-ask')}
            title="New Task"
            className="w-11 h-11 rounded-xl bg-accent hover:bg-accent-hover flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <Plus size={16} className="text-white" />
          </button>
        </div>

        <div
          className="flex-1 overflow-y-auto"
          style={{ padding: '28px' }}
        >
          {(['Needs Review', 'Open', 'In Progress', 'Completed', 'Canceled'] as TaskGroup[]).map((group) => {
            const items = groupedTasks[group];
            if (items.length === 0) return null;
            return (
              <div key={group} className="mb-5">
                <div className="flex items-center gap-2.5 px-4 py-3">
                  <span className="text-[11px] font-medium uppercase tracking-wider text-text-tertiary">{group}</span>
                  <span className="text-[10px] font-medium text-text-tertiary bg-surface-2 px-1.5 py-0.5 rounded">
                    {items.length}
                  </span>
                </div>
                {items.map((task) => (
                  <button
                    key={task.ask.id}
                    onClick={() => { setSelectedTaskId(task.ask.id); setActiveView('tasks'); }}
                    className={`w-full text-left rounded-xl px-4 py-3.5 mb-1 flex items-center gap-3.5 transition-colors cursor-pointer ${
                      selectedTaskId === task.ask.id
                        ? 'bg-surface-2 border border-border'
                        : 'border border-transparent hover:bg-surface-1'
                    }`}
                  >
                    <StatusDot status={task.ask.status} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-text-primary truncate">{task.ask.title}</p>
                      <p className="text-[11px] text-text-tertiary truncate">
                        {agentNameById[task.ask.createdBy] || 'Agent'}
                        <span className="mx-1 text-text-tertiary/40">·</span>
                        ${task.ask.minBudget}–${task.ask.maxBudget}
                      </p>
                    </div>
                    {group === 'Needs Review' && (
                      <span className="shrink-0 w-2 h-2 rounded-full bg-warning animate-pulse" />
                    )}
                  </button>
                ))}
              </div>
            );
          })}

          {tasks.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <p className="text-xs text-text-tertiary">No tasks yet</p>
            </div>
          )}
        </div>
      </aside>

      {/* ── Content ── */}
      <main className="flex min-w-0 flex-col overflow-hidden bg-bg">
        {/* Topbar */}
        <div
          className="h-[82px] border-b border-border flex items-center justify-between gap-5 shrink-0"
          style={{ padding: '0 36px' }}
        >
          <div className="flex items-center gap-2 min-w-0">
            {activeView === 'tasks' && selectedTask && (
              <>
                <span className="text-sm text-text-secondary">Tasks</span>
                <ChevronRight size={14} className="text-text-tertiary" />
                <span className="text-sm font-medium text-text-primary truncate">{selectedTask.ask.title}</span>
              </>
            )}
            {activeView === 'tasks' && !selectedTask && (
              <span className="text-sm font-medium text-text-primary">Tasks</span>
            )}
            {activeView === 'new-ask' && (
              <span className="text-sm font-medium text-text-primary">New Task</span>
            )}
            {activeView === 'agents' && (
              <span className="text-sm font-medium text-text-primary">Agents</span>
            )}
            {activeView === 'automations' && (
              <span className="text-sm font-medium text-text-primary">Automations</span>
            )}
            {activeView === 'settings' && (
              <span className="text-sm font-medium text-text-primary">Settings</span>
            )}
          </div>
          <div className="flex items-center gap-3.5">
            {reviewCount > 0 && activeView !== 'tasks' && (
              <button
                onClick={() => setActiveView('tasks')}
                className="ui-btn ui-btn-md text-warning bg-warning-muted hover:bg-warning/20"
              >
                <AlertCircle size={12} />
                {reviewCount} needs review
              </button>
            )}
            {activeView !== 'new-ask' && (
              <button
                onClick={() => setActiveView('new-ask')}
                className="ui-btn ui-btn-lg bg-accent hover:bg-accent-hover text-white whitespace-nowrap"
              >
                <Plus size={13} />
                New Task
              </button>
            )}
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 overflow-y-auto ui-page-pad">
          {/* Tasks view */}
          {activeView === 'tasks' && renderTaskDetail()}

          {/* New Ask form */}
          {activeView === 'new-ask' && (
            <div className="w-full max-w-3xl animate-[fadeIn_0.15s_ease]">
              <div className="ui-card">
                <div className="mb-6">
                  <h2 className="text-lg font-semibold">Create a Task</h2>
                  <p className="ui-subtitle">Post a new task to your marketplace.</p>
                </div>
                <form onSubmit={handlePostAsk} className="ui-form-stack">
                  <div className="ui-field">
                    <label className="ui-label">Title</label>
                    <input type="text" placeholder="What do you need?" value={askTitle} onChange={(e) => setAskTitle(e.target.value)} required className="w-full" />
                  </div>
                  <div className="ui-field">
                    <label className="ui-label">Description</label>
                    <textarea placeholder="Describe the task in detail..." value={askDescription} onChange={(e) => setAskDescription(e.target.value)} required className="w-full" />
                  </div>
                  <div className="ui-field">
                    <label className="ui-label">Tags</label>
                    <input type="text" placeholder="research, data, writing..." value={askTags} onChange={(e) => setAskTags(e.target.value)} className="w-full" />
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="ui-field">
                      <label className="ui-label">Min Budget</label>
                      <input type="number" min="1" value={askMinBudget} onChange={(e) => setAskMinBudget(e.target.value)} className="w-full" />
                    </div>
                    <div className="ui-field">
                      <label className="ui-label">Max Budget</label>
                      <input type="number" min="1" value={askMaxBudget} onChange={(e) => setAskMaxBudget(e.target.value)} className="w-full" />
                    </div>
                  </div>
                  <div className="ui-field">
                    <label className="ui-label">Deadline</label>
                    <input type="date" value={askDeadline} onChange={(e) => setAskDeadline(e.target.value)} className="w-full" />
                  </div>
                  <div className="ui-field">
                    <label className="ui-label">Buyer Agent</label>
                    <select value={askAgentId} onChange={(e) => setAskAgentId(e.target.value)} required className="w-full">
                      <option value="">Select agent</option>
                      {buyerAgents.map((agent) => (
                        <option key={agent.id} value={agent.id}>{agent.name}</option>
                      ))}
                    </select>
                  </div>
                  <button type="submit" className="ui-btn ui-btn-lg bg-accent hover:bg-accent-hover text-white">
                    <Send size={14} />
                    Post Task
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Agents view */}
          {activeView === 'agents' && (
            <div className="max-w-4xl animate-[fadeIn_0.15s_ease] ui-section-stack">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Agents</h2>
                  <p className="ui-subtitle">Manage your buyer and seller agents.</p>
                </div>
              </div>

              {/* Create form */}
              <form onSubmit={handleCreateAgent} className="ui-card ui-form-stack p-8">
                <div className="grid grid-cols-[minmax(0,1fr)_220px] gap-8 items-end">
                  <div className="ui-field">
                    <label className="ui-label">Name</label>
                    <input type="text" placeholder="Agent name" value={agentName} onChange={(e) => setAgentName(e.target.value)} required className="w-full" />
                  </div>
                  <div className="ui-field">
                    <label className="ui-label">Type</label>
                    <select value={agentType} onChange={(e) => setAgentType(e.target.value as 'BUYER' | 'SELLER' | 'DUAL')} className="w-full">
                      <option value="BUYER">Buyer</option>
                      <option value="SELLER">Seller</option>
                      <option value="DUAL">Dual</option>
                    </select>
                  </div>
                </div>
                <div className="pt-4">
                  <button type="submit" className="ui-btn ui-btn-lg bg-accent hover:bg-accent-hover text-white">
                    <Plus size={13} />
                    Create Agent
                  </button>
                </div>
              </form>

              {/* Agent list */}
              <div className="pt-3 flex flex-col gap-7">
                {agents.length === 0 && (
                  <EmptyState icon={Bot} title="No agents yet" description="Create your first agent to get started." />
                )}
                {agents.map((agent) => (
                  <div key={agent.id} className="ui-card-comfortable ui-card-row">
                    <div className="flex items-center gap-5 min-w-0">
                      <div className="ui-card-media">
                        <Bot size={17} className="text-text-tertiary" />
                      </div>
                      <div className="ui-card-content">
                        <p className="ui-card-title">{agent.name}</p>
                        <p className="ui-card-meta font-mono truncate">{agent.type} · {agent.id}</p>
                      </div>
                    </div>
                    <span className={`shrink-0 text-xs font-medium px-4 py-2 rounded-2xl ${
                      agent.type === 'BUYER' ? 'bg-accent-muted text-accent' :
                      agent.type === 'SELLER' ? 'bg-success-muted text-success' :
                      'bg-warning-muted text-warning'
                    }`}>
                      {agent.type}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Automations view */}
          {activeView === 'automations' && (
            <div className="max-w-4xl animate-[fadeIn_0.15s_ease] ui-section-stack">
              <div>
                <h2 className="text-lg font-semibold">Automations</h2>
                <p className="ui-subtitle">Configure auto-bidding rules for seller agents.</p>
              </div>

              {/* Create form */}
              <form onSubmit={handleAddAutomation} className="ui-card ui-form-stack">
                <div className="ui-field flex-1">
                  <label className="ui-label">Agent</label>
                  <select value={automationAgentId} onChange={(e) => setAutomationAgentId(e.target.value)} required className="w-full">
                    <option value="">Select agent</option>
                    {agents.map((agent) => (
                      <option key={agent.id} value={agent.id}>{agent.name} ({agent.type})</option>
                    ))}
                  </select>
                </div>
                <div className="ui-field flex-1">
                  <label className="ui-label">Tags</label>
                  <input type="text" placeholder="research, data..." value={automationTags} onChange={(e) => setAutomationTags(e.target.value)} className="w-full" />
                </div>
                <div className="ui-field w-36">
                  <label className="ui-label">Max Price</label>
                  <input type="number" min="1" placeholder="Optional" value={automationMaxPrice} onChange={(e) => setAutomationMaxPrice(e.target.value)} className="w-full" />
                </div>
                <div className="pt-2">
                  <button type="submit" className="ui-btn ui-btn-lg bg-accent hover:bg-accent-hover text-white shrink-0">
                    <Plus size={13} />
                    Add
                  </button>
                </div>
              </form>

              {/* Automation list */}
              <div className="pt-2 flex flex-col gap-6">
                {automations.length === 0 && (
                  <EmptyState icon={Zap} title="No automations" description="Create a rule to auto-bid on matching tasks." />
                )}
                {automations.map((rule) => (
                  <div key={rule.id} className="ui-card-comfortable ui-card-row">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={`ui-card-media ${rule.enabled ? 'bg-success-muted' : 'bg-surface-2'}`}>
                        <Zap size={15} className={rule.enabled ? 'text-success' : 'text-text-tertiary'} />
                      </div>
                      <div className="ui-card-content">
                        <p className="ui-card-title">{agentNameById[rule.agentId] || rule.agentId}</p>
                        <p className="ui-card-meta">
                          Tags: {rule.tags.join(', ') || 'Any'}
                          {rule.maxPrice && <span> · Max ${rule.maxPrice}</span>}
                        </p>
                      </div>
                    </div>
                    <div className="ui-card-actions">
                      <button
                        onClick={() => {
                          const updated = automations.map((item) =>
                            item.id === rule.id ? { ...item, enabled: !item.enabled } : item
                          );
                          saveAutomations(updated);
                        }}
                        className={`p-1 rounded transition-colors cursor-pointer ${rule.enabled ? 'text-success hover:bg-success-muted' : 'text-text-tertiary hover:bg-surface-2'}`}
                        title={rule.enabled ? 'Disable' : 'Enable'}
                      >
                        {rule.enabled ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                      </button>
                      <button
                        onClick={() => saveAutomations(automations.filter((a) => a.id !== rule.id))}
                        className="p-1 rounded text-text-tertiary hover:text-danger hover:bg-danger-muted transition-colors cursor-pointer"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Settings view */}
          {activeView === 'settings' && (
            <div className="max-w-3xl animate-[fadeIn_0.15s_ease] ui-section-stack">
              <div>
                <h2 className="text-lg font-semibold">Settings</h2>
                <p className="ui-subtitle">Profile and wallet preferences.</p>
              </div>

              {/* Profile */}
              <div>
                <h3 className="text-xs font-medium uppercase tracking-wide text-text-tertiary mb-4">Profile</h3>
                <div className="ui-card-comfortable ui-card-row">
                  <div className="ui-card-media rounded-full">
                    <User size={16} className="text-text-tertiary" />
                  </div>
                  <div className="ui-card-content">
                    <p className="ui-card-title">{user?.name}</p>
                    <p className="ui-card-meta">{user?.email}</p>
                  </div>
                </div>
              </div>

              {/* Wallet */}
              <div>
                <h3 className="text-xs font-medium uppercase tracking-wide text-text-tertiary mb-4">Wallet</h3>
                <div className="ui-card-comfortable ui-card-row">
                  <div className="flex items-center gap-5 min-w-0">
                    <div className="ui-card-media rounded-full">
                      <Wallet size={16} className="text-text-tertiary" />
                    </div>
                    <div className="ui-card-content">
                      <p className="ui-card-title">Connected Wallet</p>
                      <p className="ui-card-meta font-mono truncate">{walletAddress || 'Not connected'}</p>
                    </div>
                  </div>
                  {walletAddress && (
                    <button
                      onClick={() => { localStorage.removeItem(WALLET_STORAGE_KEY); setWalletAddress(''); }}
                      className="ui-btn ui-btn-md text-danger hover:bg-danger-muted"
                    >
                      Disconnect
                    </button>
                  )}
                </div>
              </div>

              {/* Agent Wallets */}
              <div>
                <h3 className="text-xs font-medium uppercase tracking-wide text-text-tertiary mb-4">Agent Wallets</h3>
                <div className="flex flex-col gap-6">
                  {wallets.length === 0 && <p className="text-xs text-text-tertiary p-2">No wallets available.</p>}
                  {wallets.map((wallet) => (
                    <div key={wallet.id} className="ui-card-comfortable ui-card-row">
                      <div className="ui-card-content">
                        <p className="ui-card-title">{wallet.agentName || 'Agent'}</p>
                        <p className="ui-card-meta font-mono truncate">{wallet.blockchainAddress || wallet.id}</p>
                      </div>
                      <span className="text-sm font-mono text-text-primary shrink-0">{wallet.balance ?? 'N/A'} USDC</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Toast */}
      {message && <Toast message={message} onDismiss={clearMessage} />}
      </div>
    </div>
  );
}

export default App;
