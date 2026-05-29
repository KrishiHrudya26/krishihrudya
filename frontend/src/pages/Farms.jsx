import { useState, useEffect, useRef } from 'react'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from 'recharts'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import toast from 'react-hot-toast'

function getStatusLabel(device) {
  if (device.motor_state === true) return { label: 'Running 💧', color: '#106f30', bg: '#e8f5ed' }
  if (device.motor_state === false && device.power_available) return { label: 'Waiting', color: '#c25a00', bg: '#fff3e0' }
  if (!device.power_available) return { label: 'No Power', color: '#c62828', bg: '#fce8e8' }
  return { label: 'Unknown', color: '#555', bg: '#f5f5f5' }
}

function formatRunTime(minutes) {
  if (!minutes) return '0 min'
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return h > 0 ? `${h}h ${m}m` : `${m} min`
}

function formatSignal(dbm) {
  if (dbm === null || dbm === undefined) return { short: 'Unknown', color: '#aaa', bars: 0 }
  const val = Math.round(dbm)
  if (dbm >= -70)  return { short: `${val} dB (Excellent)`, color: '#106f30', bars: 4 }
  if (dbm >= -85)  return { short: `${val} dB (Good)`,      color: '#33a02b', bars: 3 }
  if (dbm >= -100) return { short: `${val} dB (Mild)`,      color: '#f59e0b', bars: 2 }
  return { short: `${val} dB (Weak)`, color: '#dc2626', bars: 1 }
}

