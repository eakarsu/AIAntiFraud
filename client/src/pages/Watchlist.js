import React, { useState, useEffect, useCallback } from 'react';
import { FiPlus, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../api';
import Pagination from '../components/Pagination';

const LIMIT = 20;

const emptyForm = {
  entityName: '', entityType: 'individual', identifier: '',
  riskLevel: 'medium', source: '', reason: '', isActive: true,
  country: '', notes: '', expiresAt: ''
};

export default function Watchlist() {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });

  const loadItems = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await api.get('/watchlist', { params: { page, limit: LIMIT } });
      const data = res.data;
      setItems(data.data || []);
      if (data.pagination) setPagination({ page: data.pagination.page, totalPages: data.pagination.totalPages, total: data.pagination.total });
    } catch (err) { toast.error('Failed to load watchlist'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadItems(1); }, [loadItems]);

  const openDetail = (item) => { setSelected(item); setShowDetail(true); };
  const openNew = () => { setEditItem(null); setForm({ ...emptyForm }); setShowForm(true); };

  const openEdit = (e, item) => {
    e.stopPropagation();
    setEditItem(item);
    setForm({
      entityName: item.entityName || '',
      entityType: item.entityType || 'individual',
      identifier: item.identifier || '',
      riskLevel: item.riskLevel || 'medium',
      source: item.source || '',
      reason: item.reason || '',
      isActive: item.isActive !== false,
      country: item.country || '',
      notes: item.notes || '',
      expiresAt: item.expiresAt ? item.expiresAt.slice(0, 10) : '',
    });
    setShowForm(true);
  };

  const handleDelete = async (e, item) => {
    e.stopPropagation();
    if (!window.confirm(`Remove "${item.entityName}" from watchlist?`)) return;
    try {
      await api.delete(`/watchlist/${item.id}`);
      toast.success('Entry removed');
      loadItems(pagination.page);
    } catch (err) { toast.error('Failed to delete'); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editItem) {
        await api.put(`/watchlist/${editItem.id}`, form);
        toast.success('Entry updated');
      } else {
        await api.post('/watchlist', form);
        toast.success('Entry added');
      }
      setShowForm(false);
      loadItems(pagination.page);
    } catch (err) { toast.error(err.response?.data?.message || 'Save failed'); }
  };

  const setField = (k, v) => setForm(p => ({ ...p, [k]: v }));

  if (loading) return <div className="loading-container"><div className="spinner"></div> Loading...</div>;

  return (
    <div>
      <div className="page-header">
        <div><h2>Watchlist</h2><p>Monitor high-risk entities</p></div>
        <button className="btn btn-primary" onClick={openNew}><FiPlus /> Add Entry</button>
      </div>

      <div className="table-container">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr><th>Entity Name</th><th>Type</th><th>Identifier</th><th>Risk Level</th><th>Source</th><th>Active</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '40px' }}>No watchlist entries</td></tr>
              ) : items.map(w => (
                <tr key={w.id} onClick={() => openDetail(w)}>
                  <td>{w.entityName || '-'}</td>
                  <td><span className={`badge badge-${w.entityType === 'organization' ? 'purple' : 'blue'}`}>{w.entityType || '-'}</span></td>
                  <td>{w.identifier || '-'}</td>
                  <td><span className={`badge badge-${(w.riskLevel || '').toLowerCase()}`}>{w.riskLevel || '-'}</span></td>
                  <td>{w.source || '-'}</td>
                  <td><span className={`badge badge-${w.isActive !== false ? 'green' : 'gray'}`}>{w.isActive !== false ? 'Active' : 'Inactive'}</span></td>
                  <td className="table-actions" onClick={e => e.stopPropagation()}>
                    <button className="btn btn-secondary btn-sm" onClick={e => openEdit(e, w)}><FiEdit2 /></button>
                    <button className="btn btn-danger btn-sm" onClick={e => handleDelete(e, w)}><FiTrash2 /></button>
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
              <h3>Watchlist Entry Details</h3>
              <button className="modal-close" onClick={() => setShowDetail(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-item"><span className="detail-label">Entity Name</span><span className="detail-value">{selected.entityName}</span></div>
                <div className="detail-item"><span className="detail-label">Entity Type</span><span className="detail-value"><span className={`badge badge-${selected.entityType === 'organization' ? 'purple' : 'blue'}`}>{selected.entityType}</span></span></div>
                <div className="detail-item"><span className="detail-label">Identifier</span><span className="detail-value">{selected.identifier || '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Risk Level</span><span className="detail-value"><span className={`badge badge-${(selected.riskLevel || '').toLowerCase()}`}>{selected.riskLevel}</span></span></div>
                <div className="detail-item"><span className="detail-label">Source</span><span className="detail-value">{selected.source || '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Active</span><span className="detail-value">{selected.isActive !== false ? 'Yes' : 'No'}</span></div>
                <div className="detail-item"><span className="detail-label">Country</span><span className="detail-value">{selected.country || '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Expires At</span><span className="detail-value">{selected.expiresAt ? new Date(selected.expiresAt).toLocaleDateString() : '-'}</span></div>
                <div className="detail-item full-width"><span className="detail-label">Reason</span><span className="detail-value">{selected.reason || '-'}</span></div>
                <div className="detail-item full-width"><span className="detail-label">Notes</span><span className="detail-value">{selected.notes || '-'}</span></div>
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
              <h3>{editItem ? 'Edit Entry' : 'New Watchlist Entry'}</h3>
              <button className="modal-close" onClick={() => setShowForm(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group"><label>Entity Name</label><input type="text" value={form.entityName} onChange={e => setField('entityName', e.target.value)} required /></div>
                  <div className="form-group"><label>Entity Type</label>
                    <select value={form.entityType} onChange={e => setField('entityType', e.target.value)}>
                      <option value="individual">Individual</option><option value="organization">Organization</option><option value="account">Account</option><option value="ip_address">IP Address</option><option value="device">Device</option>
                    </select>
                  </div>
                  <div className="form-group"><label>Identifier</label><input type="text" value={form.identifier} onChange={e => setField('identifier', e.target.value)} required /></div>
                  <div className="form-group"><label>Risk Level</label>
                    <select value={form.riskLevel} onChange={e => setField('riskLevel', e.target.value)}>
                      <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
                    </select>
                  </div>
                  <div className="form-group"><label>Source</label><input type="text" value={form.source} onChange={e => setField('source', e.target.value)} /></div>
                  <div className="form-group"><label>Country</label><input type="text" value={form.country} onChange={e => setField('country', e.target.value)} /></div>
                  <div className="form-group"><label>Active</label>
                    <select value={form.isActive ? 'true' : 'false'} onChange={e => setField('isActive', e.target.value === 'true')}>
                      <option value="true">Active</option><option value="false">Inactive</option>
                    </select>
                  </div>
                  <div className="form-group"><label>Expires At</label><input type="date" value={form.expiresAt} onChange={e => setField('expiresAt', e.target.value)} /></div>
                  <div className="form-group full-width"><label>Reason</label><textarea value={form.reason} onChange={e => setField('reason', e.target.value)} /></div>
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
