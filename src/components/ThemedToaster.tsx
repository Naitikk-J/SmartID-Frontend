import type { ComponentType } from 'react'
import type { ToasterProps } from 'react-hot-toast'
import { useThemeStore } from '../store/themeStore'

// Toasts live OUTSIDE the document flow (portaled) so they're the
// only place we need to thread the resolved theme manually — the
// rest of the UI inherits from CSS variables automatically.

interface Props {
    Toaster: ComponentType<ToasterProps>
}

export default function ThemedToaster({ Toaster }: Props) {
    const resolved = useThemeStore((s) => s.resolved)
    const dark = resolved === 'dark'
    return (
        <Toaster
            position="top-right"
            toastOptions={{
                duration: 4000,
                style: {
                    background: dark ? '#18181B' : '#FFFFFF',
                    color: dark ? '#FAFAFA' : '#18181B',
                    border: dark
                        ? '1px solid rgba(255,255,255,0.10)'
                        : '1px solid rgba(24,24,27,0.10)',
                    borderRadius: '12px',
                    fontSize: '13px',
                    fontWeight: 500,
                    boxShadow: dark
                        ? '0 12px 36px -12px rgba(0,0,0,0.6)'
                        : '0 12px 36px -12px rgba(24,24,27,0.15)',
                },
                success: {
                    iconTheme: { primary: '#10B981', secondary: dark ? '#18181B' : '#FFFFFF' },
                },
                error: {
                    iconTheme: { primary: '#EF4444', secondary: dark ? '#18181B' : '#FFFFFF' },
                },
            }}
        />
    )
}
