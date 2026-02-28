import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
    id: number
    name: string
    email: string
    role: 'SUPER_ADMIN' | 'HOD' | 'FACULTY' | 'WARDEN' | 'SECURITY_GUARD'
    department?: string | null
    module?: string | null
}

interface AuthState {
    token: string | null
    refreshToken: string | null
    user: User | null
    setAuth: (data: { accessToken: string; refreshToken: string; user: User }) => void
    logout: () => void
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            token: null,
            refreshToken: null,
            user: null,
            setAuth: ({ accessToken, refreshToken, user }) =>
                set({ token: accessToken, refreshToken, user }),
            logout: () => set({ token: null, refreshToken: null, user: null }),
        }),
        { name: 'mits-auth' }
    )
)
