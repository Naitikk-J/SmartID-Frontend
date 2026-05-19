import { Sun, Moon, Monitor } from 'lucide-react'
import { useThemeStore, type ThemeMode } from '../store/themeStore'

// ═══════════════════════════════════════════════════════════════
// ThemeToggle — tri-state segmented control.
//
// Variants:
//   • `segmented` (default): full pill with three icons, used in
//     the Header. Best when there's room.
//   • `icon`: a single button that cycles light → dark → system.
//     Used in tight UIs (mobile nav, login screen).
//
// Renders only icons + tooltips; the active mode is communicated
// through the highlighted background and `aria-pressed`.
// ═══════════════════════════════════════════════════════════════

const ORDER: ThemeMode[] = ['light', 'dark', 'system']
const META: Record<ThemeMode, { icon: typeof Sun; label: string }> = {
    light: { icon: Sun, label: 'Light theme' },
    dark: { icon: Moon, label: 'Dark theme' },
    system: { icon: Monitor, label: 'Follow system' },
}

interface ThemeToggleProps {
    variant?: 'segmented' | 'icon'
    className?: string
}

export default function ThemeToggle({ variant = 'segmented', className = '' }: ThemeToggleProps) {
    const mode = useThemeStore((s) => s.mode)
    const setMode = useThemeStore((s) => s.setMode)

    if (variant === 'icon') {
        const Icon = META[mode].icon
        const next = ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length]
        return (
            <button
                type="button"
                onClick={() => setMode(next)}
                aria-label={`Switch theme (currently ${META[mode].label})`}
                title={`Theme: ${META[mode].label}`}
                className={[
                    'inline-flex items-center justify-center w-10 h-10 rounded-xl',
                    'text-text-secondary hover:text-text-primary',
                    'bg-bg-subtle hover:bg-bg-hover border border-border',
                    'transition-colors',
                    className,
                ].join(' ')}
            >
                <Icon size={18} strokeWidth={2} />
            </button>
        )
    }

    return (
        <div
            role="radiogroup"
            aria-label="Theme"
            className={[
                'inline-flex items-center gap-1 p-1 rounded-xl',
                'bg-bg-subtle border border-border',
                className,
            ].join(' ')}
        >
            {ORDER.map((opt) => {
                const Icon = META[opt].icon
                const active = mode === opt
                return (
                    <button
                        key={opt}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        title={META[opt].label}
                        onClick={() => setMode(opt)}
                        className={[
                            'relative inline-flex items-center justify-center w-8 h-8 rounded-lg',
                            'transition-colors',
                            active
                                ? 'bg-bg-card text-text-primary shadow-sm'
                                : 'text-text-muted hover:text-text-primary',
                        ].join(' ')}
                    >
                        <Icon size={15} strokeWidth={2.25} />
                    </button>
                )
            })}
        </div>
    )
}
