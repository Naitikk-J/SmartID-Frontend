// Status badges — colour is data, not decoration. Keeping the dot
// + label format because operators visually scan them in long lists.

type BadgeKey = 'GREEN' | 'RED' | 'AMBER' | 'GREY'

const badgeStyles: Record<BadgeKey, { dot: string; bg: string; text: string }> = {
    GREEN: {
        dot: 'bg-success',
        bg: 'bg-[color-mix(in_oklab,var(--color-success)_14%,transparent)] border-[color-mix(in_oklab,var(--color-success)_30%,transparent)]',
        text: 'text-success',
    },
    RED: {
        dot: 'bg-danger',
        bg: 'bg-[color-mix(in_oklab,var(--color-danger)_14%,transparent)] border-[color-mix(in_oklab,var(--color-danger)_30%,transparent)]',
        text: 'text-danger',
    },
    AMBER: {
        dot: 'bg-warning',
        bg: 'bg-[color-mix(in_oklab,var(--color-warning)_14%,transparent)] border-[color-mix(in_oklab,var(--color-warning)_30%,transparent)]',
        text: 'text-warning',
    },
    GREY: {
        dot: 'bg-neutral',
        bg: 'bg-bg-subtle border-border',
        text: 'text-text-secondary',
    },
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
    const key = (badge || 'GREY') as BadgeKey
    const style = badgeStyles[key] ?? badgeStyles.GREY
    const label = resultLabels[result] || (
        result?.startsWith('REENTERED_') ? `Re-entry (${result.split('_')[1]})` : result
    )

    const sizeClasses = {
        sm: 'px-2 py-0.5 text-[10px] gap-1.5',
        md: 'px-2.5 py-1 text-xs gap-2',
        lg: 'px-3 py-1.5 text-sm gap-2.5',
    }
    const dotSizes = { sm: 'w-1.5 h-1.5', md: 'w-2 h-2', lg: 'w-2.5 h-2.5' }

    return (
        <span
            className={[
                'inline-flex items-center rounded-full font-semibold border',
                'transition-colors',
                style.bg,
                style.text,
                sizeClasses[size],
            ].join(' ')}
        >
            <span className={`${dotSizes[size]} rounded-full ${style.dot} animate-pulse-badge`} />
            {label}
        </span>
    )
}
