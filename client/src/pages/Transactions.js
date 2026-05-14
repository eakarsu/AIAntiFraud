import React, { useState, useEffect, useCallback } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiCpu } from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../api';
import AIResultsDisplay from '../components/AIResultsDisplay';
import Pagination from '../components/Pagination';

function getRiskClass(score) {
  if (score == null) return '';
  if (score <= 30) return 'risk-low';
  if (score <= 60) return 'risk-medium';
  if (score <= 80) return 'risk-high';
  return 'risk-critical';
}

const LIMIT = 20;

const emptyForm = {
  amount: '', merchantName: '', merchantCategory: '', status: 'pending',
  riskScore: '', cardNumberLast4: '', currency: 'USD',
  locationCountry: '', locationCity: '', ipAddress: '', deviceId: '',
  isOnline: false, fraudConfirmed: false,
};

export default function Transactions() {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  const loadItems = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await api.get('/transactions', { params: { page, limit: LIMIT } });
      const data = res.data;
      setItems(data.data || []);
      if (data.pagination) {
        setPagination({
          page: data.pagination.page,
          totalPages: data.pagination.totalPages,
          total: data.pagination.total,
        });
      }
    } catch (err) {
      toast.error('Failed to load transactions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadItems(1); }, [loadItems]);

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
      merchantName: item.merchantName || '',
      merchantCategory: item.merchantCategory || '',
      status: item.status || 'pending',
      riskScore: item.riskScore ?? '',
      cardNumberLast4: item.cardNumberLast4 || '',
      currency: item.currency || 'USD',
      locationCountry: item.locationCountry || '',
      locationCity: item.locationCity || '',
      ipAddress: item.ipAddress || '',
      deviceId: item.deviceId || '',
      isOnline: item.isOnline || false,
      fraudConfirmed: item.fraudConfirmed || false,
    });
    setShowForm(true);
  };

  const handleDelete = async (e, item) => {
    e.stopPropagation();
    if (!window.confirm(`Delete transaction #${item.id}?`)) return;
    try {
      await api.delete(`/transactions/${item.id}`);
      toast.success('Transaction deleted');
      loadItems(pagination.page);
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      amount: parseFloat(form.amount) || 0,
      riskScore: form.riskScore !== '' ? parseFloat(form.riskScore) : undefined,
    };
    try {
      if (editItem) {
        await api.put(`/transactions/${editItem.id}`, payload);
        toast.success('Transaction updated');
      } else {
        await api.post('/transactions', payload);
        toast.success('Transaction created');
      }
      setShowForm(false);
      loadItems(pagination.page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    }
  };

  const runAiAnalysis = async () => {
    if (!selected) return;
    setAiLoading(true);
    setAiResult(null);
    try {
      const res = await api.post(`/transactions/${selected.id}/analyze`);
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
                <th>ID</th><th>Amount</th><th>Merchant</th><th>Category</th><th>Status</th>
                <th>Risk Score</th><th>Location</th><th>Date</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan="9" style={{ textAlign: 'center', padding: '40px' }}>No transactions found</td></tr>
              ) : items.map(t => (
                <tr key={t.id} onClick={() => openDetail(t)}>
                  <td>#{t.id}</td>
                  <td>{t.currency || 'USD'} {parseFloat(t.amount || 0).toLocaleString()}</td>
                  <td>{t.merchantName || '-'}</td>
                  <td>{t.merchantCategory || '-'}</td>
                  <td><span className={`badge badge-${(t.status || '').toLowerCase()}`}>{t.status || '-'}</span></td>
                  <td><span className={`risk-score ${getRiskClass(t.riskScore)}`}>{t.riskScore ?? '-'}</span></td>
                  <td>{[t.locationCity, t.locationCountry].filter(Boolean).join(', ') || '-'}</td>
                  <td>{t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '-'}</td>
                  <td className="table-actions" onClick={e => e.stopPropagation()}>
                    <button className="btn btn-secondary btn-sm" onClick={e => openEdit(e, t)}><FiEdit2 /></button>
                    <button className="btn btn-danger btn-sm" onClick={e => handleDelete(e, t)}><FiTrash2 /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          totalItems={pagination.total}
          limit={LIMIT}
          onPageChange={(p) => loadItems(p)}
        />
      </div>

      {showDetail && selected && (
        <div className="modal-overlay" onClick={() => setShowDetail(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Transaction #{selected.id}</h3>
              <button className="modal-close" onClick={() => setShowDetail(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-item"><span className="detail-label">Amount</span><span className="detail-value">{selected.currency} {parseFloat(selected.amount || 0).toLocaleString()}</span></div>
                <div className="detail-item"><span className="detail-label">Merchant</span><span className="detail-value">{selected.merchantName || '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Category</span><span className="detail-value">{selected.merchantCategory || '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Status</span><span className="detail-value"><span className={`badge badge-${(selected.status || '').toLowerCase()}`}>{selected.status}</span></span></div>
                <div className="detail-item"><span className="detail-label">Risk Score</span><span className="detail-value"><span className={`risk-score ${getRiskClass(selected.riskScore)}`}>{selected.riskScore ?? '-'}</span></span></div>
                <div className="detail-item"><span className="detail-label">Card Last 4</span><span className="detail-value">{selected.cardNumberLast4 || '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Currency</span><span className="detail-value">{selected.currency || '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Country</span><span className="detail-value">{selected.locationCountry || '-'}</span></div>
                <div className="detail-item"><span className="detail-label">City</span><span className="detail-value">{selected.locationCity || '-'}</span></div>
                <div className="detail-item"><span className="detail-label">IP Address</span><span className="detail-value">{selected.ipAddress || '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Device ID</span><span className="detail-value">{selected.deviceId || '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Online</span><span className="detail-value">{selected.isOnline ? 'Yes' : 'No'}</span></div>
                <div className="detail-item"><span className="detail-label">Fraud Confirmed</span><span className="detail-value">{selected.fraudConfirmed ? 'Yes' : 'No'}</span></div>
                <div className="detail-item"><span className="detail-label">Date</span><span className="detail-value">{selected.createdAt ? new Date(selected.createdAt).toLocaleString() : '-'}</span></div>
              </div>
              <div style={{ marginTop: '20px' }}>
                <button className="btn btn-ai" onClick={runAiAnalysis} disabled={aiLoading}>
                  <FiCpu /> {aiLoading ? 'Analyzing...' : 'AI Fraud Analysis'}
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
                    <label>Amount *</label>
                    <input type="number" step="0.01" value={form.amount} onChange={e => setField('amount', e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label>Merchant Name *</label>
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
                    <label>Card Last 4</label>
                    <input type="text" maxLength="4" value={form.cardNumberLast4} onChange={e => setField('cardNumberLast4', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Currency</label>
                    <input type="text" value={form.currency} onChange={e => setField('currency', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Country</label>
                    <input type="text" value={form.locationCountry} onChange={e => setField('locationCountry', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>City</label>
                    <input type="text" value={form.locationCity} onChange={e => setField('locationCity', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>IP Address</label>
                    <input type="text" value={form.ipAddress} onChange={e => setField('ipAddress', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Device ID</label>
                    <input type="text" value={form.deviceId} onChange={e => setField('deviceId', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Online Transaction</label>
                    <select value={form.isOnline ? 'true' : 'false'} onChange={e => setField('isOnline', e.target.value === 'true')}>
                      <option value="false">No</option>
                      <option value="true">Yes</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Fraud Confirmed</label>
                    <select value={form.fraudConfirmed ? 'true' : 'false'} onChange={e => setField('fraudConfirmed', e.target.value === 'true')}>
                      <option value="false">No</option>
                      <option value="true">Yes</option>
                    </select>
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
