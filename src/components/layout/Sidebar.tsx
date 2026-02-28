import { NavLink } from 'react-router-dom'
import { usePermission } from '../../hooks/usePermission'
import { useAuthStore } from '../../store/authStore'
import {
    LayoutDashboard, Radio, Users, ClipboardCheck, DoorOpen, Calendar,
    BookOpen, Wallet, Vote, BarChart3, Heart, Shield, ScrollText, LogOut
} from 'lucide-react'

const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard, permission: 'Dashboard' },
    { path: '/live-feed', label: 'Live Feed', icon: Radio, permission: 'Live Feed' },
    { path: '/students', label: 'Students', icon: Users, permission: 'Students' },
    { path: '/attendance', label: 'Attendance', icon: ClipboardCheck, permission: 'Attendance' },
    { path: '/exit-rules', label: 'Exit Rules', icon: DoorOpen, permission: 'Exit Rules' },
    { path: '/events', label: 'Events', icon: Calendar, permission: 'Events' },
    { path: '/library', label: 'Library', icon: BookOpen, permission: 'Library' },
    { path: '/wallet', label: 'Wallet', icon: Wallet, permission: 'Wallet' },
    { path: '/elections', label: 'Elections', icon: Vote, permission: 'Elections' },
    { path: '/reports', label: 'Reports', icon: BarChart3, permission: 'Reports' },
    { path: '/health', label: 'Health', icon: Heart, permission: 'Health' },
    { path: '/admin-users', label: 'Admin Users', icon: Shield, permission: 'Admin Users' },
    { path: '/audit-log', label: 'Audit Log', icon: ScrollText, permission: 'Audit Log' },
]

export default function Sidebar() {
    const { canView } = usePermission()
    const user = useAuthStore((s) => s.user)
    const logout = useAuthStore((s) => s.logout)

    return (
        <aside className="w-64 bg-bg-card border-r border-border flex flex-col shrink-0">
            {/* Logo */}
            <div className="p-6 border-b border-border">
                <h1 className="text-xl font-bold text-accent">MITS Smart ID</h1>
                <p className="text-xs text-text-secondary mt-1">Admin Dashboard</p>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto py-4">
                {navItems.filter((item) => canView(item.permission)).map((item) => (
                    <NavLink
                        key={item.path}
                        to={item.path}
                        end={item.path === '/'}
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-6 py-2.5 text-sm transition-colors ${isActive
                                ? 'text-accent bg-accent/10 border-r-2 border-accent'
                                : 'text-text-secondary hover:text-text-primary hover:bg-bg-hover'
                            }`
                        }
                    >
                        <item.icon size={18} />
                        {item.label}
                    </NavLink>
                ))}
            </nav>

            {/* User info + logout */}
            <div className="p-4 border-t border-border">
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-success" />
                    <span className="text-xs text-text-secondary">System Monitoring</span>
                </div>
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm font-medium truncate">{user?.name}</p>
                        <span className="text-xs px-2 py-0.5 bg-accent/20 text-accent rounded-full">
                            {user?.role?.replace('_', ' ')}
                        </span>
                    </div>
                    <button onClick={logout} className="p-2 text-text-secondary hover:text-danger transition-colors">
                        <LogOut size={18} />
                    </button>
                </div>
            </div>
        </aside>
    )
}
