import { useState, useEffect, useRef } from 'react'
import { usePortalAuth } from '../PortalAuthContext'
import portalApi from '../portalApi'
import toast from 'react-hot-toast'

const PRIORITY_COLORS = {
  low:      { bg: '#f0f9ff', text: '#0369a1' },
  medium:   { bg: '#fff3e0', text: '#c25a00' },
  high:     { bg: '#fce8e8', text: '#c62828' },
  critical: { bg: '#fdf2f8', text: '#86198f' },
}

const STATUS_COLORS = {
  open:               { bg: '#e0f2fe', text: '#0369a1' },
  assigned:           { bg: '#f3e8ff', text: '#6d28d9' },
  in_progress:        { bg: '#fff3e0', text: '#c25a00' },
  resolved:           { bg: '#e8f5ed', text: '#106f30' },
  closed:             { bg: '#f5f5f5', text: '#555555' },
  rejected:           { bg: '#fce8e8', text: '#c62828' },
  waiting_for_device: { bg: '#fefce8', text: '#854d0e' },
  device_received:    { bg: '#ecfdf5', text: '#065f46' },
  repaired:           { bg: '#e8f5ed', text: '#106f30' },
}

const STATUS_LABELS = {
  open:               '🔴 Open',
  assigned:           '🟣 Assigned',
  in_progress:        '🟠 In Progress',
  resolved:           '🟢 Resolved',
  closed:             '⚫ Closed',
  rejected:           '❌ Rejected',
  waiting_for_device: '🟡 Waiting for Device',
  device_received:    '📦 Device Received',
  repaired:           '🔧 Repaired',
}

const MODE_LABELS = { 1: '🔧 Field Visit', 2: '🏢 Bring to Office' }

const SOP_LABELS = {
  panel_board_checked:    'Panel board checked (no burn marks / loose wires)',
  three_phase_verified:   '3-phase power supply verified with multimeter',
  fuse_mcb_checked:       'Fuse, MCB & contactors verified — all working',
  video_recorded:         'Short video of the issue recorded',
  photos_taken:           'Geo-tagged photos with time, date & location taken',
  person_will_be_present: 'Complaint raiser will be present during service visit',
}

const COUNTRIES = [
  { code: '+91',  flag: '🇮🇳', name: 'India'        },
  { code: '+1',   flag: '🇺🇸', name: 'USA'          },
  { code: '+44',  flag: '🇬🇧', name: 'UK'           },
  { code: '+61',  flag: '🇦🇺', name: 'Australia'    },
  { code: '+971', flag: '🇦🇪', name: 'UAE'          },
  { code: '+966', flag: '🇸🇦', name: 'Saudi Arabia' },
  { code: '+65',  flag: '🇸🇬', name: 'Singapore'    },
  { code: '+60',  flag: '🇲🇾', name: 'Malaysia'     },
  { code: '+92',  flag: '🇵🇰', name: 'Pakistan'     },
  { code: '+880', flag: '🇧🇩', name: 'Bangladesh'   },
  { code: '+94',  flag: '🇱🇰', name: 'Sri Lanka'    },
  { code: '+977', flag: '🇳🇵', name: 'Nepal'        },
]

function Badge({ label, colors }) {
  return (
    <span className="px-2.5 py-1 rounded-full text-xs font-medium"
      style={{ background: colors.bg, color: colors.text }}>
      {label}
    </span>
  )
}

function Field({ label, required, hint, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-600">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400">{hint}</p>}
    </div>
  )
}

function Input({ ...props }) {
  return (
    <input {...props}
      className="px-3 py-2.5 rounded-xl border-2 border-gray-200 text-sm focus:border-[#106f30] focus:outline-none bg-white w-full" />
  )
}

function Select({ children, ...props }) {
  return (
    <select {...props}
      className="px-3 py-2.5 rounded-xl border-2 border-gray-200 text-sm focus:border-[#106f30] focus:outline-none bg-white w-full">
      {children}
    </select>
  )
}

