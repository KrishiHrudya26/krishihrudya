import { useState, useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import toast from 'react-hot-toast'

export default function Permissions() {
  const { can } = useAuth()
  const [data, setData]           = useState(null)
  const [loading, setLoading]     = useState(true)
  const [selectedRole, setSelectedRole] = useState(null)
  const [edited, setEdited]       = useState({})
  const [saving, setSaving]       = useState(false)
  const [hasChanges, setHasChanges] = useState(false)

  const fetchRoles = async () => {
    setLoading(true)
    try {
      const res = await api.get('/permissions/roles')
      setData(res.data)
      if (res.data.roles.length > 0) {
        setSelectedRole(res.data.roles[0])
        setEdited({ ...res.data.roles[0].permissions })
      }
    } catch {
      toast.error('Failed to load permissions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchRoles() }, [])

  const selectRole = (role) => {
    setSelectedRole(role)
    setEdited({ ...role.permissions })
    setHasChanges(false)
  }

  const togglePermission = (perm) => {
    if (!can('role_permissions_assign')) return
    const newVal = edited[perm] === 1 ? 0 : 1
    setEdited(e => ({ ...e, [perm]: newVal }))
    setHasChanges(true)
  }

  const handleSave = async () => {
    if (!selectedRole) return
    setSaving(true)
    try {
      await api.put(`/permissions/roles/${selectedRole.role_id}`, { permissions: edited })
      toast.success('Permissions updated')
      setHasChanges(false)
      fetchRoles()
    } catch {
      toast.error('Failed to save permissions')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    if (!selectedRole) return
    setEdited({ ...selectedRole.permissions })
    setHasChanges(false)
  }

  if (loading) return <div className="p-12 text-center text-gray-400">Loading...</div>
  if (!data) return null

  const enabledCount = Object.values(edited).filter(v => v === 1).length

  return (
    <div className="flex gap-6 h-full">
      {/* Left — Role list */}
      <div className="w-56 flex-shrink-0">
        <h1 style={{ fontFamily: "'DM Serif Display', serif", color: '#106f30' }} className="text-2xl mb-4">
          Permissions
        </h1>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {data.roles.map(role => (
            <button key={role.role_id}
              onClick={() => selectRole(role)}
              className={`w-full text-left px-4 py-3 border-b border-gray-50 transition-all
                ${selectedRole?.role_id === role.role_id
                  ? 'bg-green-50 border-l-4 border-l-[#106f30]'
                  : 'hover:bg-gray-50'
                }`}>
              <p className={`text-sm font-medium ${selectedRole?.role_id === role.role_id ? 'text-[#106f30]' : 'text-gray-800'}`}>
                {role.name}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {Object.values(role.permissions).filter(v => v === 1).length} permissions
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Right — Permission editor */}
      {selectedRole && (
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">{selectedRole.name}</h2>
              <p className="text-sm text-gray-400">
                {enabledCount} of {data.all_permissions.length} permissions enabled
              </p>
            </div>
            {can('role_permissions_assign') && hasChanges && (
              <div className="flex gap-2">
                <button onClick={handleReset}
                  className="px-4 py-2 rounded-xl text-sm border-2 border-gray-200 text-gray-600 hover:bg-gray-50">
                  Reset
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="px-4 py-2 rounded-xl text-sm text-white font-medium hover:opacity-90 disabled:opacity-60"
                  style={{ background: '#106f30' }}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            )}
          </div>

          {/* Permission groups */}
          <div className="flex flex-col gap-4">
            {Object.entries(data.permission_groups).map(([groupName, perms]) => (
              <div key={groupName} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between"
                  style={{ background: '#f9fdf5' }}>
                  <p className="font-semibold text-gray-700 text-sm">{groupName}</p>
                  <p className="text-xs text-gray-400">
                    {perms.filter(p => edited[p] === 1).length}/{perms.length} enabled
                  </p>
                </div>
                <div className="p-4 grid grid-cols-2 gap-3">
                  {perms.map(perm => {
                    const isOn = edited[perm] === 1
                    const label = data.permission_labels[perm] || perm
                    return (
                      <div key={perm}
                        onClick={() => togglePermission(perm)}
                        className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all
                          ${can('role_permissions_assign') ? 'cursor-pointer' : 'cursor-default'}
                          ${isOn
                            ? 'border-[#106f30] bg-green-50'
                            : 'border-gray-100 bg-gray-50 hover:border-gray-200'
                          }`}>
                        {/* Toggle */}
                        <div className={`w-9 h-5 rounded-full flex-shrink-0 relative transition-all
                          ${isOn ? 'bg-[#106f30]' : 'bg-gray-300'}`}>
                          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all
                            ${isOn ? 'left-4' : 'left-0.5'}`} />
                        </div>
                        <div className="min-w-0">
                          <p className={`text-xs font-medium leading-tight ${isOn ? 'text-[#106f30]' : 'text-gray-600'}`}>
                            {label}
                          </p>
                          <p className="text-xs text-gray-400 font-mono mt-0.5">{perm}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          {!can('role_permissions_assign') && (
            <p className="text-center text-sm text-gray-400 mt-6">
              You have view-only access to permissions.
            </p>
          )}
        </div>
      )}
    </div>
  )
}