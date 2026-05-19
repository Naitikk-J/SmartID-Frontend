import { useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useUIStore } from '../../store/uiStore'
import { Bell, Menu, Search } from 'lucide-react'
import ThemeToggle from '../ThemeToggle'

// Map known routes → display name for the breadcrumb. Kept light so
// adding a route doesn't force us to update three files.
const ROUTE_TITLES: Record<string, string> = {
    '/': 'Dashboard',
    '/live-feed': 'Live Feed',
    '/students': 'Students',
    '/hostellers': 'Hostellers',
    '/qr-projector': 'QR Projector',
    '/qr-manage': 'QR Manage',
    '/attendance': 'Attendance',
    '/exit-rules': 'Exit Rules',
    '/events': 'Events',
    '/library': 'Library',
    '/elections': 'Elections',
    '/reports': 'Reports',
    '/health': 'System Health',
    '/admin-users': 'Admin Users',
    '/geofencing': 'Geofencing',
    '/audit-log': 'Audit Log',
    '/student-auth-logs': 'Student Auth Logs',
}

function deriveTitle(pathname: string): string {
    if (ROUTE_TITLES[pathname]) return ROUTE_TITLES[pathname]
    // Try the first segment for dynamic routes (e.g. /students/:id).
    const seg = '/' + pathname.split('/')[1]
    return ROUTE_TITLES[seg] || 'Dashboard'
}

export default function Header() {
    const user = useAuthStore((s) => s.user)
    const toggleSidebar = useUIStore((s) => s.toggleSidebar)
    const { pathname } = useLocation()
    const title = deriveTitle(pathname)

    return (
        <header className="h-16 glass-translucent flex items-center justify-between px-4 md:px-8 shrink-0 z-20">
            <div className="flex items-center gap-3 min-w-0">
                <button
                    onClick={toggleSidebar}
                    aria-label="Toggle sidebar"
                    className="p-2 md:hidden text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-lg transition-colors"
                >
                    <Menu size={20} />
                </button>
                <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-muted">
                        MITS · Admin
                    </p>
                    <h2 className="text-base md:text-lg font-bold text-text-primary truncate leading-tight">
                        {title}
                    </h2>
                </div>
            </div>

            <div className="flex items-center gap-2 md:gap-3">
                {/* Search affordance — non-functional placeholder for now,
                    but the shape signals "this app has a global search". */}
                <div className="hidden lg:flex items-center gap-2 h-10 px-3 rounded-xl bg-bg-subtle border border-border text-text-muted w-64">
                    <Search size={15} />
                    <input
                        placeholder="Search…"
                        className="bg-transparent flex-1 outline-none text-sm placeholder:text-text-muted"
                    />
                    <span className="kbd hidden xl:inline">⌘ K</span>
                </div>

                <ThemeToggle className="hidden sm:inline-flex" />
                <ThemeToggle variant="icon" className="sm:hidden" />

                <button
                    aria-label="Notifications"
                    className="relative inline-flex items-center justify-center w-10 h-10 rounded-xl text-text-secondary hover:text-text-primary bg-bg-subtle hover:bg-bg-hover border border-border transition-colors"
                >
                    <Bell size={17} />
                    <span className="absolute top-2 right-2 w-2 h-2 bg-danger rounded-full ring-2 ring-bg-card" />
                </button>

                <div className="flex items-center gap-3 pl-3 border-l border-border">
                    <div className="hidden md:block text-right leading-tight">
                        <p className="text-sm font-semibold text-text-primary">{user?.name || 'Administrator'}</p>
                        <p className="text-[10px] uppercase tracking-wider text-text-muted">{user?.role?.replace('_', ' ') || 'Admin'}</p>
                    </div>
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white bg-gradient-to-br from-primary to-accent shadow-sm shadow-primary/25">
                        {user?.name?.charAt(0)?.toUpperCase() || 'A'}
                    </div>
                </div>
            </div>
        </header>
    )
}
