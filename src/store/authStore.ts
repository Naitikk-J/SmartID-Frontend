import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
    id: number
    name: string
    email: string
    role: 'SUPER_ADMIN' | 'HOD' | 'FACULTY' | 'WARDEN' | 'SECURITY_GUARD' | 'STUDENT'
    department?: string | null
    module?: string | null
    userType?: string
    appAccess?: 'FULL' | 'EVENT_ONLY'
}

interface AuthState {
    token: string | null
    refreshToken: string | null
    user: User | null
    setAuth: (data: { accessToken: string; refreshToken: string; user: User }) => void
    /**
     * Update ONLY the token pair without touching the user. Used by
     * the axios silent-refresh path so concurrent requests can keep
     * the same identity while picking up a freshly-rotated jwt.
     */
    setTokens: (tokens: { accessToken: string; refreshToken: string }) => void
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
            setTokens: ({ accessToken, refreshToken }) =>
                set({ token: accessToken, refreshToken }),
            logout: () => set({ token: null, refreshToken: null, user: null }),
        }),
        { name: 'mits-auth' }
    )
)
