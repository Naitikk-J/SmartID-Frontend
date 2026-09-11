import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useThemeStore } from '../store/themeStore'
import ThemeToggle from '../components/ThemeToggle'
import api from '../api/axios'
import toast from 'react-hot-toast'
import { ShieldCheck, Lock, Zap, Globe2 } from 'lucide-react'

declare global {
    interface Window {
        __MITS_GSI_INITIALIZED__?: boolean
    }
}

export default function LoginPage() {
    const setAuth = useAuthStore((s) => s.setAuth)
    const resolved = useThemeStore((s) => s.resolved)
    const navigate = useNavigate()
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

    // ── Helpers (unchanged from previous version) ───────────────
    const decodeGoogleEmailFromIdToken = (idToken: string): string | null => {
        try {
            const parts = idToken.split('.')
            if (parts.length < 2) return null
            const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/')
            const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
            const payload = JSON.parse(atob(padded))
            return typeof payload?.email === 'string' ? payload.email.toLowerCase() : null
        } catch { return null }
    }

    const handleAuthSuccess = (authPayload: any) => {
        const authData = authPayload?.data || authPayload
        const role = authData?.user?.role
        const emailValue = String(authData?.user?.email || '').toLowerCase()
        if (role === 'STUDENT' || emailValue.endsWith('@mitsgwl.ac.in')) {
            // Students never belong on the admin console; push them to
            // the web student portal (or the mobile app if configured).
            toast('Student account detected. Opening student portal…')
            navigate('/student/login', { replace: true })
            return
        }
        setAuth(authData)
        toast.success('Welcome back!')
        // Camera-only roles land straight on the scanner.
        if (role === 'SECURITY_GUARD') {
            navigate('/scanner', { replace: true })
        } else {
            navigate('/')
        }
    }

    // ── Google Identity Services bootstrap ──────────────────────
    const googleBtnRef = useRef<HTMLDivElement>(null)
    useEffect(() => {
        if (!googleClientId) return
        // @ts-ignore - GSI is loaded via the inline <script> in index.html
        if (window.google && googleBtnRef.current) {
            if (!window.__MITS_GSI_INITIALIZED__) {
                // @ts-ignore
                window.google.accounts.id.initialize({
                    client_id: googleClientId,
                    callback: async (response: any) => {
                        const idToken = response?.credential
                        if (!idToken || typeof idToken !== 'string') {
                            toast.error('Google login credential not received. Check authorized origin/client id.')
                            return
                        }
                        const tokenEmail = decodeGoogleEmailFromIdToken(idToken)
                        if (tokenEmail?.endsWith('@mitsgwl.ac.in')) {
                            toast('Student account detected. Opening student portal…')
                            navigate('/student/login', { replace: true })
                            return
                        }
                        // Admin console is locked to the SUPER_ADMIN email
                        // only. All other emails (including any historical
                        // @mitsgwalior.in admin accounts) are rejected —
                        // the server enforces the same rule, this is just
                        // faster UX feedback.
                        const ADMIN_ALLOWED = ['naitikjainjbp@gmail.com']
                        if (tokenEmail && !ADMIN_ALLOWED.includes(tokenEmail)) {
                            toast.error('This email is not authorised for the admin console.')
                            return
                        }
                        try {
                            const { data: resp } = await api.post('/auth/google', { idToken })
                            handleAuthSuccess(resp.data)
                        } catch (err: any) {
                            toast.error(err.response?.data?.error || err.message || 'Google login failed')
                        }
                    },
                    ux_mode: 'popup',
                })
                window.__MITS_GSI_INITIALIZED__ = true
            }

            googleBtnRef.current.innerHTML = ''
            // @ts-ignore
            window.google.accounts.id.renderButton(googleBtnRef.current, {
                theme: resolved === 'dark' ? 'filled_black' : 'outline',
                size: 'large',
                shape: 'pill',
                text: 'continue_with',
                width: '320',
            })
        }
        // Re-render the GSI button when the theme changes so the
        // light/dark variants stay in sync.
    }, [googleClientId, resolved])

    return (
        <div className="min-h-screen w-full bg-bg-dark text-text-primary overflow-hidden relative">
            {/* Floating theme toggle — visible even before login. */}
            <div className="absolute top-5 right-5 z-30">
                <ThemeToggle />
            </div>

            <div className="grid lg:grid-cols-2 min-h-screen">
                {/* ── Hero panel (hidden on small screens) ─────── */}
                <aside className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden">
                    {/* Layered ambient gradients — calm, not loud. */}
                    <div className="absolute inset-0 -z-10">
                        <div className="absolute -top-32 -left-32 w-[60%] h-[60%] rounded-full bg-primary/15 blur-[120px]" />
                        <div className="absolute -bottom-32 -right-32 w-[55%] h-[55%] rounded-full bg-accent/12 blur-[140px]" />
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(99,102,241,0.08),transparent_45%)]" />
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/30">
                            <ShieldCheck className="text-white" size={22} strokeWidth={2.5} />
                        </div>
                        <div className="leading-tight">
                            <p className="text-sm font-bold tracking-tight text-text-primary">Smart ID</p>
                            <p className="text-[10px] uppercase tracking-[0.2em] text-text-muted">Admin Console</p>
                        </div>
                    </div>

                    <div className="max-w-md space-y-6">
                        <div>
                            <span className="chip">
                                <span className="w-1.5 h-1.5 rounded-full bg-success" />
                                Production
                            </span>
                        </div>
                        <h1 className="text-4xl xl:text-5xl font-bold tracking-tight leading-[1.05]">
                            Operate a smarter, safer campus.
                        </h1>
                        <p className="text-text-secondary text-[15px] leading-relaxed">
                            Real-time scans, hostel curfews, geofenced gates, and full audit
                            trails — all from one console designed for the people who run
                            campus operations.
                        </p>

                        <div className="grid grid-cols-3 gap-3 pt-2">
                            {[
                                { icon: Zap, label: 'Real-time' },
                                { icon: Lock, label: 'Audited' },
                                { icon: Globe2, label: 'Multi-site' },
                            ].map(({ icon: Icon, label }) => (
                                <div
                                    key={label}
                                    className="rounded-xl border border-border bg-bg-card/60 backdrop-blur p-3 flex flex-col items-start gap-2"
                                >
                                    <Icon size={16} className="text-primary" />
                                    <span className="text-xs font-semibold text-text-secondary">{label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-text-muted">
                        Madhav Institute of Technology &amp; Science
                    </p>
                </aside>

                {/* ── Auth panel ──────────────────────────────── */}
                <main className="relative flex items-center justify-center p-6 sm:p-12">
                    <div className="absolute inset-0 -z-10 lg:hidden">
                        <div className="absolute -top-24 -left-24 w-[60%] h-[60%] rounded-full bg-primary/15 blur-[100px]" />
                        <div className="absolute -bottom-24 -right-24 w-[55%] h-[55%] rounded-full bg-accent/12 blur-[120px]" />
                    </div>

                    <div className="w-full max-w-sm animate-fade-in-up">
                        <div className="lg:hidden mb-8 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-sm shadow-primary/30">
                                <ShieldCheck className="text-white" size={18} strokeWidth={2.5} />
                            </div>
                            <div className="leading-tight">
                                <p className="text-sm font-bold">Smart ID</p>
                                <p className="text-[10px] uppercase tracking-[0.18em] text-text-muted">Admin Console</p>
                            </div>
                        </div>

                        <h2 className="text-2xl font-bold tracking-tight">Sign in</h2>
                        <p className="text-text-secondary text-sm mt-1.5">
                            Admin console is restricted to authorised super-admin accounts only.
                            Students should sign in at{' '}
                            <a href="/student/login" className="font-medium text-primary hover:underline">
                                /student/login
                            </a>.
                        </p>

                        <div className="mt-8 glass-card p-6 rounded-2xl">
                            <div className="flex flex-col items-center gap-4">
                                {googleClientId ? (
                                    <>
                                        <div ref={googleBtnRef} className="w-full flex justify-center min-h-[44px]" />
                                        <div className="flex items-center gap-2 w-full">
                                            <div className="h-px flex-1 bg-border" />
                                            <span className="text-[10px] font-semibold uppercase tracking-widest text-text-muted">
                                                Secured by Google
                                            </span>
                                            <div className="h-px flex-1 bg-border" />
                                        </div>
                                        <p className="text-[11px] text-text-muted text-center">
                                            By signing in you agree to the institute&rsquo;s
                                            acceptable-use and audit-logging policy.
                                        </p>
                                    </>
                                ) : (
                                    <div className="text-center py-4">
                                        <p className="text-sm font-medium text-warning">Google sign-in unavailable</p>
                                        <p className="text-xs text-text-secondary mt-1">
                                            Set <span className="font-mono">VITE_GOOGLE_CLIENT_ID</span> to enable login.
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <p className="text-center mt-8 text-[11px] uppercase tracking-[0.18em] text-text-muted">
                            © {new Date().getFullYear()} MITS Gwalior
                        </p>
                    </div>
                </main>
            </div>
        </div>
    )
}
