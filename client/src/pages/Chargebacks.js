import React, { useState, useEffect, useCallback } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiCpu } from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../api';
import Pagination from '../components/Pagination';
import AIResultsDisplay from '../components/AIResultsDisplay';

const LIMIT = 20;
const STATUSES = ['open', 'under_review', 'won', 'lost', 'settled', 'withdrawn'];

function statusColor(s) {
  return s === 'won' ? 'green' : s === 'lost' ? 'red' : s === 'open' ? 'blue' : s === 'under_review' ? 'amber' : 'gray';
}

const emptyForm = {
  customerName: '', amount: '', transactionId: '', reasonCode: '',
  description: '', status: 'open', dueDate: ''
};

export default function Chargebacks() {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [filterStatus, setFilterStatus] = useState('');
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  const loadItems = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = { page, limit: LIMIT };
      if (filterStatus) params.status = filterStatus;
      const res = await api.get('/chargebacks', { params });
      const data = res.data;
      setItems(data.data || []);
      if (data.pagination) setPagination({ page: data.pagination.page, totalPages: data.pagination.totalPages, total: data.pagination.total });
    } catch (err) { toast.error('Failed to load chargebacks'); }
    finally { setLoading(false); }
  }, [filterStatus]);

  useEffect(() => { loadItems(1); }, [loadItems]);

  const openDetail = (item) => { setSelected(item); setAiResult(null); setShowDetail(true); };

  const openNew = () => { setEditItem(null); setForm({ ...emptyForm }); setShowForm(true); };

  const openEdit = (e, item) => {
    e.stopPropagation();
    setEditItem(item);
    setForm({
      customerName: item.customerName || item.customer_name || '',
      amount: item.amount ?? '',
      transactionId: item.transactionId ?? '',
      reasonCode: item.reasonCode || item.reason_code || '',
      description: item.description || '',
      status: item.status || 'open',
      dueDate: item.dueDate ? item.dueDate.slice(0, 10) : '',
    });
    setShowForm(true);
  };

  const handleDelete = async (e, item) => {
    e.stopPropagation();
    if (!window.confirm(`Delete chargeback for "${item.customerName || item.customer_name}"?`)) return;
    try {
      await api.delete(`/chargebacks/${item.id}`);
      toast.success('Chargeback deleted');
      loadItems(pagination.page);
    } catch (err) { toast.error('Failed to delete'); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      customer_name: form.customerName,
      amount: parseFloat(form.amount),
      transaction_id: form.transactionId ? parseInt(form.transactionId) : null,
      reason_code: form.reasonCode,
      description: form.description,
      status: form.status,
      due_date: form.dueDate || null,
    };
    try {
      if (editItem) {
        await api.patch(`/chargebacks/${editItem.id}/status`, { status: form.status });
        toast.success('Chargeback updated');
      } else {
        await api.post('/chargebacks', payload);
        toast.success('Chargeback created');
      }
      setShowForm(false);
      loadItems(pagination.page);
    } catch (err) { toast.error(err.response?.data?.error || 'Save failed'); }
  };

  const runAiPredict = async () => {
    if (!selected) return;
    setAiLoading(true);
    setAiResult(null);
    try {
      const res = await api.post(`/chargebacks/${selected.id}/ai-predict`);
      setAiResult(res.data);
    } catch (err) { toast.error('AI prediction failed'); }
    finally { setAiLoading(false); }
  };

  const setField = (k, v) => setForm(p => ({ ...p, [k]: v }));

  if (loading) return <div className="loading-container"><div className="spinner"></div> Loading...</div>;

  return (
    <div>
      <div className="page-header">
        <div><h2>Chargebacks</h2><p>Manage chargeback disputes and AI outcome prediction</p></div>
        <button className="btn btn-primary" onClick={openNew}><FiPlus /> New Chargeback</button>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ padding: '8px 12px', background: '#1a2332', border: '1px solid #2d3a4d', borderRadius: '6px', color: '#f1f5f9' }}>
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="table-container">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr><th>Customer</th><th>Amount</th><th>Reason Code</th><th>Status</th><th>Due Date</th><th>Created</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '40px' }}>No chargebacks found</td></tr>
              ) : items.map(c => (
                <tr key={c.id} onClick={() => openDetail(c)} style={{ cursor: 'pointer' }}>
                  <td>{c.customerName || c.customer_name || '-'}</td>
                  <td>${parseFloat(c.amount || 0).toFixed(2)}</td>
                  <td>{c.reasonCode || c.reason_code || '-'}</td>
                  <td><span className={`badge badge-${statusColor(c.status)}`}>{c.status || '-'}</span></td>
                  <td>{c.dueDate ? new Date(c.dueDate).toLocaleDateString() : '-'}</td>
                  <td>{c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '-'}</td>
                  <td className="table-actions" onClick={e => e.stopPropagation()}>
                    <button className="btn btn-secondary btn-sm" onClick={e => openEdit(e, c)}><FiEdit2 /></button>
                    <button className="btn btn-danger btn-sm" onClick={e => handleDelete(e, c)}><FiTrash2 /></button>
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
              <h3>Chargeback Details</h3>
              <button className="modal-close" onClick={() => setShowDetail(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-item"><span className="detail-label">Customer</span><span className="detail-value">{selected.customerName || selected.customer_name || '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Amount</span><span className="detail-value">${parseFloat(selected.amount || 0).toFixed(2)}</span></div>
                <div className="detail-item"><span className="detail-label">Reason Code</span><span className="detail-value">{selected.reasonCode || selected.reason_code || '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Status</span><span className="detail-value"><span className={`badge badge-${statusColor(selected.status)}`}>{selected.status}</span></span></div>
                <div className="detail-item"><span className="detail-label">Transaction ID</span><span className="detail-value">{selected.transactionId ? `#${selected.transactionId}` : '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Due Date</span><span className="detail-value">{selected.dueDate ? new Date(selected.dueDate).toLocaleDateString() : '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Assigned To</span><span className="detail-value">{selected.assignedToName || selected.assigned_to_name || '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Created</span><span className="detail-value">{selected.createdAt ? new Date(selected.createdAt).toLocaleString() : '-'}</span></div>
                <div className="detail-item full-width"><span className="detail-label">Description</span><span className="detail-value">{selected.description || '-'}</span></div>
              </div>
              <div style={{ marginTop: '20px' }}>
                <button className="btn btn-ai" onClick={runAiPredict} disabled={aiLoading}>
                  <FiCpu /> {aiLoading ? 'Predicting...' : 'AI Outcome Prediction'}
                </button>
              </div>
              {aiLoading && <div className="ai-loading"><div className="spinner"></div>Running AI outcome prediction...</div>}
              {aiResult && <AIResultsDisplay data={aiResult} title="AI Chargeback Outcome Prediction" />}
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editItem ? 'Update Chargeback Status' : 'New Chargeback'}</h3>
              <button className="modal-close" onClick={() => setShowForm(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-grid">
                  {!editItem && (
                    <>
                      <div className="form-group"><label>Customer Name</label><input type="text" value={form.customerName} onChange={e => setField('customerName', e.target.value)} required /></div>
                      <div className="form-group"><label>Amount</label><input type="number" step="0.01" min="0" value={form.amount} onChange={e => setField('amount', e.target.value)} required /></div>
                      <div className="form-group"><label>Transaction ID (optional)</label><input type="number" value={form.transactionId} onChange={e => setField('transactionId', e.target.value)} /></div>
                      <div className="form-group"><label>Reason Code</label><input type="text" value={form.reasonCode} onChange={e => setField('reasonCode', e.target.value)} /></div>
                      <div className="form-group"><label>Due Date</label><input type="date" value={form.dueDate} onChange={e => setField('dueDate', e.target.value)} /></div>
                    </>
                  )}
                  <div className="form-group"><label>Status</label>
                    <select value={form.status} onChange={e => setField('status', e.target.value)}>
                      {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  {!editItem && (
                    <div className="form-group full-width"><label>Description</label><textarea value={form.description} onChange={e => setField('description', e.target.value)} /></div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">{editItem ? 'Update Status' : 'Create'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
