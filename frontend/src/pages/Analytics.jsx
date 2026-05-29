import { useState, useEffect } from 'react'
import api from '../services/api'
import toast from 'react-hot-toast'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer
} from 'recharts'

const TABS = [
  { label: '⚡ Power Analytics', value: 'power' },
  { label: '💧 Water Analytics', value: 'water' },
]

const RANGES = [
  { label: 'Today',   value: 1  },
  { label: '7 Days',  value: 7  },
  { label: '30 Days', value: 30 },
  { label: 'Custom',  value: 0  },
]

function StatCard({ label, value, unit, color = '#106f30', icon }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-1">{icon} {label}</p>
      <p className="text-2xl font-bold" style={{ color }}>
        {value ?? '—'} <span className="text-sm font-normal text-gray-400">{unit}</span>
      </p>
    </div>
  )
}

function ChartCard({ title, children, loading }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <h3 className="font-semibold text-gray-800 mb-4 text-sm">{title}</h3>
      {loading ? (
        <div className="h-64 flex items-center justify-center text-gray-300 text-sm">Loading chart...</div>
      ) : children}
    </div>
  )
}

const CustomTooltip = ({ active, payload, label, unit }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 shadow-lg text-xs">
      <p className="text-gray-500 mb-1 font-medium">{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color }} className="font-semibold">
          {p.name}: {p.value} {unit}
        </p>
      ))}
    </div>
  )
}

function Controls({ endpoint, onData }) {
  const [devices, setDevices]         = useState([])
  const [selectedUID, setSelectedUID] = useState('')
  const [range, setRange]             = useState(1)
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd]     = useState('')
  const [loading, setLoading]         = useState(false)
  const [devLoading, setDevLoading]   = useState(true)

  useEffect(() => {
    api.get('/analytics/devices')
      .then(r => {
        setDevices(r.data.devices)
        if (r.data.devices.length > 0) setSelectedUID(r.data.devices[0].uid)
      })
      .catch(() => toast.error('Failed to load devices'))
      .finally(() => setDevLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedUID) return
    if (range === 0 && (!customStart || !customEnd)) return
    setLoading(true)
    const params = new URLSearchParams({ uid: selectedUID, range_days: range })
    if (range === 0) {
      params.append('start_date', customStart)
      params.append('end_date',   customEnd)
    }
    api.get(`/analytics/${endpoint}?${params.toString()}`)
      .then(r => onData(r.data, loading))
      .catch(() => toast.error('Failed to load analytics data'))
      .finally(() => setLoading(false))
  }, [selectedUID, range, customStart, customEnd])

  const selectedDevice = devices.find(d => d.uid === selectedUID)

  return (
    <div className="mb-5">
      <div className="flex items-center gap-3 flex-wrap mb-3">
        <select value={selectedUID} onChange={e => setSelectedUID(e.target.value)}
          className="px-4 py-2 rounded-xl border-2 border-gray-200 text-sm bg-white focus:border-[#106f30] focus:outline-none"
          disabled={devLoading}>
          {devLoading ? <option>Loading devices...</option>
            : devices.length === 0 ? <option>No devices found</option>
            : devices.map(d => <option key={d.uid} value={d.uid}>{d.pump_name} — {d.uid}</option>)}
        </select>

        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {RANGES.map(r => (
            <button key={r.value} onClick={() => setRange(r.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                ${range === r.value ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {r.label}
            </button>
          ))}
        </div>

        {range === 0 && (
          <div className="flex items-center gap-2 bg-white border-2 border-gray-200 rounded-xl px-3 py-1.5">
            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
              className="text-xs focus:outline-none bg-transparent" />
            <span className="text-gray-300">→</span>
            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
              className="text-xs focus:outline-none bg-transparent" />
          </div>
        )}
      </div>

      {range === 0 && (!customStart || !customEnd) && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 mb-3 text-xs text-yellow-700">
          📅 Please select a start and end date to view analytics.
        </div>
      )}

      {selectedDevice && (
        <div className="bg-white rounded-xl px-4 py-2.5 border border-gray-100 shadow-sm flex items-center gap-4 text-xs text-gray-500">
          <span>📡 <strong className="text-gray-700">{selectedDevice.uid}</strong></span>
          <span>🌾 {selectedDevice.farm_name}</span>
          <span>🏢 {selectedDevice.customer}</span>
        </div>
      )}
    </div>
  )
}

function PowerAnalytics() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  return (
    <div>
      <Controls endpoint="power" onData={(d) => setData(d)} />

      {data && data.summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <StatCard label="Avg Voltage" value={data.summary.avg_voltage_v} unit="V"   icon="⚡" color="#1a4f7a" />
          <StatCard label="Avg Current" value={data.summary.avg_current_a} unit="A"   icon="🔌" color="#106f30" />
          <StatCard label="Avg Power"   value={data.summary.avg_power_kva} unit="kVA" icon="📊" color="#c25a00" />
          <StatCard label="Peak Power"  value={data.summary.max_power_kva} unit="kVA" icon="📈" color="#6d28d9" />
        </div>
      )}

      {data && data.points === 0 && (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100 shadow-sm">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-gray-500 text-sm">No data found for this device in the selected range.</p>
        </div>
      )}

      {data && data.points > 0 && (
        <div className="flex flex-col gap-5">
          <ChartCard title="⚡ Voltage (V1 · V2 · V3)" loading={loading}>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data.voltage} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#94a3b8' }} interval="preserveStartEnd" tickLine={false} />
                <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} unit="V" />
                <Tooltip content={<CustomTooltip unit="V" />} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line type="monotone" dataKey="V1" name="V1 (R)" stroke="#ef4444" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="V2" name="V2 (Y)" stroke="#f59e0b" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="V3" name="V3 (B)" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="🔌 Current (I1 · I2 · I3)" loading={loading}>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data.current} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#94a3b8' }} interval="preserveStartEnd" tickLine={false} />
                <YAxis domain={[0, 'auto']} tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} unit="A" />
                <Tooltip content={<CustomTooltip unit="A" />} />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Line type="monotone" dataKey="I1" name="I1 (R)" stroke="#106f30" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="I2" name="I2 (Y)" stroke="#10b981" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="I3" name="I3 (B)" stroke="#34d399" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="📊 Apparent Power (kVA)" loading={loading}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.apparent_power} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#94a3b8' }} interval="preserveStartEnd" tickLine={false} />
                <YAxis domain={[0, 'auto']} tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} unit=" kVA" />
                <Tooltip content={<CustomTooltip unit="kVA" />} />
                <Bar dataKey="kVA" name="Apparent Power" fill="#106f30" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}
    </div>
  )
}

