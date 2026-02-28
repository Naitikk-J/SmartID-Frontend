import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import api from '../api/axios'
import toast from 'react-hot-toast'
import { Lock, Mail } from 'lucide-react'

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
        <div className="min-h-screen flex items-center justify-center bg-bg-dark">
            <div className="w-full max-w-md">
                <div className="bg-bg-card rounded-2xl border border-border p-8 shadow-2xl">
                    {/* Logo */}
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-gradient-to-br from-accent to-primary rounded-xl mx-auto mb-4 flex items-center justify-center">
                            <span className="text-2xl font-bold">M</span>
                        </div>
                        <h1 className="text-2xl font-bold">MITS Smart ID</h1>
                        <p className="text-text-secondary text-sm mt-1">Admin Dashboard Login</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div>
                            <label className="block text-sm text-text-secondary mb-1.5">Email</label>
                            <div className="relative">
                                <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full bg-bg-dark border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm focus:border-accent focus:outline-none transition-colors"
                                    placeholder="admin@mits.ac.in"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm text-text-secondary mb-1.5">Password</label>
                            <div className="relative">
                                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                                <input
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-bg-dark border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm focus:border-accent focus:outline-none transition-colors"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-accent hover:bg-accent/90 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50"
                        >
                            {loading ? 'Signing in...' : 'Sign In'}
                        </button>
                    </form>

                    <p className="text-center text-xs text-text-secondary mt-6">
                        Madhav Institute of Technology & Science, Gwalior
                    </p>
                </div>
            </div>
        </div>
    )
}
