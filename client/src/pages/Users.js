import React, { useState, useEffect, useCallback } from 'react';
import { FiUsers, FiToggleLeft, FiToggleRight, FiSearch } from 'react-icons/fi';
import { toast } from 'react-toastify';
import api from '../api';
import Pagination from '../components/Pagination';

const LIMIT = 20;
const ROLES = ['admin', 'analyst', 'viewer'];

export default function Users() {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState('');
  const [filterActive, setFilterActive] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const loadItems = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = { page, limit: LIMIT };
      if (filterRole) params.role = filterRole;
      if (filterActive !== '') params.is_active = filterActive;
      if (search) params.search = search;
      const res = await api.get('/users', { params });
      const data = res.data;
      setItems(data.data || []);
      if (data.pagination) setPagination({ page: data.pagination.page, totalPages: data.pagination.totalPages, total: data.pagination.total });
    } catch (err) { toast.error('Failed to load users'); }
    finally { setLoading(false); }
  }, [filterRole, filterActive, search]);

  useEffect(() => { loadItems(1); }, [loadItems]);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  const toggleActive = async (item) => {
    try {
      await api.patch(`/users/${item.id}/toggle`);
      toast.success(`User ${item.isActive || item.is_active ? 'deactivated' : 'activated'}`);
      loadItems(pagination.page);
    } catch (err) { toast.error('Toggle failed'); }
  };

  const changeRole = async (item, newRole) => {
    if (!window.confirm(`Change ${item.name || item.email}'s role to ${newRole}?`)) return;
    try {
      await api.patch(`/users/${item.id}/role`, { role: newRole });
      toast.success('Role updated');
      loadItems(pagination.page);
    } catch (err) { toast.error(err.response?.data?.error || 'Role change failed'); }
  };

  if (loading) return <div className="loading-container"><div className="spinner"></div> Loading...</div>;

  return (
    <div>
      <div className="page-header">
        <div><h2>User Management</h2><p>Manage system users, roles, and access</p></div>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px' }}>
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search by name or email..."
            style={{ padding: '8px 12px', background: '#1a2332', border: '1px solid #2d3a4d', borderRadius: '6px', color: '#f1f5f9', minWidth: '220px' }}
          />
          <button type="submit" className="btn btn-secondary btn-sm"><FiSearch /> Search</button>
        </form>
        <select value={filterRole} onChange={e => setFilterRole(e.target.value)}
          style={{ padding: '8px 12px', background: '#1a2332', border: '1px solid #2d3a4d', borderRadius: '6px', color: '#f1f5f9' }}>
          <option value="">All Roles</option>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={filterActive} onChange={e => setFilterActive(e.target.value)}
          style={{ padding: '8px 12px', background: '#1a2332', border: '1px solid #2d3a4d', borderRadius: '6px', color: '#f1f5f9' }}>
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
      </div>

      <div className="table-container">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr><th>Name</th><th>Email</th><th>Role</th><th>Active</th><th>Created</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '40px' }}>No users found</td></tr>
              ) : items.map(u => (
                <tr key={u.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#1e40af', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 600, color: '#93c5fd', flexShrink: 0 }}>
                        {(u.name || u.email || 'U').charAt(0).toUpperCase()}
                      </div>
                      {u.name || '-'}
                    </div>
                  </td>
                  <td style={{ fontSize: '13px', color: '#94a3b8' }}>{u.email || '-'}</td>
                  <td>
                    <select
                      value={u.role || ''}
                      onChange={e => changeRole(u, e.target.value)}
                      style={{ padding: '4px 8px', background: '#1a2332', border: '1px solid #2d3a4d', borderRadius: '4px', color: '#f1f5f9', fontSize: '12px' }}
                    >
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td>
                    <span className={`badge badge-${(u.isActive || u.is_active) ? 'green' : 'gray'}`}>
                      {(u.isActive || u.is_active) ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td style={{ fontSize: '12px', color: '#64748b' }}>{u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '-'}</td>
                  <td className="table-actions">
                    <button
                      className={`btn btn-sm ${(u.isActive || u.is_active) ? 'btn-danger' : 'btn-primary'}`}
                      onClick={() => toggleActive(u)}
                      title={(u.isActive || u.is_active) ? 'Deactivate' : 'Activate'}
                    >
                      {(u.isActive || u.is_active) ? <FiToggleRight /> : <FiToggleLeft />}
                      {(u.isActive || u.is_active) ? 'Deactivate' : 'Activate'}
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
    </div>
  );
}
