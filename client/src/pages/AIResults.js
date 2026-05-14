import React, { useState, useEffect, useCallback } from 'react';
import { FiCpu, FiEye } from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../api';
import Pagination from '../components/Pagination';
import AIResultsDisplay from '../components/AIResultsDisplay';

const LIMIT = 20;

const ENDPOINTS = [
  '', 'analyze-transaction', 'credit-assessment', 'behavioral-analysis',
  'risk-report', 'merchant-screening', 'suggest-rules', 'score-transaction',
  'network-analysis', 'customer-360',
  'transactions-analyze', 'credit-scores-analyze', 'behavioral-analyze',
  'merchant-analyze', 'chargeback-predict', 'analytics-patterns',
];

export default function AIResults() {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [selectedResult, setSelectedResult] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [filterEndpoint, setFilterEndpoint] = useState('');
  const [filterEntityType, setFilterEntityType] = useState('');

  const loadItems = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = { page, limit: LIMIT };
      if (filterEndpoint) params.endpoint = filterEndpoint;
      if (filterEntityType) params.entity_type = filterEntityType;
      const res = await api.get('/ai/results', { params });
      const data = res.data;
      setItems(data.data || []);
      if (data.pagination) {
        setPagination({ page: data.pagination.page, totalPages: data.pagination.totalPages, total: data.pagination.total });
      }
    } catch (err) {
      toast.error('Failed to load AI results');
    } finally {
      setLoading(false);
    }
  }, [filterEndpoint, filterEntityType]);

  useEffect(() => { loadItems(1); }, [loadItems]);

  const openDetail = async (item) => {
    setDetailLoading(true);
    try {
      const res = await api.get(`/ai/results/${item.id}`);
      setSelectedResult(res.data.aiResult || res.data);
    } catch (err) {
      toast.error('Failed to load result detail');
    } finally {
      setDetailLoading(false);
    }
  };

  if (loading) return <div className="loading-container"><div className="spinner"></div> Loading...</div>;

  return (
    <div>
      <div className="page-header">
        <div><h2>AI Results History</h2><p>Browse all persisted AI analyses and decisions</p></div>
      </div>

      <div className="filter-bar" style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <select
          value={filterEndpoint}
          onChange={e => { setFilterEndpoint(e.target.value); }}
          style={{ padding: '8px 12px', background: '#1a2332', border: '1px solid #2d3a4d', borderRadius: '6px', color: '#f1f5f9' }}
        >
          {ENDPOINTS.map(ep => <option key={ep} value={ep}>{ep || 'All Endpoints'}</option>)}
        </select>
        <select
          value={filterEntityType}
          onChange={e => { setFilterEntityType(e.target.value); }}
          style={{ padding: '8px 12px', background: '#1a2332', border: '1px solid #2d3a4d', borderRadius: '6px', color: '#f1f5f9' }}
        >
          <option value="">All Entity Types</option>
          <option value="transaction">Transaction</option>
          <option value="credit_score">Credit Score</option>
          <option value="behavioral_pattern">Behavioral Pattern</option>
          <option value="merchant">Merchant</option>
          <option value="customer">Customer</option>
          <option value="platform">Platform</option>
          <option value="chargeback">Chargeback</option>
        </select>
      </div>

      <div className="table-container">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>ID</th><th>Endpoint</th><th>Entity Type</th><th>Entity ID</th>
                <th>Model</th><th>Created</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan="7" style={{ textAlign: 'center', padding: '40px' }}>No AI results found</td></tr>
              ) : items.map(r => (
                <tr key={r.id}>
                  <td>#{r.id}</td>
                  <td><span style={{ fontFamily: 'monospace', fontSize: '12px', color: '#60a5fa' }}>{r.endpoint}</span></td>
                  <td>{r.entityType || '-'}</td>
                  <td>{r.entityId ? `#${r.entityId}` : '-'}</td>
                  <td style={{ fontSize: '11px', color: '#94a3b8' }}>{(r.modelUsed || '').split('/').pop()}</td>
                  <td>{r.createdAt ? new Date(r.createdAt).toLocaleString() : '-'}</td>
                  <td className="table-actions">
                    <button className="btn btn-secondary btn-sm" onClick={() => openDetail(r)}>
                      <FiEye /> View
                    </button>
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

      {detailLoading && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '300px', textAlign: 'center' }}>
            <div className="spinner"></div>
            <p>Loading result...</p>
          </div>
        </div>
      )}

      {selectedResult && !detailLoading && (
        <div className="modal-overlay" onClick={() => setSelectedResult(null)}>
          <div className="modal" style={{ maxWidth: '800px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3><FiCpu style={{ marginRight: '8px' }} />AI Result #{selectedResult.id}</h3>
              <button className="modal-close" onClick={() => setSelectedResult(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="detail-grid" style={{ marginBottom: '16px' }}>
                <div className="detail-item"><span className="detail-label">Endpoint</span><span className="detail-value" style={{ fontFamily: 'monospace', color: '#60a5fa' }}>{selectedResult.endpoint}</span></div>
                <div className="detail-item"><span className="detail-label">Entity</span><span className="detail-value">{selectedResult.entityType}{selectedResult.entityId ? ` #${selectedResult.entityId}` : ''}</span></div>
                <div className="detail-item"><span className="detail-label">Model</span><span className="detail-value" style={{ fontSize: '12px' }}>{selectedResult.modelUsed}</span></div>
                <div className="detail-item"><span className="detail-label">Created</span><span className="detail-value">{selectedResult.createdAt ? new Date(selectedResult.createdAt).toLocaleString() : '-'}</span></div>
              </div>
              {selectedResult.result && (
                <AIResultsDisplay
                  data={typeof selectedResult.result === 'string' ? JSON.parse(selectedResult.result) : selectedResult.result}
                  title="Stored AI Analysis"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
