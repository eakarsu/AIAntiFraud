import React, { useState } from 'react';
import { FiCpu, FiActivity, FiCreditCard, FiUsers, FiGlobe, FiUserCheck, FiBarChart2, FiZap, FiAlertTriangle, FiSettings, FiShare2, FiLayers } from 'react-icons/fi';
import api from '../api';
import AIResultsDisplay from '../components/AIResultsDisplay';

const TOOLS = [
  { key: 'analyze-transaction', label: 'Analyze Transaction', icon: FiCreditCard, description: 'Risk-assess a single transaction.' },
  { key: 'credit-assessment', label: 'Credit Assessment', icon: FiUserCheck, description: 'Assess a credit application by ID.' },
  { key: 'behavioral-analysis', label: 'Behavioral Analysis', icon: FiActivity, description: 'Analyze a behavioral pattern.' },
  { key: 'risk-report', label: 'Platform Risk Report', icon: FiBarChart2, description: 'Comprehensive platform-wide risk report (no inputs).' },
  { key: 'merchant-screening', label: 'Merchant Screening', icon: FiUsers, description: 'Score a merchant risk profile by ID.' },
  { key: 'network-analysis', label: 'Fraud Ring Network', icon: FiGlobe, description: 'Detect fraud rings via shared device/IP clusters.' },
  { key: 'customer-360', label: 'Customer 360', icon: FiUserCheck, description: 'Unified AI snapshot of a customer/user.' },
  { key: 'velocity-rules', label: 'Velocity Rules', icon: FiZap, description: 'Detect rapid-fire transaction velocity anomalies.' },
  { key: 'money-mule-detection', label: 'Money Mule Detection', icon: FiAlertTriangle, description: 'Identify cash-out / mule account patterns.' },
  { key: 'ml-rule-automation', label: 'ML Rule Tuning', icon: FiSettings, description: 'Auto-tune fraud-rule thresholds from observed performance.' },
  { key: 'graph-anomaly', label: 'Graph Anomaly', icon: FiShare2, description: 'In-memory graph anomaly scan over user/device/IP nodes.' },
  { key: 'cross-merchant-rings', label: 'Cross-Merchant Rings', icon: FiLayers, description: 'Detect fraud rings spanning multiple merchants.' },
];

