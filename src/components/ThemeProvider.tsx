import { useEffect } from 'react'
import { useThemeStore } from '../store/themeStore'

// ═══════════════════════════════════════════════════════════════
// Theme provider — no UI. Just:
//   1. Subscribes to the OS-level `prefers-color-scheme` media query
//      so "system" mode tracks the user's OS in real time.
//   2. Re-applies on mount (covers the case where the inline boot
//      script in index.html didn't run, e.g. in tests).
// ═══════════════════════════════════════════════════════════════

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
    const syncSystem = useThemeStore((s) => s._syncSystem)
    const mode = useThemeStore((s) => s.mode)
    const setMode = useThemeStore((s) => s.setMode)

    useEffect(() => {
        // Re-resolve on first mount in case the inline bootstrap
        // didn't run (SSR-only environments, jsdom, etc.).
        setMode(mode)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return
        const mql = window.matchMedia('(prefers-color-scheme: dark)')
        const onChange = () => syncSystem()
        // `addEventListener` is the modern API; older Safari needs
        // `addListener`. Cover both.
        if (mql.addEventListener) {
            mql.addEventListener('change', onChange)
            return () => mql.removeEventListener('change', onChange)
        }
        mql.addListener?.(onChange)
        return () => mql.removeListener?.(onChange)
    }, [syncSystem])

    return <>{children}</>
}
