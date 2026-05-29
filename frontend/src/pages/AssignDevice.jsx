import { useState, useEffect, useRef } from 'react'
import api from '../services/api'
import toast from 'react-hot-toast'

const STEPS = ['Device & Farm', 'Device Details', 'Basic Settings', 'Advanced Settings', 'Review']

function StepIndicator({ current }) {
  return (
    <div className="flex items-center gap-2 mb-8 flex-wrap">
      {STEPS.map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all
            ${current > i ? 'text-white' : current === i ? 'text-white' : 'text-gray-400 bg-gray-200'}`}
            style={current >= i ? { background: '#106f30' } : {}}>
            {current > i ? '✓' : i + 1}
          </div>
          {i < STEPS.length - 1 && (
            <div className={`h-0.5 w-6 ${current > i ? 'bg-[#106f30]' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
      <span className="ml-2 text-xs text-gray-500 font-medium">{STEPS[current]}</span>
    </div>
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

function Toggle({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200">
      <span className="text-sm text-gray-700">{label}</span>
      <button type="button" onClick={() => onChange(!value)}
        className={`w-11 h-6 rounded-full relative transition-all ${value ? 'bg-[#106f30]' : 'bg-gray-300'}`}>
        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-all ${value ? 'left-6' : 'left-1'}`} />
      </button>
    </div>
  )
}

function CustomerSelect({ customers, value, onChange, placeholder = '— Select customer —' }) {
  const [search, setSearch] = useState('')
  const [open, setOpen]     = useState(false)
  const ref                 = useRef(null)
  const filtered = customers.filter(c =>
    c.cust_name.toLowerCase().includes(search.toLowerCase()) ||
    c.customer_id.toLowerCase().includes(search.toLowerCase())
  )
  const selected = customers.find(c => c.cust_id === value)
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full px-3 py-2.5 rounded-xl border-2 border-gray-200 text-sm bg-white text-left flex items-center justify-between focus:outline-none">
        <span className={selected ? 'text-gray-800' : 'text-gray-400'}>
          {selected ? `${selected.cust_name} (${selected.customer_id})` : placeholder}
        </span>
        <span className="text-gray-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="absolute top-full left-0 right-0 z-50 bg-white border border-gray-200 rounded-xl shadow-lg mt-1 overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <input autoFocus placeholder="Search by name or ID..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#106f30]"
              onClick={e => e.stopPropagation()} />
          </div>
          <div className="max-h-52 overflow-y-auto">
            <button type="button" onClick={() => { onChange(''); setOpen(false); setSearch('') }}
              className="w-full text-left px-4 py-2.5 text-sm text-gray-400 hover:bg-gray-50 border-b border-gray-50">
              {placeholder}
            </button>
            {filtered.length === 0 ? (
              <p className="px-4 py-3 text-sm text-gray-400">No customers found</p>
            ) : filtered.map(c => (
              <button key={c.cust_id} type="button"
                onClick={() => { onChange(c.cust_id); setOpen(false); setSearch('') }}
                className={`w-full text-left px-4 py-2.5 hover:bg-gray-50 border-b border-gray-50 last:border-0 ${value === c.cust_id ? 'bg-green-50' : ''}`}>
                <p className="text-sm font-medium text-gray-800">{c.cust_name}</p>
                <p className="text-xs text-gray-400 font-mono">{c.customer_id} · {c.cust_type?.toUpperCase()}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function CreateFarmModal({ onClose, onCreated }) {
  const [customers, setCustomers]         = useState([])
  const [nodes, setNodes]                 = useState([])
  const [filteredUsers, setFilteredUsers] = useState([])
  const [saving, setSaving]               = useState(false)
  const [form, setForm] = useState({
    farm_name:'', customer_id:'', hierarchy_node_id:'',
    address:'', latitude:'', longitude:'', assign_to_user_id:'',
  })
  useEffect(() => {
    api.get('/customers?limit=200').then(r => setCustomers(r.data.customers)).catch(() => {})
  }, [])
  useEffect(() => {
    if (!form.customer_id) { setNodes([]); setFilteredUsers([]); setForm(f => ({ ...f, hierarchy_node_id:'', assign_to_user_id:'' })); return }
    api.get(`/customers/${form.customer_id}`).then(r => setNodes(r.data.hierarchy?.nodes || [])).catch(() => {})
    api.get(`/assign/users-list?customer_id=${form.customer_id}`).then(r => setFilteredUsers(r.data.users)).catch(() => {})
  }, [form.customer_id])
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const handleCreate = async () => {
    if (!form.farm_name.trim()) { toast.error('Farm name is required'); return }
    setSaving(true)
    try {
      const res = await api.post('/assign/farm', {
        farm_name: form.farm_name,
        customer_id: form.customer_id || null,
        hierarchy_node_id: form.hierarchy_node_id || null,
        address: form.address || null,
        latitude: form.latitude ? parseFloat(form.latitude) : null,
        longitude: form.longitude ? parseFloat(form.longitude) : null,
        assign_to_user_id: form.assign_to_user_id || null,
      })
      toast.success('Farm created successfully')
      onCreated(res.data.farm_id, form.farm_name)
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create farm')
    } finally { setSaving(false) }
  }
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
          <h2 className="font-semibold text-gray-800">Create New Farm</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>
        <div className="p-5 flex flex-col gap-4">
          <Field label="Farm Name" required>
            <Input placeholder="e.g. North Zone Farm" value={form.farm_name} onChange={e => set('farm_name', e.target.value)} />
          </Field>
          <Field label="Customer" hint="Which customer does this farm belong to?">
            <CustomerSelect customers={customers} value={form.customer_id} onChange={v => set('customer_id', v)} />
          </Field>
          {nodes.length > 0 && (
            <Field label="Hierarchy Node" hint="Which zone, ward or division is this farm under?">
              <Select value={form.hierarchy_node_id} onChange={e => set('hierarchy_node_id', e.target.value)}>
                <option value="">— Select node (optional) —</option>
                {nodes.map(n => <option key={n.node_id} value={n.node_id}>{n.name}</option>)}
              </Select>
            </Field>
          )}
          <Field label="Assign To User" hint={form.customer_id ? 'Showing users under selected customer' : 'Select a customer first'}>
            <Select value={form.assign_to_user_id} onChange={e => set('assign_to_user_id', e.target.value)} disabled={!form.customer_id}>
              <option value="">— Assign to myself (default) —</option>
              {filteredUsers.map(u => <option key={u.user_id} value={u.user_id}>{u.full_name} ({u.email || u.phone})</option>)}
            </Select>
            {form.customer_id && filteredUsers.length === 0 && <p className="text-xs text-amber-500 mt-1">No active users found under this customer</p>}
          </Field>
          <Field label="Address">
            <textarea placeholder="Street, area, city..." value={form.address} onChange={e => set('address', e.target.value)}
              rows={2} className="px-3 py-2.5 rounded-xl border-2 border-gray-200 text-sm focus:border-[#106f30] focus:outline-none bg-white resize-none w-full" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Latitude"><Input type="number" placeholder="12.9716" value={form.latitude} onChange={e => set('latitude', e.target.value)} /></Field>
            <Field label="Longitude"><Input type="number" placeholder="77.5946" value={form.longitude} onChange={e => set('longitude', e.target.value)} /></Field>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm font-medium border-2 border-gray-200 text-gray-600 hover:bg-gray-50">Cancel</button>
            <button onClick={handleCreate} disabled={saving}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white hover:opacity-90 disabled:opacity-60"
              style={{ background: '#106f30' }}>
              {saving ? 'Creating...' : 'Create Farm'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AssignDevice() {
  const [step, setStep]           = useState(0)
  const [saving, setSaving]       = useState(false)
  const [showCreateFarm, setShowCreateFarm] = useState(false)
  const [customers, setCustomers]         = useState([])
  const [filteredFarms, setFilteredFarms] = useState([])
  const [filteredUsers, setFilteredUsers] = useState([])
  const [selectedCustomerId, setSelectedCustomerId] = useState('')
  const [deviceSearch, setDeviceSearch]     = useState('')
  const [deviceResults, setDeviceResults]   = useState([])
  const [searchLoading, setSearchLoading]   = useState(false)
  const [selectedDevice, setSelectedDevice] = useState(null)
  const searchRef = useRef(null)
  const [farmId, setFarmId]                     = useState('')
  const [subscriptionType, setSubscriptionType] = useState('1_year')
  const [installedBy, setInstalledBy]           = useState('')
  const [accessUsers, setAccessUsers]           = useState([])
  const [totalAmount, setTotalAmount]           = useState('')
  const [paid, setPaid]                         = useState('')
  const [modeOfPayment, setModeOfPayment]       = useState('')

  // Step 1 — serial_number default 0, rr_number replaces reference_number, no identifier_code
  const [deviceDetails, setDeviceDetails] = useState({
    device_name: '', pump_address: '', rr_number: '',
    serial_number: '0', flow_meter_installed: false,
  })

  // Step 2 — updated defaults: overload 45, underload 0
  const [basic, setBasic] = useState({
    auto_manual: true, overload_limit: 45, underload_limit: 0,
    on_time_delay: 30, star_run_delay: 10, over_voltage_limit: 480,
    under_voltage_limit: 250, dry_run_timer: 0, pump_flow_rate: 175,
    off_timer_mode: false, cyclic_timer_mode: false, spb_mode: false,
    notification_status: false, notification_interval: 15,
  })

  // Step 3 — updated defaults
  const [adv, setAdv] = useState({
    calibration_factor1: '7.20', calibration_factor2: '7.20', calibration_factor3: '7.20',
    oem_value: '0', water_sensor_type: '', time_to_surface_capture: '1',
    flow_meter_litres_per_pulse: '0.076', flow_meter_enable_disable: false,
    flow_meter_calibration_factor: '0.32517',
    api_token: '', chat_id: '', telegram_url: '',
    borewell_depth: '', motor_hp: '', latitude: '', longitude: '',
  })

  useEffect(() => {
    api.get('/customers?limit=200').then(r => setCustomers(r.data.customers)).catch(() => {})
  }, [])

  useEffect(() => {
    setFarmId(''); setAccessUsers([]); setFilteredFarms([]); setFilteredUsers([])
    if (!selectedCustomerId) return
    api.get(`/farms?limit=200&customer_id=${selectedCustomerId}`).then(r => setFilteredFarms(r.data.farms)).catch(() => {})
    api.get(`/assign/users-list?customer_id=${selectedCustomerId}`).then(r => setFilteredUsers(r.data.users)).catch(() => {})
  }, [selectedCustomerId])

  useEffect(() => {
    if (deviceSearch.length < 3) { setDeviceResults([]); return }
    clearTimeout(searchRef.current)
    searchRef.current = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const res = await api.get(`/assign/search-device?q=${deviceSearch}`)
        setDeviceResults(res.data.results)
      } catch {} finally { setSearchLoading(false) }
    }, 400)
  }, [deviceSearch])

  const toggleUser = (uid) => setAccessUsers(p => p.includes(uid) ? p.filter(id => id !== uid) : [...p, uid])

  const fetchFarmsForCustomer = () => {
    if (!selectedCustomerId) return
    api.get(`/farms?limit=200&customer_id=${selectedCustomerId}`).then(r => setFilteredFarms(r.data.farms)).catch(() => {})
  }

  const handleFarmCreated = (id, name) => {
    fetchFarmsForCustomer(); setFarmId(id); setShowCreateFarm(false)
    toast.success(`Farm "${name}" selected`)
  }

  const handleSubmit = async () => {
    if (!selectedDevice) { toast.error('Select a device'); return }
    if (!farmId)         { toast.error('Select a farm');   return }
    setSaving(true)
    try {
      await api.post('/assign/device', {
        uid: selectedDevice.uid, product_uid: selectedDevice.product_uid,
        farm_id: farmId, subscription_type: subscriptionType,
        installed_by: installedBy, access_user_ids: accessUsers,
        total_amount: totalAmount ? parseFloat(totalAmount) : null,
        paid: paid ? parseFloat(paid) : null,
        mode_of_payment: modeOfPayment || null,
        device_details: {
          device_name:          deviceDetails.device_name,
          pump_address:         deviceDetails.pump_address,
          reference_number:     deviceDetails.rr_number,
          serial_number:        deviceDetails.serial_number || '0',
          flow_meter_installed: deviceDetails.flow_meter_installed,
          identifier_code:      null,
        },
        basic_settings: basic,
        advanced_settings: {
          calibration_factor1:           adv.calibration_factor1           ? parseFloat(adv.calibration_factor1)           : null,
          calibration_factor2:           adv.calibration_factor2           ? parseFloat(adv.calibration_factor2)           : null,
          calibration_factor3:           adv.calibration_factor3           ? parseFloat(adv.calibration_factor3)           : null,
          oem_value:                     adv.oem_value                     ? parseFloat(adv.oem_value)                     : null,
          water_sensor_type:             adv.water_sensor_type             || null,
          time_to_surface_capture:       adv.time_to_surface_capture       ? parseInt(adv.time_to_surface_capture)         : null,
          flow_meter_litres_per_pulse:   adv.flow_meter_litres_per_pulse   ? parseFloat(adv.flow_meter_litres_per_pulse)   : null,
          flow_meter_enable_disable:     adv.flow_meter_enable_disable,
          flow_meter_calibration_factor: adv.flow_meter_calibration_factor ? parseFloat(adv.flow_meter_calibration_factor) : null,
          api_token:      adv.api_token    || null,
          chat_id:        adv.chat_id      || null,
          telegram_url:   adv.telegram_url || null,
          borewell_depth: adv.borewell_depth ? parseFloat(adv.borewell_depth) : null,
          motor_hp:       adv.motor_hp       ? parseInt(adv.motor_hp)          : null,
          latitude:       adv.latitude       ? parseFloat(adv.latitude)         : null,
          longitude:      adv.longitude      ? parseFloat(adv.longitude)        : null,
        },
      })
      toast.success('Device assigned successfully!')
      setStep(0); setSelectedDevice(null); setDeviceSearch('')
      setFarmId(''); setSelectedCustomerId('')
      setDeviceDetails({ device_name:'', pump_address:'', rr_number:'', serial_number:'0', flow_meter_installed:false })
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Assignment failed')
    } finally { setSaving(false) }
  }

  const selectedFarm     = filteredFarms.find(f => f.farm_id === farmId)
  const selectedCustomer = customers.find(c => c.cust_id === selectedCustomerId)
  const canGoNext        = step === 0 ? (!!selectedDevice && !!farmId) : true

  return (
    <div className="max-w-2xl">
      {showCreateFarm && <CreateFarmModal onClose={() => setShowCreateFarm(false)} onCreated={handleFarmCreated} />}

      <div className="mb-6">
        <h1 style={{ fontFamily: "'DM Serif Display', serif", color: '#106f30' }} className="text-2xl">Assign Device</h1>
        <p className="text-gray-500 text-sm mt-0.5">Link a device to a farm and configure its settings</p>
      </div>

      <StepIndicator current={step} />

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">

        {/* ── STEP 0 ─────────────────────────────────── */}
        {step === 0 && (
          <div className="flex flex-col gap-5">
            <h2 className="font-semibold text-gray-800 mb-1">Device & Farm</h2>

            <Field label="Search Device" required hint="Search by UID (min 4 characters from last)">
              <div className="relative">
                <Input placeholder="e.g. 865357062789704..."
                  value={deviceSearch}
                  onChange={e => { setDeviceSearch(e.target.value); setSelectedDevice(null) }} />
                {searchLoading && <p className="text-xs text-gray-400 mt-1">Searching...</p>}
                {deviceResults.length > 0 && !selectedDevice && (
                  <div className="absolute top-full left-0 right-0 z-50 bg-white border border-gray-200 rounded-xl shadow-lg mt-1 overflow-hidden">
                    {deviceResults.map(d => (
                      <button key={d.product_id} type="button"
                        onClick={() => {
                          if (d.is_assigned) {
                            toast.error(`Device ${d.uid} is already assigned to ${d.assigned_customer} — ${d.assigned_farm}`)
                            return
                          }
                          setSelectedDevice(d); setDeviceSearch(d.uid || d.product_name); setDeviceResults([])
                        }}
                        className={`w-full text-left px-4 py-3 border-b border-gray-50 last:border-0 transition-all ${d.is_assigned ? 'bg-red-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-gray-800">{d.product_name}</p>
                          {d.is_assigned
                            ? <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 flex-shrink-0">Assigned</span>
                            : <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 flex-shrink-0">Available</span>}
                        </div>
                        <p className="text-xs text-gray-400 font-mono mt-0.5">UID: {d.uid || 'Not assigned'} · SN: {d.serial_number || '—'}</p>
                        {d.is_assigned && (
                          <p className="text-xs text-red-500 mt-0.5">
                            Assigned to: {d.assigned_customer} ({d.assigned_customer_id}) → {d.assigned_farm}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {selectedDevice && (
                <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl mt-1">
                  <span className="text-green-600">✅</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-green-800">{selectedDevice.product_name}</p>
                    <p className="text-xs text-green-600 font-mono">UID: {selectedDevice.uid}</p>
                  </div>
                  <button onClick={() => { setSelectedDevice(null); setDeviceSearch('') }} className="text-gray-400 hover:text-gray-600">✕</button>
                </div>
              )}
            </Field>

            <Field label="Select Customer" required hint="Select a customer to filter farms and users below">
              <CustomerSelect customers={customers} value={selectedCustomerId} onChange={setSelectedCustomerId} />
              {selectedCustomer && <p className="text-xs text-green-600 mt-1">✅ {selectedCustomer.cust_name} — farms and users filtered below</p>}
            </Field>

            <Field label="Select Farm" required>
              <div className="flex gap-2">
                <Select value={farmId} onChange={e => setFarmId(e.target.value)} disabled={!selectedCustomerId}>
                  <option value="">{selectedCustomerId ? '— Select a farm —' : '— Select customer first —'}</option>
                  {filteredFarms.map(f => <option key={f.farm_id} value={f.farm_id}>{f.farm_name} ({f.device_count} devices)</option>)}
                </Select>
                <button type="button" onClick={() => setShowCreateFarm(true)} disabled={!selectedCustomerId}
                  className="flex-shrink-0 px-4 py-2.5 rounded-xl text-sm font-medium border-2 border-gray-200 text-gray-600 hover:bg-gray-50 whitespace-nowrap disabled:opacity-40">
                  + New Farm
                </button>
              </div>
              {selectedCustomerId && filteredFarms.length === 0 && <p className="text-xs text-amber-500 mt-1">No farms found — create one with + New Farm</p>}
              {selectedFarm && <p className="text-xs text-green-600 mt-1">✅ {selectedFarm.farm_name} — {selectedFarm.device_count} existing devices</p>}
            </Field>

            <Field label="Subscription Type">
              <Select value={subscriptionType} onChange={e => setSubscriptionType(e.target.value)}>
                <option value="1_year">1 Year</option>
              </Select>
            </Field>

            <Field label="Installed By">
              <Input placeholder="Technician or installer name" value={installedBy} onChange={e => setInstalledBy(e.target.value)} />
            </Field>

            <div className="grid grid-cols-3 gap-3">
              <Field label="Total Amount">
                <Input type="number" placeholder="0.00" value={totalAmount} onChange={e => setTotalAmount(e.target.value)} />
              </Field>
              <Field label="Paid">
                <Input type="number" placeholder="0.00" value={paid} onChange={e => setPaid(e.target.value)} />
              </Field>
              <Field label="Payment Mode">
                <Select value={modeOfPayment} onChange={e => setModeOfPayment(e.target.value)}>
                  <option value="">Select...</option>
                  <option value="cash">Cash</option>
                  <option value="upi">UPI</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cheque">Cheque</option>
                </Select>
              </Field>
            </div>

            <Field label="Grant Access To Users" hint={selectedCustomerId ? 'Showing eligible users under selected customer' : 'Select a customer first'}>
              <div className={`border-2 border-gray-200 rounded-xl overflow-hidden max-h-48 overflow-y-auto ${!selectedCustomerId ? 'opacity-50' : ''}`}>
                {!selectedCustomerId ? (
                  <p className="p-4 text-sm text-gray-400">Select a customer first to see users</p>
                ) : filteredUsers.length === 0 ? (
                  <p className="p-4 text-sm text-gray-400">No eligible users found under this customer</p>
                ) : filteredUsers.map(u => (
                  <label key={u.user_id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-0">
                    <input type="checkbox" checked={accessUsers.includes(u.user_id)} onChange={() => toggleUser(u.user_id)} className="w-4 h-4 accent-[#106f30]" />
                    <div>
                      <p className="text-sm text-gray-700 font-medium">{u.full_name}</p>
                      <p className="text-xs text-gray-400">{u.email || u.phone}</p>
                    </div>
                  </label>
                ))}
              </div>
              {accessUsers.length > 0 && <p className="text-xs text-green-600 mt-1">{accessUsers.length} user(s) selected</p>}
            </Field>
          </div>
        )}

        {/* ── STEP 1 ─────────────────────────────────── */}
        {step === 1 && (
          <div className="flex flex-col gap-5">
            <h2 className="font-semibold text-gray-800 mb-1">Device Details</h2>

            <Field label="Device / Pump Name">
              <Input placeholder="e.g. Main Pump, Borewell 1"
                value={deviceDetails.device_name}
                onChange={e => setDeviceDetails(d => ({ ...d, device_name: e.target.value }))} />
            </Field>

            <Field label="Installation Address">
              <textarea placeholder="Building, street, area, landmark..."
                value={deviceDetails.pump_address}
                onChange={e => setDeviceDetails(d => ({ ...d, pump_address: e.target.value }))}
                rows={2} className="px-3 py-2.5 rounded-xl border-2 border-gray-200 text-sm focus:border-[#106f30] focus:outline-none bg-white resize-none w-full" />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="RR Number">
                <Input placeholder="Enter RR number"
                  value={deviceDetails.rr_number}
                  onChange={e => setDeviceDetails(d => ({ ...d, rr_number: e.target.value }))} />
              </Field>
              <Field label="Serial Number">
                <Input placeholder="0"
                  value={deviceDetails.serial_number}
                  onChange={e => setDeviceDetails(d => ({ ...d, serial_number: e.target.value }))} />
              </Field>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-600">Flow Meter Installed?</label>
              <div className="flex gap-3">
                {[{ label: '❌ No', val: false }, { label: '✅ Yes', val: true }].map(opt => (
                  <button key={String(opt.val)} type="button"
                    onClick={() => setDeviceDetails(d => ({ ...d, flow_meter_installed: opt.val }))}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium border-2 transition-all
                      ${deviceDetails.flow_meter_installed === opt.val ? 'text-white border-transparent' : 'text-gray-600 border-gray-200'}`}
                    style={deviceDetails.flow_meter_installed === opt.val ? { background: '#106f30' } : {}}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 2 ─────────────────────────────────── */}
        {step === 2 && (
          <div className="flex flex-col gap-5">
            <h2 className="font-semibold text-gray-800 mb-1">Basic Settings</h2>

            <Field label="Device Mode">
              <div className="flex gap-3">
                {[{ label: '⚙️ Auto Mode', val: true }, { label: '🖐 Manual Mode', val: false }].map(opt => (
                  <button key={String(opt.val)} type="button"
                    onClick={() => setBasic(b => ({ ...b, auto_manual: opt.val }))}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium border-2 transition-all
                      ${basic.auto_manual === opt.val ? 'text-white border-transparent' : 'text-gray-600 border-gray-200'}`}
                    style={basic.auto_manual === opt.val ? { background: '#106f30' } : {}}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'overload_limit',       label: 'Overload Current (A)'        },
                { key: 'underload_limit',      label: 'Underload Current (A)'       },
                { key: 'on_time_delay',        label: 'On Time Delay (sec)'         },
                { key: 'star_run_delay',       label: 'Start Run Delay (sec)'       },
                { key: 'over_voltage_limit',   label: 'Over Voltage Limit (V)'      },
                { key: 'under_voltage_limit',  label: 'Under Voltage Limit (V)'     },
                { key: 'dry_run_timer',        label: 'Dry Run Cycle Time (min)'    },
                { key: 'pump_flow_rate',       label: 'Pump Flow Rate (L/min)'      },
                { key: 'notification_interval',label: 'Notification Interval (min)' },
              ].map(f => (
                <Field key={f.key} label={f.label}>
                  <Input type="number" value={basic[f.key]}
                    onChange={e => setBasic(b => ({ ...b, [f.key]: parseFloat(e.target.value) || 0 }))} />
                </Field>
              ))}
            </div>

            <div className="flex flex-col gap-2">
              {[
                { key: 'off_timer_mode',      label: 'Off Timer Mode'                 },
                { key: 'cyclic_timer_mode',   label: 'Cyclic Timer Mode'              },
                { key: 'spb_mode',            label: 'Single Phase Bypass (SPB) Mode' },
                { key: 'notification_status', label: 'Notification Status'            },
              ].map(t => (
                <Toggle key={t.key} label={t.label} value={basic[t.key]} onChange={v => setBasic(b => ({ ...b, [t.key]: v }))} />
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 3 ─────────────────────────────────── */}
        {step === 3 && (
          <div className="flex flex-col gap-5">
            <h2 className="font-semibold text-gray-800 mb-1">Advanced Settings</h2>
            <p className="text-xs text-gray-400 -mt-3">Typically configured by the backend team during installation.</p>

            <div className="bg-gray-50 rounded-xl p-4 flex flex-col gap-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Calibration</p>
              <div className="grid grid-cols-3 gap-3">
                {[1,2,3].map(n => (
                  <Field key={n} label={`Calibration ${n}`}>
                    <Input type="number" value={adv[`calibration_factor${n}`]}
                      onChange={e => setAdv(a => ({ ...a, [`calibration_factor${n}`]: e.target.value }))} />
                  </Field>
                ))}
              </div>
              <Field label="OEM Value">
                <Input type="number" value={adv.oem_value} onChange={e => setAdv(a => ({ ...a, oem_value: e.target.value }))} />
              </Field>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 flex flex-col gap-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Sensor & Flow Meter</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Water Sensor Type">
                  <Select value={adv.water_sensor_type} onChange={e => setAdv(a => ({ ...a, water_sensor_type: e.target.value }))}>
                    <option value="">Select...</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                  </Select>
                </Field>
                <Field label="Time to Surface Capture">
                  <Input type="number" value={adv.time_to_surface_capture}
                    onChange={e => setAdv(a => ({ ...a, time_to_surface_capture: e.target.value }))} />
                </Field>
                <Field label="Flow Meter L/Pulse">
                  <Input type="number" value={adv.flow_meter_litres_per_pulse}
                    onChange={e => setAdv(a => ({ ...a, flow_meter_litres_per_pulse: e.target.value }))} />
                </Field>
                <Field label="Flow Meter Calibration">
                  <Input type="number" value={adv.flow_meter_calibration_factor}
                    onChange={e => setAdv(a => ({ ...a, flow_meter_calibration_factor: e.target.value }))} />
                </Field>
              </div>
              <Toggle label="Flow Meter Enabled" value={adv.flow_meter_enable_disable}
                onChange={v => setAdv(a => ({ ...a, flow_meter_enable_disable: v }))} />
            </div>

            <div className="bg-gray-50 rounded-xl p-4 flex flex-col gap-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Borewell & Location</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Borewell Depth (ft)">
                  <Input type="number" placeholder="0" value={adv.borewell_depth}
                    onChange={e => setAdv(a => ({ ...a, borewell_depth: e.target.value }))} />
                </Field>
                <Field label="Motor HP">
                  <Input type="number" placeholder="0" value={adv.motor_hp}
                    onChange={e => setAdv(a => ({ ...a, motor_hp: e.target.value }))} />
                </Field>
                <Field label="Latitude">
                  <Input type="number" placeholder="12.9716" value={adv.latitude}
                    onChange={e => setAdv(a => ({ ...a, latitude: e.target.value }))} />
                </Field>
                <Field label="Longitude">
                  <Input type="number" placeholder="77.5946" value={adv.longitude}
                    onChange={e => setAdv(a => ({ ...a, longitude: e.target.value }))} />
                </Field>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 flex flex-col gap-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Telegram Notifications</p>
              <Field label="API Token">
                <Input placeholder="Telegram bot token" value={adv.api_token}
                  onChange={e => setAdv(a => ({ ...a, api_token: e.target.value }))} />
              </Field>
              <Field label="Chat ID">
                <Input placeholder="Telegram chat ID" value={adv.chat_id}
                  onChange={e => setAdv(a => ({ ...a, chat_id: e.target.value }))} />
              </Field>
              <Field label="Telegram URL">
                <Input placeholder="https://api.telegram.org/..." value={adv.telegram_url}
                  onChange={e => setAdv(a => ({ ...a, telegram_url: e.target.value }))} />
              </Field>
            </div>
          </div>
        )}

        {/* ── STEP 4 ─────────────────────────────────── */}
        {step === 4 && (
          <div className="flex flex-col gap-5">
            <h2 className="font-semibold text-gray-800 mb-1">Review & Confirm</h2>
            {[
              {
                title: 'Device & Farm',
                rows: [
                  ['Customer',     selectedCustomer?.cust_name || '—'],
                  ['Device',       selectedDevice?.product_name || '—'],
                  ['UID',          selectedDevice?.uid || '—'],
                  ['Farm',         selectedFarm?.farm_name || '—'],
                  ['Subscription', subscriptionType.replace('_', ' ')],
                  ['Installed By', installedBy || '—'],
                  ['Total Amount', totalAmount ? `₹${totalAmount}` : '—'],
                  ['Paid',         paid ? `₹${paid}` : '—'],
                  ['Payment Mode', modeOfPayment || '—'],
                ]
              },
              {
                title: 'Device Details',
                rows: [
                  ['Device Name',  deviceDetails.device_name     || '—'],
                  ['Address',      deviceDetails.pump_address     || '—'],
                  ['RR Number',    deviceDetails.rr_number        || '—'],
                  ['Serial Number',deviceDetails.serial_number    || '0'],
                  ['Flow Meter',   deviceDetails.flow_meter_installed ? 'Installed' : 'Not installed'],
                ]
              },
              {
                title: 'Basic Settings',
                rows: [
                  ['Mode',           basic.auto_manual ? 'Auto' : 'Manual'],
                  ['Overload Limit', `${basic.overload_limit} A`],
                  ['Underload Limit',`${basic.underload_limit} A`],
                  ['On Time Delay',  `${basic.on_time_delay} sec`],
                  ['Over Voltage',   `${basic.over_voltage_limit} V`],
                  ['Under Voltage',  `${basic.under_voltage_limit} V`],
                  ['Pump Flow Rate', `${basic.pump_flow_rate} L/min`],
                ]
              },
            ].map(section => (
              <div key={section.title} className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{section.title}</p>
                <div className="flex flex-col gap-2">
                  {section.rows.map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-4">
                      <span className="text-xs text-gray-400 flex-shrink-0">{label}</span>
                      <span className="text-xs font-medium text-gray-700 text-right">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {accessUsers.length > 0 && (
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Access Granted To</p>
                <div className="flex flex-wrap gap-2">
                  {accessUsers.map(uid => {
                    const u = filteredUsers.find(us => us.user_id === uid)
                    return u ? <span key={uid} className="px-3 py-1 rounded-full text-xs font-medium text-white" style={{ background: '#106f30' }}>{u.full_name}</span> : null
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-3 mt-8 pt-6 border-t border-gray-100">
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)}
              className="flex-1 py-3 rounded-xl text-sm font-medium border-2 border-gray-200 text-gray-600 hover:bg-gray-50">
              ← Back
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button onClick={() => setStep(s => s + 1)} disabled={!canGoNext}
              className="flex-1 py-3 rounded-xl text-white text-sm font-medium hover:opacity-90 disabled:opacity-40"
              style={{ background: '#106f30' }}>
              Next →
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={saving}
              className="flex-1 py-3 rounded-xl text-white text-sm font-medium hover:opacity-90 disabled:opacity-60"
              style={{ background: '#106f30' }}>
              {saving ? '⏳ Assigning...' : '✅ Assign Device'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
