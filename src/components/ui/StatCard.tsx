import { type ComponentType } from 'react'
import { ArrowUpRight, ArrowDownRight } from 'lucide-react'

interface StatCardProps {
    title: string
    value: string | number
    icon: ComponentType<any>
    /** Tailwind text-color utility e.g. `text-primary` for the icon swatch. */
    color?: string
    subtitle?: string
    /** Signed delta number, optional. Positive = green, negative = red. */
    delta?: number
    deltaLabel?: string
}

export default function StatCard({
    title,
    value,
    icon: Icon,
    color = 'text-primary',
    subtitle,
    delta,
    deltaLabel,
}: StatCardProps) {
    const deltaPositive = typeof delta === 'number' && delta >= 0
    const DeltaIcon = deltaPositive ? ArrowUpRight : ArrowDownRight

    return (
        <div className="glass-card glass-card-hover p-5 relative overflow-hidden">
            {/* Decorative watermark — very subtle, picks up the icon color. */}
            <div className={`pointer-events-none absolute -right-6 -bottom-6 ${color} opacity-[0.06]`}>
                <Icon size={140} strokeWidth={1.5} />
            </div>

            <div className="flex items-start justify-between mb-4 relative">
                <div
                    className={[
                        'inline-flex items-center justify-center w-10 h-10 rounded-xl',
                        'bg-bg-subtle border border-border',
                        color,
                    ].join(' ')}
                >
                    <Icon size={18} strokeWidth={2.25} />
                </div>
                {typeof delta === 'number' && (
                    <span
                        className={[
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold',
                            deltaPositive
                                ? 'text-success bg-[color-mix(in_oklab,var(--color-success)_12%,transparent)]'
                                : 'text-danger bg-[color-mix(in_oklab,var(--color-danger)_12%,transparent)]',
                        ].join(' ')}
                    >
                        <DeltaIcon size={12} strokeWidth={2.5} />
                        {Math.abs(delta).toFixed(0)}%
                    </span>
                )}
            </div>

            <div className="relative">
                <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{title}</p>
                <p className="mt-1 text-3xl font-bold tracking-tight text-text-primary tabular-nums">
                    {value}
                </p>
                {(subtitle || deltaLabel) && (
                    <p className="mt-2 text-xs text-text-secondary">
                        {deltaLabel || subtitle}
                    </p>
                )}
            </div>
        </div>
    )
}
