import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import toast from 'react-hot-toast'

const STATUS_COLORS = {
  active:    { bg: '#e8f5ed', text: '#106f30' },
  pending:   { bg: '#fff3e0', text: '#c25a00' },
  inactive:  { bg: '#f5f5f5', text: '#555555' },
  suspended: { bg: '#fce8e8', text: '#c62828' },
}

export default function Users() {
  const { can } = useAuth()
  const [users, setUsers]       = useState([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [page, setPage]         = useState(1)
  const [selected, setSelected] = useState(null)
  const [detail, setDetail]     = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [showReset, setShowReset] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [saving, setSaving]     = useState(false)
  const [editRole, setEditRole] = useState('')
  const [roles, setRoles]       = useState([])
  const limit = 15

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page, limit })
      if (search) params.append('search', search)
      if (filterStatus) params.append('status', filterStatus)
      const res = await api.get(`/users?${params}`)
      setUsers(res.data.users)
      setTotal(res.data.total)
    } catch {
      toast.error('Failed to load users')
    } finally {
      setLoading(false)
    }
  }

  const fetchRoles = async () => {
    try {
      const res = await api.get('/permissions/roles')
      setRoles(res.data.roles)
    } catch {}
  }

  useEffect(() => { fetchUsers() }, [page, search, filterStatus])
  useEffect(() => { fetchRoles() }, [])

  const loadDetail = async (userId) => {
    setSelected(userId)
    setDetailLoading(true)
    setShowReset(false)
    try {
      const res = await api.get(`/users/${userId}`)
      setDetail(res.data)
      setEditRole(res.data.role?.role_id || '')
    } catch {
      toast.error('Failed to load user details')
    } finally {
      setDetailLoading(false)
    }
  }

  const handleUpdateRole = async () => {
    if (!editRole) return
    setSaving(true)
    try {
      await api.put(`/users/${selected}`, { role_id: editRole })
      toast.success('Role updated')
      loadDetail(selected)
      fetchUsers()
    } catch {
      toast.error('Failed to update role')
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivate = async () => {
    if (!confirm(`Deactivate ${detail?.full_name}?`)) return
    try {
      await api.delete(`/users/${selected}`)
      toast.success('User deactivated')
      setSelected(null)
      setDetail(null)
      fetchUsers()
    } catch {
      toast.error('Failed to deactivate user')
    }
  }

  const handleResetPassword = async () => {
    if (newPassword.length < 8) { toast.error('Minimum 8 characters'); return }
    setSaving(true)
    try {
      await api.post(`/users/${selected}/reset-password`, { new_password: newPassword })
      toast.success('Password reset successfully')
      setShowReset(false)
      setNewPassword('')
    } catch {
      toast.error('Failed to reset password')
    } finally {
      setSaving(false)
    }
  }

  const handleActivate = async (userId) => {
    try {
      await api.put(`/users/${userId}`, { status: 'active' })
      toast.success('User activated')
      fetchUsers()
      if (selected === userId) loadDetail(userId)
    } catch {
      toast.error('Failed to activate user')
    }
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="flex gap-6 h-full">
      {/* Left — User list */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 style={{ fontFamily: "'DM Serif Display', serif", color: '#106f30' }} className="text-2xl">
              Users
            </h1>
            <p className="text-gray-500 text-sm mt-0.5">{total} total users</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-4">
          <input placeholder="Search name, email or phone..."
            value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="flex-1 px-4 py-2 rounded-xl border-2 border-gray-200 focus:border-[#106f30] text-sm bg-white focus:outline-none" />
          <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }}
            className="px-4 py-2 rounded-xl border-2 border-gray-200 text-sm bg-white focus:border-[#106f30] focus:outline-none">
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="inactive">Inactive</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>

        {/* User list */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-400">Loading...</div>
          ) : users.length === 0 ? (
            <div className="p-12 text-center text-gray-400">No users found</div>
          ) : (
            <div>
              {users.map((u, i) => {
                const sc = STATUS_COLORS[u.status] || STATUS_COLORS.inactive
                const isSelected = selected === u.user_id
                return (
                  <div key={u.user_id}
                    onClick={() => loadDetail(u.user_id)}
                    className={`flex items-center gap-4 px-4 py-3 cursor-pointer border-b border-gray-50 hover:bg-gray-50 transition-all
                      ${isSelected ? 'bg-green-50 border-l-4 border-l-[#106f30]' : ''}`}>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                      style={{ background: '#106f30' }}>
                      {u.full_name?.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800 text-sm truncate">{u.full_name}</p>
                      <p className="text-gray-400 text-xs truncate">{u.email || u.phone}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ background: sc.bg, color: sc.text }}>
                        {u.status}
                      </span>
                      <span className="text-xs text-gray-400">{u.role?.name || '—'}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <p className="text-xs text-gray-500">
                {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
              </p>
              <div className="flex gap-2">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                  className="px-3 py-1 rounded-lg text-xs border border-gray-200 disabled:opacity-40">← Prev</button>
                <span className="px-2 py-1 text-xs text-gray-500">{page}/{totalPages}</span>
                <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
                  className="px-3 py-1 rounded-lg text-xs border border-gray-200 disabled:opacity-40">Next →</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right — User detail panel */}
      {selected && (
        <div className="w-80 flex-shrink-0">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 sticky top-0">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <h3 className="font-semibold text-gray-800 text-sm">User Details</h3>
              <button onClick={() => { setSelected(null); setDetail(null) }}
                className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            {detailLoading ? (
              <div className="p-8 text-center text-gray-400 text-sm">Loading...</div>
            ) : detail && (
              <div className="p-5 flex flex-col gap-5">
                {/* Avatar + name */}
                <div className="flex flex-col items-center text-center gap-2">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold"
                    style={{ background: '#106f30' }}>
                    {detail.full_name?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">{detail.full_name}</p>
                    <p className="text-xs text-gray-400">{detail.role?.name || '—'}</p>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-medium"
                    style={{ background: STATUS_COLORS[detail.status]?.bg, color: STATUS_COLORS[detail.status]?.text }}>
                    {detail.status}
                  </span>
                </div>

                {/* Info */}
                <div className="flex flex-col gap-3">
                  {[
                    ['Customer', detail.customer?.cust_name],
                    ['Customer ID', detail.customer?.customer_id],
                    ['Email', detail.email || '—'],
                    ['Phone', detail.phone || '—'],
                    ['Email Verified', detail.email_verified ? '✅ Yes' : '❌ No'],
                    ['Phone Verified', detail.phone_verified ? '✅ Yes' : '❌ No'],
                    ['Hierarchy Node', detail.hierarchy_node?.name || '—'],
                    ['Last Login', detail.last_login_at ? new Date(detail.last_login_at).toLocaleDateString('en-IN') : 'Never'],
                    ['Joined', new Date(detail.created_at).toLocaleDateString('en-IN')],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-2">
                      <span className="text-xs text-gray-400 flex-shrink-0">{label}</span>
                      <span className="text-xs text-gray-700 text-right">{value}</span>
                    </div>
                  ))}
                </div>

                {/* Change role */}
                {can('users_edit') && (
                  <div className="border-t border-gray-100 pt-4">
                    <p className="text-xs font-medium text-gray-600 mb-2">Change Role</p>
                    <div className="flex gap-2">
                      <select value={editRole} onChange={e => setEditRole(e.target.value)}
                        className="flex-1 px-2 py-1.5 rounded-xl border border-gray-200 text-xs bg-white focus:border-[#106f30] focus:outline-none">
                        {roles.map(r => <option key={r.role_id} value={r.role_id}>{r.name}</option>)}
                      </select>
                      <button onClick={handleUpdateRole} disabled={saving || editRole === detail.role?.role_id}
                        className="px-3 py-1.5 rounded-xl text-xs text-white font-medium disabled:opacity-50"
                        style={{ background: '#106f30' }}>
                        Save
                      </button>
                    </div>
                  </div>
                )}

                {/* Reset password */}
                {can('users_edit') && (
                  <div className="border-t border-gray-100 pt-4">
                    {!showReset ? (
                      <button onClick={() => setShowReset(true)}
                        className="w-full py-2 rounded-xl text-xs font-medium border-2 border-gray-200 text-gray-600 hover:bg-gray-50">
                        🔑 Reset Password
                      </button>
                    ) : (
                      <div className="flex flex-col gap-2">
                        <p className="text-xs font-medium text-gray-600">New Password</p>
                        <input type="password" placeholder="Min 8 characters"
                          value={newPassword} onChange={e => setNewPassword(e.target.value)}
                          className="px-3 py-2 rounded-xl border border-gray-200 text-xs focus:border-[#106f30] focus:outline-none" />
                        <div className="flex gap-2">
                          <button onClick={() => { setShowReset(false); setNewPassword('') }}
                            className="flex-1 py-1.5 rounded-xl text-xs border border-gray-200 text-gray-500">
                            Cancel
                          </button>
                          <button onClick={handleResetPassword} disabled={saving}
                            className="flex-1 py-1.5 rounded-xl text-xs text-white disabled:opacity-60"
                            style={{ background: '#106f30' }}>
                            {saving ? '...' : 'Reset'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="border-t border-gray-100 pt-4 flex flex-col gap-2">
                  {can('users_edit') && detail.status === 'inactive' && (
                    <button onClick={() => handleActivate(detail.user_id)}
                      className="w-full py-2 rounded-xl text-xs font-medium text-green-700 border-2 border-green-200 hover:bg-green-50">
                      ✅ Activate User
                    </button>
                  )}
                  {can('users_delete') && detail.status !== 'inactive' && (
                    <button onClick={handleDeactivate}
                      className="w-full py-2 rounded-xl text-xs font-medium text-red-600 border-2 border-red-200 hover:bg-red-50">
                      🚫 Deactivate User
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}