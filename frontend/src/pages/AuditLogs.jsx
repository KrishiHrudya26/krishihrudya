import { useState, useEffect, useRef } from 'react'
import api from '../services/api'
import toast from 'react-hot-toast'

// ── Constants ─────────────────────────────────────────────

const CATEGORY_COLORS = {
  command:        { bg: '#ede9fe', text: '#5b21b6', label: '⚡ Command' },
  setting_change: { bg: '#fef3c7', text: '#92400e', label: '⚙️ Setting Change' },
}

const STATUS_COLORS = {
  success: { bg: '#e8f5ed', text: '#106f30', label: '✅ Success' },
  failed:  { bg: '#fce8e8', text: '#c62828', label: '❌ Failed'  },
}

const ACTION_CATEGORY_OPTIONS = [
  { value: '',               label: 'All Categories' },
  { value: 'command',        label: '⚡ Commands' },
  { value: 'setting_change', label: '⚙️ Setting Changes' },
]

const STATUS_OPTIONS = [
  { value: '',        label: 'All Statuses' },
  { value: 'success', label: '✅ Success' },
  { value: 'failed',  label: '❌ Failed' },
]

function formatDate(ts) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function Badge({ colors, label }) {
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: colors.bg, color: colors.text }}>
      {label}
    </span>
  )
}


// ── Log Detail Panel ──────────────────────────────────────

function LogDetail({ log, onClose }) {
  if (!log) return null
  const cat = CATEGORY_COLORS[log.action_category] || CATEGORY_COLORS.command
  const st  = STATUS_COLORS[log.status]  || STATUS_COLORS.success

  const rows = [
    ['Timestamp',     formatDate(log.created_at)],
    ['User',          log.user_name || '—'],
    ['Customer',      log.customer_name ? `${log.customer_name} (${log.customer_code})` : '—'],
    ['Device UID',    log.device_uid || '—'],
    ['Category',      log.action_category],
    ['Action',        log.action],
    ['Command',       log.command_name || '—'],
    ['Setting',       log.setting_name || '—'],
    ['Old Value',     log.old_value || '—'],
    ['New Value',     log.new_value || '—'],
    ['Status',        log.status],
    ['Failure Reason',log.failure_reason || '—'],
    ['IP Address',    log.ip_address || '—'],
  ]

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50,
      display: 'flex', justifyContent: 'flex-end' }}>
      <div style={{ width: '420px', background: 'white', height: '100%', overflowY: 'auto',
        boxShadow: '-4px 0 24px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <div style={{ padding: '20px', borderBottom: '1px solid #f0f0f0',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexShrink: 0 }}>
          <div>
            <p style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase',
              letterSpacing: '0.05em', marginBottom: '4px' }}>Audit Log Detail</p>
            <p style={{ fontWeight: 600, color: '#1a1a1a', fontSize: '14px' }}>{log.action}</p>
            <div style={{ display: 'flex', gap: '8px', marginTop: '6px', flexWrap: 'wrap' }}>
              <Badge colors={cat} label={cat.label} />
              <Badge colors={st}  label={st.label}  />
            </div>
          </div>
          <button onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer',
              color: '#aaa', fontSize: '20px', lineHeight: 1 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', flex: 1 }}>

          {/* Old → New for setting changes */}
          {log.action_category === 'setting_change' && log.old_value && log.new_value && (
            <div style={{ background: '#f9fafb', borderRadius: '12px', padding: '16px', marginBottom: '20px' }}>
              <p style={{ fontSize: '11px', color: '#888', textTransform: 'uppercase',
                letterSpacing: '0.05em', marginBottom: '12px' }}>Value Change</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ flex: 1, textAlign: 'center', background: '#fce8e8',
                  borderRadius: '8px', padding: '12px' }}>
                  <p style={{ fontSize: '10px', color: '#c62828', marginBottom: '4px' }}>OLD</p>
                  <p style={{ fontSize: '16px', fontWeight: 700, color: '#c62828',
                    fontFamily: 'monospace' }}>{log.old_value}</p>
                </div>
                <span style={{ fontSize: '20px', color: '#999' }}>→</span>
                <div style={{ flex: 1, textAlign: 'center', background: '#e8f5ed',
                  borderRadius: '8px', padding: '12px' }}>
                  <p style={{ fontSize: '10px', color: '#106f30', marginBottom: '4px' }}>NEW</p>
                  <p style={{ fontSize: '16px', fontWeight: 700, color: '#106f30',
                    fontFamily: 'monospace' }}>{log.new_value}</p>
                </div>
              </div>
              {log.setting_name && (
                <p style={{ textAlign: 'center', fontSize: '12px', color: '#888', marginTop: '8px' }}>
                  Setting: <strong>{log.setting_name}</strong>
                </p>
              )}
            </div>
          )}

          {/* All fields */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {rows.map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between',
                gap: '16px', paddingBottom: '12px', borderBottom: '1px solid #f5f5f5' }}>
                <span style={{ fontSize: '12px', color: '#888', flexShrink: 0 }}>{label}</span>
                <span style={{ fontSize: '12px', color: '#333', fontWeight: 500,
                  textAlign: 'right', wordBreak: 'break-all' }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}


