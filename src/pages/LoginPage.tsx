import { useState } from 'react'
import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import api from '../api/axios'
import toast from 'react-hot-toast'
import { ShieldCheck } from 'lucide-react'

declare global {
    interface Window {
        __MITS_GSI_INITIALIZED__?: boolean
    }
}

export default function LoginPage() {
    const [loading, setLoading] = useState(false)
    const setAuth = useAuthStore((s) => s.setAuth)
    const navigate = useNavigate()
    const studentPortalUrl = import.meta.env.VITE_STUDENT_PORTAL_URL || 'smartid://login'
    const studentPortalFallbackUrl = import.meta.env.VITE_STUDENT_PORTAL_FALLBACK_URL as string | undefined
    const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

    const decodeGoogleEmailFromIdToken = (idToken: string): string | null => {
        try {
            const parts = idToken.split('.')
            if (parts.length < 2) return null
            const normalized = parts[1].replace(/-/g, '+').replace(/_/g, '/')
            const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)
            const payload = JSON.parse(atob(padded))
            return typeof payload?.email === 'string' ? payload.email.toLowerCase() : null
        } catch {
            return null
        }
    }

    const redirectToStudentSide = () => {
        // On desktop browsers, custom app scheme may not be registered.
        if (studentPortalUrl.startsWith('smartid://')) {
            const start = Date.now()
            window.location.href = studentPortalUrl
            window.setTimeout(() => {
                const elapsed = Date.now() - start
                if (elapsed < 1800) {
                    if (studentPortalFallbackUrl) {
                        window.location.href = studentPortalFallbackUrl
                        return
                    }
                    toast.error('Student app is not installed on this device. Please login from the official student app.')
                }
            }, 1200)
            return
        }

        window.location.href = studentPortalUrl
    }

    const handleAuthSuccess = (authPayload: any) => {
        const authData = authPayload?.data || authPayload
        const role = authData?.user?.role
        const emailValue = String(authData?.user?.email || '').toLowerCase()

        if (role === 'STUDENT' || emailValue.endsWith('@mitsgwl.ac.in')) {
            toast('Student account detected. Redirecting to student side...')
            redirectToStudentSide()
            return
        }

        setAuth(authData)
        toast.success('Welcome back!')
        navigate('/')
    }


    // Google Identity Services JS API
    const googleBtnRef = useRef<HTMLDivElement>(null)
    useEffect(() => {
        if (!googleClientId) return

        // @ts-ignore
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
                            toast('Student account detected. Redirecting to student side...')
                            redirectToStudentSide()
                            return
                        }

                        if (
                            tokenEmail
                            && tokenEmail !== 'naitikjainjbp@gmail.com'
                            && !tokenEmail.endsWith('@mitsgwalior.in')
                        ) {
                            toast.error('Use only @mitsgwalior.in admin account (or super admin) on this portal.')
                            return
                        }

                        setLoading(true)
                        try {
                            const { data: resp } = await api.post('/auth/google', { idToken })
                            handleAuthSuccess(resp.data)
                        } catch (err: any) {
                            toast.error(err.response?.data?.error || err.message || 'Google login failed')
                        } finally {
                            setLoading(false)
                        }
                    },
                    ux_mode: 'popup',
                })
                window.__MITS_GSI_INITIALIZED__ = true
            }

            googleBtnRef.current.innerHTML = ''
            // @ts-ignore
            window.google.accounts.id.renderButton(googleBtnRef.current, {
                theme: 'filled_black',
                size: 'large',
                shape: 'pill',
                text: 'continue_with',
                width: 320,
            })
        }
    }, [googleClientId])

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-bg-dark">
            {/* Background Image with Overlay */}
            <div
                className="absolute inset-0 z-0 scale-105 animate-slow-zoom"
                style={{
                    backgroundImage: 'url("/MITS.png")',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                }}
            />
            <div className="absolute inset-0 bg-bg-dark/60 backdrop-blur-[2px] z-0" />

            {/* Visual Decoration */}
            <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full animate-pulse z-1" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/10 blur-[120px] rounded-full animate-pulse z-1" style={{ animationDelay: '2s' }} />

            <div className="w-full max-w-md px-6 relative z-10 animate-fade-in-up">
                <div className="glass-card p-10 shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-50" />

                    {/* Logo Section */}
                    <div className="text-center mb-10">
                        <div className="relative inline-block">
                            <div className="w-20 h-20 bg-gradient-to-br from-primary to-primary-light rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-xl shadow-primary/20 transform group-hover:rotate-6 transition-transform duration-500">
                                <ShieldCheck size={40} className="text-white" strokeWidth={2.5} />
                            </div>
                            <div className="absolute -inset-2 bg-primary/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <h1 className="text-3xl font-black tracking-tighter text-text-primary mb-2">
                            SMART-ID <span className="text-primary font-medium tracking-normal text-lg">ADMIN</span>
                        </h1>
                        <p className="text-text-secondary font-bold text-[10px] uppercase tracking-[0.2em] opacity-60">
                            Secure Infrastructure Access
                        </p>
                    </div>

                    <div className="flex flex-col items-center">
                        {googleClientId ? (
                            <>
                                <div ref={googleBtnRef} style={{ width: 320 }} />
                                <p className="text-[10px] text-text-secondary mt-6 text-center opacity-60 max-w-xs">
                                    Sign in with your @mitsgwalior.in or admin Google account
                                </p>
                            </>
                        ) : (
                            <p className="text-xs text-text-secondary text-center">
                                Google login is unavailable. Set `VITE_GOOGLE_CLIENT_ID` in environment.
                            </p>
                        )}
                    </div>

                    <div className="mt-10 pt-8 border-t border-white/5 text-center">
                        <p className="text-[9px] font-black text-text-secondary uppercase tracking-[0.3em] opacity-40">
                            Madhav Institute of Technology & Science
                        </p>
                    </div>
                </div>

                {/* External Link or Help */}
                <p className="text-center mt-8 text-[10px] font-bold text-text-secondary uppercase tracking-widest opacity-60">
                    Proprietary Security Infrastructure &copy; {new Date().getFullYear()}
                </p>
            </div>
        </div>
    )
}
