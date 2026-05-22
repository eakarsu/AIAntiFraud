import React, { createContext, useContext, useState, useEffect } from 'react';
import { Routes, Route, NavLink, Navigate, useNavigate, useLocation } from 'react-router-dom';
import {
  FiShield, FiAlertTriangle, FiCreditCard, FiActivity,
  FiUsers, FiSearch, FiSettings, FiBarChart2, FiList,
  FiEye, FiLogOut, FiCpu, FiGitMerge, FiThumbsUp,
  FiBriefcase, FiRotateCcw, FiUserCheck
} from 'react-icons/fi';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import FraudRules from './pages/FraudRules';
import FraudAlerts from './pages/FraudAlerts';
import CreditScores from './pages/CreditScores';
import RiskModels from './pages/RiskModels';
import Watchlist from './pages/Watchlist';
import AuditLog from './pages/AuditLog';
import BehavioralPatterns from './pages/BehavioralPatterns';
import MerchantProfiles from './pages/MerchantProfiles';
import AlertDetail from './pages/AlertDetail';
import AIResults from './pages/AIResults';
import AITools from './pages/AITools';
import RuleSuggestions from './pages/RuleSuggestions';
import Cases from './pages/Cases';
import Chargebacks from './pages/Chargebacks';
import RefundAbuseRisk from './pages/RefundAbuseRisk';
import Users from './pages/Users';

import CodexCustomVizFeature from './pages/CodexCustomVizFeature';
import CodexOperationsFeature from './pages/CodexOperationsFeature';

const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });

  const login = (tok, usr) => {
    localStorage.setItem('token', tok);
    localStorage.setItem('user', JSON.stringify(usr));
    setToken(tok);
    setUser(usr);
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ token, user, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

const navItems = [
  { path: '/', label: 'Dashboard', icon: FiBarChart2 },
  { path: '/transactions', label: 'Transactions', icon: FiCreditCard },
  { path: '/fraud-rules', label: 'Fraud Rules', icon: FiShield },
  { path: '/fraud-alerts', label: 'Fraud Alerts', icon: FiAlertTriangle },
  { path: '/credit-scores', label: 'Credit Scores', icon: FiActivity },
  { path: '/risk-models', label: 'Risk Models', icon: FiSettings },
  { path: '/watchlist', label: 'Watchlist', icon: FiSearch },
  { path: '/audit-log', label: 'Audit Log', icon: FiList },
  { path: '/behavioral-patterns', label: 'Behavioral Patterns', icon: FiEye },
  { path: '/merchant-profiles', label: 'Merchant Profiles', icon: FiUsers },
  { path: '/ai-tools', label: 'AI Tools', icon: FiCpu },
  { path: '/ai-results', label: 'AI History', icon: FiCpu },
  { path: '/rule-suggestions', label: 'AI Rule Suggestions', icon: FiThumbsUp },
  { path: '/cases', label: 'Cases', icon: FiBriefcase },
  { path: '/chargebacks', label: 'Chargebacks', icon: FiRotateCcw },
  { path: '/refund-abuse-risk', label: 'Refund Abuse Risk', icon: FiRotateCcw },
  { path: '/users', label: 'Users', icon: FiUserCheck },
];

function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo-icon"><FiShield /></div>
          <h1>Anti-Fraud AI<span>Credit Analysis Engine</span></h1>
        </div>
        <nav className="sidebar-nav">
          {navItems.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) => isActive ? 'active' : ''}
            >
              <item.icon className="nav-icon" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="user-info">
            <div className="user-avatar">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'A'}
            </div>
            <div className="user-details">
              <div className="user-name">{user?.name || 'Admin'}</div>
              <div className="user-role">{user?.role || 'Administrator'}</div>
            </div>
          </div>
          <button className="btn-logout" onClick={handleLogout}>
            <FiLogOut /> <span>Sign Out</span>
          </button>
        </div>
      </aside>
      <main className="main-content">
        <Routes>
        <Route path="/codex/custom-viz" element={<ProtectedRoute><CodexCustomVizFeature /></ProtectedRoute>} />
        <Route path="/codex/operations" element={<ProtectedRoute><CodexOperationsFeature /></ProtectedRoute>} />

          <Route path="/" element={<Dashboard />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/fraud-rules" element={<FraudRules />} />
          <Route path="/fraud-alerts" element={<FraudAlerts />} />
          <Route path="/fraud-alerts/:id" element={<AlertDetail />} />
          <Route path="/credit-scores" element={<CreditScores />} />
          <Route path="/risk-models" element={<RiskModels />} />
          <Route path="/watchlist" element={<Watchlist />} />
          <Route path="/audit-log" element={<AuditLog />} />
          <Route path="/behavioral-patterns" element={<BehavioralPatterns />} />
          <Route path="/merchant-profiles" element={<MerchantProfiles />} />
          <Route path="/ai-tools" element={<AITools />} />
          <Route path="/ai-results" element={<AIResults />} />
          <Route path="/rule-suggestions" element={<RuleSuggestions />} />
          <Route path="/cases" element={<Cases />} />
          <Route path="/chargebacks" element={<Chargebacks />} />
          <Route path="/refund-abuse-risk" element={<RefundAbuseRisk />} />
          <Route path="/users" element={<Users />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/*" element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        } />
      </Routes>
    </AuthProvider>
  );
}

export default App;
