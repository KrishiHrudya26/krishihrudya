import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, requiredPermission }) {
  const { user, loading, can } = useAuth()
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#f7ffd6' }}>
      <div className="animate-spin w-8 h-8 border-4 border-[#106f30] border-t-transparent rounded-full" />
    </div>
  )
  if (!user) return <Navigate to="/login" replace />
  if (requiredPermission && !can(requiredPermission)) return <Navigate to="/unauthorized" replace />
  return children
}
