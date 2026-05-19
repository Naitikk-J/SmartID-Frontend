import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// ═══════════════════════════════════════════════════════════════
// MITS Smart ID — Theme store
//
// Three modes:
//   • light  — always light
//   • dark   — always dark
//   • system — follow `prefers-color-scheme` (default)
//
// The `resolved` theme (light | dark) is what actually drives the
// DOM class. Components that just need to know "am I dark?" should
// read `resolved`, not the user-facing `mode`.
//
// FOUC prevention is handled by a tiny inline script in index.html
// that applies the right class BEFORE React mounts. This store then
// rehydrates from localStorage and keeps the DOM in sync.
// ═══════════════════════════════════════════════════════════════

export type ThemeMode = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

interface ThemeState {
    mode: ThemeMode
    resolved: ResolvedTheme
    setMode: (mode: ThemeMode) => void
    /** Called by ThemeProvider when the system preference changes. */
    _syncSystem: () => void
}

function getSystemPreference(): ResolvedTheme {
    if (typeof window === 'undefined' || !window.matchMedia) return 'dark'
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function resolve(mode: ThemeMode): ResolvedTheme {
    return mode === 'system' ? getSystemPreference() : mode
}

/**
 * Mutates the DOM to apply / clear the `dark` class. Adds a short-
 * lived `.theme-transition` class so the existing surfaces fade
 * between palettes smoothly instead of snapping.
 */
function applyToDOM(resolved: ResolvedTheme, { animate = true } = {}) {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    const wasDark = root.classList.contains('dark')

    if (animate && wasDark !== (resolved === 'dark')) {
        root.classList.add('theme-transition')
        window.setTimeout(() => root.classList.remove('theme-transition'), 320)
    }

    root.classList.toggle('dark', resolved === 'dark')
    root.setAttribute('data-theme', resolved)
    root.style.colorScheme = resolved
}

export const useThemeStore = create<ThemeState>()(
    persist(
        (set, get) => ({
            mode: 'system',
            resolved: getSystemPreference(),

            setMode: (mode) => {
                const resolved = resolve(mode)
                applyToDOM(resolved)
                set({ mode, resolved })
            },

            _syncSystem: () => {
                if (get().mode !== 'system') return
                const resolved = getSystemPreference()
                if (resolved !== get().resolved) {
                    applyToDOM(resolved)
                    set({ resolved })
                }
            },
        }),
        {
            name: 'mits-theme',
            // Don't persist `resolved` — it's recomputed at boot.
            partialize: (state) => ({ mode: state.mode }),
            onRehydrateStorage: () => (state) => {
                // After the persisted `mode` rehydrates, re-resolve and
                // re-apply so the DOM matches the stored preference.
                if (!state) return
                const resolved = resolve(state.mode)
                applyToDOM(resolved, { animate: false })
                state.resolved = resolved
            },
        },
    ),
)
