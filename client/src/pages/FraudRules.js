import React, { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../api';

const emptyForm = {
  name: '', description: '', ruleType: 'velocity', condition: '',
  action: 'flag', severity: 'medium', isActive: true, threshold: '',
  parameters: ''
};

export default function FraudRules() {
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
      const res = await api.get('/fraud-rules');
      setItems(Array.isArray(res.data) ? res.data : res.data?.data || []);
    } catch (err) { toast.error('Failed to load fraud rules'); }
    finally { setLoading(false); }
  };

  const openDetail = (item) => { setSelected(item); setShowDetail(true); };

  const openNew = () => { setEditItem(null); setForm({ ...emptyForm }); setShowForm(true); };

  const openEdit = (e, item) => {
    e.stopPropagation();
    setEditItem(item);
    setForm({
      name: item.name || '',
      description: item.description || '',
      ruleType: item.ruleType || item.type || 'velocity',
      condition: item.condition || '',
      action: item.action || 'flag',
      severity: item.severity || 'medium',
      isActive: item.isActive !== false,
      threshold: item.threshold || '',
      parameters: typeof item.parameters === 'object' ? JSON.stringify(item.parameters) : (item.parameters || ''),
    });
    setShowForm(true);
  };

  const handleDelete = async (e, item) => {
    e.stopPropagation();
    if (!window.confirm(`Delete rule "${item.name}"?`)) return;
    try {
      await api.delete(`/fraud-rules/${item._id || item.id}`);
      toast.success('Rule deleted');
      loadItems();
    } catch (err) { toast.error('Failed to delete'); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = { ...form };
    if (payload.threshold) payload.threshold = parseFloat(payload.threshold);
    try {
      if (payload.parameters) payload.parameters = JSON.parse(payload.parameters);
    } catch { /* keep as string */ }
    try {
      if (editItem) {
        await api.put(`/fraud-rules/${editItem._id || editItem.id}`, payload);
        toast.success('Rule updated');
      } else {
        await api.post('/fraud-rules', payload);
        toast.success('Rule created');
      }
      setShowForm(false);
      loadItems();
    } catch (err) { toast.error(err.response?.data?.error || 'Save failed'); }
  };

  const toggleActive = async (e, item) => {
    e.stopPropagation();
    try {
      await api.put(`/fraud-rules/${item._id || item.id}`, { isActive: !item.isActive });
      loadItems();
    } catch (err) { toast.error('Toggle failed'); }
  };

  const setField = (k, v) => setForm(p => ({ ...p, [k]: v }));

  if (loading) return <div className="loading-container"><div className="spinner"></div> Loading...</div>;

  return (
    <div>
      <div className="page-header">
        <div><h2>Fraud Rules</h2><p>Configure and manage fraud detection rules</p></div>
        <button className="btn btn-primary" onClick={openNew}><FiPlus /> New Rule</button>
      </div>

      <div className="table-container">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr><th>Name</th><th>Type</th><th>Action</th><th>Severity</th><th>Active</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '40px' }}>No fraud rules found</td></tr>
              ) : items.map(r => (
                <tr key={r._id || r.id} onClick={() => openDetail(r)}>
                  <td>{r.name || '-'}</td>
                  <td>{r.ruleType || r.type || '-'}</td>
                  <td><span className={`badge badge-${r.action === 'block' ? 'red' : r.action === 'flag' ? 'amber' : 'blue'}`}>{r.action || '-'}</span></td>
                  <td><span className={`badge badge-${(r.severity || '').toLowerCase()}`}>{r.severity || '-'}</span></td>
                  <td onClick={e => e.stopPropagation()}>
                    <label className="toggle">
                      <input type="checkbox" checked={r.isActive !== false} onChange={e => toggleActive(e, r)} />
                      <span className="slider"></span>
                    </label>
                  </td>
                  <td className="table-actions" onClick={e => e.stopPropagation()}>
                    <button className="btn btn-secondary btn-sm" onClick={e => openEdit(e, r)}><FiEdit2 /></button>
                    <button className="btn btn-danger btn-sm" onClick={e => handleDelete(e, r)}><FiTrash2 /></button>
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
              <h3>Rule Details</h3>
              <button className="modal-close" onClick={() => setShowDetail(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-item"><span className="detail-label">Name</span><span className="detail-value">{selected.name}</span></div>
                <div className="detail-item"><span className="detail-label">Type</span><span className="detail-value">{selected.ruleType || selected.type || '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Action</span><span className="detail-value"><span className={`badge badge-${selected.action === 'block' ? 'red' : 'amber'}`}>{selected.action}</span></span></div>
                <div className="detail-item"><span className="detail-label">Severity</span><span className="detail-value"><span className={`badge badge-${(selected.severity || '').toLowerCase()}`}>{selected.severity}</span></span></div>
                <div className="detail-item"><span className="detail-label">Active</span><span className="detail-value">{selected.isActive !== false ? 'Yes' : 'No'}</span></div>
                <div className="detail-item"><span className="detail-label">Threshold</span><span className="detail-value">{selected.threshold || '-'}</span></div>
                <div className="detail-item full-width"><span className="detail-label">Condition</span><span className="detail-value">{selected.condition || '-'}</span></div>
                <div className="detail-item full-width"><span className="detail-label">Description</span><span className="detail-value">{selected.description || '-'}</span></div>
                <div className="detail-item full-width"><span className="detail-label">Parameters</span><span className="detail-value">{typeof selected.parameters === 'object' ? JSON.stringify(selected.parameters, null, 2) : (selected.parameters || '-')}</span></div>
                <div className="detail-item"><span className="detail-label">Created</span><span className="detail-value">{selected.createdAt ? new Date(selected.createdAt).toLocaleString() : '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Updated</span><span className="detail-value">{selected.updatedAt ? new Date(selected.updatedAt).toLocaleString() : '-'}</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editItem ? 'Edit Rule' : 'New Rule'}</h3>
              <button className="modal-close" onClick={() => setShowForm(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group"><label>Name</label><input type="text" value={form.name} onChange={e => setField('name', e.target.value)} required /></div>
                  <div className="form-group"><label>Rule Type</label>
                    <select value={form.ruleType} onChange={e => setField('ruleType', e.target.value)}>
                      <option value="velocity">Velocity</option>
                      <option value="amount">Amount</option>
                      <option value="geographic">Geographic</option>
                      <option value="behavioral">Behavioral</option>
                      <option value="device">Device</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                  <div className="form-group"><label>Action</label>
                    <select value={form.action} onChange={e => setField('action', e.target.value)}>
                      <option value="flag">Flag</option>
                      <option value="block">Block</option>
                      <option value="alert">Alert</option>
                      <option value="review">Review</option>
                    </select>
                  </div>
                  <div className="form-group"><label>Severity</label>
                    <select value={form.severity} onChange={e => setField('severity', e.target.value)}>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  <div className="form-group"><label>Threshold</label><input type="number" value={form.threshold} onChange={e => setField('threshold', e.target.value)} /></div>
                  <div className="form-group"><label>Active</label>
                    <select value={form.isActive ? 'true' : 'false'} onChange={e => setField('isActive', e.target.value === 'true')}>
                      <option value="true">Active</option>
                      <option value="false">Inactive</option>
                    </select>
                  </div>
                  <div className="form-group full-width"><label>Condition</label><textarea value={form.condition} onChange={e => setField('condition', e.target.value)} /></div>
                  <div className="form-group full-width"><label>Description</label><textarea value={form.description} onChange={e => setField('description', e.target.value)} /></div>
                  <div className="form-group full-width"><label>Parameters (JSON)</label><textarea value={form.parameters} onChange={e => setField('parameters', e.target.value)} /></div>
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
