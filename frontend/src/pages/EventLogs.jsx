import { useState, useEffect, useCallback } from 'react'
import api from '../services/api'
import toast from 'react-hot-toast'

const RANGES = [
  { label: 'Today',   value: 1  },
  { label: '7 Days',  value: 7  },
  { label: '30 Days', value: 30 },
  { label: 'Custom',  value: 0  },
]

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('en-IN', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
  })
}

function MsgRow({ label, value, mono }) {
  return (
    <div className="flex gap-2 text-xs">
      <span className="text-gray-400 w-24 flex-shrink-0">{label}</span>
      <span className="text-gray-400 flex-shrink-0">:</span>
      <span className={`text-gray-700 font-medium break-all ${mono ? 'font-mono' : ''}`}>
        {value ?? '—'}
      </span>
    </div>
  )
}

function Divider() {
  return <div className="border-t border-gray-200 my-2" />
}

const HEADER_MAP = {
  motor_start:      { label: 'Motor Started',                      color: 'green'  },
  motor_stop:       { label: 'Motor Stopped',                      color: 'red'    },
  power_failure:    { label: 'Motor Stopped — POWER FAILURE',      color: 'red'    },
  voltage_fault:    { label: 'Voltage Fault Detected',             color: 'red'    },
  overload_trip:    { label: 'Motor Tripped — OVERLOAD',           color: 'orange' },
  underload_trip:   { label: 'Motor Tripped — UNDERLOAD / DRY RUN',color: 'orange' },
  dry_run_trip:     { label: 'Motor Tripped — DRY RUN',            color: 'orange' },
  phase_failure:    { label: 'Motor Tripped — PHASE FAILURE',      color: 'orange' },
  power_lost:       { label: 'Power Failed',                       color: 'red'    },
  power_resumed:    { label: 'Power Resumed',                      color: 'green'  },
  maintenance_due:  { label: 'Maintenance Due',                    color: 'yellow' },
  repeated_fault:   { label: 'Repeated Fault Alert',               color: 'yellow' },
  ticket_raised:    { label: 'Service Ticket Raised',              color: 'yellow' },
  ticket_resolved:  { label: 'Service Ticket Resolved',            color: 'green'  },
}

const COLOR_MAP = {
  green:  { border: '#bbf7d0', dot: 'bg-green-500',  text: 'text-green-700'  },
  red:    { border: '#fecaca', dot: 'bg-red-500',    text: 'text-red-700'    },
  orange: { border: '#fed7aa', dot: 'bg-orange-500', text: 'text-orange-700' },
  yellow: { border: '#fef08a', dot: 'bg-yellow-400', text: 'text-yellow-700' },
  gray:   { border: '#e5e7eb', dot: 'bg-gray-400',   text: 'text-gray-600'   },
}

