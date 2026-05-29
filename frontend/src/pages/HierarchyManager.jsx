import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import toast from 'react-hot-toast'

export default function HierarchyManager() {
  const { can }                   = useAuth()
  const [customers, setCustomers] = useState([])
  const [selected, setSelected]   = useState(null)
  const [detail, setDetail]       = useState(null)
  const [loading, setLoading]     = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [newLevel, setNewLevel]   = useState({ name: '', level_order: 1 })
  const [newNode, setNewNode]     = useState({ level_id: '', parent_id: '', name: '' })
  const [search, setSearch]       = useState('')

  const fetchCustomers = async () => {
    setLoading(true)
    try {
      const res = await api.get('/customers?limit=100')
      setCustomers(res.data.customers.filter(c => c.hierarchy_required))
    } catch {
      toast.error('Failed to load customers')
    } finally {
      setLoading(false)
    }
  }

  const loadDetail = async (custId) => {
    setSelected(custId)
    setDetailLoading(true)
    try {
      const res = await api.get(`/customers/${custId}`)
      setDetail(res.data)
      setNewLevel({ name: '', level_order: (res.data.hierarchy?.levels?.length || 0) + 1 })
      setNewNode({ level_id: '', parent_id: '', name: '' })
    } catch {
      toast.error('Failed to load hierarchy')
    } finally {
      setDetailLoading(false)
    }
  }

  useEffect(() => { fetchCustomers() }, [])

  const handleAddLevel = async () => {
    if (!newLevel.name.trim()) { toast.error('Level name required'); return }
    try {
      await api.post(`/customers/${selected}/hierarchy/levels`, newLevel)
      toast.success('Level added')
      loadDetail(selected)
    } catch {
      toast.error('Failed to add level')
    }
  }

  const handleAddNode = async () => {
    if (!newNode.name.trim() || !newNode.level_id) { toast.error('Select level and enter name'); return }
    try {
      await api.post(`/customers/${selected}/hierarchy/nodes`, {
        ...newNode,
        parent_id: newNode.parent_id || null,
      })
      toast.success('Node added')
      loadDetail(selected)
    } catch {
      toast.error('Failed to add node')
    }
  }

  const handleDeleteLevel = async (levelId, levelName) => {
    if (!confirm(`Delete level "${levelName}"? All nodes under it will also be removed.`)) return
    try {
      await api.delete(`/customers/${selected}/hierarchy/levels/${levelId}`)
      toast.success('Level deleted')
      loadDetail(selected)
    } catch {
      toast.error('Failed to delete level')
    }
  }

  const handleDeleteNode = async (nodeId, nodeName) => {
    if (!confirm(`Delete node "${nodeName}"?`)) return
    try {
      await api.delete(`/customers/${selected}/hierarchy/nodes/${nodeId}`)
      toast.success('Node deleted')
      loadDetail(selected)
    } catch {
      toast.error('Failed to delete node')
    }
  }

  const filtered = customers.filter(c =>
    c.cust_name.toLowerCase().includes(search.toLowerCase()) ||
    c.customer_id.toLowerCase().includes(search.toLowerCase())
  )

  const getChildNodes = (nodeId) =>
    detail?.hierarchy?.nodes?.filter(n => n.parent_id === nodeId) || []

  const getRootNodes = (levelId) =>
    detail?.hierarchy?.nodes?.filter(n => n.level_id === levelId && !n.parent_id) || []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Mobile: stack vertically. Desktop: side by side */}
      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>

      {/* Left — Customer list */}
      <div style={{ width: '100%', maxWidth: '260px', flexShrink: 0 }}>
        <h1 style={{ fontFamily: "'DM Serif Display', serif", color: '#106f30', fontSize: '24px', marginBottom: '16px' }}>
          Hierarchy
        </h1>
        <input placeholder="Search customers..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 text-sm mb-3 focus:border-[#106f30] focus:outline-none bg-white" />
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {loading ? (
            <div className="p-6 text-center text-gray-400 text-sm">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-gray-400 text-sm">No customers with hierarchy</div>
          ) : filtered.map(c => (
            <button key={c.cust_id}
              onClick={() => loadDetail(c.cust_id)}
              className={`w-full text-left px-4 py-3 border-b border-gray-50 transition-all
                ${selected === c.cust_id
                  ? 'bg-green-50 border-l-4 border-l-[#106f30]'
                  : 'hover:bg-gray-50'
                }`}>
              <p className={`text-sm font-medium ${selected === c.cust_id ? 'text-[#106f30]' : 'text-gray-800'}`}>
                {c.cust_name}
              </p>
              <p className="text-xs text-gray-400 font-mono mt-0.5">{c.customer_id}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Right — Hierarchy editor */}
      <div style={{ flex: 1, minWidth: 0, minWidth: '280px' }}>
      {selected ? (
          detailLoading ? (
            <div className="p-12 text-center text-gray-400">Loading hierarchy...</div>
          ) : detail && (
            <>
              <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">{detail.cust_name}</h2>
                  <p className="text-sm text-gray-400 font-mono">{detail.customer_id}</p>
                </div>
                <div className="flex gap-2 text-sm text-gray-500">
                  <span>{detail.hierarchy?.levels?.length || 0} levels</span>
                  <span>·</span>
                  <span>{detail.hierarchy?.nodes?.length || 0} nodes</span>
                </div>
              </div>

              {/* Hierarchy tree view */}
              <div className="flex flex-col gap-4 mb-6">
                {detail.hierarchy?.levels?.length === 0 ? (
                  <div className="bg-white rounded-2xl p-8 text-center border border-gray-100 text-gray-400 text-sm">
                    No hierarchy defined yet. Add your first level below.
                  </div>
                ) : detail.hierarchy?.levels?.map(level => (
                  <div key={level.level_id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100"
                      style={{ background: '#f9fdf5' }}>
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 rounded-full text-xs flex items-center justify-center text-white font-bold"
                          style={{ background: '#106f30' }}>
                          {level.level_order}
                        </span>
                        <p className="font-semibold text-gray-700 text-sm">{level.name}</p>
                      </div>
                      {can('hierarchy_manage') && (
                        <button onClick={() => handleDeleteLevel(level.level_id, level.name)}
                          className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded-lg hover:bg-red-50">
                          Delete level
                        </button>
                      )}
                    </div>
                    <div className="p-4">
                      {detail.hierarchy?.nodes?.filter(n => n.level_id === level.level_id).length === 0 ? (
                        <p className="text-xs text-gray-400 italic">No nodes yet</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {detail.hierarchy?.nodes?.filter(n => n.level_id === level.level_id).map(node => {
                            const parent = node.parent_id
                              ? detail.hierarchy?.nodes?.find(n2 => n2.node_id === node.parent_id)
                              : null
                            return (
                              <div key={node.node_id}
                                className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
                                {parent && (
                                  <span className="text-xs text-gray-400">{parent.name} →</span>
                                )}
                                <span className="text-sm text-gray-700 font-medium">{node.name}</span>
                                {can('hierarchy_manage') && (
                                  <button onClick={() => handleDeleteNode(node.node_id, node.name)}
                                    className="text-red-400 hover:text-red-600 text-xs ml-1">✕</button>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Add new level */}
              {can('hierarchy_manage') && (
                <div className="flex flex-col gap-4">
                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                    <h3 className="font-semibold text-gray-700 text-sm mb-3">Add Hierarchy Level</h3>
                    <div className="flex flex-col gap-2">
                      <input placeholder="Level name (e.g. Zone, Division, Ward)"
                        value={newLevel.name}
                        onChange={e => setNewLevel(l => ({ ...l, name: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 text-sm focus:border-[#106f30] focus:outline-none" />
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Order:</span>
                        <input type="number" min={1} value={newLevel.level_order}
                          onChange={e => setNewLevel(l => ({ ...l, level_order: parseInt(e.target.value) || 1 }))}
                          className="w-20 px-2 py-2 rounded-xl border-2 border-gray-200 text-sm focus:border-[#106f30] focus:outline-none" />
                        <button onClick={handleAddLevel}
                          className="flex-1 px-4 py-2 rounded-xl text-white text-sm font-medium hover:opacity-90"
                          style={{ background: '#106f30' }}>
                          Add Level
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
                    <h3 className="font-semibold text-gray-700 text-sm mb-3">Add Node</h3>
                    <div className="flex flex-col gap-2">
                      <select value={newNode.level_id}
                        onChange={e => setNewNode(n => ({ ...n, level_id: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 text-sm focus:border-[#106f30] focus:outline-none bg-white">
                        <option value="">Select level *</option>
                        {detail.hierarchy?.levels?.map(l => (
                          <option key={l.level_id} value={l.level_id}>{l.name}</option>
                        ))}
                      </select>
                      <select value={newNode.parent_id}
                        onChange={e => setNewNode(n => ({ ...n, parent_id: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 text-sm focus:border-[#106f30] focus:outline-none bg-white">
                        <option value="">No parent (root node)</option>
                        {detail.hierarchy?.nodes?.map(n => (
                          <option key={n.node_id} value={n.node_id}>{n.name}</option>
                        ))}
                      </select>
                      <input placeholder="Node name *"
                        value={newNode.name}
                        onChange={e => setNewNode(n => ({ ...n, name: e.target.value }))}
                        className="w-full px-3 py-2 rounded-xl border-2 border-gray-200 text-sm focus:border-[#106f30] focus:outline-none" />
                      <button onClick={handleAddNode}
                        className="w-full px-4 py-2 rounded-xl text-white text-sm font-medium hover:opacity-90"
                        style={{ background: '#106f30' }}>
                        Add Node
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )
      ) : (
        <div className="flex items-center justify-center text-gray-400 py-16">
          <div className="text-center">
            <p className="text-4xl mb-3">🌿</p>
            <p className="text-sm">Select a customer to view and edit its hierarchy</p>
          </div>
        </div>
      )}
      </div>
      </div>
    </div>
  )
}