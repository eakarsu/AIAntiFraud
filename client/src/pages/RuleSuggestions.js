import React, { useState, useEffect, useCallback } from 'react';
import { FiCpu, FiCheck, FiX, FiRefreshCw } from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../api';
import Pagination from '../components/Pagination';

const LIMIT = 20;

function StatusBadge({ status }) {
  const cls = status === 'accepted' ? 'badge-approved' : status === 'rejected' ? 'badge-blocked' : 'badge-pending';
  return <span className={`badge ${cls}`}>{status}</span>;
}

export default function RuleSuggestions() {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [filterStatus, setFilterStatus] = useState('pending');
  const [selected, setSelected] = useState(null);

  const loadItems = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = { page, limit: LIMIT };
      if (filterStatus) params.status = filterStatus;
      const res = await api.get('/rule-suggestions', { params });
      const data = res.data;
      setItems(data.data || []);
      if (data.pagination) setPagination({ page: data.pagination.page, totalPages: data.pagination.totalPages, total: data.pagination.total });
    } catch (err) {
      toast.error('Failed to load rule suggestions');
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => { loadItems(1); }, [loadItems]);

  const generateSuggestions = async () => {
    setGenerating(true);
    try {
      const res = await api.post('/ai/suggest-rules');
      toast.success(`Generated ${res.data.savedCount || 0} new rule suggestions`);
      loadItems(1);
    } catch (err) {
      toast.error('Failed to generate suggestions');
    } finally {
      setGenerating(false);
    }
  };

  const acceptSuggestion = async (id) => {
    try {
      const res = await api.post(`/rule-suggestions/${id}/accept`);
      toast.success('Rule promoted to active fraud rules');
      loadItems(pagination.page);
      if (selected?.id === id) setSelected(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Accept failed');
    }
  };

  const rejectSuggestion = async (id) => {
    if (!window.confirm('Reject this rule suggestion?')) return;
    try {
      await api.post(`/rule-suggestions/${id}/reject`);
      toast.success('Rule suggestion rejected');
      loadItems(pagination.page);
      if (selected?.id === id) setSelected(null);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reject failed');
    }
  };

  const getRuleData = (item) => {
    try {
      return typeof item.ruleData === 'object' ? item.ruleData : JSON.parse(item.ruleData || '{}');
    } catch { return {}; }
  };

  if (loading) return <div className="loading-container"><div className="spinner"></div> Loading...</div>;

  return (
    <div>
      <div className="page-header">
        <div><h2>AI Rule Suggestions</h2><p>Review and promote AI-generated fraud detection rules</p></div>
        <button className="btn btn-ai" onClick={generateSuggestions} disabled={generating}>
          <FiCpu /> {generating ? 'Generating...' : 'Generate New Suggestions'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
        {['', 'pending', 'accepted', 'rejected'].map(s => (
          <button
            key={s}
            className={`btn btn-sm ${filterStatus === s ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => { setFilterStatus(s); }}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      <div className="table-container">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Rule Name</th><th>Type</th><th>Action</th><th>Severity</th>
                <th>Status</th><th>Suggested By</th><th>Created</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '40px' }}>
                  No suggestions found. Click "Generate New Suggestions" to ask AI to analyze patterns.
                </td></tr>
              ) : items.map(s => {
                const rd = getRuleData(s);
                return (
                  <tr key={s.id} onClick={() => setSelected(selected?.id === s.id ? null : s)} style={{ cursor: 'pointer' }}>
                    <td>{rd.name || '-'}</td>
                    <td>{rd.ruleType || rd.rule_type || '-'}</td>
                    <td><span className={`badge badge-${rd.action || 'flag'}`}>{rd.action || '-'}</span></td>
                    <td><span className={`badge badge-${(rd.severity || 'medium').toLowerCase()}`}>{rd.severity || '-'}</span></td>
                    <td><StatusBadge status={s.status} /></td>
                    <td style={{ fontSize: '11px', color: '#94a3b8' }}>{(s.suggestedByAi || '').split('/').pop()}</td>
                    <td>{s.createdAt ? new Date(s.createdAt).toLocaleDateString() : '-'}</td>
                    <td className="table-actions" onClick={e => e.stopPropagation()}>
                      {s.status === 'pending' && (
                        <>
                          <button className="btn btn-primary btn-sm" onClick={() => acceptSuggestion(s.id)} title="Accept & Promote">
                            <FiCheck /> Accept
                          </button>
                          <button className="btn btn-danger btn-sm" onClick={() => rejectSuggestion(s.id)} title="Reject">
                            <FiX /> Reject
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
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

      {selected && (() => {
        const rd = getRuleData(selected);
        return (
          <div style={{ marginTop: '24px', background: '#1a2332', borderRadius: '12px', padding: '24px', border: '1px solid #2d3a4d' }}>
            <h3 style={{ color: '#f1f5f9', marginBottom: '16px', fontSize: '16px' }}>
              Rule Detail: {rd.name}
            </h3>
            <div className="detail-grid">
              <div className="detail-item"><span className="detail-label">Rule Type</span><span className="detail-value">{rd.ruleType || rd.rule_type || '-'}</span></div>
              <div className="detail-item"><span className="detail-label">Action</span><span className="detail-value">{rd.action || '-'}</span></div>
              <div className="detail-item"><span className="detail-label">Severity</span><span className="detail-value">{rd.severity || '-'}</span></div>
              <div className="detail-item"><span className="detail-label">Expected Precision</span><span className="detail-value">{rd.expectedPrecision || rd.expected_precision || '-'}</span></div>
              <div className="detail-item full-width"><span className="detail-label">Description</span><span className="detail-value">{rd.description || '-'}</span></div>
              <div className="detail-item full-width"><span className="detail-label">Rationale</span><span className="detail-value">{rd.rationale || '-'}</span></div>
              <div className="detail-item full-width">
                <span className="detail-label">Condition JSON</span>
                <pre style={{ background: '#0d1626', padding: '12px', borderRadius: '6px', fontSize: '12px', color: '#60a5fa', overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
                  {JSON.stringify(rd.conditionJson || rd.condition_json || {}, null, 2)}
                </pre>
              </div>
            </div>
            {selected.status === 'pending' && (
              <div style={{ marginTop: '16px', display: 'flex', gap: '12px' }}>
                <button className="btn btn-primary" onClick={() => acceptSuggestion(selected.id)}>
                  <FiCheck /> Accept & Promote to Fraud Rules
                </button>
                <button className="btn btn-danger" onClick={() => rejectSuggestion(selected.id)}>
                  <FiX /> Reject
                </button>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
