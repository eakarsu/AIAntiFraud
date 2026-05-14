import React, { useState, useEffect, useCallback } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiMessageSquare } from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../api';
import Pagination from '../components/Pagination';

const LIMIT = 20;
const STATUSES = ['open', 'investigating', 'submitted', 'resolved', 'closed'];
const PRIORITIES = ['low', 'medium', 'high', 'critical'];

const emptyForm = { title: '', description: '', priority: 'medium', status: 'open', assignedTo: '' };

function statusColor(s) {
  return s === 'open' ? 'blue' : s === 'investigating' ? 'amber' : s === 'resolved' ? 'green' : s === 'closed' ? 'gray' : 'purple';
}
function priorityColor(p) {
  return p === 'critical' ? 'red' : p === 'high' ? 'amber' : p === 'medium' ? 'blue' : 'gray';
}

export default function Cases() {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  const loadItems = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = { page, limit: LIMIT };
      if (filterStatus) params.status = filterStatus;
      if (filterPriority) params.priority = filterPriority;
      const res = await api.get('/cases', { params });
      const data = res.data;
      setItems(data.data || []);
      if (data.pagination) setPagination({ page: data.pagination.page, totalPages: data.pagination.totalPages, total: data.pagination.total });
    } catch (err) { toast.error('Failed to load cases'); }
    finally { setLoading(false); }
  }, [filterStatus, filterPriority]);

  useEffect(() => { loadItems(1); }, [loadItems]);

  const openDetail = async (item) => {
    try {
      const res = await api.get(`/cases/${item.id}`);
      setSelected(res.data.case || res.data);
      setShowDetail(true);
    } catch { setSelected(item); setShowDetail(true); }
  };

  const openNew = () => { setEditItem(null); setForm({ ...emptyForm }); setShowForm(true); };

  const openEdit = (e, item) => {
    e.stopPropagation();
    setEditItem(item);
    setForm({
      title: item.title || '',
      description: item.description || '',
      priority: item.priority || 'medium',
      status: item.status || 'open',
      assignedTo: item.assignedTo ?? '',
    });
    setShowForm(true);
  };

  const handleDelete = async (e, item) => {
    e.stopPropagation();
    if (!window.confirm(`Delete case "${item.title}"?`)) return;
    try {
      await api.delete(`/cases/${item.id}`);
      toast.success('Case deleted');
      loadItems(pagination.page);
    } catch (err) { toast.error('Failed to delete'); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      title: form.title,
      description: form.description,
      priority: form.priority,
      status: form.status,
      assigned_to: form.assignedTo ? parseInt(form.assignedTo) : null,
    };
    try {
      if (editItem) {
        await api.put(`/cases/${editItem.id}`, payload);
        toast.success('Case updated');
      } else {
        await api.post('/cases', payload);
        toast.success('Case created');
      }
      setShowForm(false);
      loadItems(pagination.page);
    } catch (err) { toast.error(err.response?.data?.error || 'Save failed'); }
  };

  const handleAddNote = async () => {
    if (!newNote.trim() || !selected) return;
    setAddingNote(true);
    try {
      await api.post(`/cases/${selected.id}/notes`, { content: newNote });
      toast.success('Note added');
      setNewNote('');
      openDetail(selected);
    } catch (err) { toast.error('Failed to add note'); }
    finally { setAddingNote(false); }
  };

  const setField = (k, v) => setForm(p => ({ ...p, [k]: v }));

  if (loading) return <div className="loading-container"><div className="spinner"></div> Loading...</div>;

  return (
    <div>
      <div className="page-header">
        <div><h2>Cases</h2><p>Fraud investigation cases and case management</p></div>
        <button className="btn btn-primary" onClick={openNew}><FiPlus /> New Case</button>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          style={{ padding: '8px 12px', background: '#1a2332', border: '1px solid #2d3a4d', borderRadius: '6px', color: '#f1f5f9' }}>
          <option value="">All Statuses</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
          style={{ padding: '8px 12px', background: '#1a2332', border: '1px solid #2d3a4d', borderRadius: '6px', color: '#f1f5f9' }}>
          <option value="">All Priorities</option>
          {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      <div className="table-container">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr><th>Title</th><th>Status</th><th>Priority</th><th>Assigned To</th><th>Created</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '40px' }}>No cases found</td></tr>
              ) : items.map(c => (
                <tr key={c.id} onClick={() => openDetail(c)} style={{ cursor: 'pointer' }}>
                  <td>{c.title || '-'}</td>
                  <td><span className={`badge badge-${statusColor(c.status)}`}>{c.status || '-'}</span></td>
                  <td><span className={`badge badge-${priorityColor(c.priority)}`}>{c.priority || '-'}</span></td>
                  <td>{c.assignedToName || c.assigned_to_name || '-'}</td>
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
          <div className="modal" style={{ maxWidth: '700px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Case Details</h3>
              <button className="modal-close" onClick={() => setShowDetail(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-item"><span className="detail-label">ID</span><span className="detail-value">#{selected.id}</span></div>
                <div className="detail-item"><span className="detail-label">Status</span><span className="detail-value"><span className={`badge badge-${statusColor(selected.status)}`}>{selected.status}</span></span></div>
                <div className="detail-item"><span className="detail-label">Priority</span><span className="detail-value"><span className={`badge badge-${priorityColor(selected.priority)}`}>{selected.priority}</span></span></div>
                <div className="detail-item"><span className="detail-label">Assigned To</span><span className="detail-value">{selected.assignedToName || selected.assigned_to_name || '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Created By</span><span className="detail-value">{selected.createdByName || selected.created_by_name || '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Created</span><span className="detail-value">{selected.createdAt ? new Date(selected.createdAt).toLocaleString() : '-'}</span></div>
                <div className="detail-item full-width"><span className="detail-label">Title</span><span className="detail-value">{selected.title || '-'}</span></div>
                <div className="detail-item full-width"><span className="detail-label">Description</span><span className="detail-value">{selected.description || '-'}</span></div>
              </div>

              {selected.notes && selected.notes.length > 0 && (
                <div style={{ marginTop: '20px' }}>
                  <span className="detail-label" style={{ display: 'block', marginBottom: '10px' }}>Case Notes</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {selected.notes.map((note, i) => (
                      <div key={i} style={{ background: '#0d1626', border: '1px solid #2d3a4d', borderRadius: '6px', padding: '10px 14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontSize: '11px', color: '#60a5fa', textTransform: 'uppercase', fontWeight: 600 }}>{note.noteType || note.note_type || 'note'}</span>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>{note.createdAt ? new Date(note.createdAt).toLocaleString() : ''}</span>
                        </div>
                        <p style={{ margin: 0, color: '#e2e8f0', fontSize: '13px' }}>{note.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ marginTop: '20px' }}>
                <span className="detail-label" style={{ display: 'block', marginBottom: '8px' }}>Add Note</span>
                <textarea
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  placeholder="Enter case note..."
                  style={{ width: '100%', padding: '8px 12px', background: '#0d1626', border: '1px solid #2d3a4d', borderRadius: '6px', color: '#f1f5f9', fontSize: '13px', minHeight: '80px', resize: 'vertical', boxSizing: 'border-box' }}
                />
                <button className="btn btn-primary" style={{ marginTop: '8px' }} onClick={handleAddNote} disabled={addingNote || !newNote.trim()}>
                  <FiMessageSquare /> {addingNote ? 'Adding...' : 'Add Note'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editItem ? 'Edit Case' : 'New Case'}</h3>
              <button className="modal-close" onClick={() => setShowForm(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group full-width"><label>Title</label><input type="text" value={form.title} onChange={e => setField('title', e.target.value)} required /></div>
                  <div className="form-group"><label>Status</label>
                    <select value={form.status} onChange={e => setField('status', e.target.value)}>
                      {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="form-group"><label>Priority</label>
                    <select value={form.priority} onChange={e => setField('priority', e.target.value)}>
                      {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                  <div className="form-group"><label>Assigned To (User ID)</label><input type="number" value={form.assignedTo} onChange={e => setField('assignedTo', e.target.value)} /></div>
                  <div className="form-group full-width"><label>Description</label><textarea value={form.description} onChange={e => setField('description', e.target.value)} /></div>
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
