import React, { useState, useEffect } from 'react';
import { FiCreditCard, FiAlertTriangle, FiShield, FiActivity, FiBarChart2, FiTrendingUp } from 'react-icons/fi';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import api from '../api';

const PIE_COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6'];

export default function Dashboard() {
  const [transactions, setTransactions] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [dashStats, setDashStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [txRes, alertRes, dashRes] = await Promise.all([
        api.get('/transactions'),
        api.get('/fraud-alerts'),
        api.get('/dashboard/stats').catch(() => null),
      ]);
      setTransactions(Array.isArray(txRes.data) ? txRes.data : txRes.data?.data || []);
      setAlerts(Array.isArray(alertRes.data) ? alertRes.data : alertRes.data?.data || []);
      if (dashRes?.data) setDashStats(dashRes.data);

      // Load analytics patterns
      api.get('/analytics/patterns').then(r => setAnalytics(r.data)).catch(() => null);
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading-container"><div className="spinner"></div> Loading dashboard...</div>;
  }

  const totalTx = transactions.length;
  const flaggedTx = transactions.filter(t => t.status === 'flagged').length;
  const blockedTx = transactions.filter(t => t.status === 'blocked').length;
  const totalAlerts = alerts.length;
  const avgRisk = totalTx > 0 ? (transactions.reduce((sum, t) => sum + (parseFloat(t.riskScore) || 0), 0) / totalTx).toFixed(1) : 0;
  const fraudRate = totalTx > 0 ? ((blockedTx / totalTx) * 100).toFixed(1) : 0;

  const statusData = [
    { name: 'Approved', count: transactions.filter(t => t.status === 'approved').length },
    { name: 'Flagged', count: flaggedTx },
    { name: 'Blocked', count: blockedTx },
    { name: 'Pending', count: transactions.filter(t => t.status === 'pending').length },
  ];

  const riskData = [
    { name: 'Low (0-30)', value: transactions.filter(t => (parseFloat(t.riskScore) || 0) <= 30).length },
    { name: 'Medium (31-60)', value: transactions.filter(t => (parseFloat(t.riskScore) || 0) > 30 && (parseFloat(t.riskScore) || 0) <= 60).length },
    { name: 'High (61-80)', value: transactions.filter(t => (parseFloat(t.riskScore) || 0) > 60 && (parseFloat(t.riskScore) || 0) <= 80).length },
    { name: 'Critical (81+)', value: transactions.filter(t => (parseFloat(t.riskScore) || 0) > 80).length },
  ];

  const recentAlerts = alerts.slice(0, 5);
  const recentTx = transactions.slice(0, 5);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Dashboard</h2>
          <p>Anti-Fraud & Credit Analysis Overview</p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue"><FiCreditCard /></div>
          <div className="stat-info">
            <h4>Total Transactions</h4>
            <div className="stat-value">{totalTx}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon amber"><FiAlertTriangle /></div>
          <div className="stat-info">
            <h4>Flagged</h4>
            <div className="stat-value">{flaggedTx}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red"><FiShield /></div>
          <div className="stat-info">
            <h4>Blocked</h4>
            <div className="stat-value">{blockedTx}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon purple"><FiActivity /></div>
          <div className="stat-info">
            <h4>Total Alerts</h4>
            <div className="stat-value">{totalAlerts}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon blue"><FiBarChart2 /></div>
          <div className="stat-info">
            <h4>Avg Risk Score</h4>
            <div className="stat-value">{avgRisk}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon red"><FiTrendingUp /></div>
          <div className="stat-info">
            <h4>Fraud Rate</h4>
            <div className="stat-value">{fraudRate}%</div>
          </div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card">
          <h3>Transaction Status Distribution</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={statusData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d3a4d" />
              <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip
                contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#f1f5f9' }}
              />
              <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="chart-card">
          <h3>Risk Level Distribution</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={riskData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                {riskData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#f1f5f9' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Alert Volume Trend (30 days) */}
      {analytics?.dailyTrend && analytics.dailyTrend.length > 0 && (
        <div className="chart-card" style={{ marginBottom: '16px' }}>
          <h3>Alert Volume - Last 30 Days</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={analytics.dailyTrend}>
              <defs>
                <linearGradient id="alertGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d3a4d" />
              <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickFormatter={v => v?.slice(5)} />
              <YAxis stroke="#64748b" fontSize={11} />
              <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#f1f5f9' }} />
              <Area type="monotone" dataKey="totalAlerts" stroke="#3b82f6" fill="url(#alertGrad)" name="Total Alerts" />
              <Area type="monotone" dataKey="highSeverityAlerts" stroke="#ef4444" fill="none" strokeDasharray="4 2" name="High Severity" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top Fraud Types bar chart */}
      {analytics?.alertTypeSummary && analytics.alertTypeSummary.length > 0 && (
        <div className="chart-card" style={{ marginBottom: '16px' }}>
          <h3>Top Fraud Types</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={analytics.alertTypeSummary.slice(0, 8)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#2d3a4d" />
              <XAxis type="number" stroke="#64748b" fontSize={11} />
              <YAxis type="category" dataKey="alertType" stroke="#64748b" fontSize={11} width={140} />
              <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: '8px', color: '#f1f5f9' }} />
              <Bar dataKey="total" fill="#8b5cf6" radius={[0, 4, 4, 0]} name="Total" />
            </BarChart>
          </ResponsiveContainer>
          {analytics.aiPatternSummary && typeof analytics.aiPatternSummary === 'string' && (
            <p style={{ marginTop: '12px', color: '#94a3b8', fontSize: '13px', fontStyle: 'italic' }}>
              AI Pattern Summary: {analytics.aiPatternSummary}
            </p>
          )}
        </div>
      )}

      <div className="charts-grid">
        <div className="table-container">
          <div className="table-header"><h3>Recent Alerts</h3></div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Severity</th>
                  <th>Description</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentAlerts.length === 0 ? (
                  <tr><td colSpan="4" style={{ textAlign: 'center', padding: '30px' }}>No alerts</td></tr>
                ) : recentAlerts.map(a => (
                  <tr key={a._id || a.id}>
                    <td>{a.alertType || a.type || '-'}</td>
                    <td><span className={`badge badge-${(a.severity || '').toLowerCase()}`}>{a.severity || '-'}</span></td>
                    <td>{(a.description || '').substring(0, 50)}{(a.description || '').length > 50 ? '...' : ''}</td>
                    <td><span className={`badge badge-${(a.status || '').toLowerCase()}`}>{a.status || '-'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="table-container">
          <div className="table-header"><h3>Recent Transactions</h3></div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Amount</th>
                  <th>Merchant</th>
                  <th>Status</th>
                  <th>Risk</th>
                </tr>
              </thead>
              <tbody>
                {recentTx.length === 0 ? (
                  <tr><td colSpan="4" style={{ textAlign: 'center', padding: '30px' }}>No transactions</td></tr>
                ) : recentTx.map(t => (
                  <tr key={t._id || t.id}>
                    <td>${parseFloat(t.amount || 0).toLocaleString()}</td>
                    <td>{t.merchantName || '-'}</td>
                    <td><span className={`badge badge-${(t.status || '').toLowerCase()}`}>{t.status || '-'}</span></td>
                    <td><span className={`risk-score ${getRiskClass(parseFloat(t.riskScore))}`}>{t.riskScore ?? '-'}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function getRiskClass(score) {
  if (score == null) return '';
  if (score <= 30) return 'risk-low';
  if (score <= 60) return 'risk-medium';
  if (score <= 80) return 'risk-high';
  return 'risk-critical';
}
