import { useState, useEffect } from 'react'
import api from '../services/api'
import toast from 'react-hot-toast'

function StatCard({ label, value, color = '#106f30', icon }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      {icon && <p className="text-2xl mb-2">{icon}</p>}
      <p className="text-2xl font-bold" style={{ color }}>{value ?? '—'}</p>
      <p className="text-gray-500 text-xs mt-1">{label}</p>
    </div>
  )
}

function SectionTitle({ children }) {
  return (
    <h3 className="font-semibold text-gray-700 text-sm mb-3 mt-5 first:mt-0">{children}</h3>
  )
}

// ── Product Statistics Tab ────────────────────────────────
function ProductsDashboard() {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/dashboard/products')
      .then(r => setData(r.data))
      .catch(() => toast.error('Failed to load product statistics'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-8 text-center text-gray-400">Loading...</div>
  if (!data)   return null

  return (
    <div>
      <SectionTitle>Products</SectionTitle>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard label="Total Products"      value={data.products.total}      icon="📦" />
        <StatCard label="Active Products"     value={data.products.active}     icon="✅" color="#106f30" />
        <StatCard label="Inactive Products"   value={data.products.inactive}   icon="⛔" color="#c62828" />
        <StatCard label="Assigned"            value={data.products.assigned}   icon="🔗" color="#1a4f7a" />
        <StatCard label="Unassigned"          value={data.products.unassigned} icon="📭" color="#c25a00" />
      </div>

      <SectionTitle>Testing Status</SectionTitle>
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Test Passed"  value={data.test_status.passed}  icon="✔️"  color="#106f30" />
        <StatCard label="Test Failed"  value={data.test_status.failed}  icon="❌"  color="#c62828" />
        <StatCard label="Test Pending" value={data.test_status.pending} icon="⏳"  color="#c25a00" />
      </div>

      <SectionTitle>Installation Metrics</SectionTitle>
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total Installations" value={data.installations.total} icon="🔧" />
        <StatCard label="Installed Today"      value={data.installations.today} icon="📅" color="#1a4f7a" />
        <StatCard label="Installed This Week"  value={data.installations.week}  icon="📆" color="#6d28d9" />
      </div>
    </div>
  )
}

// ── Customer Statistics Tab ───────────────────────────────
function CustomerDashboard({ user }) {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/dashboard/customer')
      .then(r => setData(r.data))
      .catch(() => toast.error('Failed to load customer statistics'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-8 text-center text-gray-400">Loading...</div>
  if (!data)   return null

  const fmtTime = (mins) => {
    if (!mins) return '0 min'
    const h = Math.floor(mins / 60)
    const m = Math.round(mins % 60)
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  return (
    <div>
      {/* Farms & Devices */}
      <SectionTitle>Farms & Devices</SectionTitle>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Farms"      value={data.farms.total_farms}      icon="🌾" />
        <StatCard label="Total Devices"    value={data.farms.total_devices}    icon="📡" />
        <StatCard label="Active Devices"   value={data.farms.active_devices}   icon="🟢" color="#106f30" />
        <StatCard label="Inactive Devices" value={data.farms.inactive_devices} icon="🔴" color="#c62828" />
      </div>

      {/* Device States */}
      <SectionTitle>Device States</SectionTitle>
      <div className="grid grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard label="Running"       value={data.device_state.running}  icon="💧" color="#106f30" />
        <StatCard label="Stopped"       value={data.device_state.stopped}  icon="⏹️" color="#555" />
        <StatCard label="Overload Trip" value={data.device_state.overload} icon="⚡" color="#c62828" />
        <StatCard label="Underload Trip"value={data.device_state.underload}icon="📉" color="#c25a00" />
        <StatCard label="Idle"          value={data.device_state.idle}     icon="😴" color="#888" />
      </div>

      {/* Power */}
      <SectionTitle>Power</SectionTitle>
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Power Available Time" value={fmtTime(data.power.available_time_minutes)} icon="⚡" />
        <StatCard label="Run Time"             value={fmtTime(data.power.run_time_minutes)}       icon="▶️" color="#106f30" />
        <StatCard label="Idle Time"            value={fmtTime(data.power.idle_time_minutes)}      icon="⏸️" color="#888" />
      </div>

      {/* Mode */}
      <SectionTitle>Mode Distribution</SectionTitle>
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <div className="flex gap-6 mb-4">
          <div>
            <p className="text-2xl font-bold" style={{ color: '#106f30' }}>{data.mode.auto_pct}%</p>
            <p className="text-xs text-gray-500">⚙️ Auto Mode ({data.mode.auto_count} devices)</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-600">{data.mode.manual_pct}%</p>
            <p className="text-xs text-gray-500">🖐 Manual Mode ({data.mode.manual_count} devices)</p>
          </div>
        </div>
        {/* Simple bar */}
        <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all"
            style={{ width: `${data.mode.auto_pct}%`, background: '#106f30' }} />
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>Auto</span><span>Manual</span>
        </div>
      </div>

      {/* Performance / OEE */}
      <SectionTitle>Performance (OEE)</SectionTitle>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="OEE Score"   value={data.performance.oee_score    != null ? `${data.performance.oee_score}%`    : '—'} icon="📊" />
        <StatCard label="Quality"     value={data.performance.quality       != null ? `${data.performance.quality}%`       : '—'} icon="⭐" color="#1a4f7a" />
        <StatCard label="Availability"value={data.performance.availability  != null ? `${data.performance.availability}%`  : '—'} icon="🟢" color="#106f30" />
        <StatCard label="Performance" value={data.performance.performance   != null ? `${data.performance.performance}%`   : '—'} icon="⚡" color="#c25a00" />
      </div>

      {/* Device Health */}
      <SectionTitle>Device Health</SectionTitle>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <StatCard label="Good Devices"      value={data.device_health.good}              icon="✅" color="#106f30" />
        <StatCard label="Critical Devices"  value={data.device_health.critical}          icon="🔴" color="#c62828" />
        <StatCard label="Total Faults"      value={data.device_health.fault_count}       icon="⚠️" color="#c25a00" />
        <StatCard label="Reliability Score" value={data.device_health.reliability_score != null ? `${data.device_health.reliability_score}%` : '—'} icon="🛡️" />
        <StatCard label="Avg Signal"        value={data.device_health.avg_signal != null ? `${data.device_health.avg_signal} dB` : '—'} icon="📶" />
      </div>

      {/* Alerts */}
      <SectionTitle>Alerts</SectionTitle>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Overload Trips"  value={data.alerts.overload_trips}  icon="⚡" color="#c62828" />
        <StatCard label="Underload Trips" value={data.alerts.underload_trips} icon="📉" color="#c25a00" />
        <StatCard label="Dry Run Trips"   value={data.alerts.dry_run_trips}   icon="💧" color="#1a4f7a" />
        <StatCard label="Phase Faults"    value={data.alerts.phase_faults}    icon="⚠️" color="#6d28d9" />
      </div>

      {/* Usage */}
      <SectionTitle>Usage</SectionTitle>
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total On/Off Cycles"  value={data.usage.total_on_off_cycles}                              icon="🔄" />
        <StatCard label="Avg Run Time"         value={fmtTime(data.usage.avg_run_time_minutes)}                    icon="⏱️" />
        <StatCard label="Rest Time Today"      value={fmtTime(data.usage.rest_time_minutes)}                       icon="⏸️" color="#888" />
      </div>
    </div>
  )
}

// ── Main DashboardHome ────────────────────────────────────
export default function DashboardHome({ user, permissions }) {
  const [tab, setTab] = useState('customer')

  return (
    <div className="max-w-5xl">
      <h1 style={{ fontFamily: "'DM Serif Display', serif", color: '#106f30' }} className="text-3xl mb-1">
        Welcome back, {user?.full_name?.split(' ')[0]} 👋
      </h1>
      <p className="text-gray-500 text-sm mb-6">
        {user?.customer_name} · {user?.role_name} · {user?.customer_type?.toUpperCase()}
      </p>

      {/* Tab switcher */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
        {[
          { id: 'customer', label: '📊 Customer Stats' },
          { id: 'products', label: '📦 Product Stats'  },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
              ${tab === t.id ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'customer' && <CustomerDashboard user={user} />}
      {tab === 'products' && <ProductsDashboard />}

    </div>
  )
}
