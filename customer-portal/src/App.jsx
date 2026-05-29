import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { PortalAuthProvider, usePortalAuth } from './PortalAuthContext'
import Login    from './pages/Login'
import Register from './pages/Register'
import Services from './pages/Services'

function ProtectedRoute({ children }) {
  const { user, loading } = usePortalAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#f7ffd6' }}>
      <p className="text-gray-400 text-sm">Loading...</p>
    </div>
  )
  return user ? children : <Navigate to="/login" replace />
}

function PublicRoute({ children }) {
  const { user, loading } = usePortalAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#f7ffd6' }}>
      <p className="text-gray-400 text-sm">Loading...</p>
    </div>
  )
  return user ? <Navigate to="/services" replace /> : children
}

function PortalLayout({ children }) {
  const { user, logout, isAdmin } = usePortalAuth()
  return (
    <div className="min-h-screen" style={{ background: '#f7ffd6' }}>
      <div className="border-b border-green-100 bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          <img src="/logo_horizontal.png" alt="KrishiHrudya" className="h-8" />
          <div className="flex items-center gap-4">
            {isAdmin && (
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                Admin
              </span>
            )}
            <span className="text-sm text-gray-600 hidden sm:block">{user?.full_name}</span>
            <button onClick={logout}
              className="px-3 py-1.5 rounded-xl text-xs font-medium border-2 border-gray-200 text-gray-600 hover:bg-gray-50">
              Sign out
            </button>
          </div>
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-6 py-8">
        {children}
      </div>
    </div>
  )
}

export default function App() {
  return (
    <PortalAuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{ duration: 4000 }} />
        <Routes>
          <Route path="/login"    element={<PublicRoute><Login /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
          <Route path="/services" element={
            <ProtectedRoute>
              <PortalLayout>
                <Services />
              </PortalLayout>
            </ProtectedRoute>
          } />
          <Route path="*" element={<Navigate to="/services" replace />} />
        </Routes>
      </BrowserRouter>
    </PortalAuthProvider>
  )
}
