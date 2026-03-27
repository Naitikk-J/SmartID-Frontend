import axios from 'axios'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'

const DEPLOYED_API_URL = 'https://smart-id-backend.vercel.app/api/v1'

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || DEPLOYED_API_URL,
    timeout: 150000,
})

// Request interceptor: attach JWT
api.interceptors.request.use((config) => {
    const token = useAuthStore.getState().token
    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }
    return config
})

// Response interceptor: handle errors
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const { response } = error
        const status = response?.status
        const data = response?.data

        // Ensure message is a string to prevent "Objects are not valid as a React child"
        const rawMessage = data?.error || error.message || 'An unexpected error occurred'
        const message = typeof rawMessage === 'object' ? JSON.stringify(rawMessage) : String(rawMessage)

        if (status === 401) {
            console.error(' [Auth] 401 Unauthorized. Redirecting to login...', {
                url: error.config?.url,
                message: message
            })
            useAuthStore.getState().logout()
            // Only redirect if we're not already on the login page
            if (window.location.pathname !== '/login') {
                window.location.href = '/login'
            }
        } else if (status === 403) {
            toast.error('Forbidden: ' + message)
        } else if (status === 429) {
            toast.error('Rate limited: ' + message)
        } else if (status && status >= 500) {
            toast.error('Server error: ' + message)
        } else {
            toast.error(message)
        }

        return Promise.reject(error)
    }
)

export default api
