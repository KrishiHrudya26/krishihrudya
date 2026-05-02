import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import toast from 'react-hot-toast'

const TEST_STATUS_COLORS = {
  passed:  { bg: '#e8f5ed', text: '#106f30' },
  failed:  { bg: '#fce8e8', text: '#c62828' },
  pending: { bg: '#fff3e0', text: '#c25a00' },
}

const STATUS_COLORS = {
  active:   { bg: '#e8f5ed', text: '#106f30' },
  inactive: { bg: '#f5f5f5', text: '#555'    },
}

function Badge({ label, colors }) {
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: colors.bg, color: colors.text }}>
      {label}
    </span>
  )
}

// ── CATEGORIES VIEW ───────────────────────────────────────
function CategoriesView({ can }) {
  const [cats, setCats]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm]         = useState({ name: '', description: '', image: '' })
  const [saving, setSaving]     = useState(false)

  const fetch = async () => {
    setLoading(true)
    try {
      const res = await api.get('/products/categories')
      setCats(res.data.categories)
    } catch { toast.error('Failed to load categories') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetch() }, [])

  const openCreate = () => { setEditItem(null); setForm({ name: '', description: '', image: '' }); setShowModal(true) }
  const openEdit   = (c)  => { setEditItem(c); setForm({ name: c.name, description: c.description || '', image: c.image || '' }); setShowModal(true) }

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name required'); return }
    setSaving(true)
    try {
      if (editItem) {
        await api.put(`/products/categories/${editItem.cat_id}`, form)
        toast.success('Category updated')
      } else {
        await api.post('/products/categories', form)
        toast.success('Category created')
      }
      setShowModal(false); fetch()
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed') }
    finally { setSaving(false) }
  }

  const handleToggle = async (c) => {
    try {
      await api.put(`/products/categories/${c.cat_id}`, { status: c.status === 'active' ? 'inactive' : 'active' })
      toast.success('Status updated'); fetch()
    } catch { toast.error('Failed') }
  }

  const handleDelete = async (c) => {
    if (!confirm(`Delete "${c.name}"?`)) return
    try {
      await api.delete(`/products/categories/${c.cat_id}`)
      toast.success('Deleted'); fetch()
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed') }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{cats.length} categories</p>
        {can('categories_manage') && (
          <button onClick={openCreate}
            className="px-4 py-2 rounded-xl text-white text-sm font-medium hover:opacity-90"
            style={{ background: '#106f30' }}>
            + New Category
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead style={{ background: '#106f30' }}>
            <tr>
              {['Cat ID', 'Name', 'Image', 'Description', 'Status', 'Action'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-white font-medium text-xs">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-10 text-gray-400">Loading...</td></tr>
            ) : cats.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-10 text-gray-400">No categories yet</td></tr>
            ) : cats.map((c, i) => (
              <tr key={c.cat_id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{c.cat_id.slice(0, 8)}...</td>
                <td className="px-4 py-3 font-medium text-gray-800">{c.name}</td>
                <td className="px-4 py-3">
                  {c.image
                    ? <img src={c.image} alt="" className="w-8 h-8 rounded-lg object-cover" />
                    : <span className="text-gray-300 text-xs">—</span>}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">{c.description || '—'}</td>
                <td className="px-4 py-3">
                  <Badge label={c.status} colors={STATUS_COLORS[c.status] || STATUS_COLORS.inactive} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(c)}
                      className="px-2 py-1 rounded-lg text-xs border border-gray-200 hover:bg-gray-50">
                      Edit
                    </button>
                    <button onClick={() => handleToggle(c)}
                      className={`px-2 py-1 rounded-lg text-xs border ${c.status === 'active' ? 'border-amber-200 text-amber-700 hover:bg-amber-50' : 'border-green-200 text-green-700 hover:bg-green-50'}`}>
                      {c.status === 'active' ? 'Deactivate' : 'Activate'}
                    </button>
                    <button onClick={() => handleDelete(c)}
                      className="px-2 py-1 rounded-lg text-xs border border-red-200 text-red-600 hover:bg-red-50">
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-gray-800">{editItem ? 'Edit Category' : 'New Category'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="flex flex-col gap-4">
              {[['Name *', 'name', 'text'], ['Image URL', 'image', 'text']].map(([label, key, type]) => (
                <div key={key} className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-600">{label}</label>
                  <input type={type} value={form[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="px-3 py-2.5 rounded-xl border-2 border-gray-200 text-sm focus:border-[#106f30] focus:outline-none" />
                </div>
              ))}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Description</label>
                <textarea value={form.description} rows={2}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="px-3 py-2.5 rounded-xl border-2 border-gray-200 text-sm focus:border-[#106f30] focus:outline-none resize-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm border-2 border-gray-200 text-gray-600 hover:bg-gray-50">
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 py-2.5 rounded-xl text-white text-sm font-medium hover:opacity-90 disabled:opacity-60"
                  style={{ background: '#106f30' }}>
                  {saving ? 'Saving...' : editItem ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── SUB-CATEGORIES VIEW ───────────────────────────────────
function SubCategoriesView({ can }) {
  const [subs, setSubs]         = useState([])
  const [cats, setCats]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState(null)
  const [form, setForm]         = useState({ cat_id: '', name: '', description: '', image: '' })
  const [saving, setSaving]     = useState(false)
  const [filterCat, setFilterCat] = useState('')

  const fetchAll = async () => {
    setLoading(true)
    try {
      const [subsRes, catsRes] = await Promise.all([
        api.get('/products/sub-categories' + (filterCat ? `?cat_id=${filterCat}` : '')),
        api.get('/products/categories'),
      ])
      setSubs(subsRes.data.sub_categories)
      setCats(catsRes.data.categories)
    } catch { toast.error('Failed to load') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchAll() }, [filterCat])

  const openCreate = () => { setEditItem(null); setForm({ cat_id: '', name: '', description: '', image: '' }); setShowModal(true) }
  const openEdit   = (s) => { setEditItem(s); setForm({ cat_id: s.cat_id, name: s.name, description: s.description || '', image: s.image || '' }); setShowModal(true) }

  const handleSave = async () => {
    if (!form.name.trim() || !form.cat_id) { toast.error('Category and name required'); return }
    setSaving(true)
    try {
      if (editItem) {
        await api.put(`/products/sub-categories/${editItem.sbcat_id}`, form)
        toast.success('Sub-category updated')
      } else {
        await api.post('/products/sub-categories', form)
        toast.success('Sub-category created')
      }
      setShowModal(false); fetchAll()
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed') }
    finally { setSaving(false) }
  }

  const handleToggle = async (s) => {
    try {
      await api.put(`/products/sub-categories/${s.sbcat_id}`, { status: s.status === 'active' ? 'inactive' : 'active' })
      toast.success('Status updated'); fetchAll()
    } catch { toast.error('Failed') }
  }

  const handleDelete = async (s) => {
    if (!confirm(`Delete "${s.name}"?`)) return
    try {
      await api.delete(`/products/sub-categories/${s.sbcat_id}`)
      toast.success('Deleted'); fetchAll()
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed') }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <p className="text-sm text-gray-500">{subs.length} sub-categories</p>
          <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
            className="px-3 py-1.5 rounded-xl border-2 border-gray-200 text-xs focus:border-[#106f30] focus:outline-none bg-white">
            <option value="">All Categories</option>
            {cats.map(c => <option key={c.cat_id} value={c.cat_id}>{c.name}</option>)}
          </select>
        </div>
        {can('categories_manage') && (
          <button onClick={openCreate}
            className="px-4 py-2 rounded-xl text-white text-sm font-medium hover:opacity-90"
            style={{ background: '#106f30' }}>
            + New Sub-Category
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead style={{ background: '#106f30' }}>
            <tr>
              {['SubCat ID', 'Category', 'Name', 'Image', 'Description', 'Status', 'Action'].map(h => (
                <th key={h} className="text-left px-4 py-3 text-white font-medium text-xs">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-10 text-gray-400">Loading...</td></tr>
            ) : subs.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-10 text-gray-400">No sub-categories yet</td></tr>
            ) : subs.map((s, i) => (
              <tr key={s.sbcat_id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-4 py-3 font-mono text-xs text-gray-500">{s.sbcat_id.slice(0, 8)}...</td>
                <td className="px-4 py-3 text-gray-600 text-xs">{s.cat_name}</td>
                <td className="px-4 py-3 font-medium text-gray-800">{s.name}</td>
                <td className="px-4 py-3">
                  {s.image
                    ? <img src={s.image} alt="" className="w-8 h-8 rounded-lg object-cover" />
                    : <span className="text-gray-300 text-xs">—</span>}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">{s.description || '—'}</td>
                <td className="px-4 py-3">
                  <Badge label={s.status} colors={STATUS_COLORS[s.status] || STATUS_COLORS.inactive} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(s)}
                      className="px-2 py-1 rounded-lg text-xs border border-gray-200 hover:bg-gray-50">Edit</button>
                    <button onClick={() => handleToggle(s)}
                      className={`px-2 py-1 rounded-lg text-xs border ${s.status === 'active' ? 'border-amber-200 text-amber-700' : 'border-green-200 text-green-700'}`}>
                      {s.status === 'active' ? 'Deactivate' : 'Activate'}
                    </button>
                    <button onClick={() => handleDelete(s)}
                      className="px-2 py-1 rounded-lg text-xs border border-red-200 text-red-600 hover:bg-red-50">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-gray-800">{editItem ? 'Edit Sub-Category' : 'New Sub-Category'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Category *</label>
                <select value={form.cat_id} onChange={e => setForm(f => ({ ...f, cat_id: e.target.value }))}
                  className="px-3 py-2.5 rounded-xl border-2 border-gray-200 text-sm focus:border-[#106f30] focus:outline-none bg-white">
                  <option value="">Select category...</option>
                  {cats.map(c => <option key={c.cat_id} value={c.cat_id}>{c.name}</option>)}
                </select>
              </div>
              {[['Name *', 'name'], ['Image URL', 'image']].map(([label, key]) => (
                <div key={key} className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-600">{label}</label>
                  <input value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    className="px-3 py-2.5 rounded-xl border-2 border-gray-200 text-sm focus:border-[#106f30] focus:outline-none" />
                </div>
              ))}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Description</label>
                <textarea value={form.description} rows={2}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="px-3 py-2.5 rounded-xl border-2 border-gray-200 text-sm focus:border-[#106f30] focus:outline-none resize-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-xl text-sm border-2 border-gray-200 text-gray-600 hover:bg-gray-50">Cancel</button>
                <button onClick={handleSave} disabled={saving}
                  className="flex-1 py-2.5 rounded-xl text-white text-sm font-medium hover:opacity-90 disabled:opacity-60"
                  style={{ background: '#106f30' }}>
                  {saving ? 'Saving...' : editItem ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── PRODUCTS VIEW ─────────────────────────────────────────
function ProductsView({ can }) {
  const [products, setProducts]   = useState([])
  const [total, setTotal]         = useState(0)
  const [loading, setLoading]     = useState(true)
  const [search, setSearch]       = useState('')
  const [filterStatus, setFilterStatus]     = useState('')
  const [filterTest, setFilterTest]         = useState('')
  const [page, setPage]           = useState(1)
  const limit = 15

  // Create panel
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState({
    uid: '', product_name: '', serial_number: '',
    category_name: '', sub_category_name: '',
    manufactured_date: '', price: '', warranty: '',
  })
  const [cats, setCats]   = useState([])
  const [subs, setSubs]   = useState([])
  const [saving, setSaving] = useState(false)

  // Test status panel
  const [selectedUid, setSelectedUid]     = useState(null)
  const [testForm, setTestForm]           = useState({ test_status: '', test_remarks: '' })
  const [updatingTest, setUpdatingTest]   = useState(false)

  const fetchProducts = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page, limit })
      if (search)       params.append('search', search)
      if (filterStatus) params.append('status', filterStatus)
      if (filterTest)   params.append('test_status', filterTest)
      const res = await api.get(`/products?${params}`)
      setProducts(res.data.products)
      setTotal(res.data.total)
    } catch { toast.error('Failed to load products') }
    finally { setLoading(false) }
  }

  const fetchCats = async () => {
    try {
      const res = await api.get('/products/categories')
      setCats(res.data.categories)
    } catch {}
  }

  useEffect(() => { fetchProducts() }, [page, search, filterStatus, filterTest])
  useEffect(() => { fetchCats() }, [])

  const handleCategoryChange = async (catName) => {
    setCreateForm(f => ({ ...f, category_name: catName, sub_category_name: '' }))
    const cat = cats.find(c => c.name === catName)
    if (cat) {
      try {
        const res = await api.get(`/products/sub-categories?cat_id=${cat.cat_id}`)
        setSubs(res.data.sub_categories)
      } catch {}
    } else {
      setSubs([])
    }
  }

  const handleCreate = async () => {
    if (!createForm.uid || createForm.uid.length !== 15 || !/^\d+$/.test(createForm.uid)) {
      toast.error('UID must be exactly 15 digits'); return
    }
    if (!createForm.product_name.trim()) { toast.error('Product name required'); return }
    setSaving(true)
    try {
      await api.post('/products', {
        ...createForm,
        price:    createForm.price    ? parseFloat(createForm.price)   : null,
        warranty: createForm.warranty ? parseInt(createForm.warranty)   : null,
        manufactured_date: createForm.manufactured_date || null,
      })
      toast.success('Product created')
      setShowCreate(false)
      setCreateForm({ uid:'', product_name:'', serial_number:'', category_name:'', sub_category_name:'', manufactured_date:'', price:'', warranty:'' })
      fetchProducts()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create')
    } finally { setSaving(false) }
  }

  const handleTestStatusUpdate = async () => {
    if (!testForm.test_status) { toast.error('Select test status'); return }
    setUpdatingTest(true)
    try {
      await api.put(`/products/${selectedUid}/test-status`, testForm)
      toast.success('Test status updated')
      setSelectedUid(null)
      setTestForm({ test_status: '', test_remarks: '' })
      fetchProducts()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed')
    } finally { setUpdatingTest(false) }
  }

  const handleRemoveInstallation = async (uid) => {
    if (!confirm('Remove installation? Device will be unassigned.')) return
    try {
      await api.delete(`/products/${uid}/installation`)
      toast.success('Installation removed')
      fetchProducts()
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed') }
  }

  const handleDelete = async (uid) => {
    if (!confirm('Delete this product? This cannot be undone.')) return
    try {
      await api.delete(`/products/${uid}`)
      toast.success('Product deleted')
      fetchProducts()
    } catch (err) { toast.error(err.response?.data?.detail || 'Failed') }
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="flex gap-4">
      {/* Left — main table */}
      <div className="flex-1 min-w-0">
        {/* Filters */}
        <div className="flex gap-3 mb-4">
          <input placeholder="Search UID, name or serial..."
            value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
            className="flex-1 px-4 py-2 rounded-xl border-2 border-gray-200 focus:border-[#106f30] text-sm bg-white focus:outline-none" />
          <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }}
            className="px-3 py-2 rounded-xl border-2 border-gray-200 text-sm bg-white focus:border-[#106f30] focus:outline-none">
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <select value={filterTest} onChange={e => { setFilterTest(e.target.value); setPage(1) }}
            className="px-3 py-2 rounded-xl border-2 border-gray-200 text-sm bg-white focus:border-[#106f30] focus:outline-none">
            <option value="">All Test Status</option>
            <option value="passed">Passed</option>
            <option value="failed">Failed</option>
            <option value="pending">Pending</option>
          </select>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full text-xs">
            <thead style={{ background: '#106f30' }}>
              <tr>
                {['UID', 'Product', 'Serial No.', 'Manf. Date', 'Test Status', 'Assign Status', 'Assigned To', 'Installed On', 'Device Status', 'Action'].map(h => (
                  <th key={h} className="text-left px-3 py-3 text-white font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="text-center py-10 text-gray-400">Loading...</td></tr>
              ) : products.length === 0 ? (
                <tr><td colSpan={10} className="text-center py-10 text-gray-400">No products found</td></tr>
              ) : products.map((p, i) => (
                <tr key={p.uid} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-3 py-2.5 font-mono font-medium" style={{ color: '#106f30' }}>{p.uid}</td>
                  <td className="px-3 py-2.5 font-medium text-gray-800 whitespace-nowrap">{p.product_name}</td>
                  <td className="px-3 py-2.5 text-gray-500">{p.serial_number || '—'}</td>
                  <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{p.manufactured_date || '—'}</td>
                  <td className="px-3 py-2.5">
                    <Badge label={p.test_status}
                      colors={TEST_STATUS_COLORS[p.test_status] || TEST_STATUS_COLORS.pending} />
                  </td>
                  <td className="px-3 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.is_assigned ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                      {p.is_assigned ? 'Assigned' : 'Unassigned'}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{p.assigned_to || '—'}</td>
                  <td className="px-3 py-2.5 text-gray-500 whitespace-nowrap">{p.installed_on || '—'}</td>
                  <td className="px-3 py-2.5">
                    <Badge label={p.status} colors={STATUS_COLORS[p.status] || STATUS_COLORS.inactive} />
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex gap-1 flex-wrap">
                      <button
                        onClick={() => { setSelectedUid(p.uid); setTestForm({ test_status: p.test_status || '', test_remarks: p.test_remarks || '' }) }}
                        className="px-2 py-1 rounded-lg text-xs border border-gray-200 hover:bg-gray-50 whitespace-nowrap">
                        ⚙️ Settings
                      </button>
                      {p.is_assigned && can('installations_manage') && (
                        <button onClick={() => handleRemoveInstallation(p.uid)}
                          className="px-2 py-1 rounded-lg text-xs border border-amber-200 text-amber-700 hover:bg-amber-50 whitespace-nowrap">
                          🔌 Remove
                        </button>
                      )}
                      {can('products_add') && (
                        <button onClick={() => handleDelete(p.uid)}
                          className="px-2 py-1 rounded-lg text-xs border border-red-200 text-red-600 hover:bg-red-50">
                          🗑️
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <p className="text-xs text-gray-500">{(page-1)*limit+1}–{Math.min(page*limit,total)} of {total}</p>
              <div className="flex gap-2">
                <button disabled={page===1} onClick={() => setPage(p=>p-1)}
                  className="px-3 py-1 rounded-lg text-xs border border-gray-200 disabled:opacity-40">← Prev</button>
                <span className="px-2 py-1 text-xs text-gray-500">{page}/{totalPages}</span>
                <button disabled={page===totalPages} onClick={() => setPage(p=>p+1)}
                  className="px-3 py-1 rounded-lg text-xs border border-gray-200 disabled:opacity-40">Next →</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right — action panel */}
      <div className="w-72 flex-shrink-0 flex flex-col gap-4">

        {/* Create product */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <button onClick={() => setShowCreate(!showCreate)}
            className="w-full px-4 py-3 text-left font-semibold text-sm flex items-center justify-between"
            style={{ background: '#106f30', color: 'white' }}>
            <span>+ Create Product</span>
            <span>{showCreate ? '▲' : '▼'}</span>
          </button>

          {showCreate && (
            <div className="p-4 flex flex-col gap-3">
              {[
                { key: 'uid',               label: 'UID (15 digits) *', type: 'text',   maxLength: 15 },
                { key: 'product_name',      label: 'Product Name *',    type: 'text'                  },
                { key: 'serial_number',     label: 'Serial Number',     type: 'text'                  },
                { key: 'manufactured_date', label: 'Manf. Date',        type: 'date'                  },
                { key: 'price',             label: 'Price (₹)',          type: 'number'                },
                { key: 'warranty',          label: 'Warranty (months)',  type: 'number'                },
              ].map(f => (
                <div key={f.key} className="flex flex-col gap-0.5">
                  <label className="text-xs font-medium text-gray-600">{f.label}</label>
                  <input type={f.type} maxLength={f.maxLength}
                    value={createForm[f.key]}
                    onChange={e => setCreateForm(cf => ({ ...cf, [f.key]: e.target.value }))}
                    className="px-3 py-2 rounded-xl border-2 border-gray-200 text-sm focus:border-[#106f30] focus:outline-none" />
                </div>
              ))}

              <div className="flex flex-col gap-0.5">
                <label className="text-xs font-medium text-gray-600">Category</label>
                <select value={createForm.category_name}
                  onChange={e => handleCategoryChange(e.target.value)}
                  className="px-3 py-2 rounded-xl border-2 border-gray-200 text-sm focus:border-[#106f30] focus:outline-none bg-white">
                  <option value="">Select...</option>
                  {cats.map(c => <option key={c.cat_id} value={c.name}>{c.name}</option>)}
                </select>
              </div>

              {subs.length > 0 && (
                <div className="flex flex-col gap-0.5">
                  <label className="text-xs font-medium text-gray-600">Sub-Category</label>
                  <select value={createForm.sub_category_name}
                    onChange={e => setCreateForm(cf => ({ ...cf, sub_category_name: e.target.value }))}
                    className="px-3 py-2 rounded-xl border-2 border-gray-200 text-sm focus:border-[#106f30] focus:outline-none bg-white">
                    <option value="">Select...</option>
                    {subs.map(s => <option key={s.sbcat_id} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
              )}

              <button onClick={handleCreate} disabled={saving}
                className="w-full py-2.5 rounded-xl text-white text-sm font-medium hover:opacity-90 disabled:opacity-60"
                style={{ background: '#106f30' }}>
                {saving ? 'Creating...' : 'Create Product'}
              </button>
            </div>
          )}
        </div>

        {/* Test status update */}
        {selectedUid && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="font-semibold text-sm text-gray-800">Update Test Status</p>
              <button onClick={() => setSelectedUid(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <p className="text-xs text-gray-400 font-mono mb-3">UID: {selectedUid}</p>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Test Status *</label>
                <select value={testForm.test_status}
                  onChange={e => setTestForm(f => ({ ...f, test_status: e.target.value }))}
                  className="px-3 py-2 rounded-xl border-2 border-gray-200 text-sm focus:border-[#106f30] focus:outline-none bg-white">
                  <option value="">Select status...</option>
                  <option value="passed">✅ Test Passed</option>
                  <option value="failed">❌ Test Failed</option>
                  <option value="pending">⏳ Pending</option>
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Test Remarks</label>
                <textarea value={testForm.test_remarks} rows={2}
                  onChange={e => setTestForm(f => ({ ...f, test_remarks: e.target.value }))}
                  placeholder="Optional remarks..."
                  className="px-3 py-2 rounded-xl border-2 border-gray-200 text-sm focus:border-[#106f30] focus:outline-none resize-none" />
              </div>
              <button onClick={handleTestStatusUpdate} disabled={updatingTest}
                className="w-full py-2.5 rounded-xl text-white text-sm font-medium hover:opacity-90 disabled:opacity-60"
                style={{ background: '#106f30' }}>
                {updatingTest ? 'Updating...' : 'Update Status'}
              </button>
            </div>
          </div>
        )}

        {/* Stats summary */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <p className="font-semibold text-sm text-gray-800 mb-3">Quick Stats</p>
          <div className="flex flex-col gap-2">
            <div className="flex justify-between text-xs">
              <span className="text-gray-400">Total shown</span>
              <span className="font-medium text-gray-700">{total}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── MAIN Products Page ────────────────────────────────────
export default function Products() {
  const { can }           = useAuth()
  const [view, setView]   = useState('products')

  const VIEWS = [
    { id: 'products',       label: '📦 Products'       },
    { id: 'categories',     label: '🗂️ Categories'     },
    { id: 'sub-categories', label: '📁 Sub-Categories' },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 style={{ fontFamily: "'DM Serif Display', serif", color: '#106f30' }} className="text-2xl">
          Products
        </h1>
        <div className="flex gap-2">
          {VIEWS.map(v => (
            <button key={v.id} onClick={() => setView(v.id)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border-2
                ${view === v.id ? 'text-white border-transparent' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
              style={view === v.id ? { background: '#106f30' } : {}}>
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {view === 'products'       && <ProductsView can={can} />}
      {view === 'categories'     && <CategoriesView can={can} />}
      {view === 'sub-categories' && <SubCategoriesView can={can} />}
    </div>
  )
}
