import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { canRoleView } from './hooks/usePermission'
import Sidebar from './components/layout/Sidebar'
import Header from './components/layout/Header'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import LiveFeedPage from './pages/LiveFeedPage'
import StudentsPage from './pages/StudentsPage'
import StudentDetailPage from './pages/StudentDetailPage'
import HostellersPage from './pages/HostellersPage'
import QrProjectorPage from './pages/QrProjectorPage'
import QrManagePage from './pages/QrManagePage'
import AttendancePage from './pages/AttendancePage'
import ExitRulesPage from './pages/ExitRulesPage'
import EventsPage from './pages/EventsPage'
import LibraryPage from './pages/LibraryPage'
import ElectionsPage from './pages/ElectionsPage'
import ReportsPage from './pages/ReportsPage'
import HealthPage from './pages/HealthPage'
import AdminUsersPage from './pages/AdminUsersPage'
import AuditLogPage from './pages/AuditLogPage'
import StudentAuthLogsPage from './pages/StudentAuthLogsPage'
import GeofencingPage from './pages/GeofencingPage'

function AuthGuard({ children }: { children: React.ReactNode }) {
    const token = useAuthStore((s) => s.token)
    if (!token) return <Navigate to="/login" replace />
    return <>{children}</>
}

function getRoleHome(role?: string) {
    if (role === 'SECURITY_GUARD') return '/qr-projector'
    if (role === 'WARDEN') return '/qr-projector'
    return '/'
}

function PermissionRoute({ permission, children }: { permission: string, children: React.ReactNode }) {
    const user = useAuthStore((s) => s.user)
    const role = user?.role || 'SECURITY_GUARD'

    if (!canRoleView(role, permission)) {
        return <Navigate to={getRoleHome(role)} replace />
    }

    return <>{children}</>
}

function DashboardLayout() {
    const user = useAuthStore((s) => s.user)
    const role = user?.role

    return (
        <div className="flex h-screen overflow-hidden bg-bg-dark selection:bg-primary/30">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden relative">
                {/* Background decorative elements */}
                <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/10 blur-[120px] rounded-full pointer-events-none" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[30%] h-[30%] bg-accent/10 blur-[100px] rounded-full pointer-events-none" />

                <Header />
                <main className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar relative z-10">
                    <div className="max-w-7xl mx-auto">
                        <Routes>
                            <Route path="/" element={<PermissionRoute permission="Dashboard"><DashboardPage /></PermissionRoute>} />
                            <Route path="/live-feed" element={<PermissionRoute permission="Live Feed"><LiveFeedPage /></PermissionRoute>} />
                            <Route path="/students" element={<PermissionRoute permission="Students"><StudentsPage /></PermissionRoute>} />
                            <Route path="/students/:id" element={<PermissionRoute permission="Students"><StudentDetailPage /></PermissionRoute>} />
                            <Route path="/hostellers" element={<PermissionRoute permission="Hostellers"><HostellersPage /></PermissionRoute>} />
                            <Route path="/qr-projector" element={<PermissionRoute permission="QR Projector"><QrProjectorPage /></PermissionRoute>} />
                            <Route path="/qr-manage" element={<PermissionRoute permission="QR Manage"><QrManagePage /></PermissionRoute>} />
                            <Route path="/attendance" element={<PermissionRoute permission="Attendance"><AttendancePage /></PermissionRoute>} />
                            <Route path="/exit-rules" element={<PermissionRoute permission="Exit Rules"><ExitRulesPage /></PermissionRoute>} />
                            <Route path="/events" element={<PermissionRoute permission="Events"><EventsPage /></PermissionRoute>} />
                            <Route path="/library" element={<PermissionRoute permission="Library"><LibraryPage /></PermissionRoute>} />
                            <Route path="/elections" element={<PermissionRoute permission="Elections"><ElectionsPage /></PermissionRoute>} />
                            <Route path="/reports" element={<PermissionRoute permission="Reports"><ReportsPage /></PermissionRoute>} />
                            <Route path="/health" element={<PermissionRoute permission="Health"><HealthPage /></PermissionRoute>} />
                            <Route path="/admin-users" element={<PermissionRoute permission="Admin Users"><AdminUsersPage /></PermissionRoute>} />
                            <Route path="/geofencing" element={<PermissionRoute permission="Geofencing"><GeofencingPage /></PermissionRoute>} />
                            <Route path="/audit-log" element={<PermissionRoute permission="Audit Log"><AuditLogPage /></PermissionRoute>} />
                            <Route path="/student-auth-logs" element={<PermissionRoute permission="Student Auth Logs"><StudentAuthLogsPage /></PermissionRoute>} />
                            <Route path="*" element={<Navigate to={getRoleHome(role)} replace />} />
                        </Routes>
                    </div>
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
