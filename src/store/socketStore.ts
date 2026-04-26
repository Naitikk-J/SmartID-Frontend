import { create } from 'zustand'

export interface ScanEvent {
    id: string
    time: string
    studentName: string
    enrollmentNo: string
    department: string
    scanType: string
    result: string
    badge: string
    gateId?: number
    gateName?: string | null
    direction?: 'ENTRY' | 'EXIT' | null
}

interface SocketState {
    connected: boolean
    liveFeed: ScanEvent[]
    setConnected: (v: boolean) => void
    addScanEvent: (e: ScanEvent) => void
    clearFeed: () => void
}

export const useSocketStore = create<SocketState>((set) => ({
    connected: false,
    liveFeed: [],
    setConnected: (connected) => set({ connected }),
    addScanEvent: (event) =>
        set((state) => ({
            liveFeed: [event, ...state.liveFeed].slice(0, 100),
        })),
    clearFeed: () => set({ liveFeed: [] }),
}))
