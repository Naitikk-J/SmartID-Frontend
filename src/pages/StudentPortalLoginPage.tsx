// ─────────────────────────────────────────────────────────────
// Student portal login — the *only* page a non-authenticated
// student sees. From here they get to /student/pass.
//
// Two ways in:
//   1. Google Identity Services — restricted to the college
//      email domain (VITE_CAMPUS_ENTRY_STUDENT_DOMAIN, default
//      `mitsgwl.ac.in`, matches the backend env).
//   2. Login ID + password — the credentials the admin emailed
//      after the bulk import.
//
// No timer/expiry counter is exposed anywhere in this flow —
// the QR page is spec'd to hide validity durations.
// ─────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { QrCode, ShieldCheck, Loader2 } from 'lucide-react'
import {
    studentLoginPassword,
    studentLoginGoogle,
    writeStudentAuth,
    readStudentAuth,
} from '../api/campusEntry'

declare global {
    interface Window {
        __MITS_STUDENT_GSI_INITIALIZED__?: boolean
        google?: any
    }
}

const STUDENT_DOMAIN = (import.meta.env.VITE_CAMPUS_ENTRY_STUDENT_DOMAIN as string | undefined)
    || 'mitsgwl.ac.in'

export default function StudentPortalLoginPage() {
    const navigate = useNavigate()
    const [loginId, setLoginId] = useState('')
    const [password, setPassword] = useState('')
    const [busy, setBusy] = useState(false)
    const googleBtnRef = useRef<HTMLDivElement | null>(null)
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

    // If we already have a session, go straight to the pass.
    useEffect(() => {
        const { accessToken } = readStudentAuth()
        if (accessToken) navigate('/student/pass', { replace: true })
    }, [navigate])

    // ── Google Identity Services ────────────────────────────
    useEffect(() => {
        if (!googleClientId) return
        if (!window.google?.accounts?.id || !googleBtnRef.current) return

        if (!window.__MITS_STUDENT_GSI_INITIALIZED__) {
            window.google.accounts.id.initialize({
                client_id: googleClientId,
                callback: async (response: any) => {
                    const idToken = response?.credential
                    if (!idToken) {
                        toast.error('Google did not return a credential')
                        return
                    }
                    try {
                        setBusy(true)
                        const data = await studentLoginGoogle(idToken)
                        writeStudentAuth({
                            accessToken: data.accessToken,
                            refreshToken: data.refreshToken,
                            user: data.user,
                        })
                        toast.success(`Welcome, ${data.user?.name?.split(' ')[0] || 'student'}!`)
                        navigate('/student/pass')
                    } catch (err: any) {
                        toast.error(err?.response?.data?.error || err.message || 'Google sign-in failed')
                    } finally {
                        setBusy(false)
                    }
                },
                ux_mode: 'popup',
            })
            window.__MITS_STUDENT_GSI_INITIALIZED__ = true
        }

        googleBtnRef.current.innerHTML = ''
        window.google.accounts.id.renderButton(googleBtnRef.current, {
            theme: 'filled_black',
            size: 'large',
            shape: 'pill',
            text: 'continue_with',
            width: '320',
        })
    }, [googleClientId, navigate])

    async function handlePasswordSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (busy) return
        if (!loginId.trim() || !password) {
            toast.error('Enter your login id and password')
            return
        }
        try {
            setBusy(true)
            const data = await studentLoginPassword(loginId.trim(), password)
            writeStudentAuth({
                accessToken: data.accessToken,
                refreshToken: data.refreshToken,
                user: data.user,
            })
            toast.success(`Welcome, ${data.user?.name?.split(' ')[0] || 'student'}!`)
            navigate('/student/pass')
        } catch (err: any) {
            toast.error(err?.response?.data?.error || err.message || 'Login failed')
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950 p-6 text-white">
            <div className="w-full max-w-md">
                <div className="flex items-center gap-3 mb-8">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                        <QrCode className="text-white" size={22} strokeWidth={2.5} />
                    </div>
                    <div className="leading-tight">
                        <p className="text-sm font-bold tracking-tight">MITS Smart ID</p>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-white/60">Student Portal</p>
                    </div>
                </div>

                <h1 className="text-3xl font-bold tracking-tight">Sign in for your entry pass</h1>
                <p className="text-white/60 text-sm mt-2">
                    Use your <span className="text-white font-medium">@{STUDENT_DOMAIN}</span> Google
                    account, or the login id and password from your onboarding email.
                </p>

                <div className="mt-8 rounded-2xl bg-white/5 backdrop-blur border border-white/10 p-6 space-y-6">
                    {googleClientId ? (
                        <div ref={googleBtnRef} className="w-full flex justify-center min-h-[44px]" />
                    ) : (
                        <div className="text-xs text-amber-300 text-center">
                            Google sign-in unavailable — <code className="font-mono">VITE_GOOGLE_CLIENT_ID</code> not set.
                        </div>
                    )}

                    <div className="flex items-center gap-3">
                        <div className="h-px flex-1 bg-white/10" />
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-white/40">or</span>
                        <div className="h-px flex-1 bg-white/10" />
                    </div>

                    <form onSubmit={handlePasswordSubmit} className="space-y-3">
                        <label className="block">
                            <span className="text-xs font-medium text-white/70">Login ID (email or enrollment)</span>
                            <input
                                type="text"
                                autoComplete="username"
                                value={loginId}
                                onChange={(e) => setLoginId(e.target.value)}
                                className="mt-1 w-full rounded-lg bg-slate-900/70 border border-white/10 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                                placeholder={`you@${STUDENT_DOMAIN}`}
                                disabled={busy}
                            />
                        </label>
                        <label className="block">
                            <span className="text-xs font-medium text-white/70">Password</span>
                            <input
                                type="password"
                                autoComplete="current-password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="mt-1 w-full rounded-lg bg-slate-900/70 border border-white/10 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                                placeholder="From your onboarding email"
                                disabled={busy}
                            />
                        </label>
                        <button
                            type="submit"
                            disabled={busy}
                            className="w-full rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 disabled:opacity-60 disabled:cursor-not-allowed px-4 py-2.5 text-sm font-semibold transition flex items-center justify-center gap-2"
                        >
                            {busy && <Loader2 size={14} className="animate-spin" />}
                            Sign in
                        </button>
                    </form>
                </div>

                <div className="mt-6 flex items-center gap-2 text-[11px] text-white/40">
                    <ShieldCheck size={12} />
                    <span>All logins are audited. Contact admin if your password isn't working.</span>
                </div>
            </div>
        </div>
    )
}
