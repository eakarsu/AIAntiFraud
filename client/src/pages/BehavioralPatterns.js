import React, { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiCpu } from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../api';
import AIResultsDisplay from '../components/AIResultsDisplay';

function getRiskClass(score) {
  if (score == null) return '';
  const s = parseFloat(score);
  if (s <= 30) return 'risk-low';
  if (s <= 60) return 'risk-medium';
  if (s <= 80) return 'risk-high';
  return 'risk-critical';
}

const emptyForm = {
  customerId: '', patternType: 'spending', avgTransactionAmount: '',
  maxTransactionAmount: '', minTransactionAmount: '', transactionFrequency: '',
  anomalyScore: '', typicalMerchants: '', typicalLocations: '',
  typicalTimeOfDay: '', avgDailyTransactions: '', notes: ''
};

export default function BehavioralPatterns() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => { loadItems(); }, []);

  const loadItems = async () => {
    try {
      const res = await api.get('/behavioral-patterns');
      setItems(Array.isArray(res.data) ? res.data : res.data?.data || []);
    } catch (err) { toast.error('Failed to load behavioral patterns'); }
    finally { setLoading(false); }
  };

  const openDetail = (item) => { setSelected(item); setAiResult(null); setShowDetail(true); };
  const openNew = () => { setEditItem(null); setForm({ ...emptyForm }); setShowForm(true); };

  const openEdit = (e, item) => {
    e.stopPropagation();
    setEditItem(item);
    setForm({
      customerId: item.customerId || '',
      patternType: item.patternType || 'spending',
      avgTransactionAmount: item.avgTransactionAmount ?? '',
      maxTransactionAmount: item.maxTransactionAmount ?? '',
      minTransactionAmount: item.minTransactionAmount ?? '',
      transactionFrequency: item.transactionFrequency ?? '',
      anomalyScore: item.anomalyScore ?? '',
      typicalMerchants: Array.isArray(item.typicalMerchants) ? item.typicalMerchants.join(', ') : (item.typicalMerchants || ''),
      typicalLocations: Array.isArray(item.typicalLocations) ? item.typicalLocations.join(', ') : (item.typicalLocations || ''),
      typicalTimeOfDay: item.typicalTimeOfDay || '',
      avgDailyTransactions: item.avgDailyTransactions ?? '',
      notes: item.notes || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (e, item) => {
    e.stopPropagation();
    if (!window.confirm('Delete this pattern?')) return;
    try {
      await api.delete(`/behavioral-patterns/${item._id || item.id}`);
      toast.success('Pattern deleted');
      loadItems();
    } catch (err) { toast.error('Failed to delete'); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      avgTransactionAmount: parseFloat(form.avgTransactionAmount) || 0,
      maxTransactionAmount: parseFloat(form.maxTransactionAmount) || 0,
      minTransactionAmount: parseFloat(form.minTransactionAmount) || 0,
      transactionFrequency: parseFloat(form.transactionFrequency) || 0,
      anomalyScore: parseFloat(form.anomalyScore) || 0,
      avgDailyTransactions: parseFloat(form.avgDailyTransactions) || 0,
      typicalMerchants: form.typicalMerchants ? form.typicalMerchants.split(',').map(s => s.trim()).filter(Boolean) : [],
      typicalLocations: form.typicalLocations ? form.typicalLocations.split(',').map(s => s.trim()).filter(Boolean) : [],
    };
    try {
      if (editItem) {
        await api.put(`/behavioral-patterns/${editItem._id || editItem.id}`, payload);
        toast.success('Pattern updated');
      } else {
        await api.post('/behavioral-patterns', payload);
        toast.success('Pattern created');
      }
      setShowForm(false);
      loadItems();
    } catch (err) { toast.error(err.response?.data?.error || 'Save failed'); }
  };

  const runAiAnalysis = async () => {
    if (!selected) return;
    setAiLoading(true);
    setAiResult(null);
    try {
      const res = await api.post(`/behavioral-patterns/${selected._id || selected.id}/analyze`);
      setAiResult(res.data);
    } catch (err) { toast.error('AI analysis failed'); }
    finally { setAiLoading(false); }
  };

  const setField = (k, v) => setForm(p => ({ ...p, [k]: v }));

  if (loading) return <div className="loading-container"><div className="spinner"></div> Loading...</div>;

  return (
    <div>
      <div className="page-header">
        <div><h2>Behavioral Patterns</h2><p>Customer behavioral analysis and anomaly detection</p></div>
        <button className="btn btn-primary" onClick={openNew}><FiPlus /> New Pattern</button>
      </div>

      <div className="table-container">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr><th>Customer ID</th><th>Pattern Type</th><th>Avg Amount</th><th>Max Amount</th><th>Anomaly Score</th><th>Last Updated</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '40px' }}>No behavioral patterns found</td></tr>
              ) : items.map(b => (
                <tr key={b._id || b.id} onClick={() => openDetail(b)}>
                  <td>{(b.customerId || '-').toString().slice(-8)}</td>
                  <td>{b.patternType || '-'}</td>
                  <td>${parseFloat(b.avgTransactionAmount || 0).toLocaleString()}</td>
                  <td>${parseFloat(b.maxTransactionAmount || 0).toLocaleString()}</td>
                  <td><span className={`risk-score ${getRiskClass(b.anomalyScore)}`}>{b.anomalyScore != null ? parseFloat(b.anomalyScore).toFixed(1) : '-'}</span></td>
                  <td>{(b.lastUpdated || b.updatedAt) ? new Date(b.lastUpdated || b.updatedAt).toLocaleDateString() : '-'}</td>
                  <td className="table-actions" onClick={e => e.stopPropagation()}>
                    <button className="btn btn-secondary btn-sm" onClick={e => openEdit(e, b)}><FiEdit2 /></button>
                    <button className="btn btn-danger btn-sm" onClick={e => handleDelete(e, b)}><FiTrash2 /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showDetail && selected && (
        <div className="modal-overlay" onClick={() => setShowDetail(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Behavioral Pattern Details</h3>
              <button className="modal-close" onClick={() => setShowDetail(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-item"><span className="detail-label">Customer ID</span><span className="detail-value">{selected.customerId || '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Pattern Type</span><span className="detail-value">{selected.patternType || '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Avg Transaction Amount</span><span className="detail-value">${(selected.avgTransactionAmount || 0).toLocaleString()}</span></div>
                <div className="detail-item"><span className="detail-label">Max Transaction Amount</span><span className="detail-value">${(selected.maxTransactionAmount || 0).toLocaleString()}</span></div>
                <div className="detail-item"><span className="detail-label">Min Transaction Amount</span><span className="detail-value">${(selected.minTransactionAmount || 0).toLocaleString()}</span></div>
                <div className="detail-item"><span className="detail-label">Transaction Frequency</span><span className="detail-value">{selected.transactionFrequency ?? '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Anomaly Score</span><span className="detail-value"><span className={`risk-score ${getRiskClass(selected.anomalyScore)}`}>{selected.anomalyScore != null ? parseFloat(selected.anomalyScore).toFixed(1) : '-'}</span></span></div>
                <div className="detail-item"><span className="detail-label">Avg Daily Transactions</span><span className="detail-value">{selected.avgDailyTransactions ?? '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Typical Time of Day</span><span className="detail-value">{selected.typicalTimeOfDay || '-'}</span></div>
                <div className="detail-item full-width"><span className="detail-label">Typical Merchants</span><span className="detail-value">{Array.isArray(selected.typicalMerchants) ? selected.typicalMerchants.join(', ') : (selected.typicalMerchants || '-')}</span></div>
                <div className="detail-item full-width"><span className="detail-label">Typical Locations</span><span className="detail-value">{Array.isArray(selected.typicalLocations) ? selected.typicalLocations.join(', ') : (selected.typicalLocations || '-')}</span></div>
                <div className="detail-item full-width"><span className="detail-label">Notes</span><span className="detail-value">{selected.notes || '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Last Updated</span><span className="detail-value">{(selected.lastUpdated || selected.updatedAt) ? new Date(selected.lastUpdated || selected.updatedAt).toLocaleString() : '-'}</span></div>
              </div>
              <div style={{ marginTop: '20px' }}>
                <button className="btn btn-ai" onClick={runAiAnalysis} disabled={aiLoading}><FiCpu /> {aiLoading ? 'Analyzing...' : 'AI Behavioral Analysis'}</button>
              </div>
              {aiLoading && <div className="ai-loading"><div className="spinner"></div>Running AI behavioral analysis...</div>}
              {aiResult && <AIResultsDisplay data={aiResult} title="AI Behavioral Analysis" />}
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editItem ? 'Edit Pattern' : 'New Behavioral Pattern'}</h3>
              <button className="modal-close" onClick={() => setShowForm(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group"><label>Customer ID</label><input type="text" value={form.customerId} onChange={e => setField('customerId', e.target.value)} required /></div>
                  <div className="form-group"><label>Pattern Type</label>
                    <select value={form.patternType} onChange={e => setField('patternType', e.target.value)}>
                      <option value="spending">Spending</option><option value="frequency">Frequency</option><option value="geographic">Geographic</option><option value="temporal">Temporal</option><option value="merchant">Merchant</option>
                    </select>
                  </div>
                  <div className="form-group"><label>Avg Transaction Amount</label><input type="number" step="0.01" value={form.avgTransactionAmount} onChange={e => setField('avgTransactionAmount', e.target.value)} /></div>
                  <div className="form-group"><label>Max Transaction Amount</label><input type="number" step="0.01" value={form.maxTransactionAmount} onChange={e => setField('maxTransactionAmount', e.target.value)} /></div>
                  <div className="form-group"><label>Min Transaction Amount</label><input type="number" step="0.01" value={form.minTransactionAmount} onChange={e => setField('minTransactionAmount', e.target.value)} /></div>
                  <div className="form-group"><label>Transaction Frequency</label><input type="number" value={form.transactionFrequency} onChange={e => setField('transactionFrequency', e.target.value)} /></div>
                  <div className="form-group"><label>Anomaly Score (0-1)</label><input type="number" step="0.01" min="0" max="1" value={form.anomalyScore} onChange={e => setField('anomalyScore', e.target.value)} /></div>
                  <div className="form-group"><label>Avg Daily Transactions</label><input type="number" value={form.avgDailyTransactions} onChange={e => setField('avgDailyTransactions', e.target.value)} /></div>
                  <div className="form-group"><label>Typical Time of Day</label><input type="text" placeholder="e.g., morning, afternoon" value={form.typicalTimeOfDay} onChange={e => setField('typicalTimeOfDay', e.target.value)} /></div>
                  <div className="form-group full-width"><label>Typical Merchants (comma separated)</label><input type="text" value={form.typicalMerchants} onChange={e => setField('typicalMerchants', e.target.value)} /></div>
                  <div className="form-group full-width"><label>Typical Locations (comma separated)</label><input type="text" value={form.typicalLocations} onChange={e => setField('typicalLocations', e.target.value)} /></div>
                  <div className="form-group full-width"><label>Notes</label><textarea value={form.notes} onChange={e => setField('notes', e.target.value)} /></div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editItem ? 'Update' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