function WaterAnalytics() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  return (
    <div>
      <Controls endpoint="water" onData={(d) => setData(d)} />

      {data && data.summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          <StatCard label="Total Yield"    value={data.summary.total_yield_liters}    unit="L"   icon="💧" color="#0369a1" />
          <StatCard label="Avg Utilization" value={data.summary.avg_utilization_pct}  unit="%"   icon="⚙️" color="#106f30" />
          <StatCard label="Water Level"    value={data.summary.avg_water_level_ft}    unit="ft"  icon="📏" color="#0891b2" />
          <StatCard label="Time to Surface" value={data.summary.avg_time_to_surface_s} unit="s"  icon="⏱️" color="#7c3aed" />
        </div>
      )}

      {data && data.points === 0 && (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100 shadow-sm">
          <p className="text-4xl mb-3">📭</p>
          <p className="text-gray-500 text-sm">No data found for this device in the selected range.</p>
        </div>
      )}

      {data && data.points > 0 && (
        <div className="flex flex-col gap-5">
          <ChartCard title="💧 Water Yield (Liters)" loading={loading}>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.water_yield} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#94a3b8' }} interval="preserveStartEnd" tickLine={false} />
                <YAxis domain={[0, 'auto']} tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} unit=" L" />
                <Tooltip content={<CustomTooltip unit="L" />} />
                <Bar dataKey="Liters" name="Water Yield" fill="#0369a1" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="⚙️ Pump Utilization (%)" loading={loading}>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data.utilization} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#94a3b8' }} interval="preserveStartEnd" tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} unit="%" />
                <Tooltip content={<CustomTooltip unit="%" />} />
                <Line type="monotone" dataKey="Utilization" name="Utilization" stroke="#106f30" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="📏 Actual Water Level (ft)" loading={loading}>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data.water_level} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#94a3b8' }} interval="preserveStartEnd" tickLine={false} />
                <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} unit=" ft" />
                <Tooltip content={<CustomTooltip unit="ft" />} />
                <Line type="monotone" dataKey="Feet" name="Water Level" stroke="#0891b2" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="⏱️ Time to Surface (seconds)" loading={loading}>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data.time_to_surface} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#94a3b8' }} interval="preserveStartEnd" tickLine={false} />
                <YAxis domain={[0, 'auto']} tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} unit=" s" />
                <Tooltip content={<CustomTooltip unit="s" />} />
                <Line type="monotone" dataKey="Seconds" name="Time to Surface" stroke="#7c3aed" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}
    </div>
  )
}

export default function Analytics() {
  const [activeTab, setActiveTab] = useState('power')

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <h1 style={{ fontFamily: "'DM Serif Display', serif", color: '#106f30' }} className="text-2xl">
          Analytics
        </h1>
        <p className="text-gray-500 text-sm mt-0.5">Monitor and analyse your device data</p>
      </div>

      <div className="flex gap-2 mb-6 bg-white rounded-2xl p-1.5 border border-gray-100 shadow-sm w-fit">
        {TABS.map(tab => (
          <button key={tab.value} onClick={() => setActiveTab(tab.value)}
            className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all
              ${activeTab === tab.value ? 'text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            style={activeTab === tab.value ? { background: '#106f30' } : {}}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'power' && <PowerAnalytics />}
      {activeTab === 'water' && <WaterAnalytics />}
    </div>
  )
}
