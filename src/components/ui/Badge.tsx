const badgeColors: Record<string, string> = {
    GREEN: 'bg-success text-white',
    RED: 'bg-danger text-white',
    AMBER: 'bg-warning text-white',
    GREY: 'bg-neutral text-white',
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
    const color = badgeColors[badge || 'GREY'] || badgeColors.GREY
    const label = resultLabels[result] || result
    const sizeClass = size === 'lg' ? 'px-4 py-2 text-base' : size === 'md' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs'

    return (
        <span className={`inline-flex items-center rounded-full font-semibold ${color} ${sizeClass}`}>
            {label}
        </span>
    )
}
