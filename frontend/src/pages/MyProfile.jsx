import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import toast from 'react-hot-toast'

const CROP_TYPES = [
  'Rice', 'Wheat', 'Maize', 'Sugarcane', 'Cotton', 'Groundnut',
  'Sunflower', 'Soybean', 'Tomato', 'Onion', 'Potato', 'Banana',
  'Mango', 'Coconut', 'Arecanut', 'Turmeric', 'Chilli', 'Other',
]

const CROP_STAGES = [
  'Land Preparation', 'Sowing / Planting', 'Germination',
  'Vegetative Growth', 'Flowering', 'Fruiting / Pod Formation',
  'Maturity', 'Harvesting', 'Post Harvest',
]

export default function MyProfile() {
  const { user: authUser } = useAuth()
  const [profile, setProfile]       = useState(null)
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [activeTab, setActiveTab]   = useState('info')
  const [showPwdForm, setShowPwdForm] = useState(false)

  const [form, setForm] = useState({
    full_name: '', address: '', latitude: '', longitude: '',
    farm_size: '', crop_type: '', crop_stage: '',
  })

  const [pwdForm, setPwdForm] = useState({
    current_password: '', new_password: '', confirm_password: '',
  })
  const [showPwd, setShowPwd] = useState({ current: false, new: false, confirm: false })

  const fetchProfile = async () => {
    try {
      const res = await api.get('/profile')
      setProfile(res.data)
      setForm({
        full_name:  res.data.full_name  || '',
        address:    res.data.address    || '',
        latitude:   res.data.latitude   || '',
        longitude:  res.data.longitude  || '',
        farm_size:  res.data.farm_size  || '',
        crop_type:  res.data.crop_type  || '',
        crop_stage: res.data.crop_stage || '',
      })
    } catch { toast.error('Failed to load profile') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchProfile() }, [])

  const handleSaveInfo = async () => {
    setSaving(true)
    try {
      await api.put('/profile', {
        full_name:  form.full_name  || null,
        address:    form.address    || null,
        latitude:   form.latitude   ? parseFloat(form.latitude)  : null,
        longitude:  form.longitude  ? parseFloat(form.longitude) : null,
        farm_size:  form.farm_size  || null,
        crop_type:  form.crop_type  || null,
        crop_stage: form.crop_stage || null,
      })
      toast.success('Profile updated')
      fetchProfile()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update')
    } finally { setSaving(false) }
  }

  const handleChangePassword = async () => {
    if (pwdForm.new_password !== pwdForm.confirm_password) {
      toast.error('Passwords do not match'); return
    }
    if (pwdForm.new_password.length < 8) {
      toast.error('Minimum 8 characters'); return
    }
    setSaving(true)
    try {
      await api.post('/profile/change-password', {
        current_password: pwdForm.current_password,
        new_password:     pwdForm.new_password,
      })
      toast.success('Password changed successfully')
      setPwdForm({ current_password: '', new_password: '', confirm_password: '' })
      setShowPwdForm(false)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to change password')
    } finally { setSaving(false) }
  }

  const TABS = [
    { id: 'info',     label: 'Personal Info' },
    { id: 'farm',     label: 'Farm & Crops'  },
    { id: 'security', label: 'Security'      },
  ]

  const StatusBadge = ({ status }) => {
    const c = status === 'active'
      ? { bg: '#e8f5ed', text: '#106f30' }
      : { bg: '#fce8e8', text: '#c62828' }
    return (
      <span className="px-3 py-1 rounded-full text-xs font-medium"
        style={{ background: c.bg, color: c.text }}>
        {status?.charAt(0).toUpperCase() + status?.slice(1)}
      </span>
    )
  }

  if (loading) return <div className="p-12 text-center text-gray-400">Loading profile...</div>
  if (!profile) return null

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 style={{ fontFamily: "'DM Serif Display', serif", color: '#106f30' }} className="text-2xl">
          My Profile
        </h1>
        <p className="text-gray-500 text-sm mt-0.5">Manage your account details and preferences</p>
      </div>

      {/* Profile header card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-4">
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 rounded-full flex items-center justify-center text-white text-3xl font-bold flex-shrink-0"
            style={{ background: '#106f30' }}>
            {profile.full_name?.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-gray-800">{profile.full_name}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{profile.role?.name || '—'}</p>
            <p className="text-xs text-gray-400">{profile.customer?.cust_name} · {profile.customer?.customer_id}</p>
            <div className="flex items-center gap-3 mt-2">
              <StatusBadge status={profile.status} />
              {profile.hierarchy_node && (
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                  {profile.hierarchy_node.name}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Quick info strip */}
        <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-gray-100">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Email</p>
            <p className="text-sm text-gray-700">{profile.email || '—'}</p>
            {profile.email && (
              <span className={`text-xs ${profile.email_verified ? 'text-green-600' : 'text-amber-600'}`}>
                {profile.email_verified ? '✅ Verified' : '⚠ Not verified'}
              </span>
            )}
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Phone</p>
            <p className="text-sm text-gray-700">{profile.phone || '—'}</p>
            {profile.phone && (
              <span className={`text-xs ${profile.phone_verified ? 'text-green-600' : 'text-amber-600'}`}>
                {profile.phone_verified ? '✅ Verified' : '⚠ Not verified'}
              </span>
            )}
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Last Login</p>
            <p className="text-sm text-gray-700">
              {profile.last_login_at
                ? new Date(profile.last_login_at).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })
                : 'Never'}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="flex border-b border-gray-100">
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`flex-1 py-3 text-sm font-medium transition-all border-b-2
                ${activeTab === tab.id ? 'border-[#106f30] text-[#106f30]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">

          {/* ── Personal Info ────────────────────────── */}
          {activeTab === 'info' && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Full Name</label>
                <input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                  placeholder="Your full name"
                  className="px-3 py-2.5 rounded-xl border-2 border-gray-200 text-sm focus:border-[#106f30] focus:outline-none" />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Address</label>
                <textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                  placeholder="Your address..."
                  rows={2}
                  className="px-3 py-2.5 rounded-xl border-2 border-gray-200 text-sm focus:border-[#106f30] focus:outline-none resize-none" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-600">Latitude</label>
                  <input type="number" value={form.latitude} onChange={e => setForm(f => ({ ...f, latitude: e.target.value }))}
                    placeholder="12.9716"
                    className="px-3 py-2.5 rounded-xl border-2 border-gray-200 text-sm focus:border-[#106f30] focus:outline-none" />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-gray-600">Longitude</label>
                  <input type="number" value={form.longitude} onChange={e => setForm(f => ({ ...f, longitude: e.target.value }))}
                    placeholder="77.5946"
                    className="px-3 py-2.5 rounded-xl border-2 border-gray-200 text-sm focus:border-[#106f30] focus:outline-none" />
                </div>
              </div>

              <button onClick={handleSaveInfo} disabled={saving}
                className="py-2.5 rounded-xl text-white text-sm font-medium hover:opacity-90 disabled:opacity-60 mt-2"
                style={{ background: '#106f30' }}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}

          {/* ── Farm & Crops ─────────────────────────── */}
          {activeTab === 'farm' && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Farm Size</label>
                <input value={form.farm_size} onChange={e => setForm(f => ({ ...f, farm_size: e.target.value }))}
                  placeholder="e.g. 2 acres, 5 hectares"
                  className="px-3 py-2.5 rounded-xl border-2 border-gray-200 text-sm focus:border-[#106f30] focus:outline-none" />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Crop Type</label>
                <select value={form.crop_type} onChange={e => setForm(f => ({ ...f, crop_type: e.target.value }))}
                  className="px-3 py-2.5 rounded-xl border-2 border-gray-200 text-sm focus:border-[#106f30] focus:outline-none bg-white">
                  <option value="">Select crop type...</option>
                  {CROP_TYPES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-600">Crop Stage</label>
                <select value={form.crop_stage} onChange={e => setForm(f => ({ ...f, crop_stage: e.target.value }))}
                  className="px-3 py-2.5 rounded-xl border-2 border-gray-200 text-sm focus:border-[#106f30] focus:outline-none bg-white">
                  <option value="">Select crop stage...</option>
                  {CROP_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <button onClick={handleSaveInfo} disabled={saving}
                className="py-2.5 rounded-xl text-white text-sm font-medium hover:opacity-90 disabled:opacity-60 mt-2"
                style={{ background: '#106f30' }}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}

          {/* ── Security ─────────────────────────────── */}
          {activeTab === 'security' && (
            <div className="flex flex-col gap-5">
              {/* Account status */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div>
                  <p className="text-sm font-medium text-gray-700">Account Status</p>
                  <p className="text-xs text-gray-400 mt-0.5">Your current account status on the platform</p>
                </div>
                <StatusBadge status={profile.status} />
              </div>

              {/* Verification status */}
              <div className="flex flex-col gap-2">
                {profile.email && (
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Email</p>
                      <p className="text-xs text-gray-400">{profile.email}</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${profile.email_verified ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {profile.email_verified ? '✅ Verified' : '⚠ Not verified'}
                    </span>
                  </div>
                )}
                {profile.phone && (
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <div>
                      <p className="text-sm font-medium text-gray-700">Phone</p>
                      <p className="text-xs text-gray-400">{profile.phone}</p>
                    </div>
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${profile.phone_verified ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {profile.phone_verified ? '✅ Verified' : '⚠ Not verified'}
                    </span>
                  </div>
                )}
              </div>

              {/* Change password */}
              <div className="border-t border-gray-100 pt-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Password</p>
                    <p className="text-xs text-gray-400">Change your account password</p>
                  </div>
                  <button onClick={() => setShowPwdForm(!showPwdForm)}
                    className="px-4 py-2 rounded-xl text-sm font-medium border-2 border-gray-200 text-gray-600 hover:bg-gray-50">
                    {showPwdForm ? 'Cancel' : '🔑 Change Password'}
                  </button>
                </div>

                {showPwdForm && (
                  <div className="flex flex-col gap-3 p-4 bg-gray-50 rounded-xl">
                    {[
                      { key: 'current_password', label: 'Current Password' },
                      { key: 'new_password',     label: 'New Password'     },
                      { key: 'confirm_password', label: 'Confirm Password' },
                    ].map(f => (
                      <div key={f.key} className="flex flex-col gap-1">
                        <label className="text-xs font-medium text-gray-600">{f.label}</label>
                        <div className="relative">
                          <input
                            type={showPwd[f.key] ? 'text' : 'password'}
                            value={pwdForm[f.key]}
                            onChange={e => setPwdForm(p => ({ ...p, [f.key]: e.target.value }))}
                            placeholder="••••••••"
                            className="w-full px-3 py-2.5 rounded-xl border-2 border-gray-200 text-sm focus:border-[#106f30] focus:outline-none pr-10" />
                          <button type="button"
                            onClick={() => setShowPwd(p => ({ ...p, [f.key]: !p[f.key] }))}
                            className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600 text-xs">
                            {showPwd[f.key] ? '🙈' : '👁'}
                          </button>
                        </div>
                      </div>
                    ))}
                    <button onClick={handleChangePassword} disabled={saving}
                      className="py-2.5 rounded-xl text-white text-sm font-medium hover:opacity-90 disabled:opacity-60"
                      style={{ background: '#106f30' }}>
                      {saving ? 'Changing...' : 'Change Password'}
                    </button>
                  </div>
                )}
              </div>

              {/* Account info */}
              <div className="border-t border-gray-100 pt-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">Account Information</p>
                <div className="flex flex-col gap-2">
                  {[
                    ['User ID', profile.user_id],
                    ['Role', profile.role?.name || '—'],
                    ['Customer', `${profile.customer?.cust_name} (${profile.customer?.customer_id})`],
                    ['Member Since', new Date(profile.created_at).toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' })],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-4 py-1">
                      <span className="text-xs text-gray-400">{label}</span>
                      <span className="text-xs text-gray-700 font-medium text-right truncate max-w-xs">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
