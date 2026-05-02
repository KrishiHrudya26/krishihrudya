import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import toast from 'react-hot-toast'

const CUSTOMER_TYPES = [
  { value: 'b2g',         label: 'B2G — Government' },
  { value: 'b2c',         label: 'B2C — Direct Farmer' },
  { value: 'b2b',         label: 'B2B — Business' },
  { value: 'internal',    label: 'Internal — KH Team' },
  { value: 'collaborator',label: 'Collaborator' },
  { value: 'demo',        label: 'Demo' },
  { value: 'dealer',      label: 'Dealer' },
]

const STATE_CODES = [
  { code: '29', name: 'Karnataka' },
  { code: '27', name: 'Maharashtra' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '07', name: 'Delhi' },
  { code: '36', name: 'Telangana' },
  { code: '28', name: 'Andhra Pradesh' },
  { code: '32', name: 'Kerala' },
  { code: '24', name: 'Gujarat' },
  { code: '06', name: 'Haryana' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' },
  { code: '08', name: 'Rajasthan' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '19', name: 'West Bengal' },
  { code: '00', name: 'KH Internal' },
]

const TYPE_COLORS = {
  b2g:          { bg: '#e6f1fb', text: '#1a4f7a' },
  b2c:          { bg: '#e8f5ed', text: '#106f30' },
  b2b:          { bg: '#fff3e0', text: '#c25a00' },
  internal:     { bg: '#f3e8ff', text: '#6d28d9' },
  collaborator: { bg: '#fce8e8', text: '#c62828' },
  demo:         { bg: '#f5f5f5', text: '#555555' },
  dealer:       { bg: '#e0f5f0', text: '#1a6a5a' },
}

const emptyForm = {
  cust_name: '', short_name: '', cust_type: 'b2g',
  state_code: '29', reg_type: 'approval_required',
  hierarchy_required: true, contact_email: '',
  contact_number: '', address: '',
}

export default function Customers() {
  const { can } = useAuth()
  const [customers, setCustomers] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('')
  const [page, setPage] = useState(1)
  const [showCreate, setShowCreate] = useState(false)
  const [showDetail, setShowDetail] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Hierarchy builder state
  const [showHierarchy, setShowHierarchy] = useState(false)
  const [newLevel, setNewLevel] = useState({ name: '', level_order: 1 })
  const [newNode, setNewNode] = useState({ level_id: '', parent_id: '', name: '' })

  const limit = 10

  const fetchCustomers = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page, limit })
      if (search) params.append('search', search)
      if (filterType) params.append('cust_type', filterType)
      const res = await api.get(`/customers?${params}`)
      setCustomers(res.data.customers)
      setTotal(res.data.total)
    } catch {
      toast.error('Failed to load customers')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchCustomers() }, [page, search, filterType])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!form.cust_name) { toast.error('Customer name is required'); return }
    setSaving(true)
    try {
      const res = await api.post('/customers', form)
      toast.success(`Customer created — ID: ${res.data.customer_id}`)
      setShowCreate(false)
      setForm(emptyForm)
      fetchCustomers()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create customer')
    } finally {
      setSaving(false)
    }
  }

  const loadDetail = async (custId) => {
    setShowDetail(custId)
    setDetailLoading(true)
    try {
      const res = await api.get(`/customers/${custId}`)
      setDetail(res.data)
    } catch {
      toast.error('Failed to load customer details')
    } finally {
      setDetailLoading(false)
    }
  }

  const handleDeactivate = async (custId, custName) => {
    if (!confirm(`Deactivate ${custName}? Users under this customer cannot register.`)) return
    try {
      await api.delete(`/customers/${custId}`)
      toast.success('Customer deactivated')
      fetchCustomers()
      if (showDetail === custId) setShowDetail(null)
    } catch {
      toast.error('Failed to deactivate')
    }
  }

  const handleAddLevel = async () => {
    if (!newLevel.name) { toast.error('Level name required'); return }
    try {
      await api.post(`/customers/${showDetail}/hierarchy/levels`, newLevel)
      toast.success('Level added')
      setNewLevel({ name: '', level_order: (detail?.hierarchy?.levels?.length || 0) + 1 })
      loadDetail(showDetail)
    } catch {
      toast.error('Failed to add level')
    }
  }

  const handleAddNode = async () => {
    if (!newNode.name || !newNode.level_id) { toast.error('Level and name required'); return }
    try {
      await api.post(`/customers/${showDetail}/hierarchy/nodes`, {
        ...newNode,
        parent_id: newNode.parent_id || null,
      })
      toast.success('Node added')
      setNewNode({ level_id: '', parent_id: '', name: '' })
      loadDetail(showDetail)
    } catch {
      toast.error('Failed to add node')
    }
  }

  const handleDeleteLevel = async (levelId) => {
    if (!confirm('Delete this level?')) return
    try {
      await api.delete(`/customers/${showDetail}/hierarchy/levels/${levelId}`)
      toast.success('Level deleted')
      loadDetail(showDetail)
    } catch {
      toast.error('Failed to delete level')
    }
  }

  const handleDeleteNode = async (nodeId) => {
    if (!confirm('Delete this node?')) return
    try {
      await api.delete(`/customers/${showDetail}/hierarchy/nodes/${nodeId}`)
      toast.success('Node deleted')
      loadDetail(showDetail)
    } catch {
      toast.error('Failed to delete node')
    }
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="p-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 style={{ fontFamily: "'DM Serif Display', serif", color: '#106f30' }} className="text-2xl">
            Customers
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">{total} total customers</p>
        </div>
        {can('customers_add') && (
          <button onClick={() => setShowCreate(true)}
            className="px-4 py-2 rounded-xl text-white text-sm font-medium hover:opacity-90"
            style={{ background: '#106f30' }}>
            + New Customer
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <input
          placeholder="Search name or ID..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          className="flex-1 px-4 py-2 rounded-xl border-2 border-gray-200 focus:border-[#106f30] text-sm bg-white"
        />
        <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(1) }}
          className="px-4 py-2 rounded-xl border-2 border-gray-200 text-sm bg-white focus:border-[#106f30]">
          <option value="">All Types</option>
          {CUSTOMER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead style={{ background: '#106f30' }}>
            <tr>
              {['Customer ID', 'Name', 'Type', 'Reg Type', 'Hierarchy', 'Status', 'Actions'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-white font-medium text-xs">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">Loading...</td></tr>
            ) : customers.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-gray-400">No customers found</td></tr>
            ) : customers.map((c, i) => {
              const col = TYPE_COLORS[c.cust_type] || { bg: '#f5f5f5', text: '#555' }
              return (
                <tr key={c.cust_id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-4 py-3 font-mono text-xs font-medium" style={{ color: '#106f30' }}>
                    {c.customer_id}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800">{c.cust_name}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 rounded-full text-xs font-medium"
                      style={{ background: col.bg, color: col.text }}>
                      {c.cust_type.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-xs">{c.reg_type.replace('_', ' ')}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs ${c.hierarchy_required ? 'text-green-600' : 'text-gray-400'}`}>
                      {c.hierarchy_required ? '✅ Required' : '— None'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${c.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {c.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => loadDetail(c.cust_id)}
                        className="px-3 py-1 rounded-lg text-xs font-medium border border-gray-200 hover:bg-gray-50">
                        View
                      </button>
                      {can('customers_delete') && c.is_active && (
                        <button onClick={() => handleDeactivate(c.cust_id, c.cust_name)}
                          className="px-3 py-1 rounded-lg text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50">
                          Deactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
            </p>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 rounded-lg text-xs border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
                ← Prev
              </button>
              <span className="px-3 py-1 text-xs text-gray-600">
                {page} / {totalPages}
              </span>
              <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 rounded-lg text-xs border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-semibold text-gray-800">Create New Customer</h2>
              <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 flex flex-col gap-4">

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Customer Name *</label>
                <input placeholder="e.g. BWSSB Water Department"
                  value={form.cust_name} onChange={e => setForm(f => ({ ...f, cust_name: e.target.value }))}
                  className="px-3 py-2 rounded-xl border-2 border-gray-200 text-sm focus:border-[#106f30] focus:outline-none" />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Short Name</label>
                <input placeholder="e.g. BWSSB"
                  value={form.short_name} onChange={e => setForm(f => ({ ...f, short_name: e.target.value }))}
                  className="px-3 py-2 rounded-xl border-2 border-gray-200 text-sm focus:border-[#106f30] focus:outline-none" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-600">Customer Type *</label>
                  <select value={form.cust_type} onChange={e => setForm(f => ({ ...f, cust_type: e.target.value }))}
                    className="px-3 py-2 rounded-xl border-2 border-gray-200 text-sm focus:border-[#106f30] focus:outline-none bg-white">
                    {CUSTOMER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-600">State *</label>
                  <select value={form.state_code} onChange={e => setForm(f => ({ ...f, state_code: e.target.value }))}
                    className="px-3 py-2 rounded-xl border-2 border-gray-200 text-sm focus:border-[#106f30] focus:outline-none bg-white">
                    {STATE_CODES.map(s => <option key={s.code} value={s.code}>{s.name} ({s.code})</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-600">Registration Type</label>
                  <select value={form.reg_type} onChange={e => setForm(f => ({ ...f, reg_type: e.target.value }))}
                    className="px-3 py-2 rounded-xl border-2 border-gray-200 text-sm focus:border-[#106f30] focus:outline-none bg-white">
                    <option value="approval_required">Approval Required</option>
                    <option value="open">Open</option>
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-600">Hierarchy Required</label>
                  <select value={form.hierarchy_required} onChange={e => setForm(f => ({ ...f, hierarchy_required: e.target.value === 'true' }))}
                    className="px-3 py-2 rounded-xl border-2 border-gray-200 text-sm focus:border-[#106f30] focus:outline-none bg-white">
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Contact Email</label>
                <input type="email" placeholder="contact@example.com"
                  value={form.contact_email} onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))}
                  className="px-3 py-2 rounded-xl border-2 border-gray-200 text-sm focus:border-[#106f30] focus:outline-none" />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Contact Phone</label>
                <input placeholder="+919876543210"
                  value={form.contact_number} onChange={e => setForm(f => ({ ...f, contact_number: e.target.value }))}
                  className="px-3 py-2 rounded-xl border-2 border-gray-200 text-sm focus:border-[#106f30] focus:outline-none" />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Address</label>
                <textarea placeholder="Full address..."
                  value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  rows={2}
                  className="px-3 py-2 rounded-xl border-2 border-gray-200 text-sm focus:border-[#106f30] focus:outline-none resize-none" />
              </div>

              {/* Preview generated ID */}
              <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                <p className="text-xs text-green-600 font-medium mb-1">Customer ID will be generated as:</p>
                <p className="font-mono text-sm font-bold" style={{ color: '#106f30' }}>
                  K{form.state_code}{({ b2g:'G',b2c:'C',b2b:'B',internal:'I',collaborator:'L',demo:'D',dealer:'R' })[form.cust_type] || 'X'}{String(new Date().getFullYear()).slice(2)}XXXXX
                </p>
                <p className="text-xs text-gray-400 mt-1">Sequential number assigned automatically</p>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)}
                  className="flex-1 py-2 rounded-xl border-2 border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2 rounded-xl text-white text-sm font-medium hover:opacity-90 disabled:opacity-60"
                  style={{ background: '#106f30' }}>
                  {saving ? 'Creating...' : 'Create Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Panel */}
      {showDetail && (
        <div className="fixed inset-0 bg-black/40 flex items-end lg:items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="font-semibold text-gray-800">
                {detailLoading ? 'Loading...' : detail?.cust_name}
              </h2>
              <div className="flex gap-2">
                {detail && can('hierarchy_manage') && (
                  <button onClick={() => setShowHierarchy(!showHierarchy)}
                    className="px-3 py-1 rounded-lg text-xs font-medium border border-gray-200 hover:bg-gray-50">
                    {showHierarchy ? 'Hide' : 'Edit'} Hierarchy
                  </button>
                )}
                <button onClick={() => { setShowDetail(null); setDetail(null); setShowHierarchy(false) }}
                  className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
              </div>
            </div>

            {detailLoading ? (
              <div className="p-12 text-center text-gray-400">Loading...</div>
            ) : detail && (
              <div className="p-6 flex flex-col gap-6">
                {/* Info grid */}
                <div className="grid grid-cols-2 gap-4">
                  {[
                    ['Customer ID', detail.customer_id],
                    ['Type', detail.cust_type?.toUpperCase()],
                    ['Status', detail.is_active ? '✅ Active' : '❌ Inactive'],
                    ['Users', detail.user_count],
                    ['Contact Email', detail.contact_email || '—'],
                    ['Contact Phone', detail.contact_number || '—'],
                    ['Registration', detail.reg_type?.replace('_', ' ')],
                    ['Hierarchy', detail.hierarchy_required ? 'Required' : 'Not required'],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                      <p className="text-sm font-medium text-gray-800">{value}</p>
                    </div>
                  ))}
                </div>

                {detail.address && (
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Address</p>
                    <p className="text-sm text-gray-700">{detail.address}</p>
                  </div>
                )}

                {/* Registration token */}
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-xs text-gray-400 mb-1">Registration Token (share with customer admin)</p>
                  <p className="font-mono text-xs text-gray-700 break-all">{detail.reg_token}</p>
                </div>

                {/* Hierarchy view */}
                <div>
                  <h3 className="font-semibold text-gray-700 mb-3 text-sm">Hierarchy Structure</h3>
                  {detail.hierarchy?.levels?.length === 0 ? (
                    <p className="text-sm text-gray-400">No hierarchy defined yet.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {detail.hierarchy?.levels?.map(level => (
                        <div key={level.level_id}>
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                              Level {level.level_order} — {level.name}
                            </p>
                            {can('hierarchy_manage') && showHierarchy && (
                              <button onClick={() => handleDeleteLevel(level.level_id)}
                                className="text-xs text-red-500 hover:text-red-700">Delete level</button>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2 pl-3">
                            {detail.hierarchy?.nodes?.filter(n => n.level_id === level.level_id).map(node => (
                              <div key={node.node_id} className="flex items-center gap-1 bg-gray-100 rounded-lg px-3 py-1">
                                <span className="text-sm text-gray-700">{node.name}</span>
                                {can('hierarchy_manage') && showHierarchy && (
                                  <button onClick={() => handleDeleteNode(node.node_id)}
                                    className="text-red-400 hover:text-red-600 text-xs ml-1">✕</button>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Hierarchy builder */}
                {showHierarchy && can('hierarchy_manage') && (
                  <div className="border-t border-gray-100 pt-4 flex flex-col gap-4">
                    <h3 className="font-semibold text-gray-700 text-sm">Add Hierarchy Level</h3>
                    <div className="flex gap-2">
                      <input placeholder="Level name (e.g. Zone)"
                        value={newLevel.name}
                        onChange={e => setNewLevel(l => ({ ...l, name: e.target.value }))}
                        className="flex-1 px-3 py-2 rounded-xl border-2 border-gray-200 text-sm focus:border-[#106f30] focus:outline-none" />
                      <input type="number" placeholder="Order" min={1}
                        value={newLevel.level_order}
                        onChange={e => setNewLevel(l => ({ ...l, level_order: parseInt(e.target.value) }))}
                        className="w-20 px-3 py-2 rounded-xl border-2 border-gray-200 text-sm focus:border-[#106f30] focus:outline-none" />
                      <button onClick={handleAddLevel}
                        className="px-4 py-2 rounded-xl text-white text-sm font-medium hover:opacity-90"
                        style={{ background: '#106f30' }}>
                        Add
                      </button>
                    </div>

                    <h3 className="font-semibold text-gray-700 text-sm">Add Hierarchy Node</h3>
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2">
                        <select value={newNode.level_id}
                          onChange={e => setNewNode(n => ({ ...n, level_id: e.target.value }))}
                          className="flex-1 px-3 py-2 rounded-xl border-2 border-gray-200 text-sm focus:border-[#106f30] focus:outline-none bg-white">
                          <option value="">Select level...</option>
                          {detail.hierarchy?.levels?.map(l => (
                            <option key={l.level_id} value={l.level_id}>{l.name}</option>
                          ))}
                        </select>
                        <select value={newNode.parent_id}
                          onChange={e => setNewNode(n => ({ ...n, parent_id: e.target.value }))}
                          className="flex-1 px-3 py-2 rounded-xl border-2 border-gray-200 text-sm focus:border-[#106f30] focus:outline-none bg-white">
                          <option value="">No parent (root)</option>
                          {detail.hierarchy?.nodes?.map(n => (
                            <option key={n.node_id} value={n.node_id}>{n.name}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex gap-2">
                        <input placeholder="Node name (e.g. North Zone)"
                          value={newNode.name}
                          onChange={e => setNewNode(n => ({ ...n, name: e.target.value }))}
                          className="flex-1 px-3 py-2 rounded-xl border-2 border-gray-200 text-sm focus:border-[#106f30] focus:outline-none" />
                        <button onClick={handleAddNode}
                          className="px-4 py-2 rounded-xl text-white text-sm font-medium hover:opacity-90"
                          style={{ background: '#106f30' }}>
                          Add Node
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}