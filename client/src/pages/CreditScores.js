import React, { useState, useEffect } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiCpu } from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../api';
import AIResultsDisplay from '../components/AIResultsDisplay';

function getScoreColor(score) {
  if (score == null) return '';
  if (score >= 750) return 'risk-low';
  if (score >= 650) return 'risk-medium';
  if (score >= 550) return 'risk-high';
  return 'risk-critical';
}

const emptyForm = {
  customerName: '', email: '', creditScore: '', riskLevel: 'medium',
  annualIncome: '', monthlyDebt: '', debtToIncomeRatio: '',
  loanAmountRequested: '', loanPurpose: '', employmentStatus: 'employed',
  yearsEmployed: '', bankruptcyHistory: false, latePayments: '',
  existingLoans: '', collateralValue: ''
};

export default function CreditScores() {
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
      const res = await api.get('/credit-scores');
      setItems(Array.isArray(res.data) ? res.data : res.data?.data || []);
    } catch (err) { toast.error('Failed to load credit scores'); }
    finally { setLoading(false); }
  };

  const openDetail = (item) => { setSelected(item); setAiResult(null); setShowDetail(true); };

  const openNew = () => { setEditItem(null); setForm({ ...emptyForm }); setShowForm(true); };

  const openEdit = (e, item) => {
    e.stopPropagation();
    setEditItem(item);
    setForm({
      customerName: item.customerName || '',
      email: item.email || '',
      creditScore: item.creditScore ?? '',
      riskLevel: item.riskLevel || 'medium',
      annualIncome: item.annualIncome ?? '',
      monthlyDebt: item.monthlyDebt ?? '',
      debtToIncomeRatio: item.debtToIncomeRatio ?? '',
      loanAmountRequested: item.loanAmountRequested ?? '',
      loanPurpose: item.loanPurpose || '',
      employmentStatus: item.employmentStatus || 'employed',
      yearsEmployed: item.yearsEmployed ?? '',
      bankruptcyHistory: item.bankruptcyHistory || false,
      latePayments: item.latePayments ?? '',
      existingLoans: item.existingLoans ?? '',
      collateralValue: item.collateralValue ?? '',
    });
    setShowForm(true);
  };

  const handleDelete = async (e, item) => {
    e.stopPropagation();
    if (!window.confirm('Delete this credit score record?')) return;
    try {
      await api.delete(`/credit-scores/${item._id || item.id}`);
      toast.success('Record deleted');
      loadItems();
    } catch (err) { toast.error('Failed to delete'); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      creditScore: parseFloat(form.creditScore) || 0,
      annualIncome: parseFloat(form.annualIncome) || 0,
      monthlyDebt: parseFloat(form.monthlyDebt) || 0,
      debtToIncomeRatio: parseFloat(form.debtToIncomeRatio) || 0,
      loanAmountRequested: parseFloat(form.loanAmountRequested) || 0,
      yearsEmployed: parseFloat(form.yearsEmployed) || 0,
      latePayments: parseInt(form.latePayments) || 0,
      existingLoans: parseInt(form.existingLoans) || 0,
      collateralValue: parseFloat(form.collateralValue) || 0,
    };
    try {
      if (editItem) {
        await api.put(`/credit-scores/${editItem._id || editItem.id}`, payload);
        toast.success('Record updated');
      } else {
        await api.post('/credit-scores', payload);
        toast.success('Record created');
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
      const res = await api.post(`/credit-scores/${selected._id || selected.id}/analyze`);
      setAiResult(res.data);
    } catch (err) { toast.error('AI analysis failed'); }
    finally { setAiLoading(false); }
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
              <tr><th>Customer</th><th>Email</th><th>Credit Score</th><th>Risk Level</th><th>Income</th><th>DTI</th><th>Loan Requested</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan="8" style={{ textAlign: 'center', padding: '40px' }}>No records found</td></tr>
              ) : items.map(c => (
                <tr key={c._id || c.id} onClick={() => openDetail(c)}>
                  <td>{c.customerName || '-'}</td>
                  <td>{c.customerEmail || c.email || '-'}</td>
                  <td><span className={`risk-score ${getScoreColor(c.creditScore)}`}>{c.creditScore ?? '-'}</span></td>
                  <td><span className={`badge badge-${(c.riskLevel || '').toLowerCase()}`}>{c.riskLevel || '-'}</span></td>
                  <td>${parseFloat(c.income || c.annualIncome || 0).toLocaleString()}</td>
                  <td>{(c.debtToIncome || c.debtToIncomeRatio) != null ? `${c.debtToIncome || c.debtToIncomeRatio}%` : '-'}</td>
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
      </div>

      {showDetail && selected && (
        <div className="modal-overlay" onClick={() => setShowDetail(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Credit Score Details</h3>
              <button className="modal-close" onClick={() => setShowDetail(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="detail-grid">
                <div className="detail-item"><span className="detail-label">Customer Name</span><span className="detail-value">{selected.customerName || '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Email</span><span className="detail-value">{selected.customerEmail || selected.email || '-'}</span></div>
                <div className="detail-item"><span className="detail-label">SSN Last 4</span><span className="detail-value">{selected.ssnLast4 || '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Credit Score</span><span className="detail-value"><span className={`risk-score ${getScoreColor(selected.creditScore)}`}>{selected.creditScore ?? '-'}</span></span></div>
                <div className="detail-item"><span className="detail-label">Risk Level</span><span className="detail-value"><span className={`badge badge-${(selected.riskLevel || '').toLowerCase()}`}>{selected.riskLevel}</span></span></div>
                <div className="detail-item"><span className="detail-label">Income</span><span className="detail-value">${parseFloat(selected.income || selected.annualIncome || 0).toLocaleString()}</span></div>
                <div className="detail-item"><span className="detail-label">Debt-to-Income Ratio</span><span className="detail-value">{(selected.debtToIncome || selected.debtToIncomeRatio) != null ? `${selected.debtToIncome || selected.debtToIncomeRatio}%` : '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Payment History Score</span><span className="detail-value">{selected.paymentHistoryScore ?? '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Credit Utilization</span><span className="detail-value">{selected.creditUtilization != null ? `${selected.creditUtilization}%` : '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Account Age (months)</span><span className="detail-value">{selected.accountAgeMonths ?? '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Num Accounts</span><span className="detail-value">{selected.numAccounts ?? '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Late Payments</span><span className="detail-value">{selected.numLatePayments ?? '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Loan Requested</span><span className="detail-value">${parseFloat(selected.loanAmountRequested || 0).toLocaleString()}</span></div>
                <div className="detail-item"><span className="detail-label">Loan Purpose</span><span className="detail-value">{selected.loanPurpose || '-'}</span></div>
                <div className="detail-item"><span className="detail-label">AI Recommendation</span><span className="detail-value">{selected.aiRecommendation || '-'}</span></div>
                <div className="detail-item"><span className="detail-label">AI Risk Analysis</span><span className="detail-value">{selected.aiRiskAnalysis || '-'}</span></div>
                <div className="detail-item"><span className="detail-label">Created</span><span className="detail-value">{selected.createdAt ? new Date(selected.createdAt).toLocaleString() : '-'}</span></div>
              </div>
              <div style={{ marginTop: '20px' }}>
                <button className="btn btn-ai" onClick={runAiAnalysis} disabled={aiLoading}><FiCpu /> {aiLoading ? 'Analyzing...' : 'AI Credit Analysis'}</button>
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
                  <div className="form-group"><label>Customer Name</label><input type="text" value={form.customerName} onChange={e => setField('customerName', e.target.value)} required /></div>
                  <div className="form-group"><label>Email</label><input type="email" value={form.email} onChange={e => setField('email', e.target.value)} required /></div>
                  <div className="form-group"><label>Credit Score</label><input type="number" min="300" max="850" value={form.creditScore} onChange={e => setField('creditScore', e.target.value)} required /></div>
                  <div className="form-group"><label>Risk Level</label>
                    <select value={form.riskLevel} onChange={e => setField('riskLevel', e.target.value)}>
                      <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
                    </select>
                  </div>
                  <div className="form-group"><label>Annual Income</label><input type="number" value={form.annualIncome} onChange={e => setField('annualIncome', e.target.value)} /></div>
                  <div className="form-group"><label>Monthly Debt</label><input type="number" value={form.monthlyDebt} onChange={e => setField('monthlyDebt', e.target.value)} /></div>
                  <div className="form-group"><label>Debt-to-Income Ratio (%)</label><input type="number" step="0.1" value={form.debtToIncomeRatio} onChange={e => setField('debtToIncomeRatio', e.target.value)} /></div>
                  <div className="form-group"><label>Loan Amount Requested</label><input type="number" value={form.loanAmountRequested} onChange={e => setField('loanAmountRequested', e.target.value)} /></div>
                  <div className="form-group"><label>Loan Purpose</label><input type="text" value={form.loanPurpose} onChange={e => setField('loanPurpose', e.target.value)} /></div>
                  <div className="form-group"><label>Employment Status</label>
                    <select value={form.employmentStatus} onChange={e => setField('employmentStatus', e.target.value)}>
                      <option value="employed">Employed</option><option value="self-employed">Self-Employed</option><option value="unemployed">Unemployed</option><option value="retired">Retired</option>
                    </select>
                  </div>
                  <div className="form-group"><label>Years Employed</label><input type="number" value={form.yearsEmployed} onChange={e => setField('yearsEmployed', e.target.value)} /></div>
                  <div className="form-group"><label>Bankruptcy History</label>
                    <select value={form.bankruptcyHistory ? 'true' : 'false'} onChange={e => setField('bankruptcyHistory', e.target.value === 'true')}>
                      <option value="false">No</option><option value="true">Yes</option>
                    </select>
                  </div>
                  <div className="form-group"><label>Late Payments</label><input type="number" value={form.latePayments} onChange={e => setField('latePayments', e.target.value)} /></div>
                  <div className="form-group"><label>Existing Loans</label><input type="number" value={form.existingLoans} onChange={e => setField('existingLoans', e.target.value)} /></div>
                  <div className="form-group"><label>Collateral Value</label><input type="number" value={form.collateralValue} onChange={e => setField('collateralValue', e.target.value)} /></div>
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
