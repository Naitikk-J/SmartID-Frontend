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
    gateId?: number | string
    gateName?: string | null
    direction?: 'ENTRY' | 'EXIT' | null
    credentialType?: 'QR' | 'RFID' | 'MOBILE' | 'FACE'
    readerId?: string
    readerName?: string
    cardUid?: string
    denialReason?: string | null
    accessResult?: string
    eventType?: string
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
    addRfidEvent: (e: Partial<ScanEvent>) => void
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
    addRfidEvent: (event) => {
        const fullEvent: ScanEvent = {
            id: event.id || String(Date.now()),
            time: event.time || new Date().toISOString(),
            studentName: event.studentName || event.cardUid || 'Unknown',
            enrollmentNo: event.enrollmentNo || 'N/A',
            department: event.department || 'N/A',
            scanType: event.scanType || event.eventType || 'RFID_TAP',
            result: event.result || event.accessResult || 'VERIFIED',
            badge: event.badge || (event.accessResult === 'GRANTED' || event.result === 'VERIFIED' ? 'GREEN' : 'RED'),
            gateId: event.gateId,
            gateName: event.gateName,
            direction: event.direction,
            credentialType: 'RFID',
            readerId: event.readerId,
            readerName: event.readerName,
            cardUid: event.cardUid,
            denialReason: event.denialReason,
            accessResult: event.accessResult,
            eventType: event.eventType,
        }

        return set((state) => ({
            rfidFeed: [fullEvent, ...state.rfidFeed].slice(0, 100),
            liveFeed: [fullEvent, ...state.liveFeed].slice(0, 100),
        }))
    },
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
