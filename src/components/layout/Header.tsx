import { useAuthStore } from '../../store/authStore'
import { Bell } from 'lucide-react'

export default function Header() {
    const user = useAuthStore((s) => s.user)
    return (
        <header className="h-16 bg-bg-card border-b border-border flex items-center justify-between px-6 shrink-0">
            <div>
                <h2 className="text-lg font-semibold">Madhav Institute of Technology & Science</h2>
                <p className="text-xs text-text-secondary">Smart ID Card Management System</p>
            </div>
            <div className="flex items-center gap-4">
                <button className="p-2 text-text-secondary hover:text-text-primary transition-colors relative">
                    <Bell size={20} />
                    <span className="absolute top-1 right-1 w-2 h-2 bg-danger rounded-full" />
                </button>
                <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center text-sm font-bold">
                    {user?.name?.charAt(0) || 'A'}
                </div>
            </div>
        </header>
    )
}
