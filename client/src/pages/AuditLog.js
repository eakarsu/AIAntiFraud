import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import api from '../api';

export default function AuditLog() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => { loadItems(); }, []);

  const loadItems = async () => {
    try {
      const res = await api.get('/audit-log');
      setItems(Array.isArray(res.data) ? res.data : res.data?.data || []);
    } catch (err) { toast.error('Failed to load audit log'); }
    finally { setLoading(false); }
  };

  const openDetail = (item) => { setSelected(item); setShowDetail(true); };

  const formatDetails = (data) => {
    if (!data) return '-';
    if (typeof data === 'string') {
      try { data = JSON.parse(data); } catch { return data; }
    }
    if (typeof data !== 'object') return String(data);
    return Object.entries(data).map(([key, value]) => ({
      key,
      value: typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)
    }));
  };

  if (loading) return <div className="loading-container"><div className="spinner"></div> Loading...</div>;

  return (
    <div>
      <div className="page-header">
        <div><h2>Audit Log</h2><p>System activity and change history (read-only)</p></div>
      </div>

      <div className="table-container">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr><th>Action</th><th>Entity Type</th><th>Entity ID</th><th>User</th><th>IP Address</th><th>Date</th></tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '40px' }}>No audit log entries</td></tr>
              ) : items.map(l => (
                <tr key={l._id || l.id} onClick={() => openDetail(l)}>
                  <td><span className={`badge badge-${l.action === 'delete' ? 'red' : l.action === 'create' ? 'green' : l.action === 'update' ? 'blue' : 'gray'}`}>{l.action || '-'}</span></td>
                  <td>{l.entityType || l.entity || '-'}</td>
                  <td>{(l.entityId || l.targetId || '-').toString().slice(-8)}</td>
                  <td>{l.userId || l.user || l.performedBy || '-'}</td>
                  <td>{l.ipAddress || l.ip || '-'}</td>
                  <td>{l.createdAt ? new Date(l.createdAt).toLocaleString() : (l.timestamp ? new Date(l.timestamp).toLocaleString() : '-')}</td>
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
              <h3>Audit Log Entry</h3>
              <button className="modal-close" onClick={() => setShowDetail(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-item"><span className="detail-label">ID</span><span className="detail-value">{selected._id || selected.id}</span></div>
                <div className="detail-item"><span className="detail-label">Action</span><span className="detail-value"><span className={`badge badge-${selected.action === 'delete' ? 'red' : selected.action === 'create' ? 'green' : 'blue'}`}>{selected.action}</span></span></div>
                <div className="detail-item"><span className="detail-label">Entity Type</span><span className="detail-value">{selected.entityType || selected.entity || '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Entity ID</span><span className="detail-value">{selected.entityId || selected.targetId || '-'}</span></div>
                <div className="detail-item"><span className="detail-label">User</span><span className="detail-value">{selected.userId || selected.user || selected.performedBy || '-'}</span></div>
                <div className="detail-item"><span className="detail-label">IP Address</span><span className="detail-value">{selected.ipAddress || selected.ip || '-'}</span></div>
                <div className="detail-item"><span className="detail-label">User Agent</span><span className="detail-value">{selected.userAgent || '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Date</span><span className="detail-value">{selected.createdAt ? new Date(selected.createdAt).toLocaleString() : (selected.timestamp ? new Date(selected.timestamp).toLocaleString() : '-')}</span></div>
              </div>
              {(selected.details || selected.changes || selected.metadata || selected.previousData || selected.newData) && (
                <div style={{ marginTop: '20px' }}>
                  <span className="detail-label" style={{ display: 'block', marginBottom: '10px' }}>Details</span>
                  <div style={{ background: '#0a0e1a', border: '1px solid #2d3a4d', borderRadius: '8px', padding: '16px', overflow: 'auto' }}>
                    {(() => {
                      const raw = selected.details || selected.changes || selected.metadata || { previousData: selected.previousData, newData: selected.newData };
                      const formatted = formatDetails(raw);
                      if (typeof formatted === 'string') {
                        return <pre style={{ color: '#94a3b8', fontSize: '13px', whiteSpace: 'pre-wrap', margin: 0 }}>{formatted}</pre>;
                      }
                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {formatted.map((entry, i) => (
                            <div key={i}>
                              <span style={{ color: '#3b82f6', fontSize: '12px', fontWeight: 600, textTransform: 'uppercase' }}>{entry.key}</span>
                              <pre style={{ color: '#f1f5f9', fontSize: '13px', margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>{entry.value}</pre>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
