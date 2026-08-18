import { useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAuthStore } from '../store/authStore'
import { useSocketStore, type ScanEvent, type RfidReaderStatusEvent } from '../store/socketStore'
import toast from 'react-hot-toast'

const DEPLOYED_SOCKET_URL = 'https://smart-id-backend.vercel.app'

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL ||
    (import.meta.env.VITE_API_URL?.startsWith('http')
        ? import.meta.env.VITE_API_URL.replace('/api/v1', '')
        : DEPLOYED_SOCKET_URL)

export function useRfidSocket() {
    const token = useAuthStore((s) => s.token)
    const { addRfidEvent, updateReaderStatus } = useSocketStore()
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

        socket.on('RFID_EVENT', (event: ScanEvent) => {
            addRfidEvent(event)
            if (event.accessResult === 'DENIED' || event.result === 'DENIED') {
                toast.error(`RFID Denied: ${event.studentName || event.cardUid || 'Unknown'} (${event.denialReason || 'Access Denied'})`, {
                    id: `rfid-denied-${event.id}`,
                    duration: 3500,
                })
            }
        })

        socket.on('READER_STATUS_CHANGE', (reader: RfidReaderStatusEvent) => {
            updateReaderStatus(reader)
            if (!reader.isOnline) {
                toast.error(`Reader Offline: ${reader.deviceName || reader.readerId}`, {
                    id: `reader-offline-${reader.readerId}`,
                })
            } else {
                toast.success(`Reader Online: ${reader.deviceName || reader.readerId}`, {
                    id: `reader-online-${reader.readerId}`,
                })
            }
        })

        socket.on('RFID_ALERT', (alert: { type: string; message: string }) => {
            toast.error(`RFID Alert: ${alert.message}`, {
                id: `rfid-alert-${Date.now()}`,
                duration: 5000,
            })
        })

        return () => {
            socket.disconnect()
            socketRef.current = null
        }
    }, [token, addRfidEvent, updateReaderStatus])
}
