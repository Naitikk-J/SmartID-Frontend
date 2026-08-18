import { create } from 'zustand'

export interface ScanEvent {
    id: string
    time: string
    studentName: string
    enrollmentNo: string
    department: string
    scanType?: string
    eventType?: string
    result?: string
    accessResult?: string
    badge?: string
    gateId?: number | string
    gateName?: string | null
    direction?: 'ENTRY' | 'EXIT' | null
    credentialType?: 'QR' | 'RFID' | 'MOBILE' | 'FACE'
    readerId?: string
    readerName?: string
    cardUid?: string
    denialReason?: string | null
}

export interface RfidReaderStatusEvent {
    readerId: string
    deviceName?: string
    location?: string
    zone?: string
    isOnline: boolean
    status?: string
    lastHeartbeat?: string
}

interface SocketState {
    connected: boolean
    liveFeed: ScanEvent[]
    rfidFeed: ScanEvent[]
    readerStatuses: Record<string, RfidReaderStatusEvent>
    setConnected: (v: boolean) => void
    addScanEvent: (e: ScanEvent) => void
    addRfidEvent: (e: ScanEvent) => void
    updateReaderStatus: (e: RfidReaderStatusEvent) => void
    clearFeed: () => void
    clearRfidFeed: () => void
}

export const useSocketStore = create<SocketState>((set) => ({
    connected: false,
    liveFeed: [],
    rfidFeed: [],
    readerStatuses: {},
    setConnected: (connected) => set({ connected }),
    addScanEvent: (event) =>
        set((state) => ({
            liveFeed: [event, ...state.liveFeed].slice(0, 100),
        })),
    addRfidEvent: (event) =>
        set((state) => ({
            rfidFeed: [event, ...state.rfidFeed].slice(0, 100),
            liveFeed: [event, ...state.liveFeed].slice(0, 100),
        })),
    updateReaderStatus: (reader) =>
        set((state) => ({
            readerStatuses: {
                ...state.readerStatuses,
                [reader.readerId]: reader,
            },
        })),
    clearFeed: () => set({ liveFeed: [] }),
    clearRfidFeed: () => set({ rfidFeed: [] }),
}))
