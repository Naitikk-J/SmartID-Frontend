// Lightweight spinner — no flair. Inherits color from the parent
// so it picks up `text-primary` / `text-text-secondary` etc.

export default function LoadingSpinner({
    size = 'md',
    label,
}: {
    size?: 'sm' | 'md' | 'lg'
    label?: string
}) {
    const s = size === 'lg' ? 'w-10 h-10 border-[3px]'
        : size === 'md' ? 'w-7 h-7 border-2'
            : 'w-4 h-4 border-2'
    return (
        <div className="inline-flex flex-col items-center justify-center gap-2 p-4">
            <div
                role="status"
                aria-label={label || 'Loading'}
                className={[
                    s,
                    'rounded-full',
                    'border-border border-t-primary',
                    'animate-spin',
                ].join(' ')}
            />
            {label && <span className="text-xs text-text-secondary font-medium">{label}</span>}
        </div>
    )
}
