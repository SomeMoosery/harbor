import { useState, useEffect, useCallback } from 'react';

const GATEWAY_URL = 'http://localhost:3000';

// User types
type UserType = 'HUMAN' | 'AGENT' | 'UNKNOWN';
type SubType = 'BUSINESS' | 'PERSONAL' | 'AUTONOMOUS';

interface User {
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
}

interface ApiKey {
  id: string;
  key?: string; // Only present when newly created
  keyPrefix?: string; // Masked version for list display
  name?: string;
  createdAt: string;
}

interface Wallet {
  id: string;
  agentId: string;
  blockchainAddress?: string;
  createdAt: string;
}

interface WalletWithBalance extends Wallet {
  balance?: string;
  agentName?: string;
}

type Tab = 'agents' | 'api-keys' | 'wallets' | 'fund-agent';

// Authentication state
type AuthState = 'loading' | 'unauthenticated' | 'onboarding' | 'authenticated';

function App() {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('agents');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [createdData, setCreatedData] = useState<any>(null);

  // Agent form
  const [agentName, setAgentName] = useState('');
  const [agentType, setAgentType] = useState<'BUYER' | 'SELLER' | 'DUAL'>('BUYER');

  // API Key form
  const [apiKeyName, setApiKeyName] = useState('');

  // Wallet form
  const [walletAgentId, setWalletAgentId] = useState('');

  // Fund Agent form
  const [fundAgentId, setFundAgentId] = useState('');
  const [fundAmount, setFundAmount] = useState('100');

  // Lists
  const [agents, setAgents] = useState<Agent[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [wallets, setWallets] = useState<WalletWithBalance[]>([]);

  // Onboarding form
  const [selectedUserType, setSelectedUserType] = useState<'HUMAN' | 'AGENT'>('HUMAN');
  const [selectedSubType, setSelectedSubType] = useState<'BUSINESS' | 'PERSONAL'>('PERSONAL');

  const clearMessage = () => {
    setMessage(null);
    setCreatedData(null);
  };

  // Fetch user's agents
  const fetchAgents = useCallback(async (userId: string) => {
    try {
      const response = await fetch(`${GATEWAY_URL}/users/${userId}/agents`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setAgents(data);
        return data as Agent[];
      }
    } catch (error) {
      console.error('Failed to fetch agents:', error);
    }
    return [];
  }, []);

  // Fetch user's API keys
  const fetchApiKeys = useCallback(async (userId: string) => {
    try {
      const response = await fetch(`${GATEWAY_URL}/users/${userId}/api-keys`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setApiKeys(data);
      }
    } catch (error) {
      console.error('Failed to fetch API keys:', error);
    }
  }, []);

  // Fetch wallets for all agents
  const fetchWallets = useCallback(async (agentsList: Agent[]) => {
    const walletsWithBalance: WalletWithBalance[] = [];

    for (const agent of agentsList) {
      try {
        const response = await fetch(`${GATEWAY_URL}/wallets/agent/${agent.id}`, {
          credentials: 'include',
        });
        if (response.ok) {
          const wallet = await response.json();
          // Try to get balance
          try {
            const balanceResponse = await fetch(`${GATEWAY_URL}/wallets/agent/${agent.id}/balance`, {
              credentials: 'include',
            });
            if (balanceResponse.ok) {
              const balanceData = await balanceResponse.json();
              walletsWithBalance.push({
                ...wallet,
                balance: balanceData.balance,
                agentName: agent.name,
              });
            } else {
              walletsWithBalance.push({ ...wallet, agentName: agent.name });
            }
          } catch {
            walletsWithBalance.push({ ...wallet, agentName: agent.name });
          }
        }
      } catch (error) {
        // Agent might not have a wallet yet
      }
    }

    setWallets(walletsWithBalance);
  }, []);

  // Check authentication status on mount
  const checkAuth = useCallback(async () => {
    try {
      const response = await fetch(`${GATEWAY_URL}/auth/me`, {
        credentials: 'include',
      });

      if (!response.ok) {
        setAuthState('unauthenticated');
        return;
      }

      const data = await response.json();

      if (!data.authenticated) {
        setAuthState('unauthenticated');
        return;
      }

      setUser(data.user);

      // Check if onboarding is needed
      if (!data.user.onboardingCompleted || data.user.userType === 'UNKNOWN') {
        setAuthState('onboarding');
      } else {
        setAuthState('authenticated');
        // Fetch data for authenticated users
        fetchApiKeys(data.user.id);
        if (data.user.userType === 'HUMAN') {
          const agentsList = await fetchAgents(data.user.id);
          if (agentsList.length > 0) {
            fetchWallets(agentsList);
          }
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setAuthState('unauthenticated');
    }
  }, [fetchAgents, fetchApiKeys, fetchWallets]);

  useEffect(() => {
    // Check for URL error params first
    const params = new URLSearchParams(window.location.search);
    const error = params.get('error');
    const funding = params.get('funding');

    if (error) {
      setMessage({
        type: 'error',
        text: getErrorMessage(error),
      });
      window.history.replaceState({}, '', window.location.pathname);
    }

    if (funding === 'success') {
      setMessage({
        type: 'success',
        text: 'Payment successful! Funds will be credited to the agent wallet shortly.',
      });
      setActiveTab('fund-agent');
      window.history.replaceState({}, '', window.location.pathname);
    } else if (funding === 'cancelled') {
      setMessage({
        type: 'error',
        text: 'Payment cancelled. No charges were made.',
      });
      setActiveTab('fund-agent');
      window.history.replaceState({}, '', window.location.pathname);
    }

    checkAuth();
  }, [checkAuth]);

  const getErrorMessage = (error: string): string => {
    switch (error) {
      case 'oauth_cancelled':
        return 'Authentication cancelled. Please try again.';
      case 'invalid_state':
        return 'Session expired. Please try again.';
      case 'no_code':
        return 'Authentication failed. Please try again.';
      case 'session_failed':
        return 'Failed to create session. Please try again.';
      case 'auth_failed':
        return 'Authentication failed. Please try again.';
      default:
        return 'An error occurred. Please try again.';
    }
  };

  const handleLogin = () => {
    window.location.href = `${GATEWAY_URL}/auth/login`;
  };

  const handleLogout = async () => {
    try {
      await fetch(`${GATEWAY_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (error) {
      console.error('Logout failed:', error);
    }
    setUser(null);
    setAuthState('unauthenticated');
  };

  const handleCompleteOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessage();

    try {
      const response = await fetch(`${GATEWAY_URL}/api/onboarding/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          userType: selectedUserType,
          subType: selectedUserType === 'HUMAN' ? selectedSubType : undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to complete onboarding');
      }

      const updatedUser = await response.json();
      setUser(updatedUser);
      setAuthState('authenticated');
      setMessage({ type: 'success', text: 'Welcome to Harbor!' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unknown error' });
    }
  };

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessage();

    if (!user) return;

    try {
      const response = await fetch(`${GATEWAY_URL}/users/${user.id}/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: agentName,
          type: agentType,
          capabilities: {},
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create agent');
      }

      const agent: Agent = await response.json();
      setMessage({ type: 'success', text: 'Agent created successfully!' });
      setCreatedData(agent);
      setAgentName('');
      // Refresh agents list
      if (user) {
        fetchAgents(user.id);
      }
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unknown error' });
    }
  };

  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessage();

    if (!user) return;

    try {
      const response = await fetch(`${GATEWAY_URL}/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId: user.id, name: apiKeyName }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create API key');
      }

      const apiKey: ApiKey = await response.json();
      setMessage({ type: 'success', text: 'API key created successfully! Save it - you won\'t see it again.' });
      setCreatedData(apiKey);
      setApiKeyName('');
      // Refresh API keys list
      if (user) {
        fetchApiKeys(user.id);
      }
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unknown error' });
    }
  };

  const handleCreateWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessage();

    try {
      const response = await fetch(`${GATEWAY_URL}/wallets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ agentId: walletAgentId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create wallet');
      }

      const wallet = await response.json();
      setMessage({ type: 'success', text: 'Wallet created successfully!' });
      setCreatedData(wallet);
      setWalletAgentId('');
      // Refresh wallets list
      if (agents.length > 0) {
        fetchWallets(agents);
      }
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unknown error' });
    }
  };

  const handleFundAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessage();

    try {
      const currentUrl = window.location.origin;
      const response = await fetch(`${GATEWAY_URL}/funding/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          agentId: fundAgentId,
          amount: fundAmount,
          successUrl: `${currentUrl}?funding=success`,
          cancelUrl: `${currentUrl}?funding=cancelled`,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create checkout session');
      }

      const result = await response.json();
      setMessage({ type: 'success', text: 'Redirecting to Stripe Checkout...' });
      setCreatedData(result);

      setTimeout(() => {
        window.location.href = result.url;
      }, 1000);
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unknown error' });
    }
  };

  // Loading state
  if (authState === 'loading') {
    return (
      <div className="app">
        <div className="loading">
          <h2>Loading...</h2>
        </div>
      </div>
    );
  }

  // Login page
  if (authState === 'unauthenticated') {
    return (
      <div className="app">
        <header>
          <h1>Harbor Dashboard</h1>
          <p className="subtitle">Manage your agents, wallets, and API keys</p>
        </header>

        <div className="section login-section">
          <h2>Sign In</h2>
          <p style={{ marginBottom: '1.5rem', color: '#666' }}>
            Sign in with your Google account to access the Harbor Dashboard.
          </p>
          <button className="google-btn" onClick={handleLogin}>
            <svg viewBox="0 0 24 24" width="20" height="20" style={{ marginRight: '8px' }}>
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Sign in with Google
          </button>
        </div>

        {message && (
          <div className={message.type === 'success' ? 'success' : 'error'}>
            {message.text}
          </div>
        )}
      </div>
    );
  }

  // Onboarding page
  if (authState === 'onboarding') {
    return (
      <div className="app">
        <header>
          <h1>Welcome to Harbor</h1>
          <p className="subtitle">Let's set up your account</p>
        </header>

        <div className="section onboarding-section">
          <h2>Choose Your Account Type</h2>
          <p style={{ marginBottom: '1.5rem', color: '#666' }}>
            This determines how you'll use Harbor. You can change this later in settings.
          </p>

          <form className="form" onSubmit={handleCompleteOnboarding}>
            <div className="account-type-options">
              <label className={`account-type-option ${selectedUserType === 'HUMAN' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="userType"
                  value="HUMAN"
                  checked={selectedUserType === 'HUMAN'}
                  onChange={() => setSelectedUserType('HUMAN')}
                />
                <div className="option-content">
                  <h3>Human User</h3>
                  <p>Create and manage AI agents, view wallets, manage API keys, and more.</p>
                </div>
              </label>

              <label className={`account-type-option ${selectedUserType === 'AGENT' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="userType"
                  value="AGENT"
                  checked={selectedUserType === 'AGENT'}
                  onChange={() => setSelectedUserType('AGENT')}
                />
                <div className="option-content">
                  <h3>AI Agent</h3>
                  <p>Simplified interface for creating wallets and managing your own resources.</p>
                </div>
              </label>
            </div>

            {selectedUserType === 'HUMAN' && (
              <div className="form-group" style={{ marginTop: '1.5rem' }}>
                <label htmlFor="subType">Account Sub-type</label>
                <select
                  id="subType"
                  value={selectedSubType}
                  onChange={(e) => setSelectedSubType(e.target.value as 'BUSINESS' | 'PERSONAL')}
                >
                  <option value="PERSONAL">Personal</option>
                  <option value="BUSINESS">Business</option>
                </select>
              </div>
            )}

            <button type="submit" style={{ marginTop: '1.5rem' }}>
              Continue
            </button>
          </form>
        </div>

        {message && (
          <div className={message.type === 'success' ? 'success' : 'error'}>
            {message.text}
          </div>
        )}
      </div>
    );
  }

  // Main dashboard (authenticated)
  const isAgent = user?.userType === 'AGENT';

  return (
    <div className="app">
      <header>
        <div className="header-content">
          <div>
            <h1>Harbor Dashboard</h1>
            <p className="subtitle">
              {user?.name} ({user?.email}) - {user?.userType} / {user?.subType}
            </p>
          </div>
          <button className="logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <div className="tabs">
        {!isAgent && (
          <button
            className={`tab ${activeTab === 'agents' ? 'active' : ''}`}
            onClick={() => setActiveTab('agents')}
          >
            Agents
          </button>
        )}
        <button
          className={`tab ${activeTab === 'api-keys' ? 'active' : ''}`}
          onClick={() => setActiveTab('api-keys')}
        >
          API Keys
        </button>
        <button
          className={`tab ${activeTab === 'wallets' ? 'active' : ''}`}
          onClick={() => setActiveTab('wallets')}
        >
          Wallets
        </button>
        {!isAgent && (
          <button
            className={`tab ${activeTab === 'fund-agent' ? 'active' : ''}`}
            onClick={() => setActiveTab('fund-agent')}
          >
            Fund Agent
          </button>
        )}
      </div>

      {activeTab === 'agents' && !isAgent && (
        <div className="section">
          <h2>Create Agent</h2>
          <form className="form" onSubmit={handleCreateAgent}>
            <div className="form-group">
              <label htmlFor="agentName">Agent Name</label>
              <input
                id="agentName"
                type="text"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                required
                placeholder="My Agent"
              />
            </div>
            <div className="form-group">
              <label htmlFor="agentType">Agent Type</label>
              <select
                id="agentType"
                value={agentType}
                onChange={(e) => setAgentType(e.target.value as 'BUYER' | 'SELLER' | 'DUAL')}
              >
                <option value="BUYER">Buyer</option>
                <option value="SELLER">Seller</option>
                <option value="DUAL">Dual (Buyer & Seller)</option>
              </select>
            </div>
            <button type="submit">Create Agent</button>
          </form>

          {agents.length > 0 && (
            <>
              <h3 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Your Agents ({agents.length})</h3>
              <ul className="list">
                {agents.map((agent) => (
                  <li key={agent.id} className="list-item">
                    <h3>{agent.name}</h3>
                    <p>Type: <strong>{agent.type}</strong></p>
                    <p>ID: <code>{agent.id}</code></p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {activeTab === 'api-keys' && (
        <div className="section">
          <h2>Generate API Key</h2>
          <form className="form" onSubmit={handleCreateApiKey}>
            <div className="form-group">
              <label htmlFor="apiKeyName">Key Name (optional)</label>
              <input
                id="apiKeyName"
                type="text"
                value={apiKeyName}
                onChange={(e) => setApiKeyName(e.target.value)}
                placeholder="Production Key"
              />
            </div>
            <button type="submit">Generate API Key</button>
          </form>

          {apiKeys.length > 0 && (
            <>
              <h3 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Your API Keys ({apiKeys.length})</h3>
              <ul className="list">
                {apiKeys.map((apiKey) => (
                  <li key={apiKey.id} className="list-item">
                    <h3>{apiKey.name || 'Unnamed Key'}</h3>
                    <p>Key: <code>{apiKey.key ? `${apiKey.key.substring(0, 8)}...` : '****...'}</code></p>
                    <p>Created: {new Date(apiKey.createdAt).toLocaleDateString()}</p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {activeTab === 'wallets' && (
        <div className="section">
          <h2>Create Wallet</h2>
          <form className="form" onSubmit={handleCreateWallet}>
            <div className="form-group">
              <label htmlFor="walletAgentId">Agent</label>
              {agents.length > 0 ? (
                <select
                  id="walletAgentId"
                  value={walletAgentId}
                  onChange={(e) => setWalletAgentId(e.target.value)}
                  required
                >
                  <option value="">Select an agent...</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name} ({agent.type})
                    </option>
                  ))}
                </select>
              ) : (
                <p style={{ color: '#666', fontSize: '14px' }}>
                  No agents found. Create an agent first.
                </p>
              )}
            </div>
            <button type="submit" disabled={agents.length === 0}>Create Wallet</button>
          </form>

          {wallets.length > 0 && (
            <>
              <h3 style={{ marginTop: '2rem', marginBottom: '1rem' }}>Your Wallets ({wallets.length})</h3>
              <ul className="list">
                {wallets.map((wallet) => (
                  <li key={wallet.id} className="list-item">
                    <h3>{wallet.agentName || 'Unknown Agent'}</h3>
                    <p>Balance: <strong>{wallet.balance ?? 'N/A'} USDC</strong></p>
                    {wallet.blockchainAddress && (
                      <p>Address: <code>{wallet.blockchainAddress}</code></p>
                    )}
                    <p>Wallet ID: <code>{wallet.id}</code></p>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {activeTab === 'fund-agent' && !isAgent && (
        <div className="section">
          <h2>Fund Agent Wallet</h2>
          <p style={{ marginBottom: '1rem', color: '#666' }}>
            Fund an agent's wallet using Stripe Checkout. Payment will be converted to USDC 1:1.
          </p>
          <form className="form" onSubmit={handleFundAgent}>
            <div className="form-group">
              <label htmlFor="fundAgentId">Agent</label>
              {agents.length > 0 ? (
                <select
                  id="fundAgentId"
                  value={fundAgentId}
                  onChange={(e) => setFundAgentId(e.target.value)}
                  required
                >
                  <option value="">Select an agent...</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name} ({agent.type})
                    </option>
                  ))}
                </select>
              ) : (
                <p style={{ color: '#666', fontSize: '14px' }}>
                  No agents found. Create an agent first.
                </p>
              )}
            </div>
            <div className="form-group">
              <label htmlFor="fundAmount">Amount (USD)</label>
              <input
                id="fundAmount"
                type="number"
                step="0.01"
                min="1"
                value={fundAmount}
                onChange={(e) => setFundAmount(e.target.value)}
                required
                placeholder="100"
              />
              <small style={{ color: '#666', marginTop: '0.5rem', display: 'block' }}>
                Will be converted to USDC 1:1 in the agent's wallet
              </small>
            </div>
            <button type="submit" disabled={agents.length === 0}>Continue to Stripe Checkout</button>
          </form>
        </div>
      )}

      {message && (
        <div className={message.type === 'success' ? 'success' : 'error'}>
          {message.text}
        </div>
      )}

      {createdData && (
        <div className="info-box">
          <strong>Created Resource:</strong>
          <pre>{JSON.stringify(createdData, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

export default App;
