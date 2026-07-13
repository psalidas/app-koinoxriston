import { Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { ManagerOutlet } from './components/ManagerOutlet'
import Login from './pages/Login'
import MagicRedeem from './pages/MagicRedeem'
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
import Announcements from './pages/Announcements'
import Tickets from './pages/Tickets'
import Contracts from './pages/Contracts'
import Portal from './pages/Portal'
import MyProfile from './pages/MyProfile'
import Topics from './pages/Topics'
import TopicView from './pages/TopicView'
import Polls from './pages/Polls'
import PollView from './pages/PollView'
import Assemblies from './pages/Assemblies'
import AssemblyView from './pages/AssemblyView'
import Documents from './pages/Documents'
import Directory from './pages/Directory'
import Users from './pages/admin/Users'
import AuditLog from './pages/admin/AuditLog'
import BuildingSettings from './pages/admin/BuildingSettings'
import InviteSettings from './pages/admin/InviteSettings'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/magic" element={<MagicRedeem />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        {/* Shared (managers + residents) */}
        <Route path="/portal" element={<Portal />} />
        <Route path="/my-profile" element={<MyProfile />} />
        <Route path="/announcements" element={<Announcements />} />
        <Route path="/tickets" element={<Tickets />} />
        <Route path="/topics" element={<Topics />} />
        <Route path="/topics/:id" element={<TopicView />} />
        <Route path="/polls" element={<Polls />} />
        <Route path="/polls/:id" element={<PollView />} />
        <Route path="/assemblies" element={<Assemblies />} />
        <Route path="/assemblies/:id" element={<AssemblyView />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/directory" element={<Directory />} />
        <Route path="/statements/:id/notice/:apartmentId" element={<NoticeView />} />

        {/* Manager-only */}
        <Route element={<ManagerOutlet />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/apartments" element={<Apartments />} />
          <Route path="/millesimes" element={<Millesimes />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/receipts" element={<Receipts />} />
          <Route path="/statements" element={<Statements />} />
          <Route path="/statements/:id" element={<StatementView />} />
          <Route path="/payments" element={<Payments />} />
          <Route path="/apartments/:id/ledger" element={<ApartmentLedger />} />
          <Route path="/fund" element={<Fund />} />
          <Route path="/contracts" element={<Contracts />} />
          <Route path="/import" element={<ImportExport />} />
          <Route path="/admin/users" element={<Users />} />
          <Route path="/admin/invites" element={<InviteSettings />} />
          <Route path="/admin/audit" element={<AuditLog />} />
          <Route path="/admin/settings" element={<BuildingSettings />} />
        </Route>
      </Route>
    </Routes>
  )
}
