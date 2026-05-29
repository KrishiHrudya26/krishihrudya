import { Link } from 'react-router-dom'
export default function Unauthorized() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#f7ffd6' }}>
      <div className="text-center">
        <p className="text-6xl mb-4">🚫</p>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h1>
        <p className="text-gray-500 mb-6">You don't have permission to view this page.</p>
        <Link to="/dashboard" className="px-6 py-2 rounded-xl text-white text-sm font-medium"
          style={{ background: '#106f30' }}>
          Back to Dashboard
        </Link>
      </div>
    </div>
  )
}
