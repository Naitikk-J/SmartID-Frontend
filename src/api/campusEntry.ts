// ─────────────────────────────────────────────────────────────
// MITS Smart ID — campus-entry API helpers.
//
// Uses a SECOND axios instance for the student portal so the
// student's short-lived campus-entry token never gets mixed up
// with the admin authStore in a browser where an admin might
// already be signed in. The scanner + admin pages continue to
// use the shared admin `api` instance (from src/api/axios.ts).
// ─────────────────────────────────────────────────────────────

import axios from 'axios'
import api from './axios'

const DEPLOYED_API_URL = 'https://smart-id-backend.vercel.app/api/v1'

// Student portal axios — reads its own token from localStorage
// under a distinct key so it never collides with `mits-auth`
// (the admin console's persisted store).
export const STUDENT_AUTH_KEY = 'mits-student-auth'

interface StudentAuthState {
    accessToken?: string
    refreshToken?: string
    user?: any
}

export function readStudentAuth(): StudentAuthState {
    try {
        const raw = localStorage.getItem(STUDENT_AUTH_KEY)
        if (!raw) return {}
        return JSON.parse(raw)
    } catch { return {} }
}

export function writeStudentAuth(state: StudentAuthState | null) {
    if (state === null) {
        localStorage.removeItem(STUDENT_AUTH_KEY)
        return
    }
    localStorage.setItem(STUDENT_AUTH_KEY, JSON.stringify(state))
}

export const studentApi = axios.create({
    baseURL: import.meta.env.VITE_API_URL || DEPLOYED_API_URL,
    timeout: 30000,
})

