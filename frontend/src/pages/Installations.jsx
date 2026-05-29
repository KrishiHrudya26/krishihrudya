import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import toast from 'react-hot-toast'

// ── Constants ─────────────────────────────────────────────

const STATUS_COLORS = {
  draft:     { bg: '#f5f5f5', text: '#555',     label: '📝 Draft'     },
  submitted: { bg: '#e3f2fd', text: '#1565c0',  label: '📤 Submitted' },
  verified:  { bg: '#e8f5ed', text: '#106f30',  label: '✅ Verified'  },
}

const COUNTRIES = [
  { code: '+91', flag: '🇮🇳', name: 'India'     },
  { code: '+1',  flag: '🇺🇸', name: 'USA'       },
  { code: '+44', flag: '🇬🇧', name: 'UK'        },
  { code: '+61', flag: '🇦🇺', name: 'Australia' },
]

const PHOTO_SLOTS = [
  { key: 'imei',         label: 'IMEI on Device',          icon: '🔢', hint: 'Photo of IMEI label on the device' },
  { key: 'running_amps', label: 'Running Amps on Device',  icon: '⚡', hint: 'Photo of current reading on display' },
  { key: 'installation', label: 'Device Installation',     icon: '📦', hint: 'Photo of the installed device' },
  { key: 'flowmeter',    label: 'Flowmeter Installation',  icon: '💧', hint: 'Photo of the flowmeter (if installed)' },
]

function formatDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ── Reusable Field ────────────────────────────────────────

function Field({ label, required, hint, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <label style={{ fontSize: '12px', fontWeight: 600, color: '#4b5563' }}>
        {label}{required && <span style={{ color: '#ef4444', marginLeft: '2px' }}>*</span>}
      </label>
      {children}
      {hint && <p style={{ fontSize: '11px', color: '#9ca3af' }}>{hint}</p>}
    </div>
  )
}

function Input({ style, ...props }) {
  return (
    <input {...props}
      style={{
        padding: '10px 12px', borderRadius: '10px', border: '2px solid #e5e7eb',
        fontSize: '13px', outline: 'none', width: '100%', boxSizing: 'border-box',
        background: 'white', transition: 'border-color 0.2s',
        ...style,
      }}
      onFocus={e => e.target.style.borderColor = '#106f30'}
      onBlur={e => e.target.style.borderColor = '#e5e7eb'}
    />
  )
}

function Textarea({ ...props }) {
  return (
    <textarea {...props}
      style={{
        padding: '10px 12px', borderRadius: '10px', border: '2px solid #e5e7eb',
        fontSize: '13px', outline: 'none', width: '100%', boxSizing: 'border-box',
        background: 'white', resize: 'vertical', minHeight: '80px',
      }}
      onFocus={e => e.target.style.borderColor = '#106f30'}
      onBlur={e => e.target.style.borderColor = '#e5e7eb'}
    />
  )
}

// ── Phone Input with Country Code ─────────────────────────

function PhoneField({ value, onChange }) {
  const [country,  setCountry]  = useState(COUNTRIES[0])
  const [open,     setOpen]     = useState(false)

  const numberOnly = value.startsWith(country.code)
    ? value.slice(country.code.length)
    : value

  return (
    <div style={{ display: 'flex', borderRadius: '10px', border: '2px solid #e5e7eb',
      overflow: 'hidden', transition: 'border-color 0.2s' }}
      onFocus={e => e.currentTarget.style.borderColor = '#106f30'}
      onBlur={e => e.currentTarget.style.borderColor = '#e5e7eb'}>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <button type="button" onClick={() => setOpen(!open)}
          style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '10px 10px',
            background: '#f9fafb', borderRight: '2px solid #e5e7eb', cursor: 'pointer',
            border: 'none', fontSize: '13px', height: '100%' }}>
          <span>{country.flag}</span>
          <span style={{ color: '#4b5563', fontSize: '12px' }}>{country.code}</span>
          <span style={{ color: '#9ca3af', fontSize: '10px' }}>▾</span>
        </button>
        {open && (
          <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 50,
            background: 'white', border: '1px solid #e5e7eb', borderRadius: '10px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)', width: '180px', marginTop: '4px' }}>
            {COUNTRIES.map(c => (
              <button key={c.code} type="button"
                onClick={() => { setCountry(c); setOpen(false); onChange(c.code + numberOnly) }}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                  padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '13px', textAlign: 'left' }}
                onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                <span>{c.flag}</span>
                <span style={{ color: '#374151' }}>{c.name}</span>
                <span style={{ marginLeft: 'auto', color: '#9ca3af', fontSize: '11px' }}>{c.code}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <input type="tel" placeholder="98765 43210"
        value={numberOnly}
        onChange={e => onChange(country.code + e.target.value.replace(/\D/g, ''))}
        style={{ flex: 1, padding: '10px 12px', border: 'none', outline: 'none',
          fontSize: '13px', background: 'white', minWidth: 0 }} />
    </div>
  )
}

