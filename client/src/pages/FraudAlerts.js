import React, { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../api';

const emptyForm = {
  alertType: '', severity: 'medium', description: '', status: 'open',
  assignedTo: '', transactionId: '', ruleId: '', notes: '',
  resolution: ''
};

export default function FraudAlerts() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });

  useEffect(() => { loadItems(); }, []);

  const loadItems = async () => {
    try {
      const res = await api.get('/fraud-alerts');
      setItems(Array.isArray(res.data) ? res.data : res.data?.data || []);
    } catch (err) { toast.error('Failed to load alerts'); }
    finally { setLoading(false); }
  };

  const openDetail = (item) => { setSelected(item); setShowDetail(true); };

  const openNew = () => { setEditItem(null); setForm({ ...emptyForm }); setShowForm(true); };

  const openEdit = (e, item) => {
    e.stopPropagation();
    setEditItem(item);
    setForm({
      alertType: item.alertType || item.type || '',
      severity: item.severity || 'medium',
      description: item.description || '',
      status: item.status || 'open',
      assignedTo: item.assignedTo || '',
      transactionId: item.transactionId || '',
      ruleId: item.ruleId || '',
      notes: item.notes || '',
      resolution: item.resolution || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (e, item) => {
    e.stopPropagation();
    if (!window.confirm('Delete this alert?')) return;
    try {
      await api.delete(`/fraud-alerts/${item._id || item.id}`);
      toast.success('Alert deleted');
      loadItems();
    } catch (err) { toast.error('Failed to delete'); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editItem) {
        await api.put(`/fraud-alerts/${editItem._id || editItem.id}`, form);
        toast.success('Alert updated');
      } else {
        await api.post('/fraud-alerts', form);
        toast.success('Alert created');
      }
      setShowForm(false);
      loadItems();
    } catch (err) { toast.error(err.response?.data?.error || 'Save failed'); }
  };

  const updateStatus = async (newStatus) => {
    if (!selected) return;
    try {
      await api.put(`/fraud-alerts/${selected._id || selected.id}`, { ...selected, status: newStatus });
      toast.success(`Status updated to ${newStatus}`);
      setSelected({ ...selected, status: newStatus });
      loadItems();
    } catch (err) { toast.error('Update failed'); }
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
              <tr><th>Alert Type</th><th>Severity</th><th>Description</th><th>Status</th><th>Assigned To</th><th>Date</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '40px' }}>No alerts found</td></tr>
              ) : items.map(a => (
                <tr key={a._id || a.id} onClick={() => openDetail(a)}>
                  <td>{a.alertType || a.type || '-'}</td>
                  <td><span className={`badge badge-${(a.severity || '').toLowerCase()}`}>{a.severity || '-'}</span></td>
                  <td>{(a.description || '').substring(0, 60)}{(a.description || '').length > 60 ? '...' : ''}</td>
                  <td><span className={`badge badge-${(a.status || '').toLowerCase()}`}>{a.status || '-'}</span></td>
                  <td>{a.assignedTo || '-'}</td>
                  <td>{a.createdAt ? new Date(a.createdAt).toLocaleDateString() : '-'}</td>
                  <td className="table-actions" onClick={e => e.stopPropagation()}>
                    <button className="btn btn-secondary btn-sm" onClick={e => openEdit(e, a)}><FiEdit2 /></button>
                    <button className="btn btn-danger btn-sm" onClick={e => handleDelete(e, a)}><FiTrash2 /></button>
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
              <h3>Alert Details</h3>
              <button className="modal-close" onClick={() => setShowDetail(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-item"><span className="detail-label">ID</span><span className="detail-value">{selected._id || selected.id}</span></div>
                <div className="detail-item"><span className="detail-label">Alert Type</span><span className="detail-value">{selected.alertType || selected.type || '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Severity</span><span className="detail-value"><span className={`badge badge-${(selected.severity || '').toLowerCase()}`}>{selected.severity}</span></span></div>
                <div className="detail-item"><span className="detail-label">Status</span><span className="detail-value"><span className={`badge badge-${(selected.status || '').toLowerCase()}`}>{selected.status}</span></span></div>
                <div className="detail-item"><span className="detail-label">Assigned To</span><span className="detail-value">{selected.assignedTo || '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Transaction ID</span><span className="detail-value">{selected.transactionId || '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Rule ID</span><span className="detail-value">{selected.ruleId || '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Created</span><span className="detail-value">{selected.createdAt ? new Date(selected.createdAt).toLocaleString() : '-'}</span></div>
                <div className="detail-item full-width"><span className="detail-label">Description</span><span className="detail-value">{selected.description || '-'}</span></div>
                <div className="detail-item full-width"><span className="detail-label">Notes</span><span className="detail-value">{selected.notes || '-'}</span></div>
                <div className="detail-item full-width"><span className="detail-label">Resolution</span><span className="detail-value">{selected.resolution || '-'}</span></div>
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
                  <option value="escalated">Escalated</option>
                </select>
              </div>
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
                  <div className="form-group"><label>Alert Type</label><input type="text" value={form.alertType} onChange={e => setField('alertType', e.target.value)} required /></div>
                  <div className="form-group"><label>Severity</label>
                    <select value={form.severity} onChange={e => setField('severity', e.target.value)}>
                      <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
                    </select>
                  </div>
                  <div className="form-group"><label>Status</label>
                    <select value={form.status} onChange={e => setField('status', e.target.value)}>
                      <option value="open">Open</option><option value="investigating">Investigating</option><option value="resolved">Resolved</option><option value="dismissed">Dismissed</option><option value="escalated">Escalated</option>
                    </select>
                  </div>
                  <div className="form-group"><label>Assigned To</label><input type="text" value={form.assignedTo} onChange={e => setField('assignedTo', e.target.value)} /></div>
                  <div className="form-group"><label>Transaction ID</label><input type="text" value={form.transactionId} onChange={e => setField('transactionId', e.target.value)} /></div>
                  <div className="form-group"><label>Rule ID</label><input type="text" value={form.ruleId} onChange={e => setField('ruleId', e.target.value)} /></div>
                  <div className="form-group full-width"><label>Description</label><textarea value={form.description} onChange={e => setField('description', e.target.value)} required /></div>
                  <div className="form-group full-width"><label>Notes</label><textarea value={form.notes} onChange={e => setField('notes', e.target.value)} /></div>
                  <div className="form-group full-width"><label>Resolution</label><textarea value={form.resolution} onChange={e => setField('resolution', e.target.value)} /></div>
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
