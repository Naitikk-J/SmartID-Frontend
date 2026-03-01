import { type ComponentType } from 'react'

interface StatCardProps {
    title: string
    value: string | number
    icon: ComponentType<any>
    color?: string
    subtitle?: string
}

export default function StatCard({ title, value, icon: Icon, color = 'text-primary', subtitle }: StatCardProps) {
    return (
        <div className="glass-card p-6 relative overflow-hidden group">
            {/* Background decoration */}
            <div className={`absolute -right-4 -bottom-4 opacity-5 transition-transform duration-500 group-hover:scale-110 ${color}`}>
                <Icon size={120} />
            </div>

            <div className="flex items-center justify-between mb-4 relative z-10">
                <div className={`p-2.5 rounded-xl bg-white/5 border border-white/5 ${color} shadow-inner`}>
                    <Icon size={22} strokeWidth={2.5} />
                </div>
                {subtitle && (
                    <span className="text-[10px] font-bold uppercase tracking-widest text-text-secondary bg-white/5 px-2 py-1 rounded-lg">
                        {subtitle}
                    </span>
                )}
            </div>

            <div className="relative z-10">
                <p className="text-sm font-bold text-text-secondary mb-1">{title}</p>
                <p className="text-4xl font-black tracking-tighter text-text-primary capitalize">
                    {value}
                </p>
            </div>
        </div>
    )
}
