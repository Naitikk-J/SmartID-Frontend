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
import RfidDashboardPage from './pages/RfidDashboardPage'
import RfidCardsPage from './pages/RfidCardsPage'
import RfidReadersPage from './pages/RfidReadersPage'
import RfidTransactionsPage from './pages/RfidTransactionsPage'
import RfidLiveMonitorPage from './pages/RfidLiveMonitorPage'
import CampusEntryAdminPage from './pages/CampusEntryAdminPage'
import StudentPortalLoginPage from './pages/StudentPortalLoginPage'
import StudentPassPage from './pages/StudentPassPage'
import ScannerCameraPage from './pages/ScannerCameraPage'

function AuthGuard({ children }: { children: React.ReactNode }) {
    const token = useAuthStore((s) => s.token)
    if (!token) return <Navigate to="/login" replace />
    return <>{children}</>
}

function getRoleHome(role?: string) {
    // Camera-only scanner roles land directly on the scanner page.
    // (Spec: "scanner person can log in with their credential ...
    // they will open their camera. They have only access to camera.")
    if (role === 'SECURITY_GUARD') return '/scanner'
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
        <div className="flex h-screen overflow-hidden bg-bg-dark text-text-primary">
            <Sidebar />
            <div className="flex-1 flex flex-col overflow-hidden relative">
                {/* Calm ambient gradients — far less loud than before. */}
                <div className="pointer-events-none absolute -top-32 right-[-10%] w-[35%] h-[35%] bg-primary/5 blur-[120px] rounded-full" />
                <div className="pointer-events-none absolute bottom-[-10%] left-[-10%] w-[30%] h-[30%] bg-accent/5 blur-[120px] rounded-full" />

                <Header />
                <main className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-10 py-6 md:py-8 custom-scrollbar relative z-10">
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
                            <Route path="/rfid" element={<PermissionRoute permission="RFID Dashboard"><RfidDashboardPage /></PermissionRoute>} />
                            <Route path="/rfid/cards" element={<PermissionRoute permission="RFID Cards"><RfidCardsPage /></PermissionRoute>} />
                            <Route path="/rfid/readers" element={<PermissionRoute permission="RFID Readers"><RfidReadersPage /></PermissionRoute>} />
                            <Route path="/rfid/transactions" element={<PermissionRoute permission="RFID Transactions"><RfidTransactionsPage /></PermissionRoute>} />
                            <Route path="/rfid/live" element={<PermissionRoute permission="RFID Live Monitor"><RfidLiveMonitorPage /></PermissionRoute>} />
                            <Route path="/campus-entry" element={<PermissionRoute permission="Campus Entry"><CampusEntryAdminPage /></PermissionRoute>} />
                            <Route path="*" element={<Navigate to={getRoleHome(role)} replace />} />
                        </Routes>
                    </div>
                </main>
            </div>
        </div>
    )
}

function ScannerAuthGuard({ children }: { children: React.ReactNode }) {
    const token = useAuthStore((s) => s.token)
    const role = useAuthStore((s) => s.user?.role)
    if (!token) return <Navigate to="/login" replace />
    // SECURITY_GUARD and EVENT_MANAGER are the intended camera-only
    // roles; SUPER_ADMIN / HOD can also open the scanner for testing.
    const allowed = ['SECURITY_GUARD', 'EVENT_MANAGER', 'SUPER_ADMIN', 'HOD']
    if (!allowed.includes(role || '')) {
        return <Navigate to={getRoleHome(role)} replace />
    }
    return <>{children}</>
}

export default function App() {
    return (
        <Routes>
            {/* Admin console */}
            <Route path="/login" element={<LoginPage />} />

            {/* Scanner — full-screen camera, isolated from the admin chrome */}
            <Route path="/scanner" element={<ScannerAuthGuard><ScannerCameraPage /></ScannerAuthGuard>} />

            {/* Student portal — separate auth namespace (STUDENT_AUTH_KEY),
                NOT gated by the admin AuthGuard. */}
            <Route path="/student/login" element={<StudentPortalLoginPage />} />
            <Route path="/student/pass" element={<StudentPassPage />} />
            <Route path="/student" element={<Navigate to="/student/login" replace />} />

            {/* Admin dashboard (catch-all) */}
            <Route path="/*" element={<AuthGuard><DashboardLayout /></AuthGuard>} />
        </Routes>
    )
}