function SearchableSelect({ options, value, onChange, placeholder, searchPlaceholder, filterFn }) {
  const [open, setOpen]       = useState(false)
  const [query, setQuery]     = useState('')

  const filtered = query.trim()
    ? options.filter(o => filterFn(o, query.trim().toLowerCase()))
    : options

  const selectedLabel = value ? options.find(o => o.value === value)?.label || value : ''

  return (
    <div style={{ position: 'relative' }}>
      <button type="button" onClick={() => { setOpen(o => !o); setQuery('') }}
        className="px-3 py-2.5 rounded-xl border-2 border-gray-200 text-sm focus:border-[#106f30] focus:outline-none bg-white w-full text-left flex items-center justify-between"
        style={{ borderColor: open ? '#106f30' : undefined }}>
        <span className={selectedLabel ? 'text-gray-800' : 'text-gray-400'}>
          {selectedLabel || placeholder}
        </span>
        <span className="text-gray-400 text-xs ml-2">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999,
          background: 'white', border: '2px solid #106f30',
          borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
          marginTop: '4px', maxHeight: '220px', display: 'flex', flexDirection: 'column'
        }}>
          <div className="p-2 border-b border-gray-100">
            <input autoFocus placeholder={searchPlaceholder}
              value={query} onChange={e => setQuery(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-[#106f30] focus:outline-none"
              onClick={e => e.stopPropagation()} />
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            <button type="button" onClick={() => { onChange(''); setOpen(false); setQuery('') }}
              className="w-full px-3 py-2 text-left text-sm text-gray-400 hover:bg-gray-50">
              {placeholder}
            </button>
            {filtered.length === 0 && (
              <p className="px-3 py-2 text-sm text-gray-400">No results found</p>
            )}
            {filtered.map(o => (
              <button key={o.value} type="button"
                onClick={() => { onChange(o.value); setOpen(false); setQuery('') }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-green-50 transition-colors"
                style={{ color: o.value === value ? '#106f30' : '#374151',
                         fontWeight: o.value === value ? 600 : 400 }}>
                {o.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function formatDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  })
}

// ── Raise Ticket Modal ────────────────────────────────────
function RaiseTicketModal({ onClose, onCreated }) {
  const { user } = usePortalAuth()
  const [step, setStep]             = useState(1)
  const [saving, setSaving]         = useState(false)
  const [uploading, setUploading]   = useState(false)
  const [categories, setCategories] = useState([])
  const [wards, setWards]           = useState([])
  const [legacyUids, setLegacyUids] = useState([])

  const [selectedCountry, setSelectedCountry] = useState(COUNTRIES[0])
  const [phoneOpen, setPhoneOpen]   = useState(false)
  const [phoneNumber, setPhoneNumber] = useState('')
  const [capturedPhoto, setCapturedPhoto] = useState(null)
  const [capturedVideo, setCapturedVideo] = useState(null)

  const [form, setForm] = useState({
    uid: '', farm_id: '', issue_category: '', priority: 'medium',
    description: '', contact_person: user?.full_name || '',
    in_warranty_period: false, location_lat: '', location_lng: '',
  })

  const [sop, setSop] = useState({
    panel_board_checked: false, three_phase_verified: false,
    fuse_mcb_checked: false, video_recorded: false,
    photos_taken: false, person_will_be_present: false,
  })

  useEffect(() => {
    portalApi.get('/portal/categories').then(r => setCategories(r.data.categories)).catch(() => {})
    portalApi.get('/portal/wards').then(r => setWards(r.data.wards || [])).catch(() => {})
    portalApi.get('/portal/uids').then(r => setLegacyUids(r.data.uids || [])).catch(() => {})
  }, [])



  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const allSopChecked = Object.values(sop).every(Boolean)
  const canProceedStep1 = form.uid && form.issue_category && form.description &&
    form.contact_person && phoneNumber && form.priority

  const handleCapture = async (file, type) => {
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await portalApi.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const localUrl = URL.createObjectURL(file)
      if (type === 'photo') {
        setCapturedPhoto({ url: res.data.url, localUrl, name: file.name })
        toast.success('Photo uploaded!')
      } else {
        setCapturedVideo({ url: res.data.url, localUrl, name: file.name, size: file.size })
        toast.success('Video uploaded!')
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed')
    } finally { setUploading(false) }
  }

  const handleSubmit = async () => {
    if (!allSopChecked) { toast.error('Complete all SOP checklist items'); return }
    if (!capturedPhoto) { toast.error('Take at least one photo'); return }
    setSaving(true)
    try {
      const res = await portalApi.post('/portal/tickets', {
        uid:                String(form.uid),
        farm_id:            null,
        issue_category:     form.issue_category,
        priority:           form.priority,
        description:        form.description,
        sop_checklist: {
          panel_board_checked:    sop.panel_board_checked    === true,
          three_phase_verified:   sop.three_phase_verified   === true,
          fuse_mcb_checked:       sop.fuse_mcb_checked       === true,
          video_recorded:         sop.video_recorded         === true,
          photos_taken:           sop.photos_taken           === true,
          person_will_be_present: sop.person_will_be_present === true,
        },
        photo_evidence:     [capturedPhoto?.url, capturedVideo?.url].filter(v => typeof v === 'string' && v.length > 0),
        contact_person:     form.contact_person,
        contact_number:     selectedCountry.code + phoneNumber,
        in_warranty_period: Boolean(form.in_warranty_period),
        location_lat:       form.location_lat ? parseFloat(form.location_lat) : null,
        location_lng:       form.location_lng ? parseFloat(form.location_lng) : null,
      })

      toast.success(`Ticket raised — ${res.data.ticket_number}`)
      onCreated()
    } catch (err) {
      const detail = err.response?.data?.detail
      const msg = typeof detail === 'string'
        ? detail
        : Array.isArray(detail)
        ? detail.map(e => e.msg).join(', ')
        : 'Failed to raise ticket'
      toast.error(msg)
    } finally { setSaving(false) }
  }

  const STEPS = ['Issue Details', 'SOP Checklist', 'Evidence & Submit']

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl max-h-[90vh] flex flex-col">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="font-semibold text-gray-800">Raise Service Ticket</h2>
            <p className="text-xs text-gray-400 mt-0.5">Step {step} of 3 — {STEPS[step - 1]}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <div className="px-5 pt-4 flex items-center gap-2 flex-shrink-0">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                ${step >= i + 1 ? 'text-white' : 'bg-gray-200 text-gray-400'}`}
                style={step >= i + 1 ? { background: '#106f30' } : {}}>
                {step > i + 1 ? '✓' : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`h-0.5 w-8 ${step > i + 1 ? 'bg-[#106f30]' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 bg-white">
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <Field label="Priority" required>
                <Select value={form.priority} onChange={e => set('priority', e.target.value)}>
                  <option value="low">🟢 Low</option>
                  <option value="medium">🟡 Medium</option>
                  <option value="high">🔴 High</option>
                  <option value="critical">🟣 Critical</option>
                </Select>
              </Field>

              <Field label="Select Ward">
                <SearchableSelect
                  value={form.farm_id}
                  onChange={v => set('farm_id', v)}
                  placeholder="— Select ward (optional) —"
                  searchPlaceholder="Search by ward name..."
                  options={wards.map(w => ({ value: w.farm_name, label: w.farm_name }))}
                  filterFn={(o, q) => o.label.toLowerCase().includes(q)}
                />
              </Field>

              <Field label="Device UID" required hint="Search by last 4 digits or full UID">
                <SearchableSelect
                  value={form.uid}
                  onChange={v => set('uid', v)}
                  placeholder="— Select Device UID —"
                  searchPlaceholder="Search last 4 digits e.g. 4521"
                  options={legacyUids.map(uid => ({ value: uid, label: uid }))}
                  filterFn={(o, q) => String(o.value).slice(-4).includes(q) || String(o.value).includes(q)}
                />
              </Field>

              <Field label="Issue Category" required>
                <Select value={form.issue_category} onChange={e => set('issue_category', e.target.value)}>
                  <option value="">— Select issue type —</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Field>

              <Field label="Description" required hint="Describe the issue in detail">
                <textarea value={form.description} onChange={e => set('description', e.target.value)}
                  placeholder="Describe the problem you are facing..."
                  rows={3}
                  className="px-3 py-2.5 rounded-xl border-2 border-gray-200 text-sm focus:border-[#106f30] focus:outline-none resize-none w-full bg-white" />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Contact Person" required>
                  <Input placeholder="Your name" value={form.contact_person}
                    onChange={e => set('contact_person', e.target.value)} />
                </Field>
                <Field label="Contact Number" required>
                  <div className="flex rounded-xl border-2 border-gray-200 focus-within:border-[#106f30] bg-white">
                    <div style={{ position: 'relative', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                      <button type="button" onClick={() => setPhoneOpen(o => !o)}
                        className="flex items-center gap-1 px-2 py-2.5 bg-gray-50 border-r border-gray-200 text-sm h-full rounded-l-xl">
                        <span style={{ fontSize: '14px' }}>{selectedCountry.flag}</span>
                        <span className="text-gray-700 text-xs">{selectedCountry.code}</span>
                        <span className="text-gray-400" style={{ fontSize: '10px' }}>▾</span>
                      </button>
                      {phoneOpen && (
                        <div style={{
                          position: 'absolute', top: '100%', left: 0, zIndex: 9999,
                          background: 'white', border: '1px solid #e5e7eb',
                          borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                          marginTop: '4px', width: '200px', maxHeight: '220px', overflowY: 'auto'
                        }}>
                          {COUNTRIES.map(c => (
                            <button key={c.name} type="button"
                              onClick={() => { setSelectedCountry(c); setPhoneOpen(false) }}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                width: '100%', padding: '8px 12px', textAlign: 'left',
                                background: selectedCountry.name === c.name ? '#f0fdf4' : 'transparent',
                                color: selectedCountry.name === c.name ? '#106f30' : '#374151',
                                fontSize: '13px', border: 'none', cursor: 'pointer',
                              }}>
                              <span style={{ fontSize: '14px' }}>{c.flag}</span>
                              <span style={{ flex: 1 }}>{c.name}</span>
                              <span style={{ color: '#9ca3af', fontSize: '11px' }}>{c.code}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <input type="tel" placeholder="98765 43210"
                      value={phoneNumber}
                      onChange={e => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                      className="flex-1 px-2 py-2.5 text-sm bg-white focus:outline-none rounded-r-xl min-w-0" />
                  </div>
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Latitude" hint="For dealer matching">
                  <Input type="number" placeholder="12.9716" value={form.location_lat}
                    onChange={e => set('location_lat', e.target.value)} />
                </Field>
                <Field label="Longitude">
                  <Input type="number" placeholder="77.5946" value={form.location_lng}
                    onChange={e => set('location_lng', e.target.value)} />
                </Field>
              </div>

              <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl cursor-pointer">
                <input type="checkbox" checked={form.in_warranty_period}
                  onChange={e => set('in_warranty_period', e.target.checked)}
                  className="w-4 h-4 accent-[#106f30]" />
                <div>
                  <p className="text-sm text-gray-700 font-medium">Device is in warranty period</p>
                  <p className="text-xs text-amber-600 mt-0.5">⚠️ Not applicable for BWSSB users</p>
                </div>
              </label>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-4">
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-amber-800 mb-1">⚠️ Important — Read Before Proceeding</p>
                <p className="text-xs text-amber-700">All steps must be completed before raising a ticket.</p>
              </div>
              <div className="flex flex-col gap-3">
                {Object.entries(SOP_LABELS).map(([key, label]) => (
                  <label key={key}
                    className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all
                      ${sop[key] ? 'border-[#106f30] bg-green-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                    <input type="checkbox" checked={sop[key]}
                      onChange={e => setSop(s => ({ ...s, [key]: e.target.checked }))}
                      className="w-4 h-4 accent-[#106f30] mt-0.5 flex-shrink-0" />
                    <span className={`text-sm ${sop[key] ? 'text-green-800 font-medium' : 'text-gray-700'}`}>
                      {label}
                    </span>
                  </label>
                ))}
              </div>
              {!allSopChecked ? (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3">
                  <p className="text-xs text-red-700 font-medium">
                    ❌ {Object.values(sop).filter(Boolean).length} of 6 completed. All 6 must be checked.
                  </p>
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                  <p className="text-xs text-green-700 font-medium">✅ All SOP items completed.</p>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-3">
                <p className="text-sm font-medium text-gray-700">
                  📸 Photo <span className="text-red-400">*</span>
                  <span className="text-xs text-gray-400 font-normal ml-2">1 live photo required</span>
                </p>
                {!capturedPhoto ? (
                  <label className={`flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed rounded-xl cursor-pointer transition-all
                    ${uploading ? 'border-gray-200 bg-gray-50 pointer-events-none' : 'border-gray-300 hover:border-[#106f30] hover:bg-green-50'}`}>
                    <span className="text-5xl">📷</span>
                    <p className="text-sm font-semibold text-gray-700">{uploading ? '⏳ Uploading...' : 'Tap to open camera'}</p>
                    {!uploading && (
                      <span className="px-4 py-2 rounded-xl text-white text-sm font-medium" style={{ background: '#106f30' }}>
                        📷 Take Photo
                      </span>
                    )}
                    <input type="file" accept="image/*" capture="environment" className="hidden"
                      disabled={uploading}
                      onChange={e => { if (e.target.files[0]) handleCapture(e.target.files[0], 'photo') }} />
                  </label>
                ) : (
                  <div className="relative rounded-xl overflow-hidden border-2 border-green-300">
                    <img src={capturedPhoto.localUrl} alt="Captured" className="w-full max-h-56 object-cover" />
                    <div className="absolute top-2 right-2 flex gap-2">
                      <label className="px-3 py-1.5 bg-white/90 rounded-lg text-xs font-medium text-gray-700 cursor-pointer">
                        🔄 Retake
                        <input type="file" accept="image/*" capture="environment" className="hidden"
                          onChange={e => { if (e.target.files[0]) handleCapture(e.target.files[0], 'photo') }} />
                      </label>
                      <button type="button" onClick={() => setCapturedPhoto(null)}
                        className="px-3 py-1.5 bg-red-500 rounded-lg text-xs font-medium text-white">✕</button>
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-3 py-2">
                      <p className="text-white text-xs font-medium">✅ Photo captured & uploaded</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Video Capture */}
              <div className="flex flex-col gap-3">
                <p className="text-sm font-medium text-gray-700">
                  🎬 Video
                  <span className="text-xs text-gray-400 font-normal ml-2">optional — up to 1 minute</span>
                </p>
                {!capturedVideo ? (
                  <label className={`flex flex-col items-center justify-center gap-3 p-6 border-2 border-dashed rounded-xl cursor-pointer transition-all
                    ${uploading ? 'border-gray-200 bg-gray-50 pointer-events-none' : 'border-gray-300 hover:border-[#106f30] hover:bg-green-50'}`}>
                    <span className="text-4xl">🎬</span>
                    <p className="text-sm font-semibold text-gray-700">{uploading ? '⏳ Uploading...' : 'Tap to record video'}</p>
                    {!uploading && (
                      <span className="px-4 py-2 rounded-xl text-sm font-medium border-2 border-[#106f30] text-[#106f30]">
                        🎬 Record Video
                      </span>
                    )}
                    <input type="file" accept="video/*" capture="environment" className="hidden"
                      disabled={uploading}
                      onChange={e => { if (e.target.files[0]) handleCapture(e.target.files[0], 'video') }} />
                  </label>
                ) : (
                  <div className="rounded-xl overflow-hidden border-2 border-green-300 bg-black">
                    <video src={capturedVideo.localUrl} controls className="w-full max-h-48" />
                    <div className="bg-white px-3 py-2 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-gray-700">✅ Video uploaded</p>
                        <p className="text-xs text-gray-400">{(capturedVideo.size / 1024 / 1024).toFixed(1)} MB</p>
                      </div>
                      <div className="flex gap-2">
                        <label className="px-3 py-1.5 bg-gray-100 rounded-lg text-xs font-medium text-gray-700 cursor-pointer">
                          🔄 Re-record
                          <input type="file" accept="video/*" capture="environment" className="hidden"
                            onChange={e => { if (e.target.files[0]) handleCapture(e.target.files[0], 'video') }} />
                        </label>
                        <button type="button" onClick={() => setCapturedVideo(null)}
                          className="px-3 py-1.5 bg-red-500 rounded-lg text-xs font-medium text-white">✕</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Review Summary</p>
                <div className="flex flex-col gap-2">
                  {[
                    ['Device UID',     form.uid || '—'],
                    ['Issue',          form.issue_category || '—'],
                    ['Priority',       form.priority],
                    ['Contact',        `${form.contact_person} — ${selectedCountry.code}${phoneNumber}`],
                    ['Under Warranty', form.in_warranty_period ? 'Yes' : 'No'],
                    ['SOP Completed',  allSopChecked ? '✅ All 6 items' : '❌ Incomplete'],
                    ['Photo',          capturedPhoto ? '✅ Captured' : '❌ Required'],
                    ['Video',          capturedVideo ? '✅ Recorded' : '— Not recorded'],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-4">
                      <span className="text-xs text-gray-400">{label}</span>
                      <span className="text-xs font-medium text-gray-700 text-right">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-5 border-t border-gray-100 flex gap-3 flex-shrink-0 bg-white">
          {step > 1 && (
            <button onClick={() => setStep(s => s - 1)}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium border-2 border-gray-200 text-gray-600 hover:bg-gray-50">
              ← Back
            </button>
          )}
          {step < 3 ? (
            <button onClick={() => {
              if (step === 1 && !canProceedStep1) { toast.error('Fill all required fields'); return }
              if (step === 2 && !allSopChecked)   { toast.error('Complete all SOP items'); return }
              setStep(s => s + 1)
            }}
              className="flex-1 py-2.5 rounded-xl text-white text-sm font-medium hover:opacity-90"
              style={{ background: '#106f30' }}>
              Next →
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={saving || uploading}
              className="flex-1 py-2.5 rounded-xl text-white text-sm font-medium hover:opacity-90 disabled:opacity-60"
              style={{ background: '#106f30' }}>
              {saving ? '⏳ Raising ticket...' : '✅ Raise Ticket'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Ticket Detail Panel ───────────────────────────────────
function TicketDetail({ ticketId, onClose, onUpdated, isAdmin }) {
  const [ticket, setTicket]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [dealers, setDealers] = useState([])
  const [statusForm, setStatusForm] = useState({
    status: '', service_mode: null, assigned_dealer_id: '',
    resolution_notes: '', device_received_at: '', device_returned_at: '',
    device_condition_in: '', device_condition_out: '', note: '',
  })

  const fetchTicket = async () => {
    setLoading(true)
    try {
      const res = await portalApi.get(`/portal/tickets/${ticketId}`)
      setTicket(res.data)
      setStatusForm(f => ({ ...f, status: res.data.status }))
      if (isAdmin && res.data.location_lat && res.data.location_lng) {
        portalApi.get(`/portal/nearby-dealers?lat=${res.data.location_lat}&lng=${res.data.location_lng}`)
          .then(r => setDealers(r.data.dealers || [])).catch(() => {})
      }
    } catch { toast.error('Failed to load ticket') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchTicket() }, [ticketId])

  const handleUpdate = async () => {
    if (!statusForm.status) { toast.error('Select a status'); return }
    setSaving(true)
    try {
      await portalApi.put(`/portal/tickets/${ticketId}`, statusForm)
      toast.success('Ticket updated')
      fetchTicket()
      onUpdated()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update')
    } finally { setSaving(false) }
  }

  const isOfficeMode = (statusForm.service_mode ?? ticket?.service_mode) === 2
  const availableStatuses = isOfficeMode
    ? ['open', 'waiting_for_device', 'device_received', 'repaired', 'closed', 'rejected']
    : ['open', 'assigned', 'in_progress', 'resolved', 'closed', 'rejected']

  const mediaBase = 'https://khcustomercare.in'
  const isImage = url => url && (url.match(/\.(jpg|jpeg|png|webp)$/i) || (url.startsWith('/uploads/') && !url.match(/\.(mp4|webm|mov)$/i)))
  const isVideo = url => url && url.match(/\.(mp4|webm|mov)$/i)

  if (loading) return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 text-center text-gray-400">Loading ticket...</div>
    </div>
  )
  if (!ticket) return null

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end lg:items-center justify-end z-50">
      <div className="bg-white w-full lg:w-[520px] h-full lg:h-full overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-white border-b border-gray-100 p-5 flex items-start justify-between z-10">
          <div>
            <p className="font-mono text-sm font-bold" style={{ color: '#106f30' }}>{ticket.ticket_number}</p>
            <p className="font-semibold text-gray-800 mt-0.5">{ticket.issue_category}</p>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge label={STATUS_LABELS[ticket.status] || ticket.status}
                colors={STATUS_COLORS[ticket.status] || STATUS_COLORS.open} />
              <Badge label={ticket.priority?.toUpperCase()}
                colors={PRIORITY_COLORS[ticket.priority] || PRIORITY_COLORS.medium} />
              <span className="text-xs text-gray-400">{MODE_LABELS[ticket.service_mode]}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl mt-1">✕</button>
        </div>

        <div className="p-5 flex flex-col gap-5">
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Ticket Information</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                ['Device UID',  ticket.uid || '—'],
                ['Ward',        ticket.ward_number ? `Ward ${ticket.ward_number}` : '—'],
                ...(isAdmin ? [['Customer', ticket.customer_name || '—']] : []),
                ['Warranty',    ticket.in_warranty_period ? '✅ In Warranty' : '❌ Out of Warranty'],
                ['Contact',     ticket.contact_person || '—'],
                ['Phone',       ticket.contact_number || '—'],
                ['Raised By',   ticket.raised_by_name || '—'],
                ['Raised On',   formatDate(ticket.created_at)],
                ['Resolved On', formatDate(ticket.resolved_date)],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-xs text-gray-400">{label}</p>
                  <p className="text-sm font-medium text-gray-700">{value}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Description</p>
            <p className="text-sm text-gray-700 bg-gray-50 rounded-xl p-3">{ticket.description}</p>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">SOP Checklist</p>
            <div className="flex flex-col gap-1.5">
              {Object.entries(SOP_LABELS).map(([key, label]) => {
                const checked = ticket.sop_checklist?.[key]
                return (
                  <div key={key} className={`flex items-start gap-2 px-3 py-2 rounded-lg text-xs
                    ${checked ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                    <span className="flex-shrink-0">{checked ? '✅' : '❌'}</span>
                    <span>{label}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {ticket.photo_evidence?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Evidence</p>
              <div className="flex flex-col gap-3">
                {ticket.photo_evidence.map((url, i) => (
                  <div key={i}>
                    {isVideo(url) ? (
                      <video src={mediaBase + url} controls className="w-full rounded-xl border border-gray-200 max-h-52" />
                    ) : isImage(url) ? (
                      <a href={mediaBase + url} target="_blank" rel="noreferrer">
                        <img src={mediaBase + url} alt={`Evidence ${i + 1}`}
                          className="w-full rounded-xl border border-gray-200 max-h-52 object-cover hover:opacity-90" />
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          )}

          {ticket.dealer_name && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4">
              <p className="text-xs font-semibold text-purple-600 uppercase tracking-wide mb-2">Assigned Dealer</p>
              <p className="text-sm font-semibold text-purple-800">{ticket.dealer_name}</p>
              <p className="text-xs text-purple-600">{ticket.dealer_code} · {ticket.dealer_phone}</p>
            </div>
          )}

          {ticket.resolution_notes && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Resolution Notes</p>
              <p className="text-sm text-gray-700 bg-green-50 border border-green-200 rounded-xl p-3">
                {ticket.resolution_notes}
              </p>
            </div>
          )}

          {ticket.ticket_notes?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Timeline</p>
              <div className="flex flex-col gap-3">
                {[...ticket.ticket_notes].reverse().map((note, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0" style={{ background: '#106f30' }} />
                      {i < ticket.ticket_notes.length - 1 && <div className="w-0.5 flex-1 bg-gray-200 mt-1" />}
                    </div>
                    <div className="pb-3">
                      <p className="text-xs font-semibold text-gray-700">{note.action}</p>
                      {note.note && <p className="text-xs text-gray-500 mt-0.5">{note.note}</p>}
                      <p className="text-xs text-gray-400 mt-1">{note.by} · {formatDate(note.timestamp)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isAdmin && (
            <div className="border-t border-gray-100 pt-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Update Ticket</p>
              <div className="flex flex-col gap-4">
                <Field label="Update Status" required>
                  <Select value={statusForm.status}
                    onChange={e => setStatusForm(f => ({ ...f, status: e.target.value }))}>
                    {availableStatuses.map(s => (
                      <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>
                    ))}
                  </Select>
                </Field>

                {(!ticket.service_mode || ticket.status === 'open') && (
                  <Field label="Service Mode" required>
                    <div className="flex gap-2">
                      {[{ v: 1, l: '🔧 Field Visit' }, { v: 2, l: '🏢 Bring to Office' }].map(opt => (
                        <button key={opt.v} type="button"
                          onClick={() => setStatusForm(f => ({ ...f, service_mode: opt.v }))}
                          className={`flex-1 py-2.5 rounded-xl text-sm font-medium border-2 transition-all
                            ${statusForm.service_mode === opt.v ? 'text-white border-transparent' : 'text-gray-600 border-gray-200'}`}
                          style={statusForm.service_mode === opt.v ? { background: '#106f30' } : {}}>
                          {opt.l}
                        </button>
                      ))}
                    </div>
                  </Field>
                )}

                {!isOfficeMode && dealers.length > 0 && (
                  <Field label="Assign Dealer" hint={`${dealers.length} dealer(s) found nearby`}>
                    <Select value={statusForm.assigned_dealer_id}
                      onChange={e => setStatusForm(f => ({ ...f, assigned_dealer_id: e.target.value }))}>
                      <option value="">— Select dealer —</option>
                      {dealers.map(d => (
                        <option key={d.dealer_id} value={d.dealer_id}>
                          {d.full_name} ({d.dealer_code}){d.distance_km ? ` — ${d.distance_km} km` : ''}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}

                <Field label="Resolution Notes">
                  <textarea value={statusForm.resolution_notes}
                    onChange={e => setStatusForm(f => ({ ...f, resolution_notes: e.target.value }))}
                    placeholder="Describe resolution..." rows={3}
                    className="px-3 py-2.5 rounded-xl border-2 border-gray-200 text-sm focus:border-[#106f30] focus:outline-none resize-none w-full" />
                </Field>

                <Field label="Internal Note">
                  <Input placeholder="Any notes for the team..."
                    value={statusForm.note}
                    onChange={e => setStatusForm(f => ({ ...f, note: e.target.value }))} />
                </Field>

                <button onClick={handleUpdate} disabled={saving}
                  className="w-full py-3 rounded-xl text-white text-sm font-medium hover:opacity-90 disabled:opacity-60"
                  style={{ background: '#106f30' }}>
                  {saving ? '⏳ Updating...' : '💾 Save Changes'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Services Page ────────────────────────────────────
export default function Services() {
  const { isAdmin } = usePortalAuth()
  const [tickets, setTickets]       = useState([])
  const [total, setTotal]           = useState(0)
  const [loading, setLoading]       = useState(true)
  const [showRaise, setShowRaise]   = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [page, setPage]             = useState(1)
  const limit = 20

  const [filterStatus,   setFilterStatus]   = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [filterMode,     setFilterMode]     = useState('')
  const [categories,     setCategories]     = useState([])

  const fetchTickets = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page, limit })
      if (!isAdmin) params.append('my', 'true')
      if (filterStatus)   params.append('status',       filterStatus)
      if (filterCategory) params.append('category',     filterCategory)
      if (filterPriority) params.append('priority',     filterPriority)
      if (filterMode)     params.append('service_mode', filterMode)
      const res = await portalApi.get(`/portal/tickets?${params}`)
      setTickets(res.data.tickets)
      setTotal(res.data.total)
    } catch { toast.error('Failed to load tickets') }
    finally { setLoading(false) }
  }

  useEffect(() => {
    portalApi.get('/portal/categories').then(r => setCategories(r.data.categories)).catch(() => {})
  }, [])

  useEffect(() => { fetchTickets() }, [page, filterStatus, filterCategory, filterPriority, filterMode])

  const totalPages = Math.ceil(total / limit)

  return (
    <div className="max-w-6xl">
      {showRaise && (
        <RaiseTicketModal
          onClose={() => setShowRaise(false)}
          onCreated={() => { setShowRaise(false); fetchTickets() }}
        />
      )}
      {selectedId && (
        <TicketDetail
          ticketId={selectedId}
          isAdmin={isAdmin}
          onClose={() => setSelectedId(null)}
          onUpdated={fetchTickets}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 style={{ fontFamily: "'DM Serif Display', serif", color: '#106f30' }} className="text-2xl">
            {isAdmin ? 'All Service Tickets' : 'My Service Tickets'}
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">{total} ticket{total !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowRaise(true)}
          className="px-4 py-2 rounded-xl text-white text-sm font-medium hover:opacity-90"
          style={{ background: '#106f30' }}>
          + Raise Ticket
        </button>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }}
          className="px-3 py-2 rounded-xl border-2 border-gray-200 text-xs bg-white focus:border-[#106f30] focus:outline-none">
          <option value="">All Statuses</option>
          {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select value={filterCategory} onChange={e => { setFilterCategory(e.target.value); setPage(1) }}
          className="px-3 py-2 rounded-xl border-2 border-gray-200 text-xs bg-white focus:border-[#106f30] focus:outline-none">
          <option value="">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterPriority} onChange={e => { setFilterPriority(e.target.value); setPage(1) }}
          className="px-3 py-2 rounded-xl border-2 border-gray-200 text-xs bg-white focus:border-[#106f30] focus:outline-none">
          <option value="">All Priorities</option>
          <option value="low">🟢 Low</option>
          <option value="medium">🟡 Medium</option>
          <option value="high">🔴 High</option>
          <option value="critical">🟣 Critical</option>
        </select>
        <select value={filterMode} onChange={e => { setFilterMode(e.target.value); setPage(1) }}
          className="px-3 py-2 rounded-xl border-2 border-gray-200 text-xs bg-white focus:border-[#106f30] focus:outline-none">
          <option value="">All Modes</option>
          <option value="1">🔧 Field Visit</option>
          <option value="2">🏢 Bring to Office</option>
        </select>
        {(filterStatus || filterCategory || filterPriority || filterMode) && (
          <button onClick={() => { setFilterStatus(''); setFilterCategory(''); setFilterPriority(''); setFilterMode(''); setPage(1) }}
            className="px-3 py-2 rounded-xl text-xs border-2 border-gray-200 text-gray-500 hover:bg-gray-50">
            ✕ Clear
          </button>
        )}
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl p-12 text-center text-gray-400 border border-gray-100 shadow-sm">
          Loading tickets...
        </div>
      ) : tickets.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100 shadow-sm">
          <p className="text-4xl mb-3">🎫</p>
          <p className="text-gray-500 text-sm font-medium">No service tickets found</p>
          <p className="text-gray-400 text-xs mt-1">Raise a ticket to get started</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {tickets.map(ticket => {
            const sc = STATUS_COLORS[ticket.status]     || STATUS_COLORS.open
            const pc = PRIORITY_COLORS[ticket.priority] || PRIORITY_COLORS.medium
            return (
              <div key={ticket.ticket_id}
                onClick={() => setSelectedId(ticket.ticket_id)}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-all cursor-pointer">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-mono text-xs font-bold" style={{ color: '#106f30' }}>
                        {ticket.ticket_number}
                      </span>
                      <Badge label={STATUS_LABELS[ticket.status] || ticket.status} colors={sc} />
                      <Badge label={ticket.priority?.toUpperCase()} colors={pc} />
                      <span className="text-xs text-gray-400">{MODE_LABELS[ticket.service_mode]}</span>
                    </div>
                    <p className="font-semibold text-gray-800 text-sm">{ticket.issue_category}</p>
                    <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{ticket.description}</p>
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      {ticket.uid && <span className="text-xs text-gray-400 font-mono">📡 {ticket.uid}</span>}
                      {ticket.ward_number && <span className="text-xs text-gray-400">🏘️ Ward {ticket.ward_number}</span>}
                      {isAdmin && ticket.customer_name && <span className="text-xs text-gray-400">🏢 {ticket.customer_name}</span>}
                      {ticket.in_warranty_period && <span className="text-xs text-green-600 font-medium">✅ In Warranty</span>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-gray-400">{formatDate(ticket.created_at)}</p>
                    {ticket.dealer_name && <p className="text-xs text-purple-600 mt-1">👤 {ticket.dealer_name}</p>}
                    <p className="text-xs text-gray-300 mt-2">View →</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-gray-500">
            Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
          </p>
          <div className="flex gap-2">
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
              className="px-3 py-1.5 rounded-xl text-xs border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
              ← Prev
            </button>
            <span className="px-3 py-1.5 text-xs text-gray-500">{page} / {totalPages}</span>
            <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
              className="px-3 py-1.5 rounded-xl text-xs border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