// ── GPS Hook ─────────────────────────────────────────────

function useGPS() {
  const [gps, setGps]       = useState(null)  // { lat, lng }
  const [gpsStatus, setGpsStatus] = useState('idle')  // idle | requesting | granted | denied

  const requestGPS = () => {
    if (!navigator.geolocation) {
      setGpsStatus('denied')
      return Promise.reject('Geolocation not supported')
    }
    setGpsStatus('requesting')
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        pos => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude }
          setGps(coords)
          setGpsStatus('granted')
          resolve(coords)
        },
        err => {
          setGpsStatus('denied')
          reject(err)
        },
        { enableHighAccuracy: true, timeout: 10000 }
      )
    })
  }

  return { gps, gpsStatus, requestGPS }
}

// ── Photo Capture Button ──────────────────────────────────

function PhotoCapture({ slot, photoData, onCapture, uid, gps, requestGPS, uploading }) {
  const fileRef = useRef(null)

  const handleFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    // GPS already captured before camera opened — pass it along
    const coords = gps || null
    onCapture(slot.key, file, coords)
    e.target.value = ''
  }

  const handleClick = async () => {
    // Try GPS but never block camera regardless of result
    if (!gps) {
      requestGPS().catch(() => {})
    }
    // Always open camera immediately
    fileRef.current?.click()
  }

  const hasPhoto = !!photoData?.url
  const isUploading = uploading === slot.key

  return (
    <div style={{
      border: `2px dashed ${hasPhoto ? '#106f30' : '#d1d5db'}`,
      borderRadius: '14px',
      padding: '16px',
      background: hasPhoto ? '#f0fdf4' : '#fafafa',
      display: 'flex', flexDirection: 'column', gap: '10px',
      transition: 'all 0.2s', position: 'relative',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '20px' }}>{slot.icon}</span>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: '13px', fontWeight: 600,
            color: hasPhoto ? '#106f30' : '#374151', margin: 0 }}>
            {slot.label}
          </p>
          <p style={{ fontSize: '11px', color: '#9ca3af', margin: 0 }}>{slot.hint}</p>
        </div>
        {hasPhoto && (
          <span style={{ fontSize: '18px' }}>✅</span>
        )}
      </div>

      {/* Preview */}
      {hasPhoto && (
        <div style={{ position: 'relative' }}>
          <img
            src={`http://187.127.139.240/api${photoData.url}`}
            alt={slot.label}
            style={{ width: '100%', height: '140px', objectFit: 'cover',
              borderRadius: '8px', border: '1px solid #bbf7d0' }}
            onError={e => { e.target.style.display = 'none' }}
          />
          {photoData.lat && (
            <div style={{ position: 'absolute', bottom: '6px', left: '6px',
              background: 'rgba(0,0,0,0.65)', borderRadius: '6px',
              padding: '3px 7px', fontSize: '10px', color: 'white' }}>
              📍 {photoData.lat.toFixed(4)}, {photoData.lng.toFixed(4)}
            </div>
          )}
        </div>
      )}

      {/* GPS info */}
      {hasPhoto && photoData.lat && (
        <p style={{ fontSize: '10px', color: '#6b7280', margin: 0 }}>
          📍 Lat: {photoData.lat.toFixed(6)} · Lng: {photoData.lng.toFixed(6)}
          {photoData.at && ` · ${formatDate(photoData.at)}`}
        </p>
      )}
      {hasPhoto && !photoData.lat && (
        <p style={{ fontSize: '10px', color: '#f59e0b', margin: 0 }}>
          ⚠️ No GPS data for this photo
        </p>
      )}

      {/* Capture / Replace button */}
      <input ref={fileRef} type="file"
        accept="image/jpeg,image/jpg,image/png"
        capture="environment"
        onChange={handleFileChange}
        style={{ display: 'none' }} />

      <button type="button"
        onClick={handleClick}
        disabled={isUploading}
        style={{
          padding: '10px', borderRadius: '10px', border: 'none', cursor: 'pointer',
          fontSize: '13px', fontWeight: 600, transition: 'all 0.2s',
          background: hasPhoto ? 'white' : '#106f30',
          color: hasPhoto ? '#106f30' : 'white',
          border: hasPhoto ? '2px solid #106f30' : 'none',
          opacity: isUploading ? 0.6 : 1,
        }}>
        {isUploading ? '⏳ Uploading...' : hasPhoto ? '🔄 Replace Photo' : '📷 Capture Photo'}
      </button>
    </div>
  )
}


// ── Installation Form Modal ───────────────────────────────