function MessageCell({ log }) {
  const cat = log.event_category
  const h   = HEADER_MAP[cat]
  if (!h) return <span className="text-xs text-gray-700">{log.message || '—'}</span>

  const c    = COLOR_MAP[h.color] || COLOR_MAP.gray
  const farm = log.customer?.farm_name
  const addr = log.customer?.address

  const isMotorStart  = cat === 'motor_start'
  const isMotorStop   = cat === 'motor_stop'
  const isFault       = ['power_failure','voltage_fault','overload_trip',
                         'underload_trip','dry_run_trip','phase_failure'].includes(cat)
  const isPower       = ['power_lost','power_resumed'].includes(cat)
  const isMaintenance = ['maintenance_due','repeated_fault'].includes(cat)
  const isTicket      = ['ticket_raised','ticket_resolved'].includes(cat)
  const hasRunStats   = log.run_time || log.water_yield != null || log.total_run

  return (
    <div className="rounded-xl border bg-gray-50 p-3 min-w-64 max-w-sm"
      style={{ borderColor: c.border }}>

      {/* Header */}
      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-200">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${c.dot}`} />
        <span className={`text-xs font-semibold ${c.text}`}>{h.label}</span>
      </div>

      <div className="space-y-1">

        {/* Cat 1a — Motor Start */}
        {isMotorStart && <>
          {log.mode && <MsgRow label="Mode"       value={log.mode} />}
          {farm     && <MsgRow label="Farm"       value={farm} />}
          <MsgRow label="Device UID" value={log.uid} mono />
          <MsgRow label="Time"       value={formatDate(log.created_at)} />
        </>}

        {/* Cat 1b — Motor Stop */}
        {isMotorStop && <>
          {log.mode && <MsgRow label="Mode"       value={log.mode} />}
          {farm     && <MsgRow label="Farm"       value={farm} />}
          <MsgRow label="Device UID" value={log.uid} mono />
          <MsgRow label="Time"       value={formatDate(log.created_at)} />
          {hasRunStats && <>
            <Divider />
            {log.run_time  && <MsgRow label="Run Time"    value={`${log.run_time} (This session)`} />}
            {log.total_run && <MsgRow label="Total Run"   value={`${log.total_run} (Lifetime)`} />}
            {log.water_yield != null &&
              <MsgRow label="Water Yield" value={`${log.water_yield.toLocaleString()} L`} />}
          </>}
        </>}

        {/* Cat 2 — Faults */}
        {isFault && <>
          <MsgRow label="Fault"   value={log.message} />
          <Divider />
          <MsgRow label="Voltage"
            value={`R: ${log.voltage1 ?? 0}V    Y: ${log.voltage2 ?? 0}V    B: ${log.voltage3 ?? 0}V`} />
          <MsgRow label="Current"
            value={`R: ${log.current1 ?? 0}A    Y: ${log.current2 ?? 0}A    B: ${log.current3 ?? 0}A`} />
          <Divider />
          {farm && <MsgRow label="Farm"       value={farm} />}
          <MsgRow label="Device UID" value={log.uid} mono />
          {hasRunStats && <>
            <Divider />
            {log.run_time  && <MsgRow label="Run Time"    value={`${log.run_time} (This session)`} />}
            {log.total_run && <MsgRow label="Total Run"   value={`${log.total_run} (Lifetime)`} />}
            {log.water_yield != null && (
              <div className="flex gap-2 text-xs">
                <span className="text-gray-400 w-24 flex-shrink-0">Water Yield</span>
                <span className="text-gray-400 flex-shrink-0">:</span>
                <span className="text-gray-700 font-medium">
                  {log.water_yield.toLocaleString()} L
                  {['underload_trip','dry_run_trip'].includes(cat) &&
                    <span className="ml-2 text-orange-500">⚠️ Check sensor</span>}
                </span>
              </div>
            )}
          </>}
        </>}

        {/* Cat 3 — Power Events */}
        {isPower && <>
          {farm && <MsgRow label="Farm"       value={farm} />}
          <MsgRow label="Device UID" value={log.uid} mono />
          {addr && <MsgRow label="Location"   value={addr} />}
          <Divider />
          <MsgRow label="Voltage"
            value={`R: ${log.voltage1 ?? 0}V    Y: ${log.voltage2 ?? 0}V    B: ${log.voltage3 ?? 0}V`} />
          {cat === 'power_resumed' && log.signal != null &&
            <MsgRow label="Signal" value={log.signal} />}
        </>}

        {/* Cat 4 — Maintenance */}
        {isMaintenance && <>
          <MsgRow label="Alert"      value={log.message} />
          <MsgRow label="Device UID" value={log.uid} mono />
          {farm && <MsgRow label="Farm" value={farm} />}
          {cat === 'maintenance_due' && <>
            <Divider />
            {log.total_run    && <MsgRow label="Total Run"    value={log.total_run} />}
            {log.last_service && <MsgRow label="Last Service" value={log.last_service} />}
          </>}
          {log.action && <MsgRow label="Action" value={log.action} />}
        </>}

        {/* Cat 5a — Ticket Raised */}
        {isTicket && cat === 'ticket_raised' && <>
          {log.ticket_id && <MsgRow label="Ticket ID" value={log.ticket_id} />}
          {log.issue     && <MsgRow label="Issue"     value={log.issue} />}
          {log.priority  && <MsgRow label="Priority"  value={log.priority} />}
          <MsgRow label="Device UID" value={log.uid} mono />
          {farm          && <MsgRow label="Farm"      value={farm} />}
          <Divider />
          {log.raised_by && <MsgRow label="Raised By" value={log.raised_by} />}
        </>}

        {/* Cat 5b — Ticket Resolved */}
        {isTicket && cat === 'ticket_resolved' && <>
          {log.ticket_id  && <MsgRow label="Ticket ID"  value={log.ticket_id} />}
          {log.resolution && <MsgRow label="Resolution" value={log.resolution} />}
          <MsgRow label="Device UID" value={log.uid} mono />
          <Divider />
          {log.closed_by && <MsgRow label="Closed By" value={log.closed_by} />}
          {log.duration  && <MsgRow label="Duration"  value={log.duration} />}
        </>}

      </div>
    </div>
  )
}

