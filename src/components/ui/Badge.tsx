const badgeStyles: Record<string, { dot: string; bg: string; text: string }> = {
    GREEN: { dot: 'bg-success shadow-success/40', bg: 'bg-success/10 border-success/20', text: 'text-success' },
    RED: { dot: 'bg-danger shadow-danger/40', bg: 'bg-danger/10 border-danger/20', text: 'text-danger' },
    AMBER: { dot: 'bg-warning shadow-warning/40', bg: 'bg-warning/10 border-warning/20', text: 'text-warning' },
    GREY: { dot: 'bg-neutral shadow-neutral/40', bg: 'bg-neutral/10 border-neutral/20', text: 'text-neutral' },
}

const resultLabels: Record<string, string> = {
    VERIFIED: 'Verified',
    FAKE: 'Fake',
    LOST: 'Card Lost',
    INACTIVE: 'Inactive',
    LIMIT_HIT: 'Limit Hit',
    GPS_FAIL: 'GPS Fail',
    DUPLICATE: 'Duplicate',
    TIME_EXPIRED: 'Time Expired',
    ALREADY_VOTED: 'Already Voted',
    DENIED: 'Denied',
}

interface BadgeProps {
    result: string
    badge?: string
    size?: 'sm' | 'md' | 'lg'
}

export default function Badge({ result, badge, size = 'sm' }: BadgeProps) {
    const style = badgeStyles[badge || 'GREY'] || badgeStyles.GREY
    const label = resultLabels[result] || (result?.startsWith('REENTERED_') ? `Re-entry (${result.split('_')[1]})` : result)

    const sizeClasses = {
        sm: 'px-2 py-0.5 text-[10px] gap-1.5',
        md: 'px-3 py-1 text-xs gap-2',
        lg: 'px-4 py-1.5 text-sm gap-2.5',
    }

    const dotSizes = { sm: 'w-1 h-1', md: 'w-1.5 h-1.5', lg: 'w-2 h-2' }

    return (
        <span className={`inline-flex items-center rounded-full font-bold border transition-all hover:scale-105 ${style.bg} ${style.text} ${sizeClasses[size]}`}>
            <span className={`${dotSizes[size]} rounded-full shadow-lg ${style.dot} animate-pulse-badge`} />
            {label}
        </span>
    )
}