// ── Main Audit Logs Page ──────────────────────────────────

export default function AuditLogs() {
  const [logs, setLogs]             = useState([])
  const [total, setTotal]           = useState(0)
  const [loading, setLoading]       = useState(true)
  const [selectedLog, setSelectedLog] = useState(null)
  const [usersList, setUsersList]   = useState([])
  const [exporting, setExporting]   = useState(false)
  const [page, setPage]             = useState(1)
  const limit = 50

  // Filters
  const [filterUser,     setFilterUser]     = useState('')
  const [filterDevice,   setFilterDevice]   = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterStatus,   setFilterStatus]   = useState('')
  const [filterDateFrom, setFilterDateFrom] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() - 90)
    return d.toISOString().split('T')[0]
  })
  const [filterDateTo, setFilterDateTo] = useState(() =>
    new Date().toISOString().split('T')[0]
  )
  const [search, setSearch] = useState('')
  const searchTimer = useRef(null)

  const fetchLogs = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page, limit })
      if (filterUser)     params.append('user_id',         filterUser)
      if (filterDevice)   params.append('device_uid',      filterDevice)
      if (filterCategory) params.append('action_category', filterCategory)
      if (filterStatus)   params.append('status',          filterStatus)
      if (filterDateFrom) params.append('date_from',       filterDateFrom)
      if (filterDateTo)   params.append('date_to',         filterDateTo)
      if (search)         params.append('search',          search)

      const res = await api.get(`/audit?${params}`)
      setLogs(res.data.logs)
      setTotal(res.data.total)
    } catch (err) {
      if (err.response?.status === 403) {
        toast.error('Access restricted to internal team only')
      } else {
        toast.error('Failed to load audit logs')
      }
    } finally { setLoading(false) }
  }

  useEffect(() => {
    api.get('/audit/users-list')
      .then(r => setUsersList(r.data.users))
      .catch(() => {})
  }, [])

  useEffect(() => { fetchLogs() },
    [page, filterUser, filterDevice, filterCategory, filterStatus, filterDateFrom, filterDateTo])

  // Debounced search
  useEffect(() => {
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => { setPage(1); fetchLogs() }, 400)
    return () => clearTimeout(searchTimer.current)
  }, [search])

  const handleExport = async () => {
    setExporting(true)
    try {
      const params = new URLSearchParams()
      if (filterUser)     params.append('user_id',         filterUser)
      if (filterDevice)   params.append('device_uid',      filterDevice)
      if (filterCategory) params.append('action_category', filterCategory)
      if (filterStatus)   params.append('status',          filterStatus)
      if (filterDateFrom) params.append('date_from',       filterDateFrom)
      if (filterDateTo)   params.append('date_to',         filterDateTo)

      const res = await api.get(`/audit/export?${params}`, { responseType: 'blob' })
      const url  = window.URL.createObjectURL(new Blob([res.data]))
      const link = document.createElement('a')
      link.href  = url
      link.setAttribute('download', `audit_logs_${filterDateFrom}_to_${filterDateTo}.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      toast.success('Export downloaded')
    } catch {
      toast.error('Export failed')
    } finally { setExporting(false) }
  }

  const clearFilters = () => {
    setFilterUser(''); setFilterDevice(''); setFilterCategory('')
    setFilterStatus(''); setSearch('')
    const d = new Date()
    d.setDate(d.getDate() - 90)
    setFilterDateFrom(d.toISOString().split('T')[0])
    setFilterDateTo(new Date().toISOString().split('T')[0])
    setPage(1)
  }

  const totalPages  = Math.ceil(total / limit)
  const hasFilters  = filterUser || filterDevice || filterCategory || filterStatus || search

  const selectStyle = {
    padding: '8px 12px', borderRadius: '10px', border: '2px solid #e5e7eb',
    fontSize: '12px', background: 'white', outline: 'none', cursor: 'pointer',
  }
  const inputStyle = { ...selectStyle, minWidth: '160px' }

  return (
    <div style={{ maxWidth: '1200px' }}>
      {selectedLog && (
        <LogDetail log={selectedLog} onClose={() => setSelectedLog(null)} />
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontFamily: "'DM Serif Display', serif", color: '#106f30', fontSize: '28px', margin: 0 }}>
            Audit Logs
          </h1>
          <p style={{ color: '#6b7280', fontSize: '13px', marginTop: '4px' }}>
            {total.toLocaleString()} log{total !== 1 ? 's' : ''} · Last 90 days shown by default
          </p>
        </div>
        <button onClick={handleExport} disabled={exporting}
          style={{ padding: '10px 16px', borderRadius: '10px', background: '#106f30', color: 'white',
            border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 500,
            opacity: exporting ? 0.6 : 1 }}>
          {exporting ? '⏳ Exporting...' : '📥 Export CSV'}
        </button>
      </div>

      {/* Filters row 1 */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
        <input
          placeholder="🔍 Search action, device, user..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          style={{ ...inputStyle, minWidth: '240px' }}
        />

        <select value={filterUser} onChange={e => { setFilterUser(e.target.value); setPage(1) }}
          style={selectStyle}>
          <option value="">All Users</option>
          {usersList.map(u => (
            <option key={u.user_id} value={u.user_id}>{u.full_name}</option>
          ))}
        </select>

        <input placeholder="Device UID" value={filterDevice}
          onChange={e => { setFilterDevice(e.target.value); setPage(1) }}
          style={inputStyle} />

        <select value={filterCategory} onChange={e => { setFilterCategory(e.target.value); setPage(1) }}
          style={selectStyle}>
          {ACTION_CATEGORY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setPage(1) }}
          style={selectStyle}>
          {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      {/* Filters row 2 — date range */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', color: '#888' }}>From:</span>
        <input type="date" value={filterDateFrom}
          onChange={e => { setFilterDateFrom(e.target.value); setPage(1) }}
          style={inputStyle} />
        <span style={{ fontSize: '12px', color: '#888' }}>To:</span>
        <input type="date" value={filterDateTo}
          onChange={e => { setFilterDateTo(e.target.value); setPage(1) }}
          style={inputStyle} />

        {hasFilters && (
          <button onClick={clearFilters}
            style={{ ...selectStyle, color: '#6b7280', cursor: 'pointer' }}>
            ✕ Clear filters
          </button>
        )}
      </div>

      {/* Stats strip */}
      {!loading && logs.length > 0 && (
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
          {[
            ['Total',    total,                                                    '#f9fafb', '#333'],
            ['Commands', logs.filter(l => l.action_category === 'command').length,        '#ede9fe', '#5b21b6'],
            ['Settings', logs.filter(l => l.action_category === 'setting_change').length, '#fef3c7', '#92400e'],
            ['Failed',   logs.filter(l => l.status === 'failed').length,                  '#fce8e8', '#c62828'],
          ].map(([label, count, bg, color]) => (
            <div key={label} style={{ background: bg, borderRadius: '10px',
              padding: '8px 16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '18px', fontWeight: 700, color }}>{count}</span>
              <span style={{ fontSize: '12px', color: '#888' }}>{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div style={{ background: 'white', borderRadius: '16px', padding: '48px',
          textAlign: 'center', color: '#9ca3af', border: '1px solid #f0f0f0' }}>
          Loading audit logs...
        </div>
      ) : logs.length === 0 ? (
        <div style={{ background: 'white', borderRadius: '16px', padding: '48px',
          textAlign: 'center', border: '1px solid #f0f0f0' }}>
          <p style={{ fontSize: '40px', marginBottom: '12px' }}>📜</p>
          <p style={{ color: '#6b7280', fontWeight: 500 }}>No audit logs found</p>
          <p style={{ color: '#9ca3af', fontSize: '13px', marginTop: '4px' }}>
            {hasFilters ? 'Try clearing the filters' : 'No activity recorded yet'}
          </p>
        </div>
      ) : (
        <div style={{ background: 'white', borderRadius: '16px', border: '1px solid #f0f0f0',
          overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
          {/* Table header */}
          <div style={{ display: 'grid',
            gridTemplateColumns: '160px 130px 140px 80px 80px 1fr 90px',
            padding: '12px 20px', background: '#f9fafb',
            borderBottom: '1px solid #f0f0f0', gap: '8px' }}>
            {['Timestamp', 'User', 'Device UID', 'Category', 'Status', 'Action', 'Change'].map(h => (
              <span key={h} style={{ fontSize: '11px', fontWeight: 600,
                color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {h}
              </span>
            ))}
          </div>

          {/* Table rows */}
          {logs.map((log, i) => {
            const cat = CATEGORY_COLORS[log.action_category] || CATEGORY_COLORS.command
            const st  = STATUS_COLORS[log.status]  || STATUS_COLORS.success
            return (
              <div key={log.audit_id}
                onClick={() => setSelectedLog(log)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '160px 130px 140px 80px 80px 1fr 90px',
                  padding: '12px 20px',
                  gap: '8px',
                  alignItems: 'center',
                  borderBottom: i < logs.length - 1 ? '1px solid #f5f5f5' : 'none',
                  cursor: 'pointer',
                  transition: 'background 0.1s',
                  background: log.status === 'failed' ? '#fffbfb' : 'white',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#f9fafb'}
                onMouseLeave={e => e.currentTarget.style.background = log.status === 'failed' ? '#fffbfb' : 'white'}>

                {/* Timestamp */}
                <span style={{ fontSize: '11px', color: '#6b7280', fontFamily: 'monospace' }}>
                  {formatDate(log.created_at)}
                </span>

                {/* User */}
                <div>
                  <p style={{ fontSize: '12px', fontWeight: 500, color: '#333',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {log.user_name || '—'}
                  </p>
                  {log.customer_code && (
                    <p style={{ fontSize: '10px', color: '#9ca3af', fontFamily: 'monospace' }}>
                      {log.customer_code}
                    </p>
                  )}
                </div>

                {/* Device UID */}
                <span style={{ fontSize: '11px', color: '#374151', fontFamily: 'monospace',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {log.device_uid || '—'}
                </span>

                {/* Category */}
                <Badge colors={cat} label={log.action_category === 'command' ? '⚡ CMD' : '⚙️ SET'} />

                {/* Status */}
                <Badge colors={st} label={log.status === 'success' ? '✅' : '❌'} />

                {/* Action */}
                <span style={{ fontSize: '12px', color: '#374151',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {log.command_name || log.action}
                </span>

                {/* Old → New */}
                {log.old_value && log.new_value ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
                    <span style={{ color: '#c62828', fontFamily: 'monospace',
                      overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '30px' }}>
                      {log.old_value}
                    </span>
                    <span style={{ color: '#9ca3af' }}>→</span>
                    <span style={{ color: '#106f30', fontFamily: 'monospace',
                      overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '30px' }}>
                      {log.new_value}
                    </span>
                  </div>
                ) : (
                  <span style={{ fontSize: '11px', color: '#d1d5db' }}>—</span>
                )}
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
            Showing {(page - 1) * limit + 1}–{Math.min(page * limit, total)} of {total.toLocaleString()}
          </p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)}
              style={{ ...selectStyle, opacity: page === 1 ? 0.4 : 1, cursor: page === 1 ? 'not-allowed' : 'pointer' }}>
              ← Prev
            </button>
            <span style={{ ...selectStyle, background: '#f9fafb' }}>
              {page} / {totalPages}
            </span>
            <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
              style={{ ...selectStyle, opacity: page === totalPages ? 0.4 : 1, cursor: page === totalPages ? 'not-allowed' : 'pointer' }}>
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