function formatLastSync(ts) {
  if (!ts) return 'Never'
  const d = new Date(ts)
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function SignalBars({ bars, color }) {
  return (
    <svg width="22" height="18" viewBox="0 0 22 18">
      <rect x="0"  y="12" width="4" height="6"  rx="1" fill={bars >= 1 ? color : '#e5e7eb'} />
      <rect x="6"  y="8"  width="4" height="10" rx="1" fill={bars >= 2 ? color : '#e5e7eb'} />
      <rect x="12" y="4"  width="4" height="14" rx="1" fill={bars >= 3 ? color : '#e5e7eb'} />
      <rect x="18" y="0"  width="4" height="18" rx="1" fill={bars >= 4 ? color : '#e5e7eb'} />
    </svg>
  )
}

const Icons = {
  AutoMode: () => (
    <svg width="36" height="36" viewBox="0 0 36 36">
      <circle cx="18" cy="18" r="16" fill="#fef9c3" stroke="#fde047" strokeWidth="2"/>
      <path d="M18 10 L22 20 H14 Z" fill="#f59e0b"/>
      <circle cx="18" cy="24" r="2.5" fill="#f59e0b"/>
      <path d="M11 18 Q18 8 25 18" fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  Clock: () => (
    <svg width="36" height="36" viewBox="0 0 36 36">
      <circle cx="18" cy="18" r="16" fill="#dbeafe" stroke="#93c5fd" strokeWidth="2"/>
      <circle cx="18" cy="18" r="10" fill="white" stroke="#93c5fd" strokeWidth="1.5"/>
      <line x1="18" y1="18" x2="18" y2="11" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round"/>
      <line x1="18" y1="18" x2="23" y2="21" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round"/>
      <circle cx="18" cy="18" r="1.5" fill="#3b82f6"/>
    </svg>
  ),
  Monitor: () => (
    <svg width="36" height="36" viewBox="0 0 36 36">
      <rect x="2" y="2" width="32" height="32" rx="6" fill="#d1fae5" stroke="#6ee7b7" strokeWidth="1.5"/>
      <rect x="6" y="7" width="24" height="15" rx="2" fill="#065f46"/>
      <rect x="14" y="22" width="8" height="3" rx="1" fill="#6ee7b7"/>
      <rect x="10" y="25" width="16" height="2" rx="1" fill="#a7f3d0"/>
      <line x1="10" y1="12" x2="26" y2="12" stroke="#6ee7b7" strokeWidth="1.5"/>
      <line x1="10" y1="16" x2="20" y2="16" stroke="#6ee7b7" strokeWidth="1.5"/>
    </svg>
  ),
  Water: () => (
    <svg width="36" height="36" viewBox="0 0 36 36">
      <path d="M18 4 C18 4 8 16 8 22 A10 10 0 0 0 28 22 C28 16 18 4 18 4Z" fill="#60a5fa"/>
      <path d="M18 10 C18 10 12 19 12 22 A6 6 0 0 0 24 22 C24 19 18 10 18 10Z" fill="#93c5fd"/>
      <ellipse cx="15" cy="20" rx="2" ry="3" fill="white" opacity="0.5"/>
    </svg>
  ),
  Power: () => (
    <svg width="36" height="36" viewBox="0 0 36 36">
      <circle cx="18" cy="18" r="16" fill="#fee2e2" stroke="#fca5a5" strokeWidth="2"/>
      <circle cx="18" cy="18" r="9" fill="none" stroke="#dc2626" strokeWidth="3"/>
      <line x1="18" y1="9" x2="18" y2="18" stroke="#dc2626" strokeWidth="3" strokeLinecap="round"/>
    </svg>
  ),
  PowerGreen: () => (
    <svg width="36" height="36" viewBox="0 0 36 36">
      <circle cx="18" cy="18" r="16" fill="#d1fae5" stroke="#6ee7b7" strokeWidth="2"/>
      <circle cx="18" cy="18" r="9" fill="none" stroke="#059669" strokeWidth="3"/>
      <line x1="18" y1="9" x2="18" y2="18" stroke="#059669" strokeWidth="3" strokeLinecap="round"/>
    </svg>
  ),
  Sync: () => (
    <svg width="36" height="36" viewBox="0 0 36 36">
      <circle cx="18" cy="18" r="16" fill="#e0f2fe" stroke="#7dd3fc" strokeWidth="2"/>
      <path d="M12 18 A6 6 0 0 1 24 18" fill="none" stroke="#0ea5e9" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M24 18 A6 6 0 0 1 12 18" fill="none" stroke="#0ea5e9" strokeWidth="2.5" strokeLinecap="round"/>
      <polygon points="24,14 24,18 20,18" fill="#0ea5e9"/>
      <polygon points="12,22 12,18 16,18" fill="#0ea5e9"/>
    </svg>
  ),
  PowerAnalytics: () => (
    <svg width="64" height="64" viewBox="0 0 64 64">
      <rect x="4"  y="32" width="10" height="24" rx="3" fill="#f59e0b"/>
      <rect x="18" y="20" width="10" height="36" rx="3" fill="#fbbf24"/>
      <rect x="32" y="10" width="10" height="46" rx="3" fill="#f97316"/>
      <rect x="46" y="4"  width="10" height="52" rx="3" fill="#ef4444"/>
      <polyline points="4,36 18,24 32,14 46,8 60,4" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="60" cy="4" r="3" fill="#dc2626"/>
      <polyline points="52,18 56,14 60,18" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  WaterAnalytics: () => (
    <svg width="64" height="64" viewBox="0 0 64 64">
      <rect x="4"  y="44" width="10" height="14" rx="3" fill="#93c5fd"/>
      <rect x="18" y="34" width="10" height="24" rx="3" fill="#60a5fa"/>
      <rect x="32" y="20" width="10" height="38" rx="3" fill="#3b82f6"/>
      <rect x="46" y="28" width="10" height="30" rx="3" fill="#2563eb"/>
      <path d="M36 8 C36 8 28 18 28 23 A8 8 0 0 0 44 23 C44 18 36 8 36 8Z" fill="#60a5fa"/>
      <path d="M36 13 C36 13 31 20 31 23 A5 5 0 0 0 41 23 C41 20 36 13 36 13Z" fill="#93c5fd"/>
    </svg>
  ),
  WeatherAnalytics: () => (
    <svg width="64" height="64" viewBox="0 0 64 64">
      <circle cx="32" cy="26" r="12" fill="#fbbf24"/>
      <line x1="32" y1="6"  x2="32" y2="2"  stroke="#fbbf24" strokeWidth="3" strokeLinecap="round"/>
      <line x1="32" y1="50" x2="32" y2="46" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round"/>
      <line x1="12" y1="26" x2="8"  y2="26" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round"/>
      <line x1="56" y1="26" x2="52" y2="26" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round"/>
      <line x1="18" y1="12" x2="15" y2="9"  stroke="#fbbf24" strokeWidth="3" strokeLinecap="round"/>
      <line x1="49" y1="43" x2="46" y2="40" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round"/>
      <path d="M20 40 Q22 34 30 34 Q34 28 40 32 Q46 28 48 34 Q54 35 54 42 Q54 48 46 48 H22 Q14 48 20 40Z" fill="#e0f2fe" stroke="#93c5fd" strokeWidth="1.5"/>
      <path d="M8 48 Q10 43 16 43 Q19 39 24 41 Q26 44 24 48Z" fill="#bae6fd"/>
    </svg>
  ),
  EventLogs: () => (
    <svg width="64" height="64" viewBox="0 0 64 64">
      <rect x="8" y="4" width="48" height="56" rx="6" fill="#fef3c7" stroke="#fde68a" strokeWidth="2"/>
      <rect x="16" y="14" width="32" height="4" rx="2" fill="#f59e0b"/>
      <rect x="16" y="22" width="24" height="3" rx="1.5" fill="#fde68a"/>
      <rect x="16" y="29" width="28" height="3" rx="1.5" fill="#fde68a"/>
      <rect x="16" y="36" width="20" height="3" rx="1.5" fill="#fde68a"/>
      <circle cx="46" cy="46" r="10" fill="#10b981" stroke="white" strokeWidth="2"/>
      <polyline points="40,46 44,50 52,42" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Statistics: () => (
    <svg width="64" height="64" viewBox="0 0 64 64">
      <rect x="2" y="2" width="60" height="60" rx="10" fill="#ede9fe" stroke="#c4b5fd" strokeWidth="2"/>
      <rect x="10" y="30" width="10" height="24" rx="3" fill="#8b5cf6"/>
      <rect x="24" y="18" width="10" height="36" rx="3" fill="#a78bfa"/>
      <rect x="38" y="24" width="10" height="30" rx="3" fill="#7c3aed"/>
      <polyline points="10,30 24,18 38,24 48,12" fill="none" stroke="#5b21b6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="48" cy="12" r="3" fill="#5b21b6"/>
    </svg>
  ),
  Settings: () => (
    <svg width="64" height="64" viewBox="0 0 64 64">
      <path d="M32 6 L36 2 L40 6 L46 4 L46 10 L52 12 L50 18 L56 22 L52 26 L54 32 L48 34 L48 40 L42 40 L40 46 L34 44 L32 48 L28 44 L22 46 L20 40 L14 40 L14 34 L8 32 L10 26 L6 22 L12 18 L10 12 L16 10 L16 4 L22 6 L26 2 Z" fill="#e0f2fe" stroke="#7dd3fc" strokeWidth="2"/>
      <circle cx="32" cy="32" r="10" fill="#0ea5e9"/>
      <circle cx="32" cy="32" r="5" fill="white"/>
      <rect x="29" y="16" width="6" height="6" rx="2" fill="#0284c7"/>
      <rect x="29" y="42" width="6" height="6" rx="2" fill="#0284c7"/>
      <rect x="16" y="29" width="6" height="6" rx="2" fill="#0284c7"/>
      <rect x="42" y="29" width="6" height="6" rx="2" fill="#0284c7"/>
    </svg>
  ),
}

function FarmList({ onEnter }) {
  const [farms, setFarms] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    api.get('/farms').then(r => setFarms(r.data.farms)).catch(() => toast.error('Failed to load farms')).finally(() => setLoading(false))
  }, [])
  if (loading) return <div className="p-12 text-center text-gray-400">Loading farms...</div>
  return (
    <div>
      <div className="mb-6">
        <h1 style={{ fontFamily: "'DM Serif Display', serif", color: '#106f30' }} className="text-2xl">Farm Assets</h1>
        <p className="text-gray-500 text-sm mt-0.5">{farms.length} farms assigned to you</p>
      </div>
      {farms.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100 shadow-sm">
          <p className="text-4xl mb-3">🌾</p>
          <p className="text-gray-500 text-sm">No farms assigned to your account yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {farms.map(farm => (
            <div key={farm.farm_id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all">
              <div className="p-5 border-b border-gray-50" style={{ background: '#f9fdf5' }}>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-800">{farm.farm_name}</h3>
                    <p className="text-xs text-gray-400 mt-1">Created {new Date(farm.created_at).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}</p>
                  </div>
                  <span className="px-2 py-1 rounded-full text-xs font-medium text-white" style={{ background: '#106f30' }}>{farm.device_count} Devices</span>
                </div>
              </div>
              <div className="p-5">
                <button onClick={() => onEnter(farm)} className="w-full py-2.5 rounded-xl text-white text-sm font-medium hover:opacity-90 transition-all" style={{ background: '#106f30' }}>Enter Farm →</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function DeviceList({ farm, onBack, onEnterPump }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const intervalRef = useRef(null)
  const fetchDevices = () => {
    api.get(`/farms/${farm.farm_id}/devices`).then(r => setData(r.data)).catch(() => toast.error('Failed to load devices')).finally(() => setLoading(false))
  }
  useEffect(() => { fetchDevices(); intervalRef.current = setInterval(fetchDevices, 15000); return () => clearInterval(intervalRef.current) }, [farm.farm_id])
  if (loading) return <div className="p-12 text-center text-gray-400">Loading devices...</div>
  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <button onClick={onBack} className="text-sm font-medium hover:underline" style={{ color: '#106f30' }}>Farm Assets</button>
        <span className="text-gray-400">›</span>
        <span className="text-sm font-medium text-gray-700">{data?.farm_name}</span>
      </div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 style={{ fontFamily: "'DM Serif Display', serif", color: '#106f30' }} className="text-2xl">{data?.farm_name}</h1>
          <p className="text-gray-500 text-sm mt-0.5">{data?.devices?.length} devices · Auto-refreshes every 15s</p>
        </div>
        <button onClick={fetchDevices} className="px-4 py-2 rounded-xl text-sm border-2 border-gray-200 text-gray-600 hover:bg-gray-50">🔄 Refresh</button>
      </div>
      {data?.devices?.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100"><p className="text-4xl mb-3">📡</p><p className="text-gray-500 text-sm">No devices in this farm yet.</p></div>
      ) : (
        <div className="flex flex-col gap-4">
          {data?.devices?.map(device => {
            const status = getStatusLabel(device)
            return (
              <div key={device.bore_id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100" style={{ background: '#f9fdf5' }}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{device.motor_state ? '💧' : '⏹️'}</span>
                    <div>
                      <p className="font-semibold text-gray-800">{device.borewell_name || device.product_name || 'Unnamed Device'}</p>
                      <p className="text-xs text-gray-400 font-mono">UID: {device.uid}</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-medium" style={{ background: status.bg, color: status.color }}>{status.label}</span>
                </div>
                {device.location && <div className="px-5 py-2 border-b border-gray-50 bg-gray-50"><p className="text-xs text-gray-500">📍 {device.location}</p></div>}
                <div className="px-5 py-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div><p className="text-xs text-gray-400 mb-0.5">Mode</p><p className="text-sm font-medium text-gray-700">{device.auto_manual === null ? '—' : device.auto_manual ? '⚙️ Auto' : '🖐 Manual'}</p></div>
                  <div><p className="text-xs text-gray-400 mb-0.5">Run Time Today</p><p className="text-sm font-medium text-gray-700">⏱ {formatRunTime(device.run_time_for_day)}</p></div>
                  <div><p className="text-xs text-gray-400 mb-0.5">Power</p><p className="text-sm font-medium" style={{ color: device.power_available ? '#106f30' : '#c62828' }}>{device.power_available === null ? '—' : device.power_available ? '⚡ Present' : '❌ No Power'}</p></div>
                  <div><p className="text-xs text-gray-400 mb-0.5">Water Yield Today</p><p className="text-sm font-medium text-gray-700">💧 {device.day_water_yield ? Math.round(device.day_water_yield) : 0} L</p></div>
                </div>
                <div className="px-5 pb-4">
                  <button onClick={() => onEnterPump(device, data)} className="w-full py-2 rounded-xl text-sm font-medium border-2 transition-all" style={{ borderColor: '#106f30', color: '#106f30' }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#106f30'; e.currentTarget.style.color = 'white' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#106f30' }}>
                    Enter Pump →
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function MotorControlPanel({ device, farm, onBack }) {
  const { can } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [commanding, setCommanding] = useState(false)
  const [activeSection, setActiveSection] = useState(null)
  const intervalRef = useRef(null)

  const fetchDevice = () => {
    api.get(`/farms/${farm.farm_id}/devices/${device.uid}`).then(r => setData(r.data)).catch(() => toast.error('Failed to refresh device data')).finally(() => setLoading(false))
  }
  useEffect(() => { fetchDevice(); intervalRef.current = setInterval(fetchDevice, 10000); return () => clearInterval(intervalRef.current) }, [device.uid])

  const sendCommand = async (cmd) => {
    if (!can('motor_control')) { toast.error('No motor control permission'); return }
    setCommanding(true)
    try {
      await api.post(`/farms/${farm.farm_id}/devices/${device.uid}/command`, { command: cmd })
      toast.success(`Motor ${cmd === 'on' ? 'started' : 'stopped'}`)
      setTimeout(fetchDevice, 2000)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Command failed')
    } finally {
      setCommanding(false)
    }
  }

  const signal = data ? formatSignal(data.signal_strength) : { short: 'Unknown', color: '#aaa', bars: 0 }

  if (activeSection) {
    const sectionLabel = {
      power: 'Power Analytics', water: 'Water Analytics',
      weather: 'Weather Analytics', events: 'Event Logs',
      statistics: 'Statistics', settings: 'Settings',
    }[activeSection]

    const Breadcrumb = () => (
      <div className="flex items-center gap-2 mb-6 flex-wrap text-sm">
        <button onClick={() => onBack('farms')} className="font-medium hover:underline" style={{ color: '#106f30' }}>Farm Assets</button>
        <span className="text-gray-400">›</span>
        <button onClick={() => onBack('devices')} className="font-medium hover:underline" style={{ color: '#106f30' }}>{farm.farm_name}</button>
        <span className="text-gray-400">›</span>
        <button onClick={() => setActiveSection(null)} className="font-medium hover:underline" style={{ color: '#106f30' }}>{data?.borewell_name || data?.product_name || device.uid}</button>
        <span className="text-gray-400">›</span>
        <span className="font-medium text-gray-700">{sectionLabel}</span>
      </div>
    )

    if (activeSection === 'power') return <div><Breadcrumb /><DevicePowerAnalytics uid={device.uid} deviceName={data?.borewell_name || data?.product_name || device.uid} /></div>
    if (activeSection === 'water') return <div><Breadcrumb /><DeviceWaterAnalytics uid={device.uid} deviceName={data?.borewell_name || data?.product_name || device.uid} /></div>

    const PlaceholderIcon = { weather: Icons.WeatherAnalytics, events: Icons.EventLogs, statistics: Icons.Statistics, settings: Icons.Settings }[activeSection] || Icons.PowerAnalytics
    return (
      <div>
        <Breadcrumb />
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-16 text-center">
          <div className="flex justify-center mb-4"><PlaceholderIcon /></div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">{sectionLabel}</h2>
          <p className="text-gray-400 text-sm">Coming in the next phase.</p>
          <button onClick={() => setActiveSection(null)} className="mt-6 px-6 py-2.5 rounded-xl text-white text-sm font-medium hover:opacity-90" style={{ background: '#106f30' }}>← Back to Panel</button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4 flex-wrap text-sm">
        <button onClick={() => onBack('farms')} className="font-medium hover:underline" style={{ color: '#106f30' }}>Farm Assets</button>
        <span className="text-gray-400">›</span>
        <button onClick={() => onBack('devices')} className="font-medium hover:underline" style={{ color: '#106f30' }}>{farm.farm_name}</button>
        <span className="text-gray-400">›</span>
        <span className="font-medium text-gray-700">{data?.borewell_name || data?.product_name || device.uid}</span>
      </div>

      {loading && !data ? (
        <div className="p-12 text-center text-gray-400">Loading device data...</div>
      ) : data && (
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-3xl shadow-md overflow-hidden border border-gray-100">

            <div className="px-5 pt-5 pb-3 flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-800 text-base leading-snug">{data.borewell_name || data.product_name || 'Unnamed Device'}</p>
                <p className="text-xs text-gray-500 mt-0.5">UID: {data.uid}</p>
              </div>
              <div className="flex-shrink-0" style={{ width:52, height:52, background: data.motor_state ? '#106f30' : '#dc2626', clipPath:'polygon(29% 0%,71% 0%,100% 29%,100% 71%,71% 100%,29% 100%,0% 71%,0% 29%)', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontWeight:900, fontSize:11, letterSpacing:'0.05em' }}>
                {data.motor_state ? 'RUN' : 'STOP'}
              </div>
            </div>

            <div className="px-4 pb-3">
              <div className="rounded-2xl p-3 pt-2" style={{ background: '#dbeafe' }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex gap-2 flex-1">
                    {[{val:data.voltage1,bg:'#fca5a5'},{val:data.voltage2,bg:'#fde68a'},{val:data.voltage3,bg:'#93c5fd'}].map(({val,bg},i) => (
                      <div key={i} className="flex-1 rounded-xl flex items-center justify-center" style={{ background:bg, minHeight:52, aspectRatio:'1' }}>
                        {val ? <span className="text-sm font-bold text-gray-800">{Math.round(val)}</span> : <span className="text-xl text-gray-400">⊘</span>}
                      </div>
                    ))}
                  </div>
                  <span className="text-sm font-bold text-gray-600 w-10 text-right">Volts</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex gap-2 flex-1">
                    {[{val:data.current1,bg:'#fca5a5'},{val:data.current2,bg:'#fde68a'},{val:data.current3,bg:'#93c5fd'}].map(({val,bg},i) => (
                      <div key={i} className="flex-1 rounded-xl flex items-center justify-center" style={{ background:bg, minHeight:52, aspectRatio:'1' }}>
                        {val ? <span className="text-sm font-bold text-gray-800">{val.toFixed(1)}</span> : <span className="text-xl text-gray-400">⊘</span>}
                      </div>
                    ))}
                  </div>
                  <span className="text-sm font-bold text-gray-600 w-10 text-right">Amps</span>
                </div>
              </div>
            </div>

            <div className="px-5 pb-3">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <div className="flex items-center gap-3"><Icons.AutoMode /><span className="text-sm font-semibold text-gray-700">{data.auto_manual === null ? '—' : data.auto_manual ? 'Auto Mode' : 'Manual Mode'}</span></div>
                <div className="flex items-center gap-2"><SignalBars bars={signal.bars} color={signal.color} /><span className="text-sm font-semibold" style={{ color:signal.color }}>{signal.short}</span></div>
                <div className="flex items-center gap-3"><Icons.Clock /><span className="text-sm font-semibold text-gray-700">{data.run_time_for_day ? `${Math.round(data.run_time_for_day)} Minutes` : '0 Minutes'}</span></div>
                <div className="flex items-center gap-3"><Icons.Water /><span className="text-sm font-semibold text-gray-700">{data.day_water_yield ? `${Math.round(data.day_water_yield)} Liters` : '0 Liters'}</span></div>
                <div className="flex items-center gap-3"><Icons.Monitor /><span className="text-sm font-semibold text-gray-700">{data.run_time_for_month ? `${Math.round(data.run_time_for_month)} Minutes` : '0 Minutes'}</span></div>
                <div className="flex items-center gap-3">{data.power_available ? <Icons.PowerGreen /> : <Icons.Power />}<span className="text-sm font-semibold" style={{ color: data.power_available ? '#059669' : '#dc2626' }}>{data.power_available ? 'Power Present' : 'Power Failure'}</span></div>
              </div>
              <div className="flex items-center gap-3 mt-3"><Icons.Sync /><span className="text-sm font-semibold text-gray-600">Last sync time {formatLastSync(data.last_sync_time)}</span></div>
            </div>

            {can('motor_control') && (
              <div className="mx-4 mb-5 rounded-2xl py-6 px-4 flex items-center justify-center gap-12" style={{ background: '#bfdbfe' }}>
                {/* ON button — pressed/active when motor_state === true */}
                <button onClick={() => sendCommand('on')} disabled={commanding || data.motor_state === true}
                  className="flex items-center gap-2 rounded-full font-black text-xl border-4 px-8 py-3.5 transition-all duration-100 select-none disabled:cursor-not-allowed active:scale-95"
                  style={{
                    background: data.motor_state === true ? '#15803d' : 'white',
                    borderColor: '#15803d',
                    color: data.motor_state === true ? 'white' : '#15803d',
                    boxShadow: data.motor_state === true ? 'inset 0 3px 8px rgba(0,0,0,0.25)' : '0 5px 0 #14532d',
                    transform: data.motor_state === true ? 'translateY(4px)' : 'none',
                    opacity: commanding ? 0.6 : 1,
                  }}>
                  <span>ON</span>
                  <span className="w-6 h-6 rounded-full border-2 flex items-center justify-center"
                    style={{ borderColor: data.motor_state === true ? 'rgba(255,255,255,0.6)' : '#15803d' }}>
                    <span className="w-3.5 h-3.5 rounded-full transition-colors duration-200"
                      style={{ background: data.motor_state === true ? '#4ade80' : '#d1d5db' }} />
                  </span>
                </button>

                {/* OFF button — pressed/active when motor_state === false (not null, not true) */}
                <button onClick={() => sendCommand('off')} disabled={commanding || data.motor_state === false || data.motor_state === null}
                  className="flex items-center gap-2 rounded-full font-black text-xl border-4 px-8 py-3.5 transition-all duration-100 select-none disabled:cursor-not-allowed active:scale-95"
                  style={{
                    background: data.motor_state === false ? '#dc2626' : 'white',
                    borderColor: '#dc2626',
                    color: data.motor_state === false ? 'white' : '#dc2626',
                    boxShadow: data.motor_state === false ? 'inset 0 3px 8px rgba(0,0,0,0.25)' : '0 5px 0 #991b1b',
                    transform: data.motor_state === false ? 'translateY(4px)' : 'none',
                    opacity: commanding ? 0.6 : 1,
                  }}>
                  <span>OFF</span>
                  <span className="w-6 h-6 rounded-full border-2 flex items-center justify-center"
                    style={{ borderColor: data.motor_state === false ? 'rgba(255,255,255,0.6)' : '#dc2626' }}>
                    <span className="w-3.5 h-3.5 rounded-full transition-colors duration-200"
                      style={{ background: data.motor_state === false ? '#fca5a5' : '#d1d5db' }} />
                  </span>
                </button>
              </div>
            )}
          </div>

          <div className="mt-6 grid grid-cols-3 gap-4 pb-6">
            {[
              { id:'power',      label:'Power Analytics',   Icon:Icons.PowerAnalytics   },
              { id:'water',      label:'Water Analytics',   Icon:Icons.WaterAnalytics   },
              { id:'weather',    label:'Weather Analytics', Icon:Icons.WeatherAnalytics },
              { id:'events',     label:'Event Logs',        Icon:Icons.EventLogs        },
              { id:'statistics', label:'Statistics',        Icon:Icons.Statistics       },
              { id:'settings',   label:'Settings',          Icon:Icons.Settings         },
            ].map(({ id, label, Icon }) => (
              <button key={id} onClick={() => setActiveSection(id)}
                className="flex flex-col items-center gap-2 py-4 px-2 rounded-2xl transition-all duration-150 hover:scale-105 active:scale-95 hover:bg-white hover:shadow-md">
                <Icon />
                <span className="text-xs font-semibold text-gray-600 text-center leading-tight">{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function Farms() {
  const [view, setView] = useState('farms')
  const [selectedFarm, setSelectedFarm] = useState(null)
  const [selectedDevice, setSelectedDevice] = useState(null)

  const handleEnterFarm = (farm) => { setSelectedFarm(farm); setView('devices') }
  const handleEnterPump = (device, farmData) => {
    setSelectedDevice(device)
    setSelectedFarm(f => ({ ...f, farm_name: farmData.farm_name }))
    setView('motor')
  }
  const handleBack = (to) => {
    if (to === 'farms') { setView('farms'); setSelectedFarm(null); setSelectedDevice(null) }
    else if (to === 'devices') { setView('devices'); setSelectedDevice(null) }
  }

  return (
    <div>
      {view === 'farms' && <FarmList onEnter={handleEnterFarm} />}
      {view === 'devices' && selectedFarm && <DeviceList farm={selectedFarm} onBack={() => handleBack('farms')} onEnterPump={handleEnterPump} />}
      {view === 'motor' && selectedDevice && selectedFarm && <MotorControlPanel device={selectedDevice} farm={selectedFarm} onBack={handleBack} />}
    </div>
  )
}
