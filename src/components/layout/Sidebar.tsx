import { NavLink } from 'react-router-dom'
import { usePermission } from '../../hooks/usePermission'
import { useAuthStore } from '../../store/authStore'
import { useUIStore } from '../../store/uiStore'
import {
    LayoutDashboard, Radio, Users, ClipboardCheck, DoorOpen, Calendar,
    BookOpen, Vote, BarChart3, Heart, Shield, ScrollText, LogOut, X, Home, QrCode
} from 'lucide-react'

const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard, permission: 'Dashboard' },
    { path: '/live-feed', label: 'Live Feed', icon: Radio, permission: 'Live Feed' },
    { path: '/students', label: 'Students', icon: Users, permission: 'Students' },
    { path: '/hostellers', label: 'Hostellers', icon: Home, permission: 'Hostellers' },
    { path: '/qr-projector', label: 'QR Projector', icon: QrCode, permission: 'QR Projector' },
    { path: '/attendance', label: 'Attendance', icon: ClipboardCheck, permission: 'Attendance' },
    { path: '/exit-rules', label: 'Exit Rules', icon: DoorOpen, permission: 'Exit Rules' },
    { path: '/events', label: 'Events', icon: Calendar, permission: 'Events' },
    { path: '/library', label: 'Library', icon: BookOpen, permission: 'Library' },
    { path: '/elections', label: 'Elections', icon: Vote, permission: 'Elections' },
    { path: '/reports', label: 'Reports', icon: BarChart3, permission: 'Reports' },
    { path: '/health', label: 'Health', icon: Heart, permission: 'Health' },
    { path: '/admin-users', label: 'Admin Users', icon: Shield, permission: 'Admin Users' },
    { path: '/audit-log', label: 'Audit Log', icon: ScrollText, permission: 'Audit Log' },
    { path: '/student-auth-logs', label: 'Student Auth Logs', icon: Shield, permission: 'Student Auth Logs' },
]

export default function Sidebar() {
    const { canView } = usePermission()
    const user = useAuthStore((s) => s.user)
    const logout = useAuthStore((s) => s.logout)
    const { isSidebarOpen, closeSidebar } = useUIStore()

    return (
        <>
            {/* Backdrop for mobile */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden animate-fade-in"
                    onClick={closeSidebar}
                />
            )}

            <aside className={`
                fixed md:static inset-y-0 left-0 w-72 bg-bg-card/80 backdrop-blur-xl border-r border-border flex flex-col shrink-0 z-40 transition-all duration-300 ease-spring
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
            `}>
                {/* Logo Section */}
                <div className="p-8 border-b border-border relative">
                    <button
                        onClick={closeSidebar}
                        className="absolute right-4 top-4 p-2 text-text-secondary hover:text-text-primary md:hidden"
                    >
                        <X size={20} />
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/30">
                            <Shield className="text-white" size={20} />
                        </div>
                        <div>
                            <h1 className="text-lg font-black tracking-tighter text-text-primary leading-none">MITS ID</h1>
                            <p className="text-[10px] text-accent font-bold uppercase tracking-widest mt-1">Management</p>
                        </div>
                    </div>
                </div>

                {/* Navigation Section */}
                <nav className="flex-1 overflow-y-auto px-4 py-6 custom-scrollbar">
                    {navItems.filter((item) => canView(item.permission)).map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            onClick={() => { if (window.innerWidth < 768) closeSidebar() }}
                            end={item.path === '/'}
                            className={({ isActive }) =>
                                `flex items-center gap-4 px-4 py-3 text-sm font-semibold rounded-2xl transition-all duration-300 mb-1 group
                                ${isActive
                                    ? 'bg-primary text-white shadow-lg shadow-primary/20 scale-[1.02]'
                                    : 'text-text-secondary hover:text-text-primary hover:bg-white/5'
                                }`
                            }
                        >
                            <item.icon size={18} className={`transition-transform duration-300 group-hover:scale-110`} />
                            {item.label}
                        </NavLink>
                    ))}
                </nav>

                {/* User Section */}
                <div className="p-6 mt-auto">
                    <div className="p-4 rounded-3xl bg-white/5 border border-white/5 flex flex-col gap-4">
                        <div className="flex items-center gap-3">
                            <div className="relative">
                                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary-light to-primary flex items-center justify-center text-white font-bold shadow-inner">
                                    {user?.name?.charAt(0)}
                                </div>
                                <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-success border-2 border-bg-card rounded-full" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-bold truncate text-text-primary">{user?.name}</p>
                                <p className="text-[10px] font-medium text-text-secondary uppercase tracking-wider">{user?.role?.replace('_', ' ')}</p>
                            </div>
                        </div>
                        <button
                            onClick={logout}
                            className="w-full flex items-center justify-center gap-2 py-2.5 bg-white/5 hover:bg-danger/10 text-text-secondary hover:text-danger rounded-2xl text-xs font-bold transition-all border border-transparent hover:border-danger/10"
                        >
                            <LogOut size={14} />
                            Log Out
                        </button>
                    </div>
                </div>
            </aside>
        </>
    )
}
