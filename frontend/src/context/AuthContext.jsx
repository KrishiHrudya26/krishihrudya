import { createContext, useContext, useState, useEffect } from 'react'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [permissions, setPermissions] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('access_token')
    const savedUser = localStorage.getItem('user')
    const savedPerms = localStorage.getItem('permissions')
    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser))
        setPermissions(JSON.parse(savedPerms || '{}'))
      } catch {}
    }
    setLoading(false)
  }, [])

  const login = (data) => {
    localStorage.setItem('access_token', data.access_token)
    localStorage.setItem('refresh_token', data.refresh_token)
    localStorage.setItem('user', JSON.stringify(data.user))
    localStorage.setItem('permissions', JSON.stringify(data.user.permissions || {}))
    setUser(data.user)
    setPermissions(data.user.permissions || {})
  }

  const logout = () => {
    localStorage.clear()
    setUser(null)
    setPermissions({})
  }

  const can = (permission) => permissions[permission] === 1

  return (
    <AuthContext.Provider value={{ user, permissions, loading, login, logout, can }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
