import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Runs from './pages/Runs.jsx'
import RunDetails from './pages/RunDetails.jsx'
import Failures from './pages/Failures.jsx'
import FailureDetails from './pages/FailureDetails.jsx'
import Reports from './pages/Reports.jsx'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/runs" element={<Runs />} />
        <Route path="/runs/:id" element={<RunDetails />} />
        <Route path="/failures" element={<Failures />} />
        <Route path="/failures/:id" element={<FailureDetails />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  )
}