export default function EventLogs() {
  const [logs, setLogs]             = useState([])
  const [summary, setSummary]       = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading]       = useState(false)
  const [range, setRange]           = useState(1)
  const [startDate, setStartDate]   = useState('')
  const [endDate, setEndDate]       = useState('')
  const [category, setCategory]     = useState('')
  const [uidSearch, setUidSearch]   = useState('')
  const [page, setPage]             = useState(1)
  const [total, setTotal]           = useState(0)
  const [pages, setPages]           = useState(1)
  const [selected, setSelected]     = useState(new Set())

  const fetchCategories = useCallback(async () => {
    try {
      const res = await api.get('/event-logs/categories')
      setCategories(res.data.categories || [])
    } catch {}
  }, [])

  const fetchLogs = useCallback(async (pg = 1) => {
    setLoading(true)
    try {
      let url = `/event-logs?range_days=${range}&page=${pg}&page_size=50`
      if (range === 0 && startDate && endDate) url += `&start_date=${startDate}&end_date=${endDate}`
      if (category)  url += `&category=${encodeURIComponent(category)}`
      if (uidSearch) url += `&uid=${uidSearch.trim()}`
      const res = await api.get(url)
      setLogs(res.data.logs || [])
      setSummary(res.data.summary || [])
      setTotal(res.data.total || 0)
      setPages(res.data.pages || 1)
      setPage(pg)
      setSelected(new Set())
    } catch {
      toast.error('Failed to load event logs')
    } finally {
      setLoading(false)
    }
  }, [range, startDate, endDate, category, uidSearch])

  useEffect(() => { fetchCategories() }, [fetchCategories])
  useEffect(() => { fetchLogs(1) }, [range, category])

  const toggleAll = (checked) =>
    setSelected(checked ? new Set(logs.map((_, i) => i)) : new Set())

  const toggleRow = (i) => {
    const s = new Set(selected)
    s.has(i) ? s.delete(i) : s.add(i)
    setSelected(s)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Event Logs</h2>
          <p className="text-xs text-gray-400 mt-0.5">Showing latest logs · {total} total</p>
        </div>
        <button onClick={() => fetchLogs(page)}
          className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-600">
          ↻ Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {RANGES.map(r => (
            <button key={r.value} onClick={() => setRange(r.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                range === r.value ? 'text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              style={range === r.value ? { background: '#106f30' } : {}}>
              {r.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400">Device UID</label>
            <input value={uidSearch} onChange={e => setUidSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchLogs(1)}
              placeholder="Search by UID…"
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs w-44" />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400">Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs min-w-36">
              <option value="">All Categories</option>
              {categories.map(c => (
                <option key={c} value={c}>{c.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          {range === 0 && <>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-400">From</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-400">To</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs" />
            </div>
          </>}
          <button onClick={() => fetchLogs(1)}
            className="px-4 py-1.5 rounded-lg text-white text-xs font-medium self-end"
            style={{ background: '#106f30' }}>
            Search
          </button>
        </div>

        {summary.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-100">
            {summary.map(s => (
              <button key={s.category}
                onClick={() => setCategory(category === s.category ? '' : s.category)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  category === s.category
                    ? 'text-white border-transparent'
                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                }`}
                style={category === s.category ? { background: '#106f30' } : {}}>
                {s.category.replace(/_/g, ' ')}
                <span className={`rounded-full px-1.5 py-0.5 ${
                  category === s.category ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-500'
                }`}>{s.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-300 text-sm">Loading events...</div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-3xl mb-2">📭</p>
            <p className="text-sm text-gray-400">No events found</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-4 py-3 w-10">
                      <input type="checkbox"
                        checked={selected.size === logs.length && logs.length > 0}
                        onChange={e => toggleAll(e.target.checked)}
                        className="rounded" />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">UID</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Event Category</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Message</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Customer Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Created At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {logs.map((log, i) => (
                    <tr key={`${log.event_id}-${i}`}
                      className={`hover:bg-gray-50 transition-colors ${selected.has(i) ? 'bg-green-50/40' : ''}`}>
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={selected.has(i)}
                          onChange={() => toggleRow(i)} className="rounded" />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-600 whitespace-nowrap">
                        {log.uid}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded-md">
                          {log.event_category.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <MessageCell log={log} />
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        {log.customer?.cust_name
                          ? <span className="font-medium text-gray-700">{log.customer.cust_name}</span>
                          : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {formatDate(log.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <p className="text-xs text-gray-400">
                {selected.size > 0 ? `${selected.size} selected · ` : ''}
                Page {page} of {pages} · {total} total
              </p>
              <div className="flex gap-2">
                <button onClick={() => fetchLogs(page - 1)} disabled={page === 1}
                  className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
                  ← Prev
                </button>
                <button onClick={() => fetchLogs(page + 1)} disabled={page === pages}
                  className="px-3 py-1.5 text-xs rounded-lg border border-gray-200 disabled:opacity-40 hover:bg-gray-50">
                  Next →
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
