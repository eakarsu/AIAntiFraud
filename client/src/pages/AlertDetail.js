import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiUser, FiCpu, FiAlertTriangle, FiCheckCircle } from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../api';

const severityColors = {
  low: '#10b981', medium: '#f59e0b', high: '#f97316', critical: '#ef4444',
};

const statusColors = {
  open: '#3b82f6', investigating: '#8b5cf6', resolved: '#10b981', dismissed: '#6b7280',
};

export default function AlertDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [alert, setAlert] = useState(null);
  const [loading, setLoading] = useState(true);
  const [aiScore, setAiScore] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [assignUserId, setAssignUserId] = useState('');

  useEffect(() => { loadAlert(); }, [id]);

  const loadAlert = async () => {
    try {
      const res = await api.get(`/fraud-alerts/${id}`);
      const data = res.data?.alert || res.data;
      setAlert(data);
    } catch (err) {
      toast.error('Failed to load alert');
      navigate('/fraud-alerts');
    } finally {
      setLoading(false);
    }
  };

  const getAiRiskScore = async () => {
    if (!alert) return;
    setAiLoading(true);
    try {
      const res = await api.post('/ai/score-transaction', {
        transactionId: alert.transactionId,
        amount: alert.amount || 0,
        merchantCategory: alert.merchantCategory || alert.merchant_category || '',
        location: alert.locationCountry || '',
        userId: alert.userId || alert.user_id || 1,
      });
      setAiScore(res.data);
      toast.success('AI risk score calculated');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to get AI risk score');
    } finally {
      setAiLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!assignUserId) { toast.error('Enter a user ID'); return; }
    try {
      await api.put(`/fraud-alerts/${id}`, { assignedTo: parseInt(assignUserId), status: 'investigating' });
      toast.success('Alert assigned and status set to investigating');
      setAssigning(false);
      loadAlert();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to assign');
    }
  };

  const handleResolve = async () => {
    if (!window.confirm('Mark this alert as resolved?')) return;
    try {
      await api.put(`/fraud-alerts/${id}`, { status: 'resolved' });
      toast.success('Alert resolved');
      loadAlert();
    } catch (err) {
      toast.error('Failed to resolve');
    }
  };

  if (loading) return <div className="loading-container"><div className="spinner"></div> Loading...</div>;
  if (!alert) return null;

  const sev = (alert.severity || '').toLowerCase();
  const stat = (alert.status || '').toLowerCase();

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/fraud-alerts')}>
            <FiArrowLeft />
          </button>
          <div>
            <h2>Alert #{alert.id}</h2>
            <p style={{ margin: 0, color: '#6b7280' }}>{alert.alertType || alert.alert_type}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={() => setAssigning(!assigning)}>
            <FiUser /> Assign
          </button>
          {stat !== 'resolved' && (
            <button className="btn btn-primary" onClick={handleResolve}>
              <FiCheckCircle /> Resolve
            </button>
          )}
        </div>
      </div>

      {assigning && (
        <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px', marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input
            type="number"
            placeholder="User ID to assign"
            value={assignUserId}
            onChange={e => setAssignUserId(e.target.value)}
            style={{ flex: 1, maxWidth: '200px' }}
          />
          <button className="btn btn-primary btn-sm" onClick={handleAssign}>Confirm</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setAssigning(false)}>Cancel</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* Alert Info */}
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Alert Information</h3>
          <div className="detail-grid">
            <div className="detail-item">
              <span className="detail-label">Alert ID</span>
              <span className="detail-value">#{alert.id}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Status</span>
              <span className="detail-value">
                <span style={{ background: statusColors[stat] || '#6b7280', color: '#fff', padding: '2px 8px', borderRadius: '12px', fontSize: '12px' }}>
                  {alert.status}
                </span>
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Severity</span>
              <span className="detail-value">
                <span style={{ background: severityColors[sev] || '#6b7280', color: '#fff', padding: '2px 8px', borderRadius: '12px', fontSize: '12px' }}>
                  {alert.severity}
                </span>
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Alert Type</span>
              <span className="detail-value">{alert.alertType || alert.alert_type || '-'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Rule</span>
              <span className="detail-value">{alert.ruleName || alert.rule_name || '-'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Assigned To</span>
              <span className="detail-value">{alert.assignedToName || alert.assigned_to_name || 'Unassigned'}</span>
            </div>
            <div className="detail-item full-width">
              <span className="detail-label">Description</span>
              <span className="detail-value">{alert.description || '-'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Created</span>
              <span className="detail-value">{alert.createdAt ? new Date(alert.createdAt).toLocaleString() : '-'}</span>
            </div>
          </div>
        </div>

        {/* Transaction Info */}
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Transaction Information</h3>
          <div className="detail-grid">
            <div className="detail-item">
              <span className="detail-label">Transaction ID</span>
              <span className="detail-value">{alert.transactionId || '-'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Amount</span>
              <span className="detail-value">{alert.currency || 'USD'} {alert.amount || '-'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Merchant</span>
              <span className="detail-value">{alert.merchantName || alert.merchant_name || '-'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Transaction Status</span>
              <span className="detail-value">{alert.transactionStatus || alert.transaction_status || '-'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* AI Risk Score Section */}
      <div className="card" style={{ marginTop: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ marginTop: 0 }}>AI Risk Score</h3>
          <button className="btn btn-secondary" onClick={getAiRiskScore} disabled={aiLoading}>
            <FiCpu /> {aiLoading ? 'Scoring...' : 'Run AI Risk Score'}
          </button>
        </div>

        {!aiScore && !aiLoading && (
          <p style={{ color: '#6b7280' }}>Click "Run AI Risk Score" to analyze this transaction with AI.</p>
        )}

        {aiLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6b7280' }}>
            <div className="spinner" style={{ width: '16px', height: '16px' }}></div>
            Analyzing transaction...
          </div>
        )}

        {aiScore && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginBottom: '16px' }}>
              <div style={{
                width: '80px', height: '80px', borderRadius: '50%',
                background: aiScore.riskScore >= 70 ? '#ef4444' : aiScore.riskScore >= 40 ? '#f59e0b' : '#10b981',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff',
              }}>
                <span style={{ fontSize: '24px', fontWeight: 'bold' }}>{aiScore.riskScore}</span>
                <span style={{ fontSize: '10px' }}>/ 100</span>
              </div>
              <div>
                <p style={{ margin: '0 0 4px 0', fontWeight: '600' }}>
                  {aiScore.riskScore >= 70 ? 'High Risk' : aiScore.riskScore >= 40 ? 'Medium Risk' : 'Low Risk'}
                </p>
                {aiScore.autoAlertCreated && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#ef4444', fontSize: '13px' }}>
                    <FiAlertTriangle /> Auto-alert created due to high risk score
                  </div>
                )}
              </div>
            </div>

            {aiScore.riskFactors && aiScore.riskFactors.length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                <p style={{ margin: '0 0 8px 0', fontWeight: '600', fontSize: '13px' }}>Risk Factors:</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {aiScore.riskFactors.map((f, i) => (
                    <span key={i} style={{ background: '#fee2e2', color: '#dc2626', padding: '2px 10px', borderRadius: '12px', fontSize: '12px' }}>
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {aiScore.details && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', fontSize: '13px' }}>
                {[
                  ['Location Anomaly', aiScore.details.locationAnomaly],
                  ['Amount Spike', aiScore.details.amountSpike],
                  ['Velocity Issue', aiScore.details.velocityIssue],
                  ['Unusual Merchant', aiScore.details.unusualMerchant],
                ].map(([label, val]) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: val ? '#ef4444' : '#10b981' }}>{val ? '⚠' : '✓'}</span>
                    <span>{label}: <strong>{val ? 'Yes' : 'No'}</strong></span>
                  </div>
                ))}
              </div>
            )}

            {aiScore.details?.reasoning && (
              <div style={{ marginTop: '12px', padding: '12px', background: '#f9fafb', borderRadius: '6px', fontSize: '13px' }}>
                <strong>Reasoning:</strong> {aiScore.details.reasoning}
              </div>
            )}

            <p style={{ margin: '8px 0 0 0', fontSize: '11px', color: '#9ca3af' }}>
              Baseline: avg ${aiScore.baseline?.avgAmount?.toFixed(2) || '-'} over {aiScore.baseline?.historyCount || 0} transactions
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
