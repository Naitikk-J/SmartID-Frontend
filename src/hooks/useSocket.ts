import { useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '../store/authStore'
import { useSocketStore } from '../store/socketStore'
import toast from 'react-hot-toast'

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api/v1', '') ?? 'http://localhost:4000'

export function useSocket() {
    const token = useAuthStore((s) => s.token)
    const { setConnected, addScanEvent } = useSocketStore()
    const socketRef = useRef<Socket | null>(null)

    useEffect(() => {
        if (!token) return

        const socket = io(SOCKET_URL, {
            auth: { token },
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 10000,
        })

        socketRef.current = socket

        socket.on('connect', () => {
            setConnected(true)
            toast.success('Live feed connected', { id: 'socket-status' })
        })

        socket.on('disconnect', () => {
            setConnected(false)
        })

        socket.on('connect_error', () => {
            toast.error('Live feed disconnected — retrying', { id: 'socket-status' })
        })

        socket.on('SCAN_EVENT', (event) => {
            addScanEvent(event)
        })

        socket.on('EXIT_RULES_UPDATED', () => {
            toast('Exit rules updated', { icon: '🔄', id: 'rules-update' })
        })

        return () => {
            socket.disconnect()
            socketRef.current = null
        }
    }, [token, setConnected, addScanEvent])
}
