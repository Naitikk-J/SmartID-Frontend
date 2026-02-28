export default function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
    const s = size === 'lg' ? 'w-12 h-12' : size === 'md' ? 'w-8 h-8' : 'w-5 h-5'
    return (
        <div className="flex items-center justify-center p-8">
            <div className={`${s} border-4 border-border border-t-accent rounded-full animate-spin`} />
        </div>
    )
}
