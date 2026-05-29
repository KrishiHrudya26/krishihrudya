import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import Unauthorized from './pages/Unauthorized'
import Register from './pages/Register'
import ContentPage from "./pages/ContentPage";
import BoreholeIntelligence from './pages/BoreholeIntelligence'
import ValveSetup from './pages/ValveSetup'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" />
        <Routes>
	  <Route path="/register" element={<Register />} />
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route path="/content" element={<ContentPage />} />
          <Route path="/dashboard" element={
            <ProtectedRoute><Dashboard /></ProtectedRoute>
          } />
          <Route path="/borewell-intelligence" element={
            <ProtectedRoute><BoreholeIntelligence /></ProtectedRoute>
          } />
          <Route path="/valve" element={<ValveSetup />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
