import React, { useState, useEffect, useCallback } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiCpu, FiCheckCircle, FiXCircle } from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../api';
import Pagination from '../components/Pagination';

const LIMIT = 20;

const emptyForm = {
  name: '', description: '', ruleType: 'velocity', condition: '',
  action: 'flag', severity: 'medium', isActive: true, threshold: '',
  parameters: ''
};

export default function FraudRules() {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });

  const loadItems = useCallback(async (page = 1) => {
    try {
      const res = await api.get('/fraud-rules', { params: { page, limit: LIMIT } });
      const data = res.data;
      setItems(Array.isArray(data) ? data : data?.data || []);
      if (data?.pagination) setPagination({ page: data.pagination.page, totalPages: data.pagination.totalPages, total: data.pagination.total });
    } catch (err) { toast.error('Failed to load fraud rules'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadItems(1); }, [loadItems]);

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
      loadItems(pagination.page);
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
      loadItems(pagination.page);
    } catch (err) { toast.error(err.response?.data?.error || 'Save failed'); }
  };

  const toggleActive = async (e, item) => {
    e.stopPropagation();
    try {
      await api.put(`/fraud-rules/${item._id || item.id}`, { isActive: !item.isActive });
      loadItems(pagination.page);
    } catch (err) { toast.error('Toggle failed'); }
  };

  const setField = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const [aiSuggestions, setAiSuggestions] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);

  const getAiSuggestions = async () => {
    setAiLoading(true);
    try {
      const res = await api.post('/ai/suggest-rules', {});
      setAiSuggestions(res.data);
      setShowAiModal(true);
      toast.success(`AI generated ${res.data?.suggestedRules?.length || 0} rule suggestions`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to get AI suggestions');
    } finally {
      setAiLoading(false);
    }
  };

  const acceptSuggestion = async (rule) => {
    const payload = {
      name: rule.name,
      description: rule.description,
      ruleType: 'custom',
      conditionJson: rule.conditionJson || rule.condition_json || {},
      severity: 'medium',
      action: 'flag',
      isActive: false,
    };
    try {
      await api.post('/fraud-rules', payload);
      toast.success(`Rule "${rule.name}" added successfully`);
      loadItems(1);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add rule');
    }
  };

  if (loading) return <div className="loading-container"><div className="spinner"></div> Loading...</div>;

  return (
    <div>
      <div className="page-header">
        <div><h2>Fraud Rules</h2><p>Configure and manage fraud detection rules</p></div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={getAiSuggestions} disabled={aiLoading}>
            <FiCpu /> {aiLoading ? 'Analyzing...' : 'Get AI Suggestions'}
          </button>
          <button className="btn btn-primary" onClick={openNew}><FiPlus /> New Rule</button>
        </div>
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

      {showAiModal && aiSuggestions && (
        <div className="modal-overlay" onClick={() => setShowAiModal(false)}>
          <div className="modal" style={{ maxWidth: '700px', maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>AI Rule Suggestions</h3>
              <button className="modal-close" onClick={() => setShowAiModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <p style={{ color: '#6b7280', marginBottom: '16px' }}>
                Analyzed {aiSuggestions.analyzedAlerts || 0} recent alerts. {aiSuggestions.suggestedRules?.length || 0} rules suggested.
              </p>
              {(aiSuggestions.suggestedRules || []).map((rule, idx) => (
                <div key={idx} style={{ border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <h4 style={{ margin: '0 0 4px 0', fontSize: '15px' }}>{rule.name}</h4>
                      <p style={{ margin: '0 0 8px 0', color: '#6b7280', fontSize: '13px' }}>{rule.description}</p>
                      <div style={{ display: 'flex', gap: '12px', fontSize: '12px' }}>
                        <span>Priority: <strong>{rule.priority || '-'}</strong></span>
                        <span>Expected Precision: <strong>{rule.expectedPrecision ? `${(rule.expectedPrecision * 100).toFixed(0)}%` : '-'}</strong></span>
                      </div>
                      {rule.conditionJson && (
                        <pre style={{ background: '#f3f4f6', padding: '8px', borderRadius: '4px', fontSize: '11px', marginTop: '8px', overflow: 'auto' }}>
                          {JSON.stringify(rule.conditionJson || rule.condition_json, null, 2)}
                        </pre>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginLeft: '16px', flexShrink: 0 }}>
                      <button className="btn btn-primary btn-sm" onClick={() => acceptSuggestion(rule)} title="Add Rule">
                        <FiCheckCircle />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowAiModal(false)}>Close</button>
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
