import React, { useState, useEffect, useCallback } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiExternalLink } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../api';
import Pagination from '../components/Pagination';

const LIMIT = 20;

const VALID_ALERT_TYPES = [
  'velocity_check', 'amount_threshold', 'location_anomaly', 'behavioral_anomaly',
  'card_testing', 'account_takeover', 'identity_theft', 'merchant_fraud',
  'chargeback_abuse', 'synthetic_identity', 'ai_risk_score', 'manual',
];

const emptyForm = {
  alertType: '', severity: 'medium', description: '', status: 'open',
  assignedTo: '', transactionId: '', ruleId: '',
};

export default function FraudAlerts() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });

  const loadItems = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await api.get('/fraud-alerts', { params: { page, limit: LIMIT } });
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
      toast.error('Failed to load alerts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadItems(1); }, [loadItems]);

  const openDetail = (item) => { setSelected(item); setShowDetail(true); };

  const openNew = () => { setEditItem(null); setForm({ ...emptyForm }); setShowForm(true); };

  const openEdit = (e, item) => {
    e?.stopPropagation();
    setEditItem(item);
    setForm({
      alertType: item.alertType || '',
      severity: item.severity || 'medium',
      description: item.description || '',
      status: item.status || 'open',
      assignedTo: item.assignedTo || '',
      transactionId: item.transactionId || '',
      ruleId: item.ruleId || '',
    });
    setShowForm(true);
  };

  const requestDelete = (e, item) => {
    e?.stopPropagation();
    setDeleteTarget(item);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/fraud-alerts/${deleteTarget.id}`);
      toast.success('Alert deleted');
      setDeleteTarget(null);
      setShowDetail(false);
      loadItems(pagination.page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      alert_type: form.alertType,
      severity: form.severity,
      description: form.description,
      status: form.status,
      assigned_to: form.assignedTo ? parseInt(form.assignedTo) : undefined,
      transaction_id: form.transactionId ? parseInt(form.transactionId) : undefined,
      rule_id: form.ruleId ? parseInt(form.ruleId) : undefined,
    };
    try {
      if (editItem) {
        await api.put(`/fraud-alerts/${editItem.id}`, payload);
        toast.success('Alert updated');
      } else {
        await api.post('/fraud-alerts', payload);
        toast.success('Alert created');
      }
      setShowForm(false);
      loadItems(pagination.page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    }
  };

  const updateStatus = async (newStatus) => {
    if (!selected) return;
    try {
      await api.patch(`/fraud-alerts/${selected.id}/status`, { status: newStatus });
      toast.success(`Status updated to ${newStatus}`);
      setSelected({ ...selected, status: newStatus });
      loadItems(pagination.page);
    } catch (err) {
      toast.error('Update failed');
    }
  };

  const setField = (k, v) => setForm(p => ({ ...p, [k]: v }));

  if (loading) return <div className="loading-container"><div className="spinner"></div> Loading...</div>;

  return (
    <div>
      <div className="page-header">
        <div><h2>Fraud Alerts</h2><p>View and manage fraud alerts</p></div>
        <button className="btn btn-primary" onClick={openNew}><FiPlus /> New Alert</button>
      </div>

      <div className="table-container">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>ID</th><th>Alert Type</th><th>Severity</th><th>Description</th>
                <th>Status</th><th>Assigned To</th><th>Date</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '40px' }}>No alerts found</td></tr>
              ) : items.map(a => (
                <tr key={a.id} onClick={() => openDetail(a)}>
                  <td>#{a.id}</td>
                  <td>{a.alertType || '-'}</td>
                  <td><span className={`badge badge-${(a.severity || '').toLowerCase()}`}>{a.severity || '-'}</span></td>
                  <td>{(a.description || '').substring(0, 60)}{(a.description || '').length > 60 ? '...' : ''}</td>
                  <td><span className={`badge badge-${(a.status || '').toLowerCase()}`}>{a.status || '-'}</span></td>
                  <td>{a.assignedToName || a.assignedTo || '-'}</td>
                  <td>{a.createdAt ? new Date(a.createdAt).toLocaleDateString() : '-'}</td>
                  <td className="table-actions" onClick={e => e.stopPropagation()}>
                    <button className="btn btn-secondary btn-sm" title="View Detail" onClick={e => { e.stopPropagation(); navigate(`/fraud-alerts/${a.id}`); }}><FiExternalLink /></button>
                    <button className="btn btn-secondary btn-sm" onClick={e => openEdit(e, a)}><FiEdit2 /></button>
                    <button className="btn btn-danger btn-sm" onClick={e => requestDelete(e, a)}><FiTrash2 /></button>
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
              <h3>Alert #{selected.id} Details</h3>
              <button className="modal-close" onClick={() => setShowDetail(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-item"><span className="detail-label">Alert Type</span><span className="detail-value">{selected.alertType || '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Severity</span><span className="detail-value"><span className={`badge badge-${(selected.severity || '').toLowerCase()}`}>{selected.severity}</span></span></div>
                <div className="detail-item"><span className="detail-label">Status</span><span className="detail-value"><span className={`badge badge-${(selected.status || '').toLowerCase()}`}>{selected.status}</span></span></div>
                <div className="detail-item"><span className="detail-label">Assigned To</span><span className="detail-value">{selected.assignedToName || selected.assignedTo || '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Transaction ID</span><span className="detail-value">{selected.transactionId ? `#${selected.transactionId}` : '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Amount</span><span className="detail-value">{selected.amount ? `${selected.currency || ''} ${parseFloat(selected.amount).toLocaleString()}` : '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Merchant</span><span className="detail-value">{selected.merchantName || '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Rule</span><span className="detail-value">{selected.ruleName || (selected.ruleId ? `#${selected.ruleId}` : '-')}</span></div>
                <div className="detail-item"><span className="detail-label">Created</span><span className="detail-value">{selected.createdAt ? new Date(selected.createdAt).toLocaleString() : '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Resolved At</span><span className="detail-value">{selected.resolvedAt ? new Date(selected.resolvedAt).toLocaleString() : '-'}</span></div>
                <div className="detail-item full-width"><span className="detail-label">Description</span><span className="detail-value">{selected.description || '-'}</span></div>
              </div>
              <div style={{ marginTop: '20px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginRight: '10px' }}>UPDATE STATUS:</label>
                <select
                  value={selected.status || 'open'}
                  onChange={e => updateStatus(e.target.value)}
                  style={{ padding: '8px 12px', background: '#1a2332', border: '1px solid #2d3a4d', borderRadius: '6px', color: '#f1f5f9', fontSize: '13px' }}
                >
                  <option value="open">Open</option>
                  <option value="investigating">Investigating</option>
                  <option value="resolved">Resolved</option>
                  <option value="dismissed">Dismissed</option>
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDetail(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={e => { setShowDetail(false); openEdit(e, selected); }}><FiEdit2 /> Edit</button>
              <button className="btn btn-danger" onClick={e => requestDelete(e, selected)}><FiTrash2 /> Delete</button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="modal" role="alertdialog" aria-modal="true" onClick={e => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="modal-header"><h3>Delete fraud alert?</h3></div>
            <div className="modal-body">Alert #{deleteTarget.id} will be permanently removed from PostgreSQL.</div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger" onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editItem ? 'Edit Alert' : 'New Alert'}</h3>
              <button className="modal-close" onClick={() => setShowForm(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label>Alert Type *</label>
                    <select value={form.alertType} onChange={e => setField('alertType', e.target.value)} required>
                      <option value="">Select type...</option>
                      {VALID_ALERT_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Severity</label>
                    <select value={form.severity} onChange={e => setField('severity', e.target.value)}>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Status</label>
                    <select value={form.status} onChange={e => setField('status', e.target.value)}>
                      <option value="open">Open</option>
                      <option value="investigating">Investigating</option>
                      <option value="resolved">Resolved</option>
                      <option value="dismissed">Dismissed</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Assigned To (User ID)</label>
                    <input type="number" value={form.assignedTo} onChange={e => setField('assignedTo', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Transaction ID</label>
                    <input type="number" value={form.transactionId} onChange={e => setField('transactionId', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label>Rule ID</label>
                    <input type="number" value={form.ruleId} onChange={e => setField('ruleId', e.target.value)} />
                  </div>
                  <div className="form-group full-width">
                    <label>Description *</label>
                    <textarea value={form.description} onChange={e => setField('description', e.target.value)} required />
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
