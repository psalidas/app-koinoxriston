import { Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Apartments from './pages/Apartments'
import Millesimes from './pages/Millesimes'
import Expenses from './pages/Expenses'
import Receipts from './pages/Receipts'
import Statements from './pages/Statements'
import StatementView from './pages/StatementView'
import NoticeView from './pages/NoticeView'
import Payments from './pages/Payments'
import ApartmentLedger from './pages/ApartmentLedger'
import Fund from './pages/Fund'
import ImportExport from './pages/ImportExport'
import Users from './pages/admin/Users'
import AuditLog from './pages/admin/AuditLog'
import BuildingSettings from './pages/admin/BuildingSettings'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/apartments" element={<Apartments />} />
        <Route path="/millesimes" element={<Millesimes />} />
        <Route path="/expenses" element={<Expenses />} />
        <Route path="/receipts" element={<Receipts />} />
        <Route path="/statements" element={<Statements />} />
        <Route path="/statements/:id" element={<StatementView />} />
        <Route path="/statements/:id/notice/:apartmentId" element={<NoticeView />} />
        <Route path="/payments" element={<Payments />} />
        <Route path="/apartments/:id/ledger" element={<ApartmentLedger />} />
        <Route path="/fund" element={<Fund />} />
        <Route path="/import" element={<ImportExport />} />
        <Route path="/admin/users" element={<Users />} />
        <Route path="/admin/audit" element={<AuditLog />} />
        <Route path="/admin/settings" element={<BuildingSettings />} />
      </Route>
    </Routes>
  )
}
