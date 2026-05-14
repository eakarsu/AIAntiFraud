import React, { useState, useEffect, useCallback } from 'react';
import { FiPlus, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../api';
import Pagination from '../components/Pagination';

const LIMIT = 20;

const emptyForm = {
  name: '', description: '', modelType: 'classification', version: '',
  accuracy: '', precision: '', recall: '', f1Score: '',
  status: 'training', features: '', trainingDataSize: '',
  lastTrainedAt: '', parameters: ''
};

export default function RiskModels() {
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
      const res = await api.get('/risk-models', { params: { page, limit: LIMIT } });
      const data = res.data;
      setItems(Array.isArray(data) ? data : data?.data || []);
      if (data?.pagination) setPagination({ page: data.pagination.page, totalPages: data.pagination.totalPages, total: data.pagination.total });
    } catch (err) { toast.error('Failed to load risk models'); }
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
      modelType: item.modelType || item.type || 'classification',
      version: item.version || '',
      accuracy: item.accuracy ?? '',
      precision: item.precision ?? '',
      recall: item.recall ?? '',
      f1Score: item.f1Score ?? '',
      status: item.status || 'training',
      features: Array.isArray(item.features) ? item.features.join(', ') : (item.features || ''),
      trainingDataSize: item.trainingDataSize ?? '',
      lastTrainedAt: item.lastTrainedAt ? item.lastTrainedAt.slice(0, 10) : '',
      parameters: typeof item.parameters === 'object' ? JSON.stringify(item.parameters) : (item.parameters || ''),
    });
    setShowForm(true);
  };

  const handleDelete = async (e, item) => {
    e.stopPropagation();
    if (!window.confirm(`Delete model "${item.name}"?`)) return;
    try {
      await api.delete(`/risk-models/${item._id || item.id}`);
      toast.success('Model deleted');
      loadItems(pagination.page);
    } catch (err) { toast.error('Failed to delete'); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      accuracy: parseFloat(form.accuracy) || 0,
      precision: parseFloat(form.precision) || 0,
      recall: parseFloat(form.recall) || 0,
      f1Score: parseFloat(form.f1Score) || 0,
      trainingDataSize: parseInt(form.trainingDataSize) || 0,
      features: form.features ? form.features.split(',').map(f => f.trim()).filter(Boolean) : [],
    };
    try { if (payload.parameters) payload.parameters = JSON.parse(payload.parameters); } catch { /* keep as string */ }
    try {
      if (editItem) {
        await api.put(`/risk-models/${editItem._id || editItem.id}`, payload);
        toast.success('Model updated');
      } else {
        await api.post('/risk-models', payload);
        toast.success('Model created');
      }
      setShowForm(false);
      loadItems(pagination.page);
    } catch (err) { toast.error(err.response?.data?.error || 'Save failed'); }
  };

  const setField = (k, v) => setForm(p => ({ ...p, [k]: v }));

  if (loading) return <div className="loading-container"><div className="spinner"></div> Loading...</div>;

  return (
    <div>
      <div className="page-header">
        <div><h2>Risk Models</h2><p>Manage ML risk assessment models</p></div>
        <button className="btn btn-primary" onClick={openNew}><FiPlus /> New Model</button>
      </div>

      <div className="table-container">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr><th>Name</th><th>Type</th><th>Accuracy</th><th>Precision</th><th>Recall</th><th>F1</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '40px' }}>No models found</td></tr>
              ) : items.map(m => (
                <tr key={m._id || m.id} onClick={() => openDetail(m)}>
                  <td>{m.name || '-'}</td>
                  <td>{m.modelType || m.type || '-'}</td>
                  <td>{m.accuracy != null ? `${(parseFloat(m.accuracy) * (parseFloat(m.accuracy) <= 1 ? 100 : 1)).toFixed(1)}%` : '-'}</td>
                  <td>{(m.precisionScore || m.precision) != null ? `${(parseFloat(m.precisionScore || m.precision) * (parseFloat(m.precisionScore || m.precision) <= 1 ? 100 : 1)).toFixed(1)}%` : '-'}</td>
                  <td>{(m.recallScore || m.recall) != null ? `${(parseFloat(m.recallScore || m.recall) * (parseFloat(m.recallScore || m.recall) <= 1 ? 100 : 1)).toFixed(1)}%` : '-'}</td>
                  <td>{(m.f1Score) != null ? `${(parseFloat(m.f1Score) * (parseFloat(m.f1Score) <= 1 ? 100 : 1)).toFixed(1)}%` : '-'}</td>
                  <td><span className={`badge badge-${m.status === 'active' || m.status === 'deployed' ? 'green' : m.status === 'training' ? 'blue' : m.status === 'retired' ? 'gray' : 'amber'}`}>{m.status || '-'}</span></td>
                  <td className="table-actions" onClick={e => e.stopPropagation()}>
                    <button className="btn btn-secondary btn-sm" onClick={e => openEdit(e, m)}><FiEdit2 /></button>
                    <button className="btn btn-danger btn-sm" onClick={e => handleDelete(e, m)}><FiTrash2 /></button>
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
              <h3>Model Details</h3>
              <button className="modal-close" onClick={() => setShowDetail(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-item"><span className="detail-label">Name</span><span className="detail-value">{selected.name}</span></div>
                <div className="detail-item"><span className="detail-label">Type</span><span className="detail-value">{selected.modelType || selected.type || '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Version</span><span className="detail-value">{selected.version || '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Status</span><span className="detail-value"><span className={`badge badge-${selected.status === 'active' || selected.status === 'deployed' ? 'green' : 'blue'}`}>{selected.status}</span></span></div>
                <div className="detail-item"><span className="detail-label">Accuracy</span><span className="detail-value">{selected.accuracy != null ? `${(parseFloat(selected.accuracy) * (parseFloat(selected.accuracy) <= 1 ? 100 : 1)).toFixed(2)}%` : '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Precision</span><span className="detail-value">{(selected.precisionScore || selected.precision) != null ? `${(parseFloat(selected.precisionScore || selected.precision) * (parseFloat(selected.precisionScore || selected.precision) <= 1 ? 100 : 1)).toFixed(2)}%` : '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Recall</span><span className="detail-value">{(selected.recallScore || selected.recall) != null ? `${(parseFloat(selected.recallScore || selected.recall) * (parseFloat(selected.recallScore || selected.recall) <= 1 ? 100 : 1)).toFixed(2)}%` : '-'}</span></div>
                <div className="detail-item"><span className="detail-label">F1 Score</span><span className="detail-value">{selected.f1Score != null ? `${(parseFloat(selected.f1Score) * (parseFloat(selected.f1Score) <= 1 ? 100 : 1)).toFixed(2)}%` : '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Training Data Size</span><span className="detail-value">{selected.trainingDataSize?.toLocaleString() || '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Last Trained</span><span className="detail-value">{selected.lastTrainedAt ? new Date(selected.lastTrainedAt).toLocaleString() : '-'}</span></div>
                <div className="detail-item full-width"><span className="detail-label">Features</span><span className="detail-value">{Array.isArray(selected.features) ? selected.features.join(', ') : (selected.features || '-')}</span></div>
                <div className="detail-item full-width"><span className="detail-label">Description</span><span className="detail-value">{selected.description || '-'}</span></div>
                <div className="detail-item full-width"><span className="detail-label">Parameters</span><span className="detail-value">{typeof selected.parameters === 'object' ? JSON.stringify(selected.parameters, null, 2) : (selected.parameters || '-')}</span></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editItem ? 'Edit Model' : 'New Risk Model'}</h3>
              <button className="modal-close" onClick={() => setShowForm(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group"><label>Name</label><input type="text" value={form.name} onChange={e => setField('name', e.target.value)} required /></div>
                  <div className="form-group"><label>Model Type</label>
                    <select value={form.modelType} onChange={e => setField('modelType', e.target.value)}>
                      <option value="classification">Classification</option><option value="regression">Regression</option><option value="anomaly_detection">Anomaly Detection</option><option value="ensemble">Ensemble</option><option value="neural_network">Neural Network</option>
                    </select>
                  </div>
                  <div className="form-group"><label>Version</label><input type="text" value={form.version} onChange={e => setField('version', e.target.value)} /></div>
                  <div className="form-group"><label>Status</label>
                    <select value={form.status} onChange={e => setField('status', e.target.value)}>
                      <option value="training">Training</option><option value="active">Active</option><option value="deployed">Deployed</option><option value="testing">Testing</option><option value="retired">Retired</option>
                    </select>
                  </div>
                  <div className="form-group"><label>Accuracy (0-1)</label><input type="number" step="0.001" min="0" max="1" value={form.accuracy} onChange={e => setField('accuracy', e.target.value)} /></div>
                  <div className="form-group"><label>Precision (0-1)</label><input type="number" step="0.001" min="0" max="1" value={form.precision} onChange={e => setField('precision', e.target.value)} /></div>
                  <div className="form-group"><label>Recall (0-1)</label><input type="number" step="0.001" min="0" max="1" value={form.recall} onChange={e => setField('recall', e.target.value)} /></div>
                  <div className="form-group"><label>F1 Score (0-1)</label><input type="number" step="0.001" min="0" max="1" value={form.f1Score} onChange={e => setField('f1Score', e.target.value)} /></div>
                  <div className="form-group"><label>Training Data Size</label><input type="number" value={form.trainingDataSize} onChange={e => setField('trainingDataSize', e.target.value)} /></div>
                  <div className="form-group"><label>Last Trained At</label><input type="date" value={form.lastTrainedAt} onChange={e => setField('lastTrainedAt', e.target.value)} /></div>
                  <div className="form-group full-width"><label>Features (comma separated)</label><input type="text" value={form.features} onChange={e => setField('features', e.target.value)} /></div>
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