export default function AITools() {
  const [activeTool, setActiveTool] = useState('analyze-transaction');
  const [inputs, setInputs] = useState({
    transaction_id: '',
    credit_score_id: '',
    pattern_id: '',
    merchant_id: '',
    days_back: '30',
    min_shared_attrs: '2',
    customer_id: '',
    user_id: '',
    velocity_user_id: '',
    velocity_hours: '1',
    velocity_min_count: '3',
    velocity_days_back: '7',
    mule_days_back: '30',
    mule_min_total: '1000',
    rule_days_back: '30',
    rule_min_hits: '1',
    graph_days_back: '14',
    graph_max_nodes: '50',
    ring_days_back: '30',
    ring_min_merchants: '3',
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const update = (k) => (e) => setInputs(prev => ({ ...prev, [k]: e.target.value }));
  const reset = () => { setResult(null); setError(null); };

  const submit = async (e) => {
    e.preventDefault();
    reset();
    setLoading(true);
    try {
      let payload = {};
      switch (activeTool) {
        case 'analyze-transaction': payload = { transaction_id: inputs.transaction_id }; break;
        case 'credit-assessment': payload = { credit_score_id: inputs.credit_score_id }; break;
        case 'behavioral-analysis': payload = { pattern_id: inputs.pattern_id }; break;
        case 'risk-report': payload = {}; break;
        case 'merchant-screening': payload = { merchant_id: inputs.merchant_id }; break;
        case 'network-analysis': payload = { days_back: parseInt(inputs.days_back, 10) || 30, min_shared_attrs: parseInt(inputs.min_shared_attrs, 10) || 2 }; break;
        case 'customer-360':
          payload = {};
          if (inputs.customer_id) payload.customer_id = inputs.customer_id;
          if (inputs.user_id) payload.user_id = inputs.user_id;
          break;
        case 'velocity-rules':
          payload = {
            hours_window: parseInt(inputs.velocity_hours, 10) || 1,
            min_tx_count: parseInt(inputs.velocity_min_count, 10) || 3,
            days_back: parseInt(inputs.velocity_days_back, 10) || 7,
          };
          if (inputs.velocity_user_id) payload.user_id = parseInt(inputs.velocity_user_id, 10);
          break;
        case 'money-mule-detection':
          payload = {
            days_back: parseInt(inputs.mule_days_back, 10) || 30,
            min_total_amount: parseFloat(inputs.mule_min_total) || 1000,
          };
          break;
        case 'ml-rule-automation':
          payload = {
            days_back: parseInt(inputs.rule_days_back, 10) || 30,
            min_hits: parseInt(inputs.rule_min_hits, 10) || 0,
          };
          break;
        case 'graph-anomaly':
          payload = {
            days_back: parseInt(inputs.graph_days_back, 10) || 14,
            max_nodes: parseInt(inputs.graph_max_nodes, 10) || 50,
          };
          break;
        case 'cross-merchant-rings':
          payload = {
            days_back: parseInt(inputs.ring_days_back, 10) || 30,
            min_merchants: parseInt(inputs.ring_min_merchants, 10) || 3,
          };
          break;
        default: break;
      }
      const res = await api.post(`/ai/${activeTool}`, payload);
      setResult({ data: res.data.analysis || res.data.report || res.data.profile || res.data });
    } catch (err) {
      const detail = err.response?.data?.message || err.response?.data?.error || err.message;
      const status = err.response?.status;
      if (status === 503 || (typeof detail === 'string' && detail.toLowerCase().includes('openrouter'))) {
        setError({ kind: 'unconfigured', message: 'AI not configured: backend is missing OPENROUTER_API_KEY. Set it in the server environment and restart.' });
      } else {
        setError({ kind: 'error', message: detail });
      }
    } finally {
      setLoading(false);
    }
  };

  const tool = TOOLS.find(t => t.key === activeTool);

  return (
    <div>
      <div className="page-header">
        <div>
          <h2><FiCpu style={{ verticalAlign: 'middle', marginRight: 8 }} />AI Tools</h2>
          <p>Direct access to the platform's AI fraud-analysis endpoints.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 24 }}>
        <div style={{ background: '#1a2332', border: '1px solid #2d3a4d', borderRadius: 8, padding: 8 }}>
          {TOOLS.map(t => {
            const Icon = t.icon;
            const isActive = t.key === activeTool;
            return (
              <div
                key={t.key}
                onClick={() => { setActiveTool(t.key); reset(); }}
                style={{
                  padding: '10px 12px',
                  cursor: 'pointer',
                  borderRadius: 6,
                  marginBottom: 4,
                  background: isActive ? '#312e81' : 'transparent',
                  color: isActive ? '#e0e7ff' : '#cbd5e1',
                  fontWeight: isActive ? 600 : 500,
                }}
              >
                <Icon style={{ verticalAlign: 'middle', marginRight: 8 }} />
                {t.label}
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, fontWeight: 400, lineHeight: 1.3 }}>
                  {t.description}
                </div>
              </div>
            );
          })}
        </div>

        <div>
          <div style={{ background: '#1a2332', border: '1px solid #2d3a4d', borderRadius: 8, padding: 16, marginBottom: 16 }}>
            <h3 style={{ marginTop: 0, color: '#f1f5f9' }}>{tool?.label}</h3>
            <p style={{ color: '#94a3b8', fontSize: 13 }}>{tool?.description}</p>
            <form onSubmit={submit} style={{ marginTop: 12 }}>
              {activeTool === 'analyze-transaction' && (
                <FieldInput label="Transaction ID" required value={inputs.transaction_id} onChange={update('transaction_id')} />
              )}
              {activeTool === 'credit-assessment' && (
                <FieldInput label="Credit Score ID" required value={inputs.credit_score_id} onChange={update('credit_score_id')} />
              )}
              {activeTool === 'behavioral-analysis' && (
                <FieldInput label="Pattern ID" required value={inputs.pattern_id} onChange={update('pattern_id')} />
              )}
              {activeTool === 'risk-report' && (
                <p style={{ color: '#94a3b8', fontSize: 13 }}>No inputs required — analyzes platform-wide stats.</p>
              )}
              {activeTool === 'merchant-screening' && (
                <FieldInput label="Merchant ID" required value={inputs.merchant_id} onChange={update('merchant_id')} />
              )}
              {activeTool === 'network-analysis' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <FieldInput label="Days back" type="number" value={inputs.days_back} onChange={update('days_back')} />
                  <FieldInput label="Min shared attrs" type="number" value={inputs.min_shared_attrs} onChange={update('min_shared_attrs')} />
                </div>
              )}
              {activeTool === 'customer-360' && (
                <>
                  <FieldInput label="Customer ID (or User ID below)" value={inputs.customer_id} onChange={update('customer_id')} />
                  <FieldInput label="User ID" value={inputs.user_id} onChange={update('user_id')} />
                </>
              )}
              {activeTool === 'velocity-rules' && (
                <>
                  <FieldInput label="User ID (optional — leave blank for platform-wide)" value={inputs.velocity_user_id} onChange={update('velocity_user_id')} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    <FieldInput label="Window (hours)" type="number" value={inputs.velocity_hours} onChange={update('velocity_hours')} />
                    <FieldInput label="Min tx / hour" type="number" value={inputs.velocity_min_count} onChange={update('velocity_min_count')} />
                    <FieldInput label="Days back" type="number" value={inputs.velocity_days_back} onChange={update('velocity_days_back')} />
                  </div>
                </>
              )}
              {activeTool === 'money-mule-detection' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <FieldInput label="Days back" type="number" value={inputs.mule_days_back} onChange={update('mule_days_back')} />
                  <FieldInput label="Min total amount ($)" type="number" value={inputs.mule_min_total} onChange={update('mule_min_total')} />
                </div>
              )}
              {activeTool === 'ml-rule-automation' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <FieldInput label="Days back" type="number" value={inputs.rule_days_back} onChange={update('rule_days_back')} />
                  <FieldInput label="Min hits" type="number" value={inputs.rule_min_hits} onChange={update('rule_min_hits')} />
                </div>
              )}
              {activeTool === 'graph-anomaly' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <FieldInput label="Days back" type="number" value={inputs.graph_days_back} onChange={update('graph_days_back')} />
                  <FieldInput label="Max nodes" type="number" value={inputs.graph_max_nodes} onChange={update('graph_max_nodes')} />
                </div>
              )}
              {activeTool === 'cross-merchant-rings' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <FieldInput label="Days back" type="number" value={inputs.ring_days_back} onChange={update('ring_days_back')} />
                  <FieldInput label="Min merchants" type="number" value={inputs.ring_min_merchants} onChange={update('ring_min_merchants')} />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  marginTop: 12, padding: '10px 18px', borderRadius: 6, border: 0,
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: 'white',
                  fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.6 : 1,
                }}
              >
                {loading ? 'Analyzing...' : 'Run AI Analysis'}
              </button>
            </form>
          </div>

          {error && error.kind === 'unconfigured' && (
            <div style={{ background: '#3b2e0a', border: '1px solid #b45309', borderRadius: 8, padding: 16, color: '#fef3c7' }}>
              <strong>AI not configured</strong>
              <p style={{ fontSize: 13, margin: '6px 0 0' }}>{error.message}</p>
            </div>
          )}
          {error && error.kind === 'error' && (
            <div style={{ background: '#450a0a', border: '1px solid #b91c1c', borderRadius: 8, padding: 16, color: '#fecaca' }}>
              <strong>Request failed</strong>
              <p style={{ fontSize: 13, margin: '6px 0 0', whiteSpace: 'pre-wrap' }}>{error.message}</p>
            </div>
          )}

          {result && result.data && (
            <AIResultsDisplay result={typeof result.data === 'object' ? result.data : { content: result.data }} />
          )}
        </div>
      </div>
    </div>
  );
}

function FieldInput({ label, required, type = 'text', value, onChange }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <label style={{ display: 'block', fontSize: 12, color: '#cbd5e1', marginBottom: 4 }}>
        {label}{required && <span style={{ color: '#f87171' }}> *</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        required={required}
        style={{
          width: '100%', padding: '8px 12px',
          background: '#0f172a', color: '#f1f5f9',
          border: '1px solid #334155', borderRadius: 6,
        }}
      />
    </div>
  );
}
