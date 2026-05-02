import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import toast from 'react-hot-toast'

// ── Device state labels ───────────────────────────────────
const DEVICE_STATES = {
  0:  'Idle',
  1:  'Starting',
  2:  'Running',
  3:  'Stopping',
  4:  'Waiting',
  5:  'Fault',
  6:  'Dry Run',
  7:  'Overload Trip',
  8:  'Underload Trip',
  9:  'Over Voltage',
  10: 'Under Voltage',
}

function getStatusLabel(device) {
  if (device.motor_state === true) return { label: 'Running 💧', color: '#106f30', bg: '#e8f5ed' }
  if (device.motor_state === false && device.power_available) return { label: 'Waiting for command', color: '#c25a00', bg: '#fff3e0' }
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
  if (!dbm) return { label: 'Unknown', color: '#aaa' }
  if (dbm >= -70) return { label: `${Math.round(dbm)} dB (Excellent)`, color: '#106f30' }
  if (dbm >= -85) return { label: `${Math.round(dbm)} dB (Good)`, color: '#33a02b' }
  if (dbm >= -100) return { label: `${Math.round(dbm)} dB (Fair)`, color: '#c25a00' }
  return { label: `${Math.round(dbm)} dB (Weak)`, color: '#c62828' }
}

function formatLastSync(ts) {
  if (!ts) return 'Never'
  const d = new Date(ts)
  return d.toLocaleString('en-IN', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit' })
}

// ── VIEW: Farm list ───────────────────────────────────────
function FarmList({ onEnter }) {
  const [farms, setFarms]     = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/farms')
      .then(r => setFarms(r.data.farms))
      .catch(() => toast.error('Failed to load farms'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-12 text-center text-gray-400">Loading farms...</div>

  return (
    <div>
      <div className="mb-6">
        <h1 style={{ fontFamily: "'DM Serif Display', serif", color: '#106f30' }} className="text-2xl">
          Farm Assets
        </h1>
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
            <div key={farm.farm_id}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all">
              <div className="p-5 border-b border-gray-50" style={{ background: '#f9fdf5' }}>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-800">{farm.farm_name}</h3>
                    <p className="text-xs text-gray-400 mt-1">
                      Created {new Date(farm.created_at).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}
                    </p>
                  </div>
                  <span className="px-2 py-1 rounded-full text-xs font-medium text-white"
                    style={{ background: '#106f30' }}>
                    {farm.device_count} Devices
                  </span>
                </div>
              </div>
              <div className="p-5">
                <button onClick={() => onEnter(farm)}
                  className="w-full py-2.5 rounded-xl text-white text-sm font-medium hover:opacity-90 transition-all"
                  style={{ background: '#106f30' }}>
                  Enter Farm →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── VIEW: Device list inside farm ─────────────────────────
function DeviceList({ farm, onBack, onEnterPump }) {
  const { can }               = useAuth()
  const [data, setData]       = useState(null)
  const [loading, setLoading] = useState(true)
  const intervalRef           = useRef(null)

  const fetchDevices = () => {
    api.get(`/farms/${farm.farm_id}/devices`)
      .then(r => setData(r.data))
      .catch(() => toast.error('Failed to load devices'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchDevices()
    intervalRef.current = setInterval(fetchDevices, 15000)
    return () => clearInterval(intervalRef.current)
  }, [farm.farm_id])

  if (loading) return <div className="p-12 text-center text-gray-400">Loading devices...</div>

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6">
        <button onClick={onBack} className="text-sm font-medium hover:underline" style={{ color: '#106f30' }}>
          Farm Assets
        </button>
        <span className="text-gray-400">›</span>
        <span className="text-sm font-medium text-gray-700">{data?.farm_name}</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 style={{ fontFamily: "'DM Serif Display', serif", color: '#106f30' }} className="text-2xl">
            {data?.farm_name}
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">{data?.devices?.length} devices · Auto-refreshes every 15s</p>
        </div>
        <button onClick={fetchDevices}
          className="px-4 py-2 rounded-xl text-sm border-2 border-gray-200 text-gray-600 hover:bg-gray-50">
          🔄 Refresh
        </button>
      </div>

      {data?.devices?.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
          <p className="text-4xl mb-3">📡</p>
          <p className="text-gray-500 text-sm">No devices in this farm yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {data?.devices?.map(device => {
            const status = getStatusLabel(device)
            const signal = formatSignal(device.signal_strength)
            return (
              <div key={device.bore_id}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {/* Device header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100"
                  style={{ background: '#f9fdf5' }}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">
                      {device.motor_state ? '💧' : '⏹️'}
                    </span>
                    <div>
                      <p className="font-semibold text-gray-800">
                        {device.borewell_name || device.product_name || 'Unnamed Device'}
                      </p>
                      <p className="text-xs text-gray-400 font-mono">UID: {device.uid}</p>
                    </div>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-medium"
                    style={{ background: status.bg, color: status.color }}>
                    {status.label}
                  </span>
                </div>

                {/* Location */}
                {device.location && (
                  <div className="px-5 py-2 border-b border-gray-50 bg-gray-50">
                    <p className="text-xs text-gray-500">📍 {device.location}</p>
                  </div>
                )}

                {/* Stats row */}
                <div className="px-5 py-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Mode</p>
                    <p className="text-sm font-medium text-gray-700">
                      {device.auto_manual === null ? '—'
                        : device.auto_manual ? '⚙️ Auto' : '🖐 Manual'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Run Time Today</p>
                    <p className="text-sm font-medium text-gray-700">
                      ⏱ {formatRunTime(device.run_time_for_day)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Power</p>
                    <p className="text-sm font-medium" style={{ color: device.power_available ? '#106f30' : '#c62828' }}>
                      {device.power_available === null ? '—'
                        : device.power_available ? '⚡ Present' : '❌ No Power'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 mb-0.5">Water Yield Today</p>
                    <p className="text-sm font-medium text-gray-700">
                      💧 {device.day_water_yield ? Math.round(device.day_water_yield) : 0} L
                    </p>
                  </div>
                </div>

                {/* Enter pump button */}
                <div className="px-5 pb-4">
                  <button onClick={() => onEnterPump(device, data)}
                    className="w-full py-2 rounded-xl text-sm font-medium border-2 transition-all hover:text-white"
                    style={{ borderColor: '#106f30', color: '#106f30' }}
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

// ── VIEW: Motor Control Panel ─────────────────────────────
function MotorControlPanel({ device, farm, onBack }) {
  const { can }                   = useAuth()
  const [data, setData]           = useState(null)
  const [loading, setLoading]     = useState(true)
  const [commanding, setCommanding] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')
  const intervalRef               = useRef(null)

  const fetchDevice = () => {
    api.get(`/farms/${farm.farm_id}/devices/${device.uid}`)
      .then(r => setData(r.data))
      .catch(() => toast.error('Failed to refresh device data'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchDevice()
    intervalRef.current = setInterval(fetchDevice, 10000)
    return () => clearInterval(intervalRef.current)
  }, [device.uid])

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

  const signal = data ? formatSignal(data.signal_strength) : { label: '—', color: '#aaa' }

  const ANALYTICS_TABS = [
    { id: 'overview',  label: 'Overview'          },
    { id: 'power',     label: 'Power Analytics'   },
    { id: 'water',     label: 'Water Analytics'   },
    { id: 'weather',   label: 'Weather Analytics' },
    { id: 'events',    label: 'Event Logs'        },
    { id: 'stats',     label: 'Statistics'        },
  ]

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <button onClick={() => onBack('farms')} className="text-sm font-medium hover:underline" style={{ color: '#106f30' }}>
          Farm Assets
        </button>
        <span className="text-gray-400">›</span>
        <button onClick={() => onBack('devices')} className="text-sm font-medium hover:underline" style={{ color: '#106f30' }}>
          {farm.farm_name}
        </button>
        <span className="text-gray-400">›</span>
        <span className="text-sm font-medium text-gray-700">
          {data?.borewell_name || data?.product_name || device.uid}
        </span>
      </div>

      {loading && !data ? (
        <div className="p-12 text-center text-gray-400">Loading device data...</div>
      ) : data && (
        <>
          {/* Device Header Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-4 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100" style={{ background: '#f9fdf5' }}>
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <h1 style={{ fontFamily: "'DM Serif Display', serif", color: '#106f30' }} className="text-xl">
                    Motor Control Panel
                  </h1>
                  <p className="font-semibold text-gray-700 mt-1">
                    {data.borewell_name || data.product_name || 'Unnamed Device'}
                  </p>
                  {data.location && (
                    <p className="text-sm text-gray-500 mt-0.5">📍 {data.location}</p>
                  )}
                  <p className="text-xs text-gray-400 font-mono mt-1">UID: {data.uid}</p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${data.motor_state ? 'text-white' : 'text-gray-600 border border-gray-200'}`}
                    style={data.motor_state ? { background: '#106f30' } : { background: '#f5f5f5' }}>
                    {data.motor_state ? '💧 Motor Running' : '⏹ Motor Stopped'}
                  </span>
                  <p className="text-xs text-gray-400">
                    Last sync: {formatLastSync(data.last_sync_time)}
                  </p>
                </div>
              </div>
            </div>

            {/* Voltage + Current readings */}
            <div className="px-6 py-5">
              <div className="grid grid-cols-2 gap-6">
                {/* Voltages */}
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Voltage (V)</p>
                  <div className="flex gap-3">
                    {[data.voltage1, data.voltage2, data.voltage3].map((v, i) => (
                      <div key={i} className="flex-1 bg-blue-50 rounded-xl p-3 text-center border border-blue-100">
                        <p className="text-lg font-bold text-blue-700">{v ? Math.round(v) : '—'}</p>
                        <p className="text-xs text-blue-400">L{i + 1}</p>
                      </div>
                    ))}
                  </div>
                </div>
                {/* Currents */}
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Current (A)</p>
                  <div className="flex gap-3">
                    {[data.current1, data.current2, data.current3].map((c, i) => (
                      <div key={i} className="flex-1 bg-orange-50 rounded-xl p-3 text-center border border-orange-100">
                        <p className="text-lg font-bold text-orange-700">{c ? c.toFixed(1) : '—'}</p>
                        <p className="text-xs text-orange-400">L{i + 1}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Status strip */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-4 overflow-hidden">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 divide-x divide-gray-100">
              {[
                {
                  label: 'Mode',
                  value: data.auto_manual === null ? '—' : data.auto_manual ? '⚙️ Auto' : '🖐 Manual',
                  color: DARK,
                },
                {
                  label: 'Run Time Today',
                  value: `⏱ ${formatRunTime(data.run_time_for_day)}`,
                  color: '#1a4f7a',
                },
                {
                  label: 'Signal',
                  value: signal.label,
                  color: signal.color,
                },
                {
                  label: 'Water Yield Today',
                  value: `💧 ${data.day_water_yield ? Math.round(data.day_water_yield) : 0} L`,
                  color: '#106f30',
                },
                {
                  label: 'Power',
                  value: data.power_available ? '⚡ Present' : '❌ No Power',
                  color: data.power_available ? '#106f30' : '#c62828',
                },
                {
                  label: 'Status',
                  value: data.motor_state
                    ? 'Running...'
                    : data.power_available
                      ? 'Waiting for command'
                      : 'No Power',
                  color: data.motor_state ? '#106f30' : '#c25a00',
                },
              ].map(item => (
                <div key={item.label} className="px-4 py-4 text-center">
                  <p className="text-xs text-gray-400 mb-1">{item.label}</p>
                  <p className="text-sm font-semibold" style={{ color: item.color }}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Motor control buttons */}
          {can('motor_control') && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-4 p-6">
              <p className="text-sm font-semibold text-gray-700 mb-4">Motor Control</p>
              <div className="flex gap-4">
                <button
                  onClick={() => sendCommand('on')}
                  disabled={commanding || data.motor_state === true}
                  className="flex-1 py-4 rounded-2xl text-white font-bold text-base transition-all hover:opacity-90 disabled:opacity-40"
                  style={{ background: '#106f30' }}>
                  {commanding ? '⏳ Sending...' : '▶ Start Motor'}
                </button>
                <button
                  onClick={() => sendCommand('off')}
                  disabled={commanding || data.motor_state === false}
                  className="flex-1 py-4 rounded-2xl text-white font-bold text-base transition-all hover:opacity-90 disabled:opacity-40"
                  style={{ background: '#c62828' }}>
                  {commanding ? '⏳ Sending...' : '⏹ Stop Motor'}
                </button>
              </div>
              <p className="text-xs text-gray-400 text-center mt-3">
                Commands are sent via MQTT (QoS 1). Device will respond within a few seconds.
              </p>
            </div>
          )}

          {/* Analytics tabs */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="flex overflow-x-auto border-b border-gray-100">
              {ANALYTICS_TABS.map(tab => (
                <button key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-5 py-3 text-sm font-medium whitespace-nowrap transition-all border-b-2
                    ${activeTab === tab.id
                      ? 'border-[#106f30] text-[#106f30]'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}>
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="p-6">
              {activeTab === 'overview' && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[
                    ['Device Mode', data.auto_manual === null ? '—' : data.auto_manual ? 'Auto' : 'Manual'],
                    ['Motor HP', data.motor_hp ? `${data.motor_hp} HP` : '—'],
                    ['Pump Stages', data.pump_stages || '—'],
                    ['Borewell Depth', data.borewell_depth ? `${data.borewell_depth} ft` : '—'],
                    ['Flow Rate', data.pump_flow_rate ? `${data.pump_flow_rate} L/min` : '—'],
                    ['On/Off Cycles', data.total_on_off_cycles ?? '—'],
                    ['Overload Trips', data.total_overload_trips ?? '—'],
                    ['Underload Trips', data.total_underload_trips ?? '—'],
                    ['Weekly Run Time', formatRunTime(data.run_time_for_week)],
                    ['Monthly Run Time', formatRunTime(data.run_time_for_month)],
                    ['Water Yield This Month', data.month_water_yield ? `${Math.round(data.month_water_yield)} L` : '—'],
                    ['Overload Limit', data.overload_limit ? `${data.overload_limit} A` : '—'],
                    ['Underload Limit', data.underload_limit ? `${data.underload_limit} A` : '—'],
                    ['Installed By', data.installed_by || '—'],
                  ].map(([label, value]) => (
                    <div key={label} className="bg-gray-50 rounded-xl p-4">
                      <p className="text-xs text-gray-400 mb-1">{label}</p>
                      <p className="text-sm font-semibold text-gray-800">{value}</p>
                    </div>
                  ))}
                </div>
              )}

              {activeTab !== 'overview' && (
                <div className="text-center py-12 text-gray-400">
                  <p className="text-3xl mb-3">📊</p>
                  <p className="text-sm font-medium text-gray-600 mb-1">{ANALYTICS_TABS.find(t => t.id === activeTab)?.label}</p>
                  <p className="text-xs">Analytics charts will be built in the next phase.</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

const DARK = '#1a1a1a'

// ── Main Farms page controller ────────────────────────────
export default function Farms() {
  const [view, setView]           = useState('farms')
  const [selectedFarm, setSelectedFarm]     = useState(null)
  const [selectedDevice, setSelectedDevice] = useState(null)

  const handleEnterFarm = (farm) => {
    setSelectedFarm(farm)
    setView('devices')
  }

  const handleEnterPump = (device, farmData) => {
    setSelectedDevice(device)
    setSelectedFarm(f => ({ ...f, farm_name: farmData.farm_name }))
    setView('motor')
  }

  const handleBack = (to) => {
    if (to === 'farms') {
      setView('farms')
      setSelectedFarm(null)
      setSelectedDevice(null)
    } else if (to === 'devices') {
      setView('devices')
      setSelectedDevice(null)
    }
  }

  return (
    <div>
      {view === 'farms'   && <FarmList onEnter={handleEnterFarm} />}
      {view === 'devices' && selectedFarm && (
        <DeviceList
          farm={selectedFarm}
          onBack={() => handleBack('farms')}
          onEnterPump={handleEnterPump}
        />
      )}
      {view === 'motor' && selectedDevice && selectedFarm && (
        <MotorControlPanel
          device={selectedDevice}
          farm={selectedFarm}
          onBack={handleBack}
        />
      )}
    </div>
  )
}
