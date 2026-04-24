import React, { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiCpu } from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../api';
import AIResultsDisplay from '../components/AIResultsDisplay';

function getRiskClass(score) {
  if (score == null) return '';
  if (score <= 30) return 'risk-low';
  if (score <= 60) return 'risk-medium';
  if (score <= 80) return 'risk-high';
  return 'risk-critical';
}

const emptyForm = {
  amount: '', merchantName: '', merchantCategory: '', status: 'pending',
  riskScore: '', cardNumber: '', cardType: '', currency: 'USD',
  country: '', city: '', ipAddress: '', deviceType: '',
  transactionType: 'purchase', channel: 'online', description: ''
};

export default function Transactions() {
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
      const res = await api.get('/transactions');
      setItems(Array.isArray(res.data) ? res.data : res.data?.data || []);
    } catch (err) {
      toast.error('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  };

  const openDetail = (item) => {
    setSelected(item);
    setAiResult(null);
    setShowDetail(true);
  };

  const openNew = () => {
    setEditItem(null);
    setForm({ ...emptyForm });
    setShowForm(true);
  };

  const openEdit = (e, item) => {
    e.stopPropagation();
    setEditItem(item);
    setForm({
      amount: item.amount || '',
      merchantName: item.merchantName || item.merchant || '',
      merchantCategory: item.merchantCategory || item.category || '',
      status: item.status || 'pending',
      riskScore: item.riskScore ?? '',
      cardNumber: item.cardNumber || '',
      cardType: item.cardType || '',
      currency: item.currency || 'USD',
      country: item.country || '',
      city: item.city || '',
      ipAddress: item.ipAddress || '',
      deviceType: item.deviceType || '',
      transactionType: item.transactionType || 'purchase',
      channel: item.channel || 'online',
      description: item.description || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (e, item) => {
    e.stopPropagation();
    if (!window.confirm(`Delete transaction ${item._id || item.id}?`)) return;
    try {
      await api.delete(`/transactions/${item._id || item.id}`);
      toast.success('Transaction deleted');
      loadItems();
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { ...form, amount: parseFloat(form.amount) || 0, riskScore: parseFloat(form.riskScore) || 0 };
    try {
      if (editItem) {
        await api.put(`/transactions/${editItem._id || editItem.id}`, payload);
        toast.success('Transaction updated');
      } else {
        await api.post('/transactions', payload);
        toast.success('Transaction created');
      }
      setShowForm(false);
      loadItems();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed');
    }
  };

  const runAiAnalysis = async () => {
    if (!selected) return;
    setAiLoading(true);
    setAiResult(null);
    try {
      const res = await api.post(`/transactions/${selected._id || selected.id}/analyze`);
      setAiResult(res.data);
    } catch (err) {
      toast.error('AI analysis failed');
    } finally {
      setAiLoading(false);
    }
  };

  const setField = (k, v) => setForm(p => ({ ...p, [k]: v }));

  if (loading) return <div className="loading-container"><div className="spinner"></div> Loading...</div>;

  return (
    <div>
      <div className="page-header">
        <div><h2>Transactions</h2><p>Monitor and manage all transactions</p></div>
        <button className="btn btn-primary" onClick={openNew}><FiPlus /> New Transaction</button>
      </div>

      <div className="table-container">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>ID</th><th>Amount</th><th>Merchant</th><th>Category</th><th>Status</th><th>Risk Score</th><th>Location</th><th>Date</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan="9" style={{ textAlign: 'center', padding: '40px' }}>No transactions found</td></tr>
              ) : items.map(t => (
                <tr key={t._id || t.id} onClick={() => openDetail(t)}>
                  <td>{(t._id || t.id || '').toString().slice(-8)}</td>
                  <td>${(t.amount || 0).toLocaleString()}</td>
                  <td>{t.merchantName || t.merchant || '-'}</td>
                  <td>{t.merchantCategory || t.category || '-'}</td>
                  <td><span className={`badge badge-${(t.status || '').toLowerCase()}`}>{t.status || '-'}</span></td>
                  <td><span className={`risk-score ${getRiskClass(t.riskScore)}`}>{t.riskScore ?? '-'}</span></td>
                  <td>{[t.city, t.country].filter(Boolean).join(', ') || '-'}</td>
                  <td>{t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '-'}</td>
                  <td className="table-actions" onClick={e => e.stopPropagation()}>
                    <button className="btn btn-secondary btn-sm" onClick={(e) => openEdit(e, t)}><FiEdit2 /></button>
                    <button className="btn btn-danger btn-sm" onClick={(e) => handleDelete(e, t)}><FiTrash2 /></button>
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
              <h3>Transaction Details</h3>
              <button className="modal-close" onClick={() => setShowDetail(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-item"><span className="detail-label">ID</span><span className="detail-value">{selected._id || selected.id}</span></div>
                <div className="detail-item"><span className="detail-label">Amount</span><span className="detail-value">${(selected.amount || 0).toLocaleString()}</span></div>
                <div className="detail-item"><span className="detail-label">Merchant</span><span className="detail-value">{selected.merchantName || selected.merchant || '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Category</span><span className="detail-value">{selected.merchantCategory || selected.category || '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Status</span><span className="detail-value"><span className={`badge badge-${(selected.status || '').toLowerCase()}`}>{selected.status}</span></span></div>
                <div className="detail-item"><span className="detail-label">Risk Score</span><span className="detail-value"><span className={`risk-score ${getRiskClass(selected.riskScore)}`}>{selected.riskScore ?? '-'}</span></span></div>
                <div className="detail-item"><span className="detail-label">Card Number</span><span className="detail-value">{selected.cardNumber || '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Card Type</span><span className="detail-value">{selected.cardType || '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Currency</span><span className="detail-value">{selected.currency || '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Country</span><span className="detail-value">{selected.country || '-'}</span></div>
                <div className="detail-item"><span className="detail-label">City</span><span className="detail-value">{selected.city || '-'}</span></div>
                <div className="detail-item"><span className="detail-label">IP Address</span><span className="detail-value">{selected.ipAddress || '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Device Type</span><span className="detail-value">{selected.deviceType || '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Transaction Type</span><span className="detail-value">{selected.transactionType || '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Channel</span><span className="detail-value">{selected.channel || '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Date</span><span className="detail-value">{selected.createdAt ? new Date(selected.createdAt).toLocaleString() : '-'}</span></div>
                <div className="detail-item full-width"><span className="detail-label">Description</span><span className="detail-value">{selected.description || '-'}</span></div>
              </div>
              <div style={{ marginTop: '20px' }}>
                <button className="btn btn-ai" onClick={runAiAnalysis} disabled={aiLoading}>
                  <FiCpu /> {aiLoading ? 'Analyzing...' : 'AI Analyze'}
                </button>
              </div>
              {aiLoading && <div className="ai-loading"><div className="spinner"></div>Running AI analysis...</div>}
              {aiResult && <AIResultsDisplay data={aiResult} title="AI Transaction Analysis" />}
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editItem ? 'Edit Transaction' : 'New Transaction'}</h3>
              <button className="modal-close" onClick={() => setShowForm(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label>Amount</label>
                    <input type="number" step="0.01" value={form.amount} onChange={e => setField('amount', e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>Merchant Name</label>
                    <input type="text" value={form.merchantName} onChange={e => setField('merchantName', e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>Merchant Category</label>
                    <input type="text" value={form.merchantCategory} onChange={e => setField('merchantCategory', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Status</label>
                    <select value={form.status} onChange={e => setField('status', e.target.value)}>
                      <option value="pending">Pending</option>
                      <option value="approved">Approved</option>
                      <option value="flagged">Flagged</option>
                      <option value="blocked">Blocked</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Risk Score (0-100)</label>
                    <input type="number" min="0" max="100" value={form.riskScore} onChange={e => setField('riskScore', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Card Number</label>
                    <input type="text" value={form.cardNumber} onChange={e => setField('cardNumber', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Card Type</label>
                    <select value={form.cardType} onChange={e => setField('cardType', e.target.value)}>
                      <option value="">Select...</option>
                      <option value="visa">Visa</option>
                      <option value="mastercard">Mastercard</option>
                      <option value="amex">Amex</option>
                      <option value="discover">Discover</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Currency</label>
                    <input type="text" value={form.currency} onChange={e => setField('currency', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Country</label>
                    <input type="text" value={form.country} onChange={e => setField('country', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>City</label>
                    <input type="text" value={form.city} onChange={e => setField('city', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>IP Address</label>
                    <input type="text" value={form.ipAddress} onChange={e => setField('ipAddress', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Device Type</label>
                    <select value={form.deviceType} onChange={e => setField('deviceType', e.target.value)}>
                      <option value="">Select...</option>
                      <option value="desktop">Desktop</option>
                      <option value="mobile">Mobile</option>
                      <option value="tablet">Tablet</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Transaction Type</label>
                    <select value={form.transactionType} onChange={e => setField('transactionType', e.target.value)}>
                      <option value="purchase">Purchase</option>
                      <option value="withdrawal">Withdrawal</option>
                      <option value="transfer">Transfer</option>
                      <option value="refund">Refund</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Channel</label>
                    <select value={form.channel} onChange={e => setField('channel', e.target.value)}>
                      <option value="online">Online</option>
                      <option value="in-store">In-Store</option>
                      <option value="atm">ATM</option>
                      <option value="phone">Phone</option>
                    </select>
                  </div>
                  <div className="form-group full-width">
                    <label>Description</label>
                    <textarea value={form.description} onChange={e => setField('description', e.target.value)} />
                  </div>
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
