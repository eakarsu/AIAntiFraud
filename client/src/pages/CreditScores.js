import React, { useState, useEffect, useCallback } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiCpu } from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../api';
import AIResultsDisplay from '../components/AIResultsDisplay';
import Pagination from '../components/Pagination';

function getScoreColor(score) {
  if (score == null) return '';
  if (score >= 750) return 'risk-low';
  if (score >= 650) return 'risk-medium';
  if (score >= 550) return 'risk-high';
  return 'risk-critical';
}

const LIMIT = 20;

const emptyForm = {
  customerName: '', customerEmail: '', ssnLast4: '',
  creditScore: '', riskLevel: 'medium',
  income: '', debtToIncome: '', paymentHistoryScore: '',
  creditUtilization: '', accountAgeMonths: '',
  numAccounts: '', numLatePayments: '',
  loanAmountRequested: '', loanPurpose: '',
};

export default function CreditScores() {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [aiResult, setAiResult] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  const loadItems = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await api.get('/credit-scores', { params: { page, limit: LIMIT } });
      const data = res.data;
      setItems(data.data || []);
      if (data.pagination) {
        setPagination({
          page: data.pagination.page,
          totalPages: data.pagination.totalPages,
          total: data.pagination.total,
        });
      }
    } catch (err) {
      toast.error('Failed to load credit scores');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadItems(1); }, [loadItems]);

  const openDetail = (item) => { setSelected(item); setAiResult(null); setShowDetail(true); };
  const openNew = () => { setEditItem(null); setForm({ ...emptyForm }); setShowForm(true); };

  const openEdit = (e, item) => {
    e.stopPropagation();
    setEditItem(item);
    setForm({
      customerName: item.customerName || '',
      customerEmail: item.customerEmail || '',
      ssnLast4: item.ssnLast4 || '',
      creditScore: item.creditScore ?? '',
      riskLevel: item.riskLevel || 'medium',
      income: item.income ?? '',
      debtToIncome: item.debtToIncome ?? '',
      paymentHistoryScore: item.paymentHistoryScore ?? '',
      creditUtilization: item.creditUtilization ?? '',
      accountAgeMonths: item.accountAgeMonths ?? '',
      numAccounts: item.numAccounts ?? '',
      numLatePayments: item.numLatePayments ?? '',
      loanAmountRequested: item.loanAmountRequested ?? '',
      loanPurpose: item.loanPurpose || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (e, item) => {
    e.stopPropagation();
    if (!window.confirm('Delete this credit score record?')) return;
    try {
      await api.delete(`/credit-scores/${item.id}`);
      toast.success('Record deleted');
      loadItems(pagination.page);
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      customer_name: form.customerName,
      customer_email: form.customerEmail || undefined,
      ssn_last4: form.ssnLast4 || undefined,
      credit_score: form.creditScore !== '' ? parseInt(form.creditScore) : undefined,
      risk_level: form.riskLevel,
      income: form.income !== '' ? parseFloat(form.income) : undefined,
      debt_to_income: form.debtToIncome !== '' ? parseFloat(form.debtToIncome) : undefined,
      payment_history_score: form.paymentHistoryScore !== '' ? parseFloat(form.paymentHistoryScore) : undefined,
      credit_utilization: form.creditUtilization !== '' ? parseFloat(form.creditUtilization) : undefined,
      account_age_months: form.accountAgeMonths !== '' ? parseInt(form.accountAgeMonths) : undefined,
      num_accounts: form.numAccounts !== '' ? parseInt(form.numAccounts) : undefined,
      num_late_payments: form.numLatePayments !== '' ? parseInt(form.numLatePayments) : undefined,
      loan_amount_requested: form.loanAmountRequested !== '' ? parseFloat(form.loanAmountRequested) : undefined,
      loan_purpose: form.loanPurpose || undefined,
    };
    try {
      if (editItem) {
        await api.put(`/credit-scores/${editItem.id}`, payload);
        toast.success('Record updated');
      } else {
        await api.post('/credit-scores', payload);
        toast.success('Record created');
      }
      setShowForm(false);
      loadItems(pagination.page);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Save failed');
    }
  };

  const runAiAnalysis = async () => {
    if (!selected) return;
    setAiLoading(true);
    setAiResult(null);
    try {
      const res = await api.post(`/credit-scores/${selected.id}/analyze`);
      setAiResult(res.data);
    } catch (err) {
      toast.error('AI analysis failed');
    } finally {
      setAiLoading(false);
    }
  };

  const setField = (k, v) => setForm(p => ({ ...p, [k]: v }));

  if (loading) return <div className="loading-container"><div className="spinner"></div> Loading...</div>;

  return (
    <div>
      <div className="page-header">
        <div><h2>Credit Scores</h2><p>Manage credit scoring and analysis</p></div>
        <button className="btn btn-primary" onClick={openNew}><FiPlus /> New Record</button>
      </div>

      <div className="table-container">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Customer</th><th>Email</th><th>Credit Score</th><th>Risk Level</th>
                <th>Income</th><th>DTI</th><th>Loan Requested</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '40px' }}>No records found</td></tr>
              ) : items.map(c => (
                <tr key={c.id} onClick={() => openDetail(c)}>
                  <td>{c.customerName || '-'}</td>
                  <td>{c.customerEmail || '-'}</td>
                  <td><span className={`risk-score ${getScoreColor(c.creditScore)}`}>{c.creditScore ?? '-'}</span></td>
                  <td><span className={`badge badge-${(c.riskLevel || '').toLowerCase()}`}>{c.riskLevel || '-'}</span></td>
                  <td>${parseFloat(c.income || 0).toLocaleString()}</td>
                  <td>{c.debtToIncome != null ? `${c.debtToIncome}%` : '-'}</td>
                  <td>${parseFloat(c.loanAmountRequested || 0).toLocaleString()}</td>
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
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Credit Score — {selected.customerName}</h3>
              <button className="modal-close" onClick={() => setShowDetail(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-item"><span className="detail-label">Customer Name</span><span className="detail-value">{selected.customerName || '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Email</span><span className="detail-value">{selected.customerEmail || '-'}</span></div>
                <div className="detail-item"><span className="detail-label">SSN Last 4</span><span className="detail-value">{selected.ssnLast4 || '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Credit Score</span><span className="detail-value"><span className={`risk-score ${getScoreColor(selected.creditScore)}`}>{selected.creditScore ?? '-'}</span></span></div>
                <div className="detail-item"><span className="detail-label">Risk Level</span><span className="detail-value"><span className={`badge badge-${(selected.riskLevel || '').toLowerCase()}`}>{selected.riskLevel}</span></span></div>
                <div className="detail-item"><span className="detail-label">Annual Income</span><span className="detail-value">${parseFloat(selected.income || 0).toLocaleString()}</span></div>
                <div className="detail-item"><span className="detail-label">Debt-to-Income</span><span className="detail-value">{selected.debtToIncome != null ? `${selected.debtToIncome}%` : '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Payment History Score</span><span className="detail-value">{selected.paymentHistoryScore ?? '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Credit Utilization</span><span className="detail-value">{selected.creditUtilization != null ? `${selected.creditUtilization}%` : '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Account Age</span><span className="detail-value">{selected.accountAgeMonths != null ? `${selected.accountAgeMonths} months` : '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Num Accounts</span><span className="detail-value">{selected.numAccounts ?? '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Late Payments</span><span className="detail-value">{selected.numLatePayments ?? '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Loan Requested</span><span className="detail-value">${parseFloat(selected.loanAmountRequested || 0).toLocaleString()}</span></div>
                <div className="detail-item"><span className="detail-label">Loan Purpose</span><span className="detail-value">{selected.loanPurpose || '-'}</span></div>
                <div className="detail-item"><span className="detail-label">AI Recommendation</span><span className="detail-value">{selected.aiRecommendation || '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Created</span><span className="detail-value">{selected.createdAt ? new Date(selected.createdAt).toLocaleString() : '-'}</span></div>
              </div>
              <div style={{ marginTop: '20px' }}>
                <button className="btn btn-ai" onClick={runAiAnalysis} disabled={aiLoading}>
                  <FiCpu /> {aiLoading ? 'Analyzing...' : 'AI Credit Analysis'}
                </button>
              </div>
              {aiLoading && <div className="ai-loading"><div className="spinner"></div>Running AI credit analysis...</div>}
              {aiResult && <AIResultsDisplay data={aiResult} title="AI Credit Analysis Results" />}
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={() => setShowForm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editItem ? 'Edit Record' : 'New Credit Score Record'}</h3>
              <button className="modal-close" onClick={() => setShowForm(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group"><label>Customer Name *</label><input type="text" value={form.customerName} onChange={e => setField('customerName', e.target.value)} required /></div>
                  <div className="form-group"><label>Email</label><input type="email" value={form.customerEmail} onChange={e => setField('customerEmail', e.target.value)} /></div>
                  <div className="form-group"><label>SSN Last 4</label><input type="text" maxLength="4" value={form.ssnLast4} onChange={e => setField('ssnLast4', e.target.value)} /></div>
                  <div className="form-group"><label>Credit Score (300-850)</label><input type="number" min="300" max="850" value={form.creditScore} onChange={e => setField('creditScore', e.target.value)} /></div>
                  <div className="form-group"><label>Risk Level</label>
                    <select value={form.riskLevel} onChange={e => setField('riskLevel', e.target.value)}>
                      <option value="very_low">Very Low</option>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="very_high">Very High</option>
                    </select>
                  </div>
                  <div className="form-group"><label>Annual Income</label><input type="number" step="0.01" value={form.income} onChange={e => setField('income', e.target.value)} /></div>
                  <div className="form-group"><label>Debt-to-Income Ratio (%)</label><input type="number" step="0.01" value={form.debtToIncome} onChange={e => setField('debtToIncome', e.target.value)} /></div>
                  <div className="form-group"><label>Payment History Score</label><input type="number" step="0.01" value={form.paymentHistoryScore} onChange={e => setField('paymentHistoryScore', e.target.value)} /></div>
                  <div className="form-group"><label>Credit Utilization (%)</label><input type="number" step="0.01" value={form.creditUtilization} onChange={e => setField('creditUtilization', e.target.value)} /></div>
                  <div className="form-group"><label>Account Age (months)</label><input type="number" value={form.accountAgeMonths} onChange={e => setField('accountAgeMonths', e.target.value)} /></div>
                  <div className="form-group"><label>Number of Accounts</label><input type="number" value={form.numAccounts} onChange={e => setField('numAccounts', e.target.value)} /></div>
                  <div className="form-group"><label>Late Payments</label><input type="number" value={form.numLatePayments} onChange={e => setField('numLatePayments', e.target.value)} /></div>
                  <div className="form-group"><label>Loan Amount Requested</label><input type="number" step="0.01" value={form.loanAmountRequested} onChange={e => setField('loanAmountRequested', e.target.value)} /></div>
                  <div className="form-group"><label>Loan Purpose</label><input type="text" value={form.loanPurpose} onChange={e => setField('loanPurpose', e.target.value)} /></div>
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
