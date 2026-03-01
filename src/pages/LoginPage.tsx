import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import api from '../api/axios'
import toast from 'react-hot-toast'
import { Lock, Mail, ShieldCheck } from 'lucide-react'

export default function LoginPage() {
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const setAuth = useAuthStore((s) => s.setAuth)
    const navigate = useNavigate()

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            const { data: response } = await api.post('/auth/login', { email, password })
            const user = response.data.user

            if (user.role === 'SECURITY_GUARD') {
                toast.error('Access Denied: Security Guards must use the Mobile App')
                return
            }

            setAuth(response.data)
            toast.success('Welcome back!')
            navigate('/')
        } catch (err: any) {
            toast.error(err.response?.data?.error || 'Login failed')
        } finally {
            setLoading(false)
        }
    }

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

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-2">
                            <label className="block text-[10px] font-black uppercase tracking-widest text-text-secondary ml-1">Email Identity</label>
                            <div className="relative group/input">
                                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary group-focus-within/input:text-primary transition-colors" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold text-text-primary focus:border-primary/40 focus:bg-white/[0.08] focus:outline-none transition-all placeholder:text-text-secondary/30"
                                    placeholder="Enter system email"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="block text-[10px] font-black uppercase tracking-widest text-text-secondary ml-1">Secure Password</label>
                            <div className="relative group/input">
                                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary group-focus-within/input:text-primary transition-colors" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold text-text-primary focus:border-primary/40 focus:bg-white/[0.08] focus:outline-none transition-all placeholder:text-text-secondary/30"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full group/btn relative bg-primary text-white font-black text-sm uppercase tracking-widest py-4 rounded-2xl overflow-hidden shadow-lg shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                        >
                            <div className="relative z-10 flex items-center justify-center gap-2">
                                {loading ? 'Validating Token...' : (
                                    <>
                                        Authorize Access
                                        <ShieldCheck size={18} />
                                    </>
                                )}
                            </div>
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-1000" />
                        </button>
                    </form>

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
