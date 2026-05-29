import { createContext, useContext, useState, useEffect } from 'react'

const PortalAuthContext = createContext(null)

export function PortalAuthProvider({ children }) {
  const [user, setUser]         = useState(null)
  const [permissions, setPerms] = useState({})
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    const token     = localStorage.getItem('portal_access_token') || sessionStorage.getItem('portal_access_token')
    const savedUser = localStorage.getItem('portal_user') || sessionStorage.getItem('portal_user')
    const savedPerms = localStorage.getItem('portal_permissions') || sessionStorage.getItem('portal_permissions')
    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser))
        setPerms(JSON.parse(savedPerms || '{}'))
      } catch {}
    }
    setLoading(false)
  }, [])

    const login = (data, remember = true) => {
    const storage = localStorage
    storage.setItem('portal_access_token',  data.access_token)
    storage.setItem('portal_refresh_token', data.refresh_token)
    storage.setItem('portal_user',          JSON.stringify(data.user))
    storage.setItem('portal_permissions',   JSON.stringify(data.user.permissions || {}))
    localStorage.setItem('portal_storage_type', 'local')
    setUser(data.user)
    setPerms(data.user.permissions || {})
  }

  const logout = () => {
    localStorage.removeItem('portal_access_token')
    localStorage.removeItem('portal_refresh_token')
    localStorage.removeItem('portal_user')
    localStorage.removeItem('portal_permissions')
    sessionStorage.removeItem('portal_access_token')
    sessionStorage.removeItem('portal_refresh_token')
    sessionStorage.removeItem('portal_user')
    sessionStorage.removeItem('portal_permissions')
    localStorage.removeItem('portal_storage_type')
    setUser(null)
    setPerms({})
  }

  const can     = (perm) => permissions[perm] === 1
  const isAdmin = user?.bypass_org_scope || can('services_manage')

  return (
    <PortalAuthContext.Provider value={{ user, permissions, loading, login, logout, can, isAdmin }}>
      {children}
    </PortalAuthContext.Provider>
  )
}

export const usePortalAuth = () => useContext(PortalAuthContext)
