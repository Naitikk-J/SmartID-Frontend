import { type ComponentType } from 'react'

interface StatCardProps {
    title: string
    value: string | number
    icon: ComponentType<{ size?: number; className?: string }>
    color?: string
    subtitle?: string
}

export default function StatCard({ title, value, icon: Icon, color = 'text-accent', subtitle }: StatCardProps) {
    return (
        <div className="bg-bg-card rounded-xl border border-border p-5 hover:border-accent/30 transition-colors">
            <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-text-secondary">{title}</span>
                <Icon size={20} className={color} />
            </div>
            <p className="text-3xl font-bold">{value}</p>
            {subtitle && <p className="text-xs text-text-secondary mt-1">{subtitle}</p>}
        </div>
    )
}
