import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import Sidebar from './components/layout/Sidebar'
import Header from './components/layout/Header'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import LiveFeedPage from './pages/LiveFeedPage'
import StudentsPage from './pages/StudentsPage'
import StudentDetailPage from './pages/StudentDetailPage'
import AttendancePage from './pages/AttendancePage'
import ExitRulesPage from './pages/ExitRulesPage'
import EventsPage from './pages/EventsPage'
import LibraryPage from './pages/LibraryPage'
import WalletPage from './pages/WalletPage'
import ElectionsPage from './pages/ElectionsPage'
import ReportsPage from './pages/ReportsPage'
import HealthPage from './pages/HealthPage'
import AdminUsersPage from './pages/AdminUsersPage'
import AuditLogPage from './pages/AuditLogPage'

function AuthGuard({ children }: { children: React.ReactNode }) {
    const token = useAuthStore((s) => s.token)
    if (!token) return <Navigate to="/login" replace />
    return <>{children}</>
}

function DashboardLayout() {
    return (
        <div className="flex h-screen overflow-hidden">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden">
                <Header />
                <main className="flex-1 overflow-y-auto p-6">
                    <Routes>
                        <Route path="/" element={<DashboardPage />} />
                        <Route path="/live-feed" element={<LiveFeedPage />} />
                        <Route path="/students" element={<StudentsPage />} />
                        <Route path="/students/:id" element={<StudentDetailPage />} />
                        <Route path="/attendance" element={<AttendancePage />} />
                        <Route path="/exit-rules" element={<ExitRulesPage />} />
                        <Route path="/events" element={<EventsPage />} />
                        <Route path="/library" element={<LibraryPage />} />
                        <Route path="/wallet" element={<WalletPage />} />
                        <Route path="/elections" element={<ElectionsPage />} />
                        <Route path="/reports" element={<ReportsPage />} />
                        <Route path="/health" element={<HealthPage />} />
                        <Route path="/admin-users" element={<AdminUsersPage />} />
                        <Route path="/audit-log" element={<AuditLogPage />} />
                    </Routes>
                </main>
            </div>
        </div>
    )
}

export default function App() {
    return (
        <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/*" element={<AuthGuard><DashboardLayout /></AuthGuard>} />
        </Routes>
    )
}
