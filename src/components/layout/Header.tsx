import { useAuthStore } from '../../store/authStore'
import { useUIStore } from '../../store/uiStore'
import { Bell, Menu } from 'lucide-react'

export default function Header() {
    const user = useAuthStore((s) => s.user)
    const toggleSidebar = useUIStore((s) => s.toggleSidebar)

    return (
        <header className="h-16 glass border-b border-border flex items-center justify-between px-4 md:px-6 shrink-0 z-20">
            <div className="flex items-center gap-3">
                <button
                    onClick={toggleSidebar}
                    className="p-2 md:hidden text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-lg transition-all"
                >
                    <Menu size={20} />
                </button>
                <div className="hidden sm:block">
                    <h2 className="text-sm md:text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-text-primary to-text-secondary">
                        Madhav Institute of Technology & Science
                    </h2>
                    <p className="text-[10px] md:text-xs text-text-secondary font-medium tracking-wide">
                        Smart ID Card Management System
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-2 md:gap-4">
                <button className="p-2 text-text-secondary hover:text-text-primary hover:bg-bg-hover rounded-xl transition-all relative group">
                    <Bell size={20} />
                    <span className="absolute top-2 right-2 w-2 h-2 bg-danger rounded-full border-2 border-bg-card animate-pulse" />
                </button>

                <div className="flex items-center gap-3 pl-2 border-l border-border">
                    <div className="hidden md:block text-right">
                        <p className="text-xs font-bold text-text-primary">{user?.name}</p>
                        <p className="text-[10px] text-text-secondary font-medium">Administrator</p>
                    </div>
                    <div className="w-9 h-9 bg-gradient-to-br from-primary to-primary-light rounded-xl flex items-center justify-center text-sm font-bold text-white shadow-lg shadow-primary/20 animate-glow">
                        {user?.name?.charAt(0) || 'A'}
                    </div>
                </div>
            </div>
        </header>
    )
}
