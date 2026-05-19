import axios, { AxiosError, type AxiosRequestConfig } from 'axios'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'

const DEPLOYED_API_URL = 'https://smart-id-backend.vercel.app/api/v1'

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || DEPLOYED_API_URL,
    timeout: 150000,
})

// ─── Silent refresh state ────────────────────────────────────
//
// The backend now issues SINGLE-USE refresh tokens (jti recorded in
// Redis, each /refresh call rotates + revokes the previous one). If
// multiple requests race past the access-token expiry at once they
// must NOT all call /refresh in parallel — that would burn through
// rotations and every request after the first would 401 with
// REFRESH_REVOKED.
//
// `refreshPromise` is a single in-flight refresh; concurrent 401s
// await the same promise, then replay with the new access token.

let refreshPromise: Promise<string> | null = null

interface RetryableConfig extends AxiosRequestConfig {
    _retry?: boolean
}

async function performRefresh(): Promise<string> {
    const state = useAuthStore.getState()
    const currentRefresh = state.refreshToken
    if (!currentRefresh) {
        throw new Error('No refresh token available')
    }

    // Use a bare axios instance — going through `api` would re-enter
    // the response interceptor and recurse on 401.
    const res = await axios.post(
        `${api.defaults.baseURL}/auth/refresh`,
        { refreshToken: currentRefresh },
        { headers: { 'Content-Type': 'application/json' } },
    )

    const data = res.data?.data
    if (!data?.accessToken || !data?.refreshToken) {
        throw new Error('Malformed refresh response')
    }

    useAuthStore.getState().setTokens({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
    })
    return data.accessToken
}

// Request interceptor: attach JWT
api.interceptors.request.use((config) => {
    const token = useAuthStore.getState().token
    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }
    return config
})

// Response interceptor: silent-refresh on 401, then surface real errors
api.interceptors.response.use(
    (response) => response,
    async (error: AxiosError<any>) => {
        const { response, config } = error
        const status = response?.status
        const data = response?.data as any
        const original = config as RetryableConfig | undefined
        const code = data?.code

        // ── Silent refresh path ──────────────────────────────
        // Only attempt one refresh per failing request. Skip when:
        //   - the failing request IS the refresh call (don't loop)
        //   - the failing request has no auth header to refresh
        //   - the server told us the refresh chain is dead
        const isAuthRefreshCall = original?.url?.includes('/auth/refresh')
        const refreshDead = code === 'REFRESH_REVOKED' || code === 'INVALID_TOKEN'
        const canRetry = !!original
            && !original._retry
            && status === 401
            && !isAuthRefreshCall
            && !refreshDead
            && Boolean(useAuthStore.getState().refreshToken)

        if (canRetry) {
            original!._retry = true
            try {
                if (!refreshPromise) {
                    refreshPromise = performRefresh().finally(() => {
                        refreshPromise = null
                    })
                }
                const newToken = await refreshPromise
                // Re-attach the fresh token on the queued request and replay.
                original!.headers = { ...(original!.headers || {}) } as any
                ;(original!.headers as any).Authorization = `Bearer ${newToken}`
                return api.request(original!)
            } catch (refreshErr) {
                // Fall through to the hard-logout path below.
            }
        }

        // Ensure message is a string to prevent "Objects are not valid as a React child"
        const rawMessage = data?.error || error.message || 'An unexpected error occurred'
        const message = typeof rawMessage === 'object' ? JSON.stringify(rawMessage) : String(rawMessage)

        if (status === 401) {
            console.error('[Auth] 401 Unauthorized — logging out', {
                url: error.config?.url,
                code,
                message,
            })
            useAuthStore.getState().logout()
            if (window.location.pathname !== '/login') {
                window.location.href = '/login'
            }
        } else if (status === 403) {
            toast.error('Forbidden: ' + message)
        } else if (status === 429) {
            toast.error('Rate limited: ' + message)
        } else if (status === 413) {
            toast.error('Upload too large: ' + message)
        } else if (status && status >= 500) {
            toast.error('Server error: ' + message)
        } else {
            toast.error(message)
        }

        return Promise.reject(error)
    },
)

export default api