studentApi.interceptors.request.use((config) => {
    const { accessToken } = readStudentAuth()
    if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`
    }
    return config
})

studentApi.interceptors.response.use(
    (r) => r,
    (err) => {
        if (err?.response?.status === 401) {
            writeStudentAuth(null)
            if (!window.location.pathname.startsWith('/student/login')) {
                window.location.href = '/student/login'
            }
        }
        return Promise.reject(err)
    },
)

// ── Student endpoints ───────────────────────────────────────

export async function studentLoginPassword(loginId: string, password: string) {
    const { data } = await studentApi.post('/campus-entry/student/login', { loginId, password })
    return data.data
}

export async function studentLoginGoogle(idToken: string) {
    const { data } = await studentApi.post('/campus-entry/student/google', { idToken })
    return data.data
}

export async function fetchStudentMe() {
    const { data } = await studentApi.get('/campus-entry/me')
    return data.data
}

export async function fetchStudentQr() {
    const { data } = await studentApi.get('/campus-entry/qr')
    return data.data as {
        token: string
        ttlSeconds: number
        alreadyUsed: boolean
        participant: { id: string; fullName: string; enrollmentNo: string }
    }
}

export async function fetchStudentStatus() {
    const { data } = await studentApi.get('/campus-entry/status')
    return data.data as {
        enrolled: boolean
        entered: boolean
        enteredAt: string | null
        revokedAt: string | null
        active: boolean
    }
}

// ── Scanner + Admin endpoints (use the admin `api` client) ──

export async function scanCampusEntry(qrToken: string, extra?: {
    gateLabel?: string
    gateId?: string
    latitude?: number
    longitude?: number
}) {
    const { data } = await api.post('/campus-entry/scan', { qrToken, ...(extra || {}) })
    return data.data as ScanResult
}

// Warm-up ping — called when the scanner camera page mounts so the
// first REAL scan doesn't pay a Vercel serverless cold-start (~1-2s).
// Hits /health which is public + cheap; the point is just to force
// the backend container + Prisma client to spin up before the guard
// aims at the first student's QR. Safe to fail silently.
export async function warmupCampusEntry() {
    await api.get('/health', { timeout: 4000 })
}

export type ScanResult = {
    ok: boolean
    reason: string
    message: string
    scanId?: string | null
    participantId?: string
    scannedAt?: string
    student?: {
        fullName: string
        enrollmentNo: string
        email?: string
        department?: string | null
        year?: number | null
        section?: string | null
        photoUrl?: string | null
        phone?: string | null
        bloodGroup?: string | null
        studentType?: string | null
        usedAt?: string | null
    }
}

export async function enrollCampusParticipants(participants: Array<{
    fullName: string
    email: string
    phone?: string
    enrollmentNo?: string
    department?: string
    year?: number
    section?: string
}>, sendEmails = true) {
    const { data } = await api.post('/campus-entry/admin/enroll', { participants, sendEmails })
    return data.data
}

export async function enrollExistingStudents(studentIds: string[], sendEmails = true) {
    const { data } = await api.post('/campus-entry/admin/enroll-existing', { studentIds, sendEmails })
    return data.data
}

// Reuses the existing /students endpoint (admin auth already applied
// via the shared axios instance). Returns the list used by the
// "Pick existing students" flow in the campus-entry admin UI.
export async function listExistingStudents(params: {
    search?: string
    dept?: string
    year?: number
    page?: number
    limit?: number
} = {}) {
    const { data } = await api.get('/students', { params: { limit: 50, ...params } })
    return data.data as {
        students: Array<{
            id: string
            fullName: string
            email: string
            enrollmentNo: string
            department: string
            year: number
            section?: string
            phone?: string
            photoUrl?: string
        }>
        total: number
        page: number
        limit: number
        pages: number
    }
}

export async function listCampusScans(params: {
    limit?: number
    cursor?: string | null
    since?: string | null
    search?: string | null
} = {}) {
    const { data } = await api.get('/campus-entry/admin/scans', { params })
    return data.data as {
        scans: any[]
        nextCursor: string | null
    }
}

export async function listCampusParticipants(params: {
    limit?: number
    cursor?: string | null
    filter?: 'entered' | 'not_entered' | 'revoked' | null
    search?: string | null
} = {}) {
    const { data } = await api.get('/campus-entry/admin/participants', { params })
    return data.data as {
        participants: any[]
        nextCursor: string | null
    }
}

export async function revokeCampusEntry(participantId: string, reason?: string) {
    const { data } = await api.post('/campus-entry/admin/revoke', { participantId, reason })
    return data.data
}

export async function revokeCampusEntriesBulk(participantIds: string[], reason?: string) {
    const { data } = await api.post('/campus-entry/admin/revoke-bulk', { participantIds, reason })
    return data.data as { ok: boolean; revoked: number }
}

export async function resetCampusEntryDay(reason?: string) {
    const { data } = await api.post('/campus-entry/admin/reset-day', { confirm: true, reason })
    return data.data as { ok: boolean; revoked: number }
}

export async function resendCredentials(input: { participantIds?: string[]; onlyFailed?: boolean }) {
    const { data } = await api.post('/campus-entry/admin/resend-credentials', input)
    return data.data
}

export async function fetchCredentialEmails(status?: 'QUEUED' | 'SENT' | 'FAILED') {
    const { data } = await api.get('/campus-entry/admin/credential-emails', {
        params: status ? { status } : {},
    })
    return data.data as {
        rows: Array<{
            id: string
            participantId: string
            email: string
            status: 'QUEUED' | 'SENT' | 'FAILED'
            attempts: number
            lastError: string | null
            sentAt: string | null
            updatedAt: string
            createdAt: string
        }>
        summary: { SENT: number; FAILED: number; QUEUED: number }
    }
}

export async function fetchCampusStats() {
    const { data } = await api.get('/campus-entry/admin/stats')
    return data.data as {
        enrolled: number
        entered: number
        notEntered: number
        revokes: number
        totalRevokeCount: number
        mail: { SENT: number; FAILED: number; QUEUED: number }
        smtpConfigured: boolean
    }
}
