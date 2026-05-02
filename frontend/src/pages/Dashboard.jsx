import Analytics from './Analytics'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { authAPI } from '../services/api'
import toast from 'react-hot-toast'
import Customers from './Customers'
import Users from './Users'
import Permissions from './Permissions'
import HierarchyManager from './HierarchyManager'
import Farms from './Farms'
import AssignDevice from './AssignDevice'
import DashboardHome from './DashboardHome'
import MyProfile from './MyProfile'
import Products from './Products'


export default function Dashboard() {
  const { user, permissions, logout, can } = useAuth()
  const navigate = useNavigate()
  const [activePage, setActivePage] = useState('dashboard')

  const handleLogout = async () => {
    try {
      const refresh = localStorage.getItem('refresh_token')
      if (refresh) await authAPI.logout({ refresh_token: refresh })
    } catch {}
    logout()
    navigate('/login')
    toast.success('Logged out successfully')
  }

  const navItems = [
    { icon: '🏠', label: 'Dashboard',    perm: 'dashboard_access',  page: 'dashboard'   },
    { icon: '📊', label: 'Analytics',    perm: 'analytics_access',  page: 'analytics'   },
    { icon: '📋', label: 'Reports',      perm: 'reports_view',      page: 'reports'     },
    { icon: '🔧', label: 'Devices',      perm: 'devices_assign',    page: 'devices'     },
    { icon: '📲', label: 'Assign Devices', perm: 'devices_assign', page: 'assign' },
    { icon: '🌾', label: 'Farms',        perm: 'farms_manage',      page: 'farms'       },
    { icon: '👥', label: 'Users',        perm: 'users_add',         page: 'users'       },
    { icon: '🏢', label: 'Customers',    perm: 'customers_add',     page: 'customers'   },
    { icon: '🌿', label: 'Hierarchy',    perm: 'hierarchy_view',    page: 'hierarchy'   },
    { icon: '🤝', label: 'Dealers',      perm: 'dealer_manage',     page: 'dealers'     },
    { icon: '🛍️', label: 'Products',     perm: 'products_add',      page: 'products'    },
    { icon: '🔐', label: 'Permissions',  perm: 'role_permissions_assign', page: 'permissions' },
    { icon: '🎫', label: 'Services',     perm: 'services_view',     page: 'services'    },
    { icon: '📱', label: 'SIM Database', perm: 'sim_manage',        page: 'sim'         },
    { icon: '📁', label: 'Content',      perm: 'content_manage',    page: 'content'     },
    { icon: '📜', label: 'Audit Logs',   perm: 'audit_logs_view',   page: 'audit'       },
    { icon: '👤', label: 'My Profile',   perm: 'dashboard_access',  page: 'profile'     },
    { icon: '🌐', label: 'Visit Site',   perm: 'dashboard_access',  page: 'visit'       },
  ].filter(item => can(item.perm))


  return (
    <div className="min-h-screen flex" style={{ background: '#f7ffd6' }}>
      <aside className="w-64 flex flex-col shadow-lg flex-shrink-0" style={{ background: '#106f30' }}>
        <div className="p-6 border-b border-green-700">
          <img src="/logo_vertical.png" alt="KH" className="h-14 mb-4" />
          <p className="text-white font-semibold text-sm">{user?.full_name}</p>
          <p className="text-green-200 text-xs mt-0.5">{user?.role_name}</p>
          <p className="text-green-300 text-xs">{user?.customer_name}</p>
        </div>
        <nav className="flex-1 p-4 flex flex-col gap-1 overflow-y-auto">
          {navItems.map(item => (
            <button key={item.label}
              onClick={() => setActivePage(item.page)}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-left transition-all
                ${activePage === item.page
                  ? 'bg-green-700 text-white'
                  : 'text-green-100 hover:bg-green-700'
                }`}>
              <span>{item.icon}</span>{item.label}
            </button>
          ))}
        </nav>
        <div className="p-4 border-t border-green-700">
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-red-200 hover:bg-red-900/30 text-sm font-medium transition-all">
            <span>🚪</span> Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 p-8 overflow-y-auto">
        {activePage === 'dashboard'   && <DashboardHome user={user} permissions={permissions} />}
        {activePage === 'customers'   && <Customers />}
        {activePage === 'hierarchy'   && <HierarchyManager />}
        {activePage === 'users'       && <Users />}
        {activePage === 'permissions' && <Permissions />}
        {activePage === 'farms' && <Farms />}
        {activePage === 'assign' && <AssignDevice />}
        {activePage === 'profile' && <MyProfile />}
        {activePage === 'products' && <Products />}
        {activePage === 'analytics'   && <Analytics />}
        {activePage === 'reports'     && <ComingSoon title="Reports"      icon="📋" />}
        {activePage === 'devices'     && <ComingSoon title="Devices"      icon="🔧" />}
        {activePage === 'dealers'     && <ComingSoon title="Dealers"      icon="🤝" />}
        {activePage === 'services'    && <ComingSoon title="Services"     icon="🎫" />}
        {activePage === 'sim'         && <ComingSoon title="SIM Database" icon="📱" />}
        {activePage === 'content'     && <ComingSoon title="Content"      icon="📁" />}
        {activePage === 'audit'       && <ComingSoon title="Audit Logs"   icon="📜" />}
        {activePage === 'profile'     && <ComingSoon title="My Profile"   icon="👤" />}
        {activePage === 'visit'       && (() => { window.open('https://krishihrudya.com', '_blank'); setActivePage('dashboard'); return null })()} 
      </main>
    </div>
  )
}

function ComingSoon({ title, icon }) {
  return (
    <div className="flex flex-col items-center justify-center h-96 text-center">
      <p className="text-5xl mb-4">{icon}</p>
      <h2 style={{ fontFamily: "'DM Serif Display', serif", color: '#106f30' }} className="text-2xl mb-2">
        {title}
      </h2>
      <p className="text-gray-400 text-sm">This section is being built. Coming soon.</p>
    </div>
  )
}