function InstallationForm({ existing, onClose, onSaved }) {
  const { user } = useAuth()
  const { gps, gpsStatus, requestGPS } = useGPS()
  const [saving,    setSaving]    = useState(false)
  const [uploading, setUploading] = useState(null)
  const [countryOpen, setCountryOpen] = useState(false)

  const [form, setForm] = useState({
    uid:                existing?.uid            || '',
    rr_number:          existing?.rr_number      || '',
    borewell_depth:     existing?.borewell_depth || '',
    motor_hp:           existing?.motor_hp       || '',
    address:            existing?.address        || '',
    waterman_name:      existing?.waterman_name  || '',
    waterman_phone:     existing?.waterman_phone || '',
    flow_meter_present: existing?.flow_meter_present ?? null,
    latitude:           existing?.latitude       || '',
    longitude:          existing?.longitude      || '',
  })

  const [photos, setPhotos] = useState({
    imei:         { url: existing?.photo_imei,         lat: existing?.photo_imei_lat,         lng: existing?.photo_imei_lng,         at: existing?.photo_imei_at         },
    running_amps: { url: existing?.photo_running_amps, lat: existing?.photo_running_amps_lat, lng: existing?.photo_running_amps_lng, at: existing?.photo_running_amps_at },
    installation: { url: existing?.photo_installation, lat: existing?.photo_installation_lat, lng: existing?.photo_installation_lng, at: existing?.photo_installation_at },
    flowmeter:    { url: existing?.photo_flowmeter,    lat: existing?.photo_flowmeter_lat,    lng: existing?.photo_flowmeter_lng,    at: existing?.photo_flowmeter_at    },
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Auto-fill lat/lng when GPS obtained
  useEffect(() => {
    if (gps && !form.latitude && !form.longitude) {
      setForm(f => ({
        ...f,
        latitude:  gps.lat.toFixed(8),
        longitude: gps.lng.toFixed(8),
      }))
    }
  }, [gps])

  // Request GPS on button click — NOT on mount
  // GPS is mandatory, so we ask before opening camera
  const handlePhotoCapture = async (photoKey, file, coords) => {
    if (!form.uid) {
      toast.error('Enter Device UID before capturing photos')
      return
    }

    setUploading(photoKey)
    try {
      const fd = new FormData()
      fd.append('file',       file)
      fd.append('photo_type', photoKey)
      fd.append('uid',        form.uid)
      if (coords) {
        fd.append('lat', coords.lat)
        fd.append('lng', coords.lng)
      }

      const res = await api.post('/installations/upload-photo', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      setPhotos(p => ({
        ...p,
        [photoKey]: {
          url: res.data.url,
          lat: coords?.lat || null,
          lng: coords?.lng || null,
          at:  res.data.uploaded_at,
        }
      }))
      toast.success(`${photoKey.replace('_', ' ')} photo uploaded`)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Upload failed')
    } finally { setUploading(null) }
  }

  const photosComplete = PHOTO_SLOTS.filter(s => s.key !== 'flowmeter' || form.flow_meter_present)
    .every(s => !!photos[s.key]?.url)
  const handleSave = async (status = 'draft') => {
    if (!form.uid) { toast.error('Device UID is required'); return }
    if (status === 'submitted' && !photosComplete) {
      toast.error('Please capture all required photos before submitting')
      return
    }

    setSaving(true)
    try {
      const payload = {
        uid:                form.uid,
        rr_number:          form.rr_number || null,
        borewell_depth:     form.borewell_depth ? parseFloat(form.borewell_depth) : null,
        motor_hp:           form.motor_hp ? parseInt(form.motor_hp) : null,
        address:            form.address || null,
        waterman_name:      form.waterman_name || null,
        waterman_phone:     form.waterman_phone || null,
        flow_meter_present: form.flow_meter_present,
        latitude:           form.latitude ? parseFloat(form.latitude) : null,
        longitude:          form.longitude ? parseFloat(form.longitude) : null,
        status,
        // Photos
        photo_imei:             photos.imei?.url         || null,
        photo_imei_lat:         photos.imei?.lat         || null,
        photo_imei_lng:         photos.imei?.lng         || null,
        photo_imei_at:          photos.imei?.at          || null,
        photo_running_amps:     photos.running_amps?.url || null,
        photo_running_amps_lat: photos.running_amps?.lat || null,
        photo_running_amps_lng: photos.running_amps?.lng || null,
        photo_running_amps_at:  photos.running_amps?.at  || null,
        photo_installation:     photos.installation?.url || null,
        photo_installation_lat: photos.installation?.lat || null,
        photo_installation_lng: photos.installation?.lng || null,
        photo_installation_at:  photos.installation?.at  || null,
        photo_flowmeter:        photos.flowmeter?.url    || null,
        photo_flowmeter_lat:    photos.flowmeter?.lat    || null,
        photo_flowmeter_lng:    photos.flowmeter?.lng    || null,
        photo_flowmeter_at:     photos.flowmeter?.at     || null,
      }

      if (existing?.detail_id) {
        await api.put(`/installations/${existing.detail_id}`, payload)
        toast.success('Installation updated')
      } else {
        await api.post('/installations', payload)
        toast.success(status === 'submitted' ? 'Installation submitted for review' : 'Draft saved')
      }
      onSaved()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save')
    } finally { setSaving(false) }
  }

  const gpsColor = { idle: '#9ca3af', requesting: '#f59e0b', granted: '#106f30', denied: '#ef4444' }[gpsStatus]
  const gpsLabel = { 
    idle:       '📍 GPS will be requested when you capture a photo', 
    requesting: '📍 Requesting GPS location...', 
    granted:    `📍 GPS ready · ${gps?.lat?.toFixed(4)}, ${gps?.lng?.toFixed(4)}`, 
    denied:     '⚠️ GPS denied — allow location in browser settings and retry' 
  }[gpsStatus]

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      zIndex: 50, display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      padding: '16px', overflowY: 'auto' }}>
      <div style={{ background: 'white', borderRadius: '20px', width: '100%',
        maxWidth: '600px', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        marginTop: '16px', marginBottom: '16px' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #f0f0f0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#111' }}>
              {existing ? 'Edit Installation' : 'New Installation'}
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#9ca3af' }}>
              Fill all details and capture photos at the installation site
            </p>
          </div>
          <button onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer',
              color: '#9ca3af', fontSize: '22px', lineHeight: 1 }}>✕</button>
        </div>

        {/* GPS status bar */}
        <div style={{ padding: '10px 24px', background: '#f9fafb',
          borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%',
            background: gpsColor, flexShrink: 0, display: 'inline-block' }} />
          <span style={{ fontSize: '12px', color: gpsColor, fontWeight: 500 }}>{gpsLabel}</span>
          {gpsStatus === 'denied' && (
            <button onClick={() => requestGPS().catch(() => {})}
              style={{ marginLeft: 'auto', fontSize: '11px', color: '#1565c0',
                background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
              Retry GPS
            </button>
          )}
        </div>

        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* ── Device & Farm ── */}
          <div>
            <p style={{ fontSize: '11px', fontWeight: 700, color: '#9ca3af',
              textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
              Device Information
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <Field label="Device UID (IMEI)" required
                hint="🔗 Legacy DB connection coming soon — enter manually for now">
                <Input placeholder="Enter 15-digit device UID / IMEI"
                  value={form.uid}
                  onChange={e => set('uid', e.target.value.replace(/\D/g, '').slice(0, 15))}
                  maxLength={15} />
              </Field>
              <Field label="Farm"
                hint="🔗 Legacy DB connection coming soon — enter farm name manually for now">
                <Input placeholder="Enter farm name or ID"
                  value={form.farm_name || ''}
                  onChange={e => setForm(f => ({ ...f, farm_name: e.target.value }))} />
              </Field>
            </div>
          </div>

          {/* ── Installation Details ── */}
          <div>
            <p style={{ fontSize: '11px', fontWeight: 700, color: '#9ca3af',
              textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
              Installation Details
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>

              <Field label="RR Number">
                <Input placeholder="e.g. RR/2024/12345"
                  value={form.rr_number}
                  onChange={e => set('rr_number', e.target.value)} />
              </Field>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Field label="Borewell Depth" hint="in metres">
                  <Input type="number" placeholder="e.g. 120"
                    value={form.borewell_depth}
                    onChange={e => set('borewell_depth', e.target.value)} />
                </Field>
                <Field label="Motor HP">
                  <Input type="number" placeholder="e.g. 5"
                    value={form.motor_hp}
                    onChange={e => set('motor_hp', e.target.value)} />
                </Field>
              </div>

              <Field label="Address" required>
                <Textarea placeholder="Full installation address..."
                  value={form.address}
                  onChange={e => set('address', e.target.value)} />
              </Field>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Field label="Latitude"
                  hint={gpsStatus === 'granted' ? '📍 Auto-filled from GPS' : 'Auto-filled when GPS allowed'}>
                  <div style={{ position: 'relative' }}>
                    <Input
                      type="number"
                      placeholder="e.g. 12.971599"
                      value={form.latitude}
                      onChange={e => set('latitude', e.target.value)}
                      style={{ paddingRight: gpsStatus === 'requesting' ? '36px' : '12px' }}
                    />
                    {gpsStatus === 'requesting' && (
                      <span style={{ position: 'absolute', right: '10px', top: '50%',
                        transform: 'translateY(-50%)', fontSize: '14px' }}>⏳</span>
                    )}
                  </div>
                </Field>
                <Field label="Longitude"
                  hint={gpsStatus === 'granted' ? '📍 Auto-filled from GPS' : 'Auto-filled when GPS allowed'}>
                  <div style={{ position: 'relative' }}>
                    <Input
                      type="number"
                      placeholder="e.g. 77.594566"
                      value={form.longitude}
                      onChange={e => set('longitude', e.target.value)}
                      style={{ paddingRight: gpsStatus === 'requesting' ? '36px' : '12px' }}
                    />
                    {gpsStatus === 'requesting' && (
                      <span style={{ position: 'absolute', right: '10px', top: '50%',
                        transform: 'translateY(-50%)', fontSize: '14px' }}>⏳</span>
                    )}
                  </div>
                </Field>
              </div>

              {gpsStatus !== 'granted' && (
                <button type="button" onClick={() => requestGPS().catch(() => {})}
                  style={{ padding: '10px', borderRadius: '10px', border: '2px solid #e5e7eb',
                    background: '#f9fafb', color: '#374151', fontSize: '13px',
                    cursor: 'pointer', fontWeight: 500, textAlign: 'center' }}>
                  📍 {gpsStatus === 'requesting' ? 'Getting location...' : 'Get My Location'}
                </button>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Field label="Waterman Name">
                  <Input placeholder="Waterman's full name"
                    value={form.waterman_name}
                    onChange={e => set('waterman_name', e.target.value)} />
                </Field>
                <Field label="Waterman Phone">
                  <PhoneField
                    value={form.waterman_phone}
                    onChange={v => set('waterman_phone', v)} />
                </Field>
              </div>

              {/* Flow meter toggle */}
              <Field label="Flow Meter Present?" required>
                <div style={{ display: 'flex', gap: '10px' }}>
                  {[{ v: true, l: '✅ Yes' }, { v: false, l: '❌ No' }].map(opt => (
                    <button key={String(opt.v)} type="button"
                      onClick={() => set('flow_meter_present', opt.v)}
                      style={{
                        flex: 1, padding: '10px', borderRadius: '10px',
                        border: '2px solid',
                        borderColor: form.flow_meter_present === opt.v ? '#106f30' : '#e5e7eb',
                        background: form.flow_meter_present === opt.v ? '#e8f5ed' : 'white',
                        color: form.flow_meter_present === opt.v ? '#106f30' : '#6b7280',
                        fontWeight: 600, fontSize: '13px', cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}>
                      {opt.l}
                    </button>
                  ))}
                </div>
              </Field>
            </div>
          </div>

          {/* ── Photo Capture ── */}
          <div>
            <p style={{ fontSize: '11px', fontWeight: 700, color: '#9ca3af',
              textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
              Photo Evidence
            </p>
            <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '12px' }}>
              All photos must be taken at the installation site. GPS coordinates are captured automatically with each photo.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {PHOTO_SLOTS.map(slot => (
                <PhotoCapture
                  key={slot.key}
                  slot={slot}
                  photoData={photos[slot.key]}
                  onCapture={handlePhotoCapture}
                  uid={form.uid}
                  gps={gps}
                  requestGPS={requestGPS}
                  uploading={uploading}
                />
              ))}
            </div>

            {/* Photos completion status */}
            <div style={{ marginTop: '12px', padding: '10px 14px',
              background: photosComplete ? '#e8f5ed' : '#fff3e0',
              borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>{photosComplete ? '✅' : '⏳'}</span>
              <span style={{ fontSize: '12px',
                color: photosComplete ? '#106f30' : '#c25a00', fontWeight: 500 }}>
                {PHOTO_SLOTS.filter(s => photos[s.key]?.url).length} of {PHOTO_SLOTS.length} photos captured
                {!photosComplete && ' — capture all before submitting'}
              </span>
            </div>
          </div>

          {/* ── Action Buttons ── */}
          <div style={{ display: 'flex', gap: '10px', paddingTop: '8px',
            borderTop: '1px solid #f0f0f0' }}>
            <button onClick={() => handleSave('draft')} disabled={saving}
              style={{ flex: 1, padding: '12px', borderRadius: '12px',
                border: '2px solid #e5e7eb', background: 'white', color: '#374151',
                fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                opacity: saving ? 0.6 : 1 }}>
              {saving ? '⏳ Saving...' : '💾 Save Draft'}
            </button>
            <button onClick={() => handleSave('submitted')} disabled={saving}
              style={{ flex: 1, padding: '12px', borderRadius: '12px',
                border: 'none', background: '#106f30', color: 'white',
                fontSize: '14px', fontWeight: 600, cursor: 'pointer',
                opacity: saving ? 0.6 : 1 }}>
              {saving ? '⏳ Submitting...' : '📤 Submit'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}


// ── Installation Detail View ──────────────────────────────

function InstallationDetail({ record, onClose, onEdit, isAdmin }) {
  const sc = STATUS_COLORS[record.status] || STATUS_COLORS.draft
  const [verifying, setVerifying] = useState(false)

  const handleVerify = async () => {
    setVerifying(true)
    try {
      await api.put(`/installations/${record.detail_id}`, { status: 'verified' })
      toast.success('Installation verified')
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to verify')
    } finally { setVerifying(false) }
  }

  const InfoRow = ({ label, value }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px',
      paddingBottom: '10px', borderBottom: '1px solid #f5f5f5' }}>
      <span style={{ fontSize: '12px', color: '#9ca3af', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: '12px', color: '#374151', fontWeight: 500, textAlign: 'right' }}>{value || '—'}</span>
    </div>
  )

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      zIndex: 50, display: 'flex', justifyContent: 'flex-end' }}>
      <div style={{ width: '100%', maxWidth: '480px', background: 'white',
        height: '100%', overflowY: 'auto', boxShadow: '-4px 0 24px rgba(0,0,0,0.15)' }}>

        {/* Header */}
        <div style={{ padding: '20px', borderBottom: '1px solid #f0f0f0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          position: 'sticky', top: 0, background: 'white', zIndex: 10 }}>
          <div>
            <p style={{ fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase',
              letterSpacing: '0.05em', marginBottom: '4px' }}>Installation Detail</p>
            <p style={{ fontWeight: 700, color: '#111', fontSize: '15px',
              fontFamily: 'monospace', margin: 0 }}>{record.uid}</p>
            <div style={{ marginTop: '6px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px',
                fontWeight: 600, background: sc.bg, color: sc.text }}>
                {sc.label}
              </span>
              {record.flow_meter_present && (
                <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11px',
                  background: '#e3f2fd', color: '#1565c0' }}>💧 Flow Meter</span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {record.status !== 'verified' && (
              <button onClick={() => onEdit(record)}
                style={{ padding: '6px 12px', borderRadius: '8px', border: '2px solid #e5e7eb',
                  background: 'white', color: '#374151', fontSize: '12px', cursor: 'pointer' }}>
                ✏️ Edit
              </button>
            )}
            <button onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer',
                color: '#9ca3af', fontSize: '22px' }}>✕</button>
          </div>
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Details */}
          <div>
            <p style={{ fontSize: '11px', fontWeight: 700, color: '#9ca3af',
              textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
              Installation Details
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <InfoRow label="Device UID"      value={record.uid} />
              <InfoRow label="RR Number"       value={record.rr_number} />
              <InfoRow label="Borewell Depth"  value={record.borewell_depth ? `${record.borewell_depth} m` : null} />
              <InfoRow label="Motor HP"        value={record.motor_hp ? `${record.motor_hp} HP` : null} />
              <InfoRow label="Address"         value={record.address} />
              <InfoRow label="Waterman"        value={record.waterman_name} />
              <InfoRow label="Waterman Phone"  value={record.waterman_phone} />
              <InfoRow label="Flow Meter"      value={record.flow_meter_present === true ? 'Yes' : record.flow_meter_present === false ? 'No' : '—'} />
              <InfoRow label="Submitted By"    value={record.submitted_by_name} />
              <InfoRow label="Submitted On"    value={formatDate(record.created_at)} />
            </div>
          </div>

          {/* Photos */}
          <div>
            <p style={{ fontSize: '11px', fontWeight: 700, color: '#9ca3af',
              textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
              Photo Evidence
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {PHOTO_SLOTS.map(slot => {
                const url = record[`photo_${slot.key}`]
                const lat = record[`photo_${slot.key}_lat`]
                const lng = record[`photo_${slot.key}_lng`]
                const at  = record[`photo_${slot.key}_at`]
                return (
                  <div key={slot.key} style={{
                    border: `2px solid ${url ? '#bbf7d0' : '#e5e7eb'}`,
                    borderRadius: '12px', overflow: 'hidden',
                    background: url ? '#f0fdf4' : '#fafafa',
                  }}>
                    <div style={{ padding: '8px 10px', display: 'flex',
                      alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '14px' }}>{slot.icon}</span>
                      <span style={{ fontSize: '11px', fontWeight: 600,
                        color: url ? '#106f30' : '#9ca3af' }}>
                        {slot.label}
                      </span>
                    </div>
                    {url ? (
                      <>
                        <a href={`http://187.127.139.240/api${url}`} target="_blank" rel="noreferrer">
                          <img src={`http://187.127.139.240/api${url}`}
                            alt={slot.label}
                            style={{ width: '100%', height: '100px', objectFit: 'cover',
                              display: 'block' }} />
                        </a>
                        {lat && (
                          <p style={{ fontSize: '9px', color: '#6b7280', padding: '4px 8px', margin: 0 }}>
                            📍 {lat.toFixed(4)}, {lng.toFixed(4)}
                          </p>
                        )}
                      </>
                    ) : (
                      <div style={{ height: '80px', display: 'flex', alignItems: 'center',
                        justifyContent: 'center' }}>
                        <span style={{ fontSize: '11px', color: '#d1d5db' }}>No photo</span>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Admin — Verify button */}
          {isAdmin && record.status === 'submitted' && (
            <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: '16px' }}>
              <button onClick={handleVerify} disabled={verifying}
                style={{ width: '100%', padding: '14px', borderRadius: '12px',
                  border: 'none', background: '#106f30', color: 'white',
                  fontSize: '14px', fontWeight: 700, cursor: 'pointer',
                  opacity: verifying ? 0.6 : 1 }}>
                {verifying ? '⏳ Verifying...' : '✅ Verify Installation'}
              </button>
              <p style={{ fontSize: '11px', color: '#9ca3af', textAlign: 'center', marginTop: '8px' }}>
                Verification will lock this record and trigger sync to old platform
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}


// ── Main Installations Page ───────────────────────────────

export default function Installations() {
  const { user, can } = useAuth()
  const isAdmin = user?.bypass_org_scope || can('installations_manage')

  const [records, setRecords]       = useState([])
  const [total, setTotal]           = useState(0)
  const [loading, setLoading]       = useState(true)
  const [showForm, setShowForm]     = useState(false)
  const [editRecord, setEditRecord] = useState(null)
  const [viewRecord, setViewRecord] = useState(null)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterUid,    setFilterUid]    = useState('')
  const [page, setPage] = useState(1)
  const limit = 20

  const fetchRecords = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page, limit })
      if (filterStatus) params.append('status', filterStatus)
      if (filterUid)    params.append('uid', filterUid)
      const res = await api.get(`/installations?${params}`)
      setRecords(res.data.records)
      setTotal(res.data.total)
    } catch { toast.error('Failed to load installations') }
    finally { setLoading(false) }
  }

  useEffect(() => { fetchRecords() }, [page, filterStatus, filterUid])

  const totalPages = Math.ceil(total / limit)

  const handleEdit = (record) => {
    setViewRecord(null)
    setEditRecord(record)
    setShowForm(true)
  }

  const statusCounts = {
    draft:     records.filter(r => r.status === 'draft').length,
    submitted: records.filter(r => r.status === 'submitted').length,
    verified:  records.filter(r => r.status === 'verified').length,
  }

  return (
    <div style={{ maxWidth: '1100px' }}>

      {/* Modals */}
      {showForm && (
        <InstallationForm
          existing={editRecord}
          onClose={() => { setShowForm(false); setEditRecord(null) }}
          onSaved={() => { setShowForm(false); setEditRecord(null); fetchRecords() }}
        />
      )}
      {viewRecord && !showForm && (
        <InstallationDetail
          record={viewRecord}
          isAdmin={isAdmin}
          onClose={() => setViewRecord(null)}
          onEdit={handleEdit}
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontFamily: "'DM Serif Display', serif", color: '#106f30',
            fontSize: '28px', margin: 0 }}>
            Installations
          </h1>
          <p style={{ color: '#6b7280', fontSize: '13px', marginTop: '4px' }}>
            {total} installation{total !== 1 ? 's' : ''} recorded
          </p>
        </div>
        {can('installations_manage') && (
          <button onClick={() => { setEditRecord(null); setShowForm(true) }}
            style={{ padding: '10px 18px', borderRadius: '12px', border: 'none',
              background: '#106f30', color: 'white', fontSize: '13px',
              fontWeight: 600, cursor: 'pointer' }}>
            + New Installation
          </button>
        )}
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {Object.entries(STATUS_COLORS).map(([key, val]) => (
          <div key={key} style={{ padding: '10px 16px', borderRadius: '12px',
            background: val.bg, display: 'flex', gap: '10px', alignItems: 'center',
            cursor: 'pointer', border: `2px solid ${filterStatus === key ? val.text : 'transparent'}` }}
            onClick={() => setFilterStatus(filterStatus === key ? '' : key)}>
            <span style={{ fontSize: '20px', fontWeight: 700, color: val.text }}>
              {statusCounts[key] || 0}
            </span>
            <span style={{ fontSize: '12px', color: '#6b7280' }}>{val.label}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <input placeholder="🔍 Search by UID..."
          value={filterUid}
          onChange={e => { setFilterUid(e.target.value); setPage(1) }}
          style={{ padding: '8px 12px', borderRadius: '10px', border: '2px solid #e5e7eb',
            fontSize: '13px', outline: 'none', minWidth: '200px' }} />
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }}
          style={{ padding: '8px 12px', borderRadius: '10px', border: '2px solid #e5e7eb',
            fontSize: '13px', background: 'white', outline: 'none' }}>
          <option value="">All Statuses</option>
          <option value="draft">📝 Draft</option>
          <option value="submitted">📤 Submitted</option>
          <option value="verified">✅ Verified</option>
        </select>
        {(filterStatus || filterUid) && (
          <button onClick={() => { setFilterStatus(''); setFilterUid(''); setPage(1) }}
            style={{ padding: '8px 12px', borderRadius: '10px', border: '2px solid #e5e7eb',
              background: 'white', color: '#6b7280', fontSize: '13px', cursor: 'pointer' }}>
            ✕ Clear
          </button>
        )}
      </div>

      {/* Records list */}
      {loading ? (
        <div style={{ background: 'white', borderRadius: '16px', padding: '48px',
          textAlign: 'center', color: '#9ca3af', border: '1px solid #f0f0f0' }}>
          Loading installations...
        </div>
      ) : records.length === 0 ? (
        <div style={{ background: 'white', borderRadius: '16px', padding: '48px',
          textAlign: 'center', border: '1px solid #f0f0f0' }}>
          <p style={{ fontSize: '40px', marginBottom: '12px' }}>📋</p>
          <p style={{ color: '#6b7280', fontWeight: 500 }}>No installation records found</p>
          <p style={{ color: '#9ca3af', fontSize: '13px' }}>Click "+ New Installation" to get started</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {records.map(record => {
            const sc = STATUS_COLORS[record.status] || STATUS_COLORS.draft
            const photoCount = PHOTO_SLOTS.filter(s => record[`photo_${s.key}`]).length

            return (
              <div key={record.detail_id}
                onClick={() => setViewRecord(record)}
                style={{
                  background: 'white', borderRadius: '16px', padding: '16px 20px',
                  border: '1px solid #f0f0f0', cursor: 'pointer',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                  display: 'flex', alignItems: 'center', gap: '16px',
                  transition: 'box-shadow 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'}
                onMouseLeave={e => e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.04)'}>

                {/* Status dot */}
                <div style={{ width: '10px', height: '10px', borderRadius: '50%',
                  background: sc.text, flexShrink: 0 }} />

                {/* Main info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px',
                    flexWrap: 'wrap', marginBottom: '4px' }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700,
                      color: '#106f30', fontSize: '13px' }}>
                      {record.uid}
                    </span>
                    <span style={{ padding: '2px 8px', borderRadius: '20px', fontSize: '10px',
                      fontWeight: 600, background: sc.bg, color: sc.text }}>
                      {sc.label}
                    </span>
                    {record.flow_meter_present && (
                      <span style={{ fontSize: '10px', color: '#1565c0' }}>💧 Flow Meter</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    {record.address && (
                      <span style={{ fontSize: '12px', color: '#6b7280',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        maxWidth: '300px' }}>
                        📍 {record.address}
                      </span>
                    )}
                    {record.motor_hp && (
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>
                        ⚡ {record.motor_hp} HP
                      </span>
                    )}
                    {record.borewell_depth && (
                      <span style={{ fontSize: '12px', color: '#6b7280' }}>
                        🕳️ {record.borewell_depth}m
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: '11px', color: '#9ca3af', marginTop: '4px' }}>
                    By {record.submitted_by_name || '—'} · {formatDate(record.created_at)}
                  </p>
                </div>

                {/* Photos count */}
                <div style={{ textAlign: 'center', flexShrink: 0 }}>
                  <p style={{ fontSize: '18px', fontWeight: 700,
                    color: photoCount === 4 ? '#106f30' : '#f59e0b', margin: 0 }}>
                    {photoCount}/4
                  </p>
                  <p style={{ fontSize: '10px', color: '#9ca3af', margin: 0 }}>photos</p>
                </div>

                <span style={{ color: '#d1d5db', fontSize: '16px' }}>›</span>
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', marginTop: '16px' }}>
          <p style={{ fontSize: '12px', color: '#6b7280' }}>
            Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total}
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #e5e7eb',
                background: 'white', cursor: page === 1 ? 'not-allowed' : 'pointer',
                opacity: page === 1 ? 0.4 : 1, fontSize: '13px' }}>
              ← Prev
            </button>
            <span style={{ padding: '8px 12px', fontSize: '13px', color: '#6b7280' }}>
              {page} / {totalPages}
            </span>
            <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
              style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid #e5e7eb',
                background: 'white', cursor: page === totalPages ? 'not-allowed' : 'pointer',
                opacity: page === totalPages ? 0.4 : 1, fontSize: '13px' }}>
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
