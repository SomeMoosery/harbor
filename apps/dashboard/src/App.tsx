import { useState, useEffect } from 'react';

const USER_SERVICE_URL = 'http://localhost:3002';
const WALLET_SERVICE_URL = 'http://localhost:3003';

type Tab = 'users' | 'agents' | 'api-keys' | 'wallets' | 'fund-agent';

interface User {
  id: string;
  email: string;
  name: string;
}

interface Agent {
  id: string;
  userId: string;
  name: string;
  type: 'BUYER' | 'SELLER' | 'DUAL';
}

interface ApiKey {
  id: string;
  key: string;
  name?: string;
  createdAt: string;
}

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('users');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [createdData, setCreatedData] = useState<any>(null);

  // User form
  const [userEmail, setUserEmail] = useState('');
  const [userName, setUserName] = useState('');
  const [userType, setUserType] = useState<'BUSINESS' | 'PERSONAL'>('PERSONAL');
  const [userPhone, setUserPhone] = useState('');

  // Agent form
  const [agentUserId, setAgentUserId] = useState('');
  const [agentName, setAgentName] = useState('');
  const [agentType, setAgentType] = useState<'BUYER' | 'SELLER' | 'DUAL'>('BUYER');

  // API Key form
  const [apiKeyUserId, setApiKeyUserId] = useState('');
  const [apiKeyName, setApiKeyName] = useState('');

  // Wallet form
  const [walletAgentId, setWalletAgentId] = useState('');

  // Fund Agent form
  const [fundAgentId, setFundAgentId] = useState('');
  const [fundAmount, setFundAmount] = useState('100');

  const clearMessage = () => {
    setMessage(null);
    setCreatedData(null);
  };

  // Check for funding success/cancelled from Stripe redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const funding = params.get('funding');

    if (funding === 'success') {
      setMessage({
        type: 'success',
        text: 'Payment successful! Funds will be credited to the agent wallet shortly.'
      });
      setActiveTab('fund-agent');
      // Clear URL params
      window.history.replaceState({}, '', window.location.pathname);
    } else if (funding === 'cancelled') {
      setMessage({
        type: 'error',
        text: 'Payment cancelled. No charges were made.'
      });
      setActiveTab('fund-agent');
      // Clear URL params
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessage();

    try {
      const response = await fetch(`${USER_SERVICE_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: userName,
          email: userEmail,
          type: userType,
          phone: userPhone,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create user');
      }

      const user: User = await response.json();
      setMessage({ type: 'success', text: 'User created successfully!' });
      setCreatedData(user);
      setUserEmail('');
      setUserName('');
      setUserPhone('');
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unknown error' });
    }
  };

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessage();

    try {
      const response = await fetch(`${USER_SERVICE_URL}/users/${agentUserId}/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: agentName,
          type: agentType,
          capabilities: {}, // Empty capabilities object
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
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unknown error' });
    }
  };

  const handleCreateApiKey = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessage();

    try {
      const response = await fetch(`${USER_SERVICE_URL}/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: apiKeyUserId, name: apiKeyName }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create API key');
      }

      const apiKey: ApiKey = await response.json();
      setMessage({ type: 'success', text: 'API key created successfully! Save it - you won\'t see it again.' });
      setCreatedData(apiKey);
      setApiKeyName('');
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unknown error' });
    }
  };

  const handleCreateWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessage();

    try {
      const response = await fetch(`${WALLET_SERVICE_URL}/wallets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: walletAgentId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create wallet');
      }

      const wallet = await response.json();
      setMessage({ type: 'success', text: 'Wallet created successfully!' });
      setCreatedData(wallet);
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unknown error' });
    }
  };

  const handleFundAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    clearMessage();

    try {
      const currentUrl = window.location.origin;
      const response = await fetch(`${WALLET_SERVICE_URL}/funding/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

      // Redirect to Stripe Checkout
      setTimeout(() => {
        window.location.href = result.url;
      }, 1000);
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unknown error' });
    }
  };

  return (
    <div className="app">
      <header>
        <h1>Harbor Dashboard</h1>
        <p className="subtitle">Manage users, agents, wallets, and API keys</p>
      </header>

      <div className="tabs">
        <button
          className={`tab ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          Users
        </button>
        <button
          className={`tab ${activeTab === 'agents' ? 'active' : ''}`}
          onClick={() => setActiveTab('agents')}
        >
          Agents
        </button>
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
        <button
          className={`tab ${activeTab === 'fund-agent' ? 'active' : ''}`}
          onClick={() => setActiveTab('fund-agent')}
        >
          Fund Agent
        </button>
      </div>

      {activeTab === 'users' && (
        <div className="section">
          <h2>Create User</h2>
          <form className="form" onSubmit={handleCreateUser}>
            <div className="form-group">
              <label htmlFor="name">Name</label>
              <input
                id="name"
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                required
                placeholder="John Doe"
              />
            </div>
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                required
                placeholder="user@example.com"
              />
            </div>
            <div className="form-group">
              <label htmlFor="userType">User Type</label>
              <select
                id="userType"
                value={userType}
                onChange={(e) => setUserType(e.target.value as 'BUSINESS' | 'PERSONAL')}
                required
              >
                <option value="PERSONAL">Personal</option>
                <option value="BUSINESS">Business</option>
              </select>
            </div>
            <div className="form-group">
              <label htmlFor="phone">Phone</label>
              <input
                id="phone"
                type="tel"
                value={userPhone}
                onChange={(e) => setUserPhone(e.target.value)}
                required
                placeholder="+1234567890"
              />
            </div>
            <button type="submit">Create User</button>
          </form>
        </div>
      )}

      {activeTab === 'agents' && (
        <div className="section">
          <h2>Create Agent</h2>
          <form className="form" onSubmit={handleCreateAgent}>
            <div className="form-group">
              <label htmlFor="userId">User ID</label>
              <input
                id="userId"
                type="text"
                value={agentUserId}
                onChange={(e) => setAgentUserId(e.target.value)}
                required
                placeholder="user-uuid"
              />
            </div>
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
        </div>
      )}

      {activeTab === 'api-keys' && (
        <div className="section">
          <h2>Generate API Key</h2>
          <form className="form" onSubmit={handleCreateApiKey}>
            <div className="form-group">
              <label htmlFor="apiKeyUserId">User ID</label>
              <input
                id="apiKeyUserId"
                type="text"
                value={apiKeyUserId}
                onChange={(e) => setApiKeyUserId(e.target.value)}
                required
                placeholder="user-uuid"
              />
            </div>
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
        </div>
      )}

      {activeTab === 'wallets' && (
        <div className="section">
          <h2>Create Wallet</h2>
          <form className="form" onSubmit={handleCreateWallet}>
            <div className="form-group">
              <label htmlFor="walletAgentId">Agent ID</label>
              <input
                id="walletAgentId"
                type="text"
                value={walletAgentId}
                onChange={(e) => setWalletAgentId(e.target.value)}
                required
                placeholder="agent-uuid"
              />
            </div>
            <button type="submit">Create Wallet</button>
          </form>
        </div>
      )}

      {activeTab === 'fund-agent' && (
        <div className="section">
          <h2>Fund Agent Wallet</h2>
          <p style={{ marginBottom: '1rem', color: '#666' }}>
            Fund an agent's wallet using Stripe Checkout. Payment will be converted to USDC 1:1.
          </p>
          <form className="form" onSubmit={handleFundAgent}>
            <div className="form-group">
              <label htmlFor="fundAgentId">Agent ID</label>
              <input
                id="fundAgentId"
                type="text"
                value={fundAgentId}
                onChange={(e) => setFundAgentId(e.target.value)}
                required
                placeholder="agent-uuid"
              />
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
            <button type="submit">Continue to Stripe Checkout</button>
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
