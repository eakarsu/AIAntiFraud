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
  merchantName: '', merchantCategory: '', riskScore: '',
  chargebackRate: '', fraudCount: '', country: '', city: '',
  isFlagged: false, website: '', mcc: '', processingVolume: '',
  averageTicket: '', yearsInBusiness: '', notes: ''
};

export default function MerchantProfiles() {
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
      const res = await api.get('/merchant-profiles');
      setItems(Array.isArray(res.data) ? res.data : res.data?.data || []);
    } catch (err) { toast.error('Failed to load merchant profiles'); }
    finally { setLoading(false); }
  };

  const openDetail = (item) => { setSelected(item); setAiResult(null); setShowDetail(true); };
  const openNew = () => { setEditItem(null); setForm({ ...emptyForm }); setShowForm(true); };

  const openEdit = (e, item) => {
    e.stopPropagation();
    setEditItem(item);
    setForm({
      merchantName: item.merchantName || '',
      merchantCategory: item.merchantCategory || '',
      riskScore: item.riskScore ?? '',
      chargebackRate: item.chargebackRate ?? '',
      fraudCount: item.fraudCount ?? '',
      country: item.country || '',
      city: item.city || '',
      isFlagged: item.isFlagged || false,
      website: item.website || '',
      mcc: item.mcc || '',
      processingVolume: item.processingVolume ?? '',
      averageTicket: item.averageTicket ?? '',
      yearsInBusiness: item.yearsInBusiness ?? '',
      notes: item.notes || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (e, item) => {
    e.stopPropagation();
    if (!window.confirm(`Delete merchant "${item.merchantName}"?`)) return;
    try {
      await api.delete(`/merchant-profiles/${item._id || item.id}`);
      toast.success('Merchant deleted');
      loadItems();
    } catch (err) { toast.error('Failed to delete'); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      riskScore: parseFloat(form.riskScore) || 0,
      chargebackRate: parseFloat(form.chargebackRate) || 0,
      fraudCount: parseInt(form.fraudCount) || 0,
      processingVolume: parseFloat(form.processingVolume) || 0,
      averageTicket: parseFloat(form.averageTicket) || 0,
      yearsInBusiness: parseFloat(form.yearsInBusiness) || 0,
    };
    try {
      if (editItem) {
        await api.put(`/merchant-profiles/${editItem._id || editItem.id}`, payload);
        toast.success('Merchant updated');
      } else {
        await api.post('/merchant-profiles', payload);
        toast.success('Merchant created');
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
      const res = await api.post(`/merchant-profiles/${selected._id || selected.id}/analyze`);
      setAiResult(res.data);
    } catch (err) { toast.error('AI screening failed'); }
    finally { setAiLoading(false); }
  };

  const setField = (k, v) => setForm(p => ({ ...p, [k]: v }));

  if (loading) return <div className="loading-container"><div className="spinner"></div> Loading...</div>;

  return (
    <div>
      <div className="page-header">
        <div><h2>Merchant Profiles</h2><p>Manage merchant risk profiles and screening</p></div>
        <button className="btn btn-primary" onClick={openNew}><FiPlus /> New Merchant</button>
      </div>

      <div className="table-container">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr><th>Merchant</th><th>Category</th><th>Risk Score</th><th>Chargeback Rate</th><th>Fraud Count</th><th>Country</th><th>Flagged</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '40px' }}>No merchant profiles found</td></tr>
              ) : items.map(m => (
                <tr key={m._id || m.id} onClick={() => openDetail(m)}>
                  <td>{m.merchantName || '-'}</td>
                  <td>{m.merchantCategory || '-'}</td>
                  <td><span className={`risk-score ${getRiskClass(m.riskScore)}`}>{m.riskScore ?? '-'}</span></td>
                  <td>{m.chargebackRate != null ? `${m.chargebackRate}%` : '-'}</td>
                  <td>{m.fraudCount ?? '-'}</td>
                  <td>{m.country || '-'}</td>
                  <td><span className={`badge badge-${m.isFlagged ? 'red' : 'green'}`}>{m.isFlagged ? 'Flagged' : 'Clear'}</span></td>
                  <td className="table-actions" onClick={e => e.stopPropagation()}>
                    <button className="btn btn-secondary btn-sm" onClick={e => openEdit(e, m)}><FiEdit2 /></button>
                    <button className="btn btn-danger btn-sm" onClick={e => handleDelete(e, m)}><FiTrash2 /></button>
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
              <h3>Merchant Profile Details</h3>
              <button className="modal-close" onClick={() => setShowDetail(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-item"><span className="detail-label">Merchant Name</span><span className="detail-value">{selected.merchantName || '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Category</span><span className="detail-value">{selected.merchantCategory || '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Risk Score</span><span className="detail-value"><span className={`risk-score ${getRiskClass(selected.riskScore)}`}>{selected.riskScore ?? '-'}</span></span></div>
                <div className="detail-item"><span className="detail-label">Chargeback Rate</span><span className="detail-value">{selected.chargebackRate != null ? `${selected.chargebackRate}%` : '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Fraud Count</span><span className="detail-value">{selected.fraudCount ?? '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Flagged</span><span className="detail-value"><span className={`badge badge-${selected.isFlagged ? 'red' : 'green'}`}>{selected.isFlagged ? 'Flagged' : 'Clear'}</span></span></div>
                <div className="detail-item"><span className="detail-label">Country</span><span className="detail-value">{selected.country || '-'}</span></div>
                <div className="detail-item"><span className="detail-label">City</span><span className="detail-value">{selected.city || '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Website</span><span className="detail-value">{selected.website || '-'}</span></div>
                <div className="detail-item"><span className="detail-label">MCC</span><span className="detail-value">{selected.mcc || '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Processing Volume</span><span className="detail-value">${(selected.processingVolume || 0).toLocaleString()}</span></div>
                <div className="detail-item"><span className="detail-label">Average Ticket</span><span className="detail-value">${(selected.averageTicket || 0).toLocaleString()}</span></div>
                <div className="detail-item"><span className="detail-label">Years in Business</span><span className="detail-value">{selected.yearsInBusiness ?? '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Created</span><span className="detail-value">{selected.createdAt ? new Date(selected.createdAt).toLocaleString() : '-'}</span></div>
                <div className="detail-item full-width"><span className="detail-label">Notes</span><span className="detail-value">{selected.notes || '-'}</span></div>
              </div>
              <div style={{ marginTop: '20px' }}>
                <button className="btn btn-ai" onClick={runAiAnalysis} disabled={aiLoading}><FiCpu /> {aiLoading ? 'Screening...' : 'AI Merchant Screening'}</button>
              </div>
              {aiLoading && <div className="ai-loading"><div className="spinner"></div>Running AI merchant screening...</div>}
              {aiResult && <AIResultsDisplay data={aiResult} title="AI Merchant Screening Results" />}
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editItem ? 'Edit Merchant' : 'New Merchant Profile'}</h3>
              <button className="modal-close" onClick={() => setShowForm(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group"><label>Merchant Name</label><input type="text" value={form.merchantName} onChange={e => setField('merchantName', e.target.value)} required /></div>
                  <div className="form-group"><label>Category</label><input type="text" value={form.merchantCategory} onChange={e => setField('merchantCategory', e.target.value)} /></div>
                  <div className="form-group"><label>Risk Score (0-100)</label><input type="number" min="0" max="100" value={form.riskScore} onChange={e => setField('riskScore', e.target.value)} /></div>
                  <div className="form-group"><label>Chargeback Rate (%)</label><input type="number" step="0.01" value={form.chargebackRate} onChange={e => setField('chargebackRate', e.target.value)} /></div>
                  <div className="form-group"><label>Fraud Count</label><input type="number" value={form.fraudCount} onChange={e => setField('fraudCount', e.target.value)} /></div>
                  <div className="form-group"><label>Country</label><input type="text" value={form.country} onChange={e => setField('country', e.target.value)} /></div>
                  <div className="form-group"><label>City</label><input type="text" value={form.city} onChange={e => setField('city', e.target.value)} /></div>
                  <div className="form-group"><label>Flagged</label>
                    <select value={form.isFlagged ? 'true' : 'false'} onChange={e => setField('isFlagged', e.target.value === 'true')}>
                      <option value="false">No</option><option value="true">Yes</option>
                    </select>
                  </div>
                  <div className="form-group"><label>Website</label><input type="text" value={form.website} onChange={e => setField('website', e.target.value)} /></div>
                  <div className="form-group"><label>MCC Code</label><input type="text" value={form.mcc} onChange={e => setField('mcc', e.target.value)} /></div>
                  <div className="form-group"><label>Processing Volume</label><input type="number" value={form.processingVolume} onChange={e => setField('processingVolume', e.target.value)} /></div>
                  <div className="form-group"><label>Average Ticket</label><input type="number" value={form.averageTicket} onChange={e => setField('averageTicket', e.target.value)} /></div>
                  <div className="form-group"><label>Years in Business</label><input type="number" value={form.yearsInBusiness} onChange={e => setField('yearsInBusiness', e.target.value)} /></div>
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
