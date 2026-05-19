import { NavLink } from 'react-router-dom'
import { usePermission } from '../../hooks/usePermission'
import { useAuthStore } from '../../store/authStore'
import { useUIStore } from '../../store/uiStore'
import {
    LayoutDashboard, Radio, Users, ClipboardCheck, DoorOpen, Calendar,
    BookOpen, Vote, BarChart3, Heart, Shield, ScrollText, LogOut, X, Home,
    QrCode, MapPinned, Settings2,
} from 'lucide-react'
import api from '../../api/axios'

// Sidebar is grouped to give the nav a sense of hierarchy rather
// than a flat 17-item list. Groups appear top-to-bottom only when
// at least one of their items is visible to the current role.
const navGroups: Array<{
    title: string
    items: Array<{ path: string; label: string; icon: typeof LayoutDashboard; permission: string }>
}> = [
    {
        title: 'Overview',
        items: [
            { path: '/', label: 'Dashboard', icon: LayoutDashboard, permission: 'Dashboard' },
            { path: '/live-feed', label: 'Live Feed', icon: Radio, permission: 'Live Feed' },
        ],
    },
    {
        title: 'Identity',
        items: [
            { path: '/students', label: 'Students', icon: Users, permission: 'Students' },
            { path: '/hostellers', label: 'Hostellers', icon: Home, permission: 'Hostellers' },
            { path: '/admin-users', label: 'Admin Users', icon: Shield, permission: 'Admin Users' },
        ],
    },
    {
        title: 'Access',
        items: [
            { path: '/qr-projector', label: 'QR Projector', icon: QrCode, permission: 'QR Projector' },
            { path: '/qr-manage', label: 'QR Manage', icon: Settings2, permission: 'QR Manage' },
            { path: '/exit-rules', label: 'Exit Rules', icon: DoorOpen, permission: 'Exit Rules' },
            { path: '/geofencing', label: 'Geofencing', icon: MapPinned, permission: 'Geofencing' },
        ],
    },
    {
        title: 'Programs',
        items: [
            { path: '/attendance', label: 'Attendance', icon: ClipboardCheck, permission: 'Attendance' },
            { path: '/events', label: 'Events', icon: Calendar, permission: 'Events' },
            { path: '/library', label: 'Library', icon: BookOpen, permission: 'Library' },
            { path: '/elections', label: 'Elections', icon: Vote, permission: 'Elections' },
        ],
    },
    {
        title: 'Operations',
        items: [
            { path: '/reports', label: 'Reports', icon: BarChart3, permission: 'Reports' },
            { path: '/health', label: 'Health', icon: Heart, permission: 'Health' },
            { path: '/audit-log', label: 'Audit Log', icon: ScrollText, permission: 'Audit Log' },
            { path: '/student-auth-logs', label: 'Auth Logs', icon: Shield, permission: 'Student Auth Logs' },
        ],
    },
]

export default function Sidebar() {
    const { canView } = usePermission()
    const user = useAuthStore((s) => s.user)
    const logout = useAuthStore((s) => s.logout)
    const { isSidebarOpen, closeSidebar } = useUIStore()

    // Logout flow (preserved from the refresh-token rotation wave):
    //   1. POST /auth/logout with the refresh token so the server can
    //      blacklist the access JWT AND revoke the refresh jti in Redis.
    //   2. Clear local persisted state regardless of API result so a
    //      network blip never leaves the user "stuck logged in".
    const handleLogout = async () => {
        const refreshToken = useAuthStore.getState().refreshToken
        try {
            await api.post('/auth/logout', refreshToken ? { refreshToken } : {})
        } catch { /* best-effort */ }
        logout()
        if (window.location.pathname !== '/login') {
            window.location.href = '/login'
        }
    }

    return (
        <>
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-bg-overlay backdrop-blur-sm z-30 md:hidden animate-fade-in"
                    onClick={closeSidebar}
                />
            )}

            <aside
                className={[
                    'fixed md:static inset-y-0 left-0 w-72 shrink-0 z-40',
                    'flex flex-col',
                    'bg-bg-card border-r border-border',
                    'transition-transform duration-300 ease-out',
                    isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
                ].join(' ')}
            >
                {/* ── Brand ─────────────────────────────────── */}
                <div className="px-6 pt-6 pb-5 border-b border-border relative">
                    <button
                        onClick={closeSidebar}
                        aria-label="Close sidebar"
                        className="absolute right-3 top-4 p-2 text-text-muted hover:text-text-primary md:hidden rounded-lg"
                    >
                        <X size={18} />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-sm shadow-primary/30">
                            <Shield className="text-white" size={18} strokeWidth={2.5} />
                        </div>
                        <div className="leading-tight">
                            <h1 className="text-[15px] font-bold text-text-primary">MITS Smart&nbsp;ID</h1>
                            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-text-muted">
                                Admin Console
                            </p>
                        </div>
                    </div>
                </div>

                {/* ── Nav ───────────────────────────────────── */}
                <nav className="flex-1 overflow-y-auto px-3 py-5 custom-scrollbar">
                    {navGroups.map((group) => {
                        const visible = group.items.filter((item) => canView(item.permission))
                        if (visible.length === 0) return null

                        return (
                            <div key={group.title} className="mb-5">
                                <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                                    {group.title}
                                </p>
                                <div className="flex flex-col gap-0.5">
                                    {visible.map((item) => (
                                        <NavLink
                                            key={item.path}
                                            to={item.path}
                                            onClick={() => { if (window.innerWidth < 768) closeSidebar() }}
                                            end={item.path === '/'}
                                            className={({ isActive }) =>
                                                [
                                                    'group relative flex items-center gap-3 px-3 py-2 rounded-lg',
                                                    'text-sm font-medium transition-colors',
                                                    isActive
                                                        ? 'bg-bg-subtle text-text-primary'
                                                        : 'text-text-secondary hover:text-text-primary hover:bg-bg-subtle/60',
                                                ].join(' ')
                                            }
                                        >
                                            {({ isActive }) => (
                                                <>
                                                    {isActive && (
                                                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 rounded-r-full bg-primary" />
                                                    )}
                                                    <item.icon
                                                        size={16}
                                                        strokeWidth={isActive ? 2.4 : 2}
                                                        className={isActive ? 'text-primary' : ''}
                                                    />
                                                    <span className="truncate">{item.label}</span>
                                                </>
                                            )}
                                        </NavLink>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </nav>

                {/* ── User card + logout ────────────────────── */}
                <div className="p-3">
                    <div className="rounded-xl bg-bg-subtle border border-border p-3">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="relative">
                                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white text-sm font-bold shadow-sm shadow-primary/20">
                                    {user?.name?.charAt(0)?.toUpperCase() || 'A'}
                                </div>
                                <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-success rounded-full ring-2 ring-bg-subtle" />
                            </div>
                            <div className="flex-1 min-w-0 leading-tight">
                                <p className="text-sm font-semibold text-text-primary truncate">{user?.name || '—'}</p>
                                <p className="text-[10px] uppercase tracking-wider text-text-muted truncate">
                                    {user?.role?.replace('_', ' ') || 'Admin'}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={handleLogout}
                            className="w-full inline-flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-semibold
                                       bg-bg-card text-text-secondary hover:text-danger
                                       border border-border hover:border-danger/30
                                       transition-colors"
                        >
                            <LogOut size={13} />
                            Log out
                        </button>
                    </div>
                </div>
            </aside>
        </>
    )
}
