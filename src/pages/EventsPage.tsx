import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import api from '../api/axios'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import Modal from '../components/ui/Modal'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import { Calendar, Download, Mail, Plus, QrCode, Trash2, Upload, UserPlus } from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'

interface EventItem {
    id: string
    name: string
    description?: string | null
    isActive: boolean
    isStayHostel?: boolean
    eventDate: string
    startTime: string
    endTime: string
    timezone?: string
    reportRecipients?: string[]
    participantsCount?: number
    stayScansCount?: number
    mealScansCount?: number
    maxMealsPerParticipant?: number | null
    dayWiseMealLimits?: Array<{ dayNumber: number; coupons: number }> | null
}

interface ParticipantImportRow {
    fullName: string
    email: string
    phone: string
    enrollmentNo?: string
    department?: string
    year?: number
    studentType?: string
}

interface MealEditDraft {
    maxMealsAllowed: string
    mealsConsumed: string
}

interface DayWiseMealLimitDraft {
    dayNumber: number
    coupons: string
}

interface ManualParticipantForm {
    fullName: string
    email: string
    phone: string
    enrollmentNo: string
    department: string
    year: string
    studentType: string
}

function toIso(date: string, time?: string): string {
    if (!time) return new Date(date).toISOString()
    return new Date(`${date}T${time}:00`).toISOString()
}

function normalizeHeaderKey(value: string): string {
    return String(value || '')
        .replace(/\u00A0/g, ' ')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
}

function toCleanString(value: unknown): string {
    if (value == null) return ''
    return String(value).replace(/\u00A0/g, ' ').trim()
}

function normalizeStudentType(value: string): string | undefined {
    const upper = String(value || '').trim().toUpperCase()
    if (!upper) return undefined

    if (upper.includes('HOSTELLER_GIRLS') || upper.includes('HOSTELLER GIRLS')) return 'HOSTELLER_GIRLS'
    if (upper.includes('HOSTELLER_BOYS') || upper.includes('HOSTELLER BOYS')) return 'HOSTELLER_BOYS'
    if (upper.includes('DAY_SCHOLAR') || upper.includes('DAY SCHOLAR') || upper.includes('STUDENT')) return 'DAY_SCHOLAR'

    return undefined
}

function getRawField(raw: Record<string, unknown>, aliases: string[]): unknown {
    for (const alias of aliases) {
        if (Object.prototype.hasOwnProperty.call(raw, alias)) {
            const value = raw[alias]
            if (value != null && String(value).trim() !== '') return value
        }
    }

    const normalizedMap = new Map<string, unknown>()
    Object.entries(raw).forEach(([key, value]) => {
        normalizedMap.set(normalizeHeaderKey(key), value)
    })

    for (const alias of aliases) {
        const value = normalizedMap.get(normalizeHeaderKey(alias))
        if (value != null && String(value).trim() !== '') return value
    }

    return ''
}

function normalizeParticipantRows(rawRows: Record<string, unknown>[]): ParticipantImportRow[] {
    return rawRows
        .map((raw) => {
            const fullName = toCleanString(getRawField(raw, ['fullName', 'name', 'studentName', 'student_name', 'Name', 'Name ']))
            const email = toCleanString(getRawField(raw, ['email', 'loginId', 'login_id', 'Email', 'Email ID'])).toLowerCase()
            const phone = toCleanString(getRawField(raw, ['phone', 'mobile', 'Mobile', 'Mobile No.', 'password']))
            const enrollmentNo = toCleanString(getRawField(raw, ['enrollmentNo', 'enrollment', 'enrollment_no', 'Enrollment No']))
            const department = toCleanString(getRawField(raw, ['department', 'Institue Name', 'Institute Name', 'Allocated Nodal Centre', 'Team Name- Team Id-Participant Type']))
            const yearRaw = Number(getRawField(raw, ['year', 'Year']) || 0)
            const studentType = normalizeStudentType(toCleanString(getRawField(raw, ['studentType', 'student_type', 'Participant Type', 'Team Leader/ Team Member/Mentor', 'Team Name- Team Id-Participant Type'])))

            return {
                fullName,
                email,
                phone,
                enrollmentNo: enrollmentNo || undefined,
                department: department || undefined,
                year: Number.isFinite(yearRaw) && yearRaw > 0 ? yearRaw : undefined,
                studentType: studentType || undefined,
            }
        })
        .filter((row) => row.fullName && row.email && row.phone)
}

function emptyManualParticipantForm(): ManualParticipantForm {
    return {
        fullName: '',
        email: '',
        phone: '',
        enrollmentNo: '',
        department: '',
        year: '',
        studentType: 'DAY_SCHOLAR',
    }
}

function parseRecipients(value: string): string[] {
    return Array.from(
        new Set(
            value
                .split(/[\n,;]+/g)
                .map((entry) => entry.trim().toLowerCase())
                .filter((entry) => /^\S+@\S+\.\S+$/.test(entry)),
        ),
    )
}

function downloadBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
}

function normalizeDayWiseMealLimits(raw: unknown): Array<{ dayNumber: number; coupons: number }> {
    if (!Array.isArray(raw)) return []

    const map = new Map<number, number>()
    raw.forEach((item) => {
        const dayNumber = Number((item as any)?.dayNumber)
        const coupons = Number((item as any)?.coupons)
        if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > 90) return
        if (!Number.isInteger(coupons) || coupons < 0) return
        map.set(dayNumber, coupons)
    })

    return Array.from(map.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([dayNumber, coupons]) => ({ dayNumber, coupons }))
}

function splitGlobalAcrossDays(globalLimit: number, days = 5): Array<{ dayNumber: number; coupons: number }> {
    const safeGlobal = Math.max(0, Math.trunc(globalLimit || 0))
    const safeDays = Math.max(1, Math.trunc(days || 1))

    const base = Math.floor(safeGlobal / safeDays)
    let remainder = safeGlobal % safeDays

    return Array.from({ length: safeDays }, (_, index) => {
        const next = base + (remainder > 0 ? 1 : 0)
        if (remainder > 0) remainder -= 1
        return {
            dayNumber: index + 1,
            coupons: next,
        }
    })
}

function computeDurationDays(startInput: string | Date, endInput: string | Date): number {
    const start = startInput instanceof Date ? startInput : new Date(startInput)
    const end = endInput instanceof Date ? endInput : new Date(endInput)

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 1

    const startDay = new Date(start)
    startDay.setHours(0, 0, 0, 0)
    const endDay = new Date(end)
    endDay.setHours(0, 0, 0, 0)

    const diffMs = endDay.getTime() - startDay.getTime()
    const days = Math.floor(diffMs / (24 * 60 * 60 * 1000)) + 1

    return Math.max(1, Math.min(90, days))
}

function buildDayWiseDrafts(
    durationDays: number,
    existing?: Array<{ dayNumber: number; coupons: number }>,
): DayWiseMealLimitDraft[] {
    const safeDuration = Math.max(1, Math.min(90, Math.trunc(durationDays || 1)))
    const map = new Map<number, number>()

        ; (existing || []).forEach((item) => {
            map.set(item.dayNumber, item.coupons)
        })

    return Array.from({ length: safeDuration }, (_, index) => {
        const dayNumber = index + 1
        const existingCoupons = map.get(dayNumber)
        return {
            dayNumber,
            coupons: existingCoupons == null ? '' : String(existingCoupons),
        }
    })
}

export default function EventsPage() {
    const [showCreate, setShowCreate] = useState(false)
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
    const [reportDate, setReportDate] = useState<string>(new Date().toISOString().slice(0, 10))
    const [participantRows, setParticipantRows] = useState<ParticipantImportRow[]>([])
    const [recipientInput, setRecipientInput] = useState('')
    const [stayQrToken, setStayQrToken] = useState<string>('')
    const [messQrToken, setMessQrToken] = useState<string>('')
    const [deletingEventId, setDeletingEventId] = useState<string | null>(null)
    const [globalMealLimitInput, setGlobalMealLimitInput] = useState('')
    const [dayWiseMealDrafts, setDayWiseMealDrafts] = useState<DayWiseMealLimitDraft[]>(
        buildDayWiseDrafts(1),
    )
    const [participantMealDrafts, setParticipantMealDrafts] = useState<Record<string, MealEditDraft>>({})
    const [participantSearchInput, setParticipantSearchInput] = useState('')
    const [participantSearchTerm, setParticipantSearchTerm] = useState('')
    const [manualParticipant, setManualParticipant] = useState<ManualParticipantForm>(emptyManualParticipantForm())
    const [form, setForm] = useState({
        name: '',
        description: '',
        eventDate: new Date().toISOString().slice(0, 10),
        endDate: new Date().toISOString().slice(0, 10),
        startTime: '09:00',
        endTime: '18:00',
        isStayHostel: true,
        hostelGateLabel: 'Event Hostel Gate',
        timezone: 'Asia/Kolkata',
        appliesTo: 'ALL',
    })

    const qc = useQueryClient()

    const { data: events, isLoading } = useQuery<EventItem[]>({
        queryKey: ['events'],
        queryFn: () => api.get('/events').then((r) => r.data.data.events as EventItem[]),
    })

    const selectedEvent = useMemo(
        () => events?.find((event) => event.id === selectedEventId) || null,
        [events, selectedEventId],
    )

    const participantsQuery = useQuery({
        queryKey: ['event-participants-all', selectedEventId],
        enabled: Boolean(selectedEventId),
        queryFn: async () => {
            if (!selectedEventId) {
                return { participants: [], total: 0, page: 1, limit: 0, pages: 0 }
            }

            const limit = 200
            let page = 1
            let pages = 1
            let total = 0
            let eventMealSettings: any = null
            const participants: any[] = []

            while (page <= pages) {
                const response = await api.get(`/events/${selectedEventId}/participants`, { params: { page, limit } })
                const data = response.data?.data || {}

                participants.push(...(data.participants || []))
                total = Number(data.total || participants.length)
                pages = Number(data.pages || 1)
                eventMealSettings = data.eventMealSettings || eventMealSettings
                page += 1
            }

            return {
                participants,
                total,
                page: 1,
                limit: participants.length,
                pages: 1,
                eventMealSettings,
            }
        },
    })

    const staySummaryQuery = useQuery({
        queryKey: ['event-stay-summary', selectedEventId, reportDate],
        enabled: Boolean(selectedEventId),
        queryFn: () => api.get(`/events/${selectedEventId}/stay/summary`, { params: { date: reportDate } }).then((r) => r.data.data),
    })

    const stayLogsQuery = useQuery({
        queryKey: ['event-stay-logs', selectedEventId, reportDate],
        enabled: Boolean(selectedEventId),
        queryFn: () => api.get(`/events/${selectedEventId}/stay/logs`, { params: { date: reportDate, limit: 15 } }).then((r) => r.data.data.logs),
    })

    const messLogsQuery = useQuery({
        queryKey: ['event-mess-logs', selectedEventId, reportDate],
        enabled: Boolean(selectedEventId),
        queryFn: () => api.get(`/events/${selectedEventId}/mess/logs`, { params: { date: reportDate, limit: 15 } }).then((r) => r.data.data.logs),
    })

    const toggleMutation = useMutation({
        mutationFn: (id: string) => api.patch(`/events/${id}/toggle`),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['events'] }); toast.success('Event toggled') },
    })

    const deleteEventMutation = useMutation({
        mutationFn: (id: string) => api.delete(`/events/${id}`),
        onSuccess: (_, eventId) => {
            qc.invalidateQueries({ queryKey: ['events'] })
            if (selectedEventId === eventId) {
                setSelectedEventId(null)
                setStayQrToken('')
                setMessQrToken('')
            }
            toast.success('Event deleted successfully')
        },
        onError: (error: any) => {
            const message = String(error?.response?.data?.message || error?.message || 'Failed to delete event')
            toast.error(message)
        },
        onSettled: () => {
            setDeletingEventId(null)
        },
    })

    const createMutation = useMutation({
        mutationFn: (payload: unknown) => api.post('/events', payload),
        onSuccess: (response) => {
            qc.invalidateQueries({ queryKey: ['events'] })
            toast.success('Event created successfully')
            const newId = response.data?.data?.event?.id as string | undefined
            setShowCreate(false)
            if (newId) setSelectedEventId(newId)
            setParticipantRows([])
        },
    })

    const importMutation = useMutation({
        mutationFn: (payload: { eventId: string; participants: ParticipantImportRow[] }) =>
            api.post(`/events/${payload.eventId}/participants/import`, { participants: payload.participants }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['event-participants-all', selectedEventId] })
            qc.invalidateQueries({ queryKey: ['events'] })
            toast.success('Participants imported')
            setParticipantRows([])
        },
    })

    const saveRecipientsMutation = useMutation({
        mutationFn: (emails: string[]) => api.post(`/events/${selectedEventId}/report-recipients`, { emails }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['events'] })
            toast.success('Report recipients saved')
        },
    })

    const sendDailyReportMutation = useMutation({
        mutationFn: () => api.post(`/events/${selectedEventId}/reports/send-daily`, { date: reportDate }),
        onSuccess: () => toast.success('Daily report trigger sent'),
    })

    const saveGlobalMealLimitMutation = useMutation({
        mutationFn: (payload: { maxMealsPerParticipant?: number | null; dayWiseMealLimits?: Array<{ dayNumber: number; coupons: number }> }) =>
            api.patch(`/events/${selectedEventId}/meal-settings`, payload),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['events'] })
            qc.invalidateQueries({ queryKey: ['event-participants-all', selectedEventId] })
            toast.success('Meal settings updated')
        },
    })

    const saveParticipantMealsMutation = useMutation({
        mutationFn: (payload: { participantId: string; maxMealsAllowed: number | null; mealsConsumed: number }) =>
            api.patch(`/events/${selectedEventId}/participants/${payload.participantId}/meals`, {
                maxMealsAllowed: payload.maxMealsAllowed,
                mealsConsumed: payload.mealsConsumed,
            }),
        onSuccess: (_, variables) => {
            qc.invalidateQueries({ queryKey: ['event-participants-all', selectedEventId] })
            setParticipantMealDrafts((prev) => {
                const next = { ...prev }
                delete next[variables.participantId]
                return next
            })
            toast.success('Participant meal data updated')
        },
    })

    useEffect(() => {
        if (!selectedEvent) {
            setGlobalMealLimitInput('')
            setDayWiseMealDrafts(buildDayWiseDrafts(1))
            setParticipantMealDrafts({})
            return
        }

        setGlobalMealLimitInput(
            selectedEvent.maxMealsPerParticipant == null ? '' : String(selectedEvent.maxMealsPerParticipant),
        )

        const normalizedDayWise = normalizeDayWiseMealLimits(selectedEvent.dayWiseMealLimits)
        const durationDays = computeDurationDays(selectedEvent.eventDate, selectedEvent.endTime)
        const nextDrafts = buildDayWiseDrafts(durationDays, normalizedDayWise)
        setDayWiseMealDrafts(nextDrafts)

        setParticipantMealDrafts({})
    }, [selectedEvent?.id, selectedEvent?.eventDate, selectedEvent?.endTime, selectedEvent?.maxMealsPerParticipant, selectedEvent?.dayWiseMealLimits])

    const buildDefaultDraft = (participant: any): MealEditDraft => {
        const consumedFromStats = participant?.mealStats?.consumed
        const consumed = Number.isInteger(consumedFromStats)
            ? consumedFromStats
            : Number.isInteger(participant?.mealsConsumed)
                ? participant.mealsConsumed
                : 0

        return {
            maxMealsAllowed: participant.maxMealsAllowed == null ? '' : String(participant.maxMealsAllowed),
            mealsConsumed: String(consumed),
        }
    }

    const getDraftForParticipant = (participant: any): MealEditDraft => {
        const draft = participantMealDrafts[participant.id]
        if (draft) return draft
        return buildDefaultDraft(participant)
    }

    const updateDraftField = (participant: any, field: keyof MealEditDraft, value: string): void => {
        setParticipantMealDrafts((prev) => {
            const base = prev[participant.id] || buildDefaultDraft(participant)
            return {
                ...prev,
                [participant.id]: {
                    ...base,
                    [field]: value,
                },
            }
        })
    }

    const saveParticipantMealDraft = (participant: any): void => {
        if (!selectedEventId) return

        const draft = getDraftForParticipant(participant)
        const maxMealsAllowed = draft.maxMealsAllowed.trim() === '' ? null : Number(draft.maxMealsAllowed)
        const mealsConsumed = Number(draft.mealsConsumed)

        if (maxMealsAllowed !== null && (!Number.isInteger(maxMealsAllowed) || maxMealsAllowed < 1)) {
            toast.error('Max meals should be a number >= 1')
            return
        }

        if (!Number.isInteger(mealsConsumed) || mealsConsumed < 0) {
            toast.error('Meals consumed should be a number >= 0')
            return
        }

        if (maxMealsAllowed !== null && mealsConsumed > maxMealsAllowed) {
            toast.error('Consumed meals cannot exceed max meals')
            return
        }

        saveParticipantMealsMutation.mutate({
            participantId: participant.id,
            maxMealsAllowed,
            mealsConsumed,
        })
    }

    const saveGlobalMealLimit = (): void => {
        if (!selectedEventId) return

        const parsed = globalMealLimitInput.trim() === '' ? null : Number(globalMealLimitInput)
        if (parsed !== null && (!Number.isInteger(parsed) || parsed < 1)) {
            toast.error('Global max meals should be a number >= 1')
            return
        }

        if (parsed !== null) {
            const dayWisePayload = parseDayWiseDraftPayload()
            if (!dayWisePayload) return

            const dayWiseTotal = sumDayWiseCoupons(dayWisePayload)
            if (dayWiseTotal > parsed) {
                toast.error(`Day-wise coupons total (${dayWiseTotal}) cannot exceed global max meals (${parsed})`)
                return
            }
        }

        saveGlobalMealLimitMutation.mutate({ maxMealsPerParticipant: parsed })
    }

    const updateDayWiseDraft = (dayNumber: number, value: string): void => {
        setDayWiseMealDrafts((prev) => prev.map((item) => (
            item.dayNumber === dayNumber
                ? { ...item, coupons: value }
                : item
        )))
    }

    const parseDayWiseDraftPayload = (): Array<{ dayNumber: number; coupons: number }> | null => {
        const payload: Array<{ dayNumber: number; coupons: number }> = []
        for (const row of dayWiseMealDrafts) {
            const trimmed = row.coupons.trim()
            if (!trimmed) continue

            const parsed = Number(trimmed)
            if (!Number.isInteger(parsed) || parsed < 0) {
                toast.error(`Day ${row.dayNumber} coupons must be a number >= 0`)
                return null
            }

            payload.push({ dayNumber: row.dayNumber, coupons: parsed })
        }

        return payload
    }

    const sumDayWiseCoupons = (payload: Array<{ dayNumber: number; coupons: number }>): number => (
        payload.reduce((sum, item) => sum + item.coupons, 0)
    )

    const autoSplitGlobalIntoDays = (): void => {
        const parsedGlobal = Number(globalMealLimitInput)
        if (!Number.isInteger(parsedGlobal) || parsedGlobal < 1) {
            toast.error('Enter a valid global max meals value first')
            return
        }

        const split = splitGlobalAcrossDays(parsedGlobal, dayWiseMealDrafts.length || 5)
        setDayWiseMealDrafts(split.map((item) => ({
            dayNumber: item.dayNumber,
            coupons: String(item.coupons),
        })))
    }

    const saveDayWiseMealLimits = (): void => {
        if (!selectedEventId) return

        const payload = parseDayWiseDraftPayload()
        if (!payload) return

        const effectiveGlobalFromInput = globalMealLimitInput.trim() === '' ? null : Number(globalMealLimitInput)
        const effectiveGlobalLimit = effectiveGlobalFromInput ?? selectedEvent?.maxMealsPerParticipant ?? null

        if (effectiveGlobalLimit !== null) {
            if (!Number.isInteger(effectiveGlobalLimit) || effectiveGlobalLimit < 1) {
                toast.error('Global max meals should be a number >= 1')
                return
            }

            const dayWiseTotal = sumDayWiseCoupons(payload)
            if (dayWiseTotal > effectiveGlobalLimit) {
                toast.error(`Day-wise coupons total (${dayWiseTotal}) cannot exceed global max meals (${effectiveGlobalLimit})`)
                return
            }
        }

        saveGlobalMealLimitMutation.mutate({
            dayWiseMealLimits: payload,
        })
    }

    const participantPreview = useMemo(() => {
        const valid = participantRows.filter((row) => row.fullName && row.email && row.phone).length
        return {
            total: participantRows.length,
            valid,
            invalid: participantRows.length - valid,
        }
    }, [participantRows])

    const filteredParticipants = useMemo(() => {
        const participants = participantsQuery.data?.participants || []
        const query = participantSearchTerm.trim().toLowerCase()

        if (!query) return participants

        return participants.filter((participant: any) => {
            const fields = [
                participant?.fullName,
                participant?.email,
                participant?.loginId,
                participant?.enrollmentNo,
            ]
            return fields.some((value) => String(value || '').toLowerCase().includes(query))
        })
    }, [participantsQuery.data?.participants, participantSearchTerm])

    const onImportFile = async (file: File): Promise<void> => {
        const lowerName = file.name.toLowerCase()
        const isPdf = lowerName.endsWith('.pdf') || file.type.toLowerCase().includes('pdf')

        if (isPdf) {
            const formData = new FormData()
            formData.append('file', file)
            const response = await api.post('/events/participants/parse-pdf', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            })
            const parsedRows = (response.data?.data?.participants || []) as Record<string, unknown>[]
            const normalized = normalizeParticipantRows(parsedRows)
            setParticipantRows(normalized)
            toast.success(`Loaded ${normalized.length} participants from PDF`)
            return
        }

        const buffer = await file.arrayBuffer()
        const workbook = XLSX.read(buffer, { type: 'array' })
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(firstSheet, { defval: '' })
        const normalized = normalizeParticipantRows(rows)
        setParticipantRows(normalized)
        toast.success(`Loaded ${normalized.length} participants from sheet`)
    }

    const addManualParticipantToQueue = (): void => {
        const fullName = manualParticipant.fullName.trim()
        const email = manualParticipant.email.trim().toLowerCase()
        const phone = manualParticipant.phone.trim()
        const enrollmentNo = manualParticipant.enrollmentNo.trim()
        const department = manualParticipant.department.trim()
        const studentType = normalizeStudentType(manualParticipant.studentType) || undefined
        const yearValue = manualParticipant.year.trim() === '' ? undefined : Number(manualParticipant.year)

        if (!fullName) {
            toast.error('Full name is required')
            return
        }
        if (!/^\S+@\S+\.\S+$/.test(email)) {
            toast.error('Valid email is required')
            return
        }
        if (phone.length < 4) {
            toast.error('Phone should be at least 4 characters')
            return
        }
        if (yearValue !== undefined && (!Number.isInteger(yearValue) || yearValue < 1 || yearValue > 4)) {
            toast.error('Year should be between 1 and 4')
            return
        }

        const payload: ParticipantImportRow = {
            fullName,
            email,
            phone,
            enrollmentNo: enrollmentNo || undefined,
            department: department || undefined,
            year: yearValue,
            studentType,
        }

        setParticipantRows((prev) => {
            const idx = prev.findIndex((row) => row.email === email)
            if (idx === -1) return [...prev, payload]

            const next = [...prev]
            next[idx] = payload
            return next
        })

        setManualParticipant(emptyManualParticipantForm())
        toast.success('Participant added to import queue')
    }

    const handleCreateEvent = async (): Promise<void> => {
        if (!form.name.trim()) {
            toast.error('Event name is required')
            return
        }

        const startAt = new Date(`${form.eventDate}T${form.startTime}:00`)
        const endAt = new Date(`${form.endDate}T${form.endTime}:00`)

        if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
            toast.error('Invalid start/end date-time')
            return
        }

        if (endAt.getTime() < startAt.getTime()) {
            toast.error('End date/time must be after start date/time')
            return
        }

        const payload = {
            name: form.name.trim(),
            description: form.description.trim() || null,
            eventDate: toIso(form.eventDate),
            startTime: toIso(form.eventDate, form.startTime),
            endTime: toIso(form.endDate, form.endTime),
            isStayHostel: form.isStayHostel,
            hostelGateLabel: form.hostelGateLabel.trim() || null,
            timezone: form.timezone,
            appliesTo: [form.appliesTo],
            participants: participantRows,
            reportRecipients: parseRecipients(recipientInput),
        }
        await createMutation.mutateAsync(payload)
    }

    const handleDownloadCsv = async (kind: 'stay' | 'meal' | 'combined'): Promise<void> => {
        if (!selectedEventId) return
        const response = await api.get(`/events/${selectedEventId}/reports/daily-csv`, {
            params: { kind, date: reportDate },
            responseType: 'blob',
        })
        const fileName = `${selectedEvent?.name || 'event'}_${reportDate}_${kind}.csv`.replace(/\s+/g, '_')
        downloadBlob(response.data as Blob, fileName)
    }

    const generateStayQr = async (): Promise<void> => {
        if (!selectedEventId) return
        const response = await api.get(`/events/${selectedEventId}/stay/qr`)
        setStayQrToken(String(response.data?.data?.qr_token || ''))
    }

    const loadMessQr = async (): Promise<void> => {
        if (!selectedEventId) return
        const response = await api.get(`/events/${selectedEventId}/mess/qr`)
        const shared = String(response.data?.data?.sharedQrToken || '')
        if (shared) {
            setMessQrToken(shared)
            return
        }

        const firstRule = (response.data?.data?.rules || [])[0] as { qrToken?: string } | undefined
        setMessQrToken(String(firstRule?.qrToken || ''))
    }

    const downloadMessQr = (): void => {
        if (!messQrToken) {
            toast.error('Load Mess QR first')
            return
        }

        const canvas = document.getElementById('event-mess-qr') as HTMLCanvasElement | null
        if (!canvas) {
            toast.error('Unable to render mess QR image')
            return
        }

        const url = canvas.toDataURL('image/png')
        const link = document.createElement('a')
        const safeEventName = (selectedEvent?.name || 'event').replace(/\s+/g, '_')
        link.download = `${safeEventName}_mess_qr.png`
        link.href = url
        link.click()
    }

    const handleDeleteEvent = (event: EventItem): void => {
        if (deleteEventMutation.isPending) return

        const confirmed = window.confirm(`Delete event \"${event.name}\"? This will deactivate the event.`)
        if (!confirmed) return

        setDeletingEventId(event.id)
        deleteEventMutation.mutate(event.id)
    }

    if (isLoading) return <LoadingSpinner />

    const selectedEventDurationDays = selectedEvent
        ? computeDurationDays(selectedEvent.eventDate, selectedEvent.endTime)
        : 1

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold flex items-center gap-2"><Calendar size={28} /> Campus Events</h2>
                <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-accent px-4 py-2 rounded-lg text-sm font-medium hover:bg-accent/90">
                    <Plus size={16} /> New Event
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {events?.map((event) => (
                    <div
                        key={event.id}
                        className={`bg-bg-card rounded-xl border p-5 transition-colors ${selectedEventId === event.id ? 'border-accent' : 'border-border hover:border-accent/30'}`}
                    >
                        <div className="flex items-start justify-between">
                            <div>
                                <h3 className="font-semibold text-lg">{event.name}</h3>
                                <p className="text-sm text-text-secondary mt-1">{event.description || 'No description'}</p>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-xs ${event.isActive ? 'bg-success/20 text-success' : 'bg-neutral/20 text-neutral'}`}>
                                {event.isActive ? 'Active' : 'Inactive'}
                            </span>
                        </div>
                        <div className="flex gap-4 mt-4 text-xs text-text-secondary">
                            <span>Stay: <span className="text-accent font-medium">{event.isStayHostel ? 'Yes' : 'No'}</span></span>
                            <span>Date: {new Date(event.eventDate).toLocaleDateString()}</span>
                        </div>
                        <div className="mt-3 text-xs text-text-secondary flex gap-3">
                            <span>Participants: {event.participantsCount ?? 0}</span>
                            <span>Stay Logs: {event.stayScansCount ?? 0}</span>
                            <span>Meals: {event.mealScansCount ?? 0}</span>
                        </div>
                        <div className="flex gap-2 mt-4">
                            <button onClick={() => toggleMutation.mutate(event.id)} className="px-3 py-1 bg-bg-hover rounded text-xs hover:bg-border transition-colors">
                                {event.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                            <button onClick={() => setSelectedEventId(event.id)} className="px-3 py-1 bg-primary/20 text-primary rounded text-xs hover:bg-primary/30 transition-colors">
                                Open Console
                            </button>
                            <button
                                onClick={() => handleDeleteEvent(event)}
                                disabled={deleteEventMutation.isPending && deletingEventId === event.id}
                                className="px-3 py-1 bg-red-500/15 text-red-400 rounded text-xs hover:bg-red-500/25 transition-colors disabled:opacity-50 flex items-center gap-1"
                            >
                                <Trash2 size={12} />
                                {deleteEventMutation.isPending && deletingEventId === event.id ? 'Deleting...' : 'Delete'}
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {selectedEvent && (
                <div className="bg-bg-card rounded-xl border border-border p-5 space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h3 className="text-xl font-bold">{selectedEvent.name} Console</h3>
                            <p className="text-xs text-text-secondary">Manage QR scans, participants and daily exports.</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="date"
                                value={reportDate}
                                onChange={(e) => setReportDate(e.target.value)}
                                className="bg-bg-dark border border-border rounded px-3 py-2 text-sm"
                            />
                            <button onClick={() => sendDailyReportMutation.mutate()} className="px-3 py-2 text-xs rounded bg-warning/20 text-warning flex items-center gap-2">
                                <Mail size={14} /> Send Daily Mail
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 text-sm">
                        <div className="bg-bg-dark rounded-lg border border-border p-3">
                            <p className="text-text-secondary">Inside</p>
                            <p className="text-lg font-bold">{staySummaryQuery.data?.inside ?? 0}</p>
                        </div>
                        <div className="bg-bg-dark rounded-lg border border-border p-3">
                            <p className="text-text-secondary">Outside</p>
                            <p className="text-lg font-bold">{staySummaryQuery.data?.outside ?? 0}</p>
                        </div>
                        <div className="bg-bg-dark rounded-lg border border-border p-3">
                            <p className="text-text-secondary">Entries / Exits</p>
                            <p className="text-lg font-bold">{staySummaryQuery.data?.entries ?? 0} / {staySummaryQuery.data?.exits ?? 0}</p>
                        </div>
                        <div className="bg-bg-dark rounded-lg border border-border p-3">
                            <p className="text-text-secondary">Meals Today</p>
                            <p className="text-lg font-bold">{staySummaryQuery.data?.mealsToday ?? 0}</p>
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <button onClick={generateStayQr} className="px-3 py-2 text-xs rounded bg-success/20 text-success flex items-center gap-2">
                            <QrCode size={14} /> Generate Stay QR
                        </button>
                        <button onClick={loadMessQr} className="px-3 py-2 text-xs rounded bg-primary/20 text-primary flex items-center gap-2">
                            <QrCode size={14} /> Load Mess QR
                        </button>
                        <button onClick={() => handleDownloadCsv('stay')} className="px-3 py-2 text-xs rounded bg-bg-hover flex items-center gap-2">
                            <Download size={14} /> Stay CSV
                        </button>
                        <button onClick={() => handleDownloadCsv('meal')} className="px-3 py-2 text-xs rounded bg-bg-hover flex items-center gap-2">
                            <Download size={14} /> Meal CSV
                        </button>
                        <button onClick={() => handleDownloadCsv('combined')} className="px-3 py-2 text-xs rounded bg-bg-hover flex items-center gap-2">
                            <Download size={14} /> Combined CSV
                        </button>
                    </div>

                    {stayQrToken && (
                        <div className="bg-bg-dark border border-border rounded-lg p-3">
                            <p className="text-xs text-text-secondary mb-1">Dynamic Stay QR Token</p>
                            <p className="text-xs break-all font-mono">{stayQrToken}</p>
                        </div>
                    )}

                    {messQrToken && (
                        <div className="bg-bg-dark border border-border rounded-lg p-3 space-y-2">
                            <p className="text-xs text-text-secondary">Static Mess QR Token (Single QR for all meals)</p>
                            <div className="p-3 bg-white rounded-lg w-fit">
                                <QRCodeCanvas
                                    id="event-mess-qr"
                                    value={messQrToken}
                                    size={200}
                                    level="M"
                                    marginSize={2}
                                />
                            </div>
                            <button
                                onClick={downloadMessQr}
                                className="px-3 py-2 text-xs rounded bg-success/20 text-success flex items-center gap-2"
                            >
                                <Download size={14} /> Save/Download Mess QR
                            </button>
                            <p className="text-xs break-all font-mono text-text-secondary">{messQrToken}</p>
                        </div>
                    )}

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        <div className="bg-bg-dark rounded-lg border border-border p-3">
                            <h4 className="font-semibold mb-2">Latest Stay Logs</h4>
                            <div className="space-y-2 max-h-72 overflow-y-auto">
                                {(stayLogsQuery.data || []).map((log: any) => {
                                    const profile = log.participant || log.student
                                    return (
                                        <div key={log.id} className="text-xs border border-border rounded p-2">
                                            <p className="font-semibold">{profile?.fullName || 'Unknown'} • {log.direction}</p>
                                            <p className="text-text-secondary">{new Date(log.scannedAt).toLocaleString()} • {log.gateLabel || 'Gate'}</p>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                        <div className="bg-bg-dark rounded-lg border border-border p-3">
                            <h4 className="font-semibold mb-2">Latest Meal Logs</h4>
                            <div className="space-y-2 max-h-72 overflow-y-auto">
                                {(messLogsQuery.data || []).map((log: any) => {
                                    const profile = log.participant || log.student
                                    return (
                                        <div key={log.id} className="text-xs border border-border rounded p-2">
                                            <p className="font-semibold">{profile?.fullName || 'Unknown'} • Meal {log.mealNumber}</p>
                                            <p className="text-text-secondary">{log.mealLabel} • {new Date(log.scannedAt).toLocaleString()}</p>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="bg-bg-dark rounded-lg border border-border p-3 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <h4 className="font-semibold">Meal Controls</h4>
                            <span className="text-xs text-text-secondary">Global limit applies unless per-ID override is set</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <input
                                type="number"
                                min={1}
                                value={globalMealLimitInput}
                                onChange={(e) => setGlobalMealLimitInput(e.target.value)}
                                placeholder="Leave blank for unlimited"
                                className="w-52 bg-bg-card border border-border rounded px-3 py-2 text-xs"
                            />
                            <button
                                onClick={saveGlobalMealLimit}
                                disabled={saveGlobalMealLimitMutation.isPending}
                                className="px-3 py-2 text-xs rounded bg-primary/20 text-primary disabled:opacity-50"
                            >
                                {saveGlobalMealLimitMutation.isPending ? 'Saving...' : 'Save Global Limit'}
                            </button>
                        </div>

                        <div className="border-t border-border pt-3 space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-xs text-text-secondary">
                                    Day-wise coupon split (midnight rollover): previous day unused coupons auto-expire.
                                </p>
                                <span className="text-[11px] text-text-secondary">
                                    Duration-based days: {selectedEventDurationDays}
                                </span>
                                <button
                                    onClick={autoSplitGlobalIntoDays}
                                    className="px-2 py-1 text-[11px] rounded bg-bg-hover"
                                >
                                    Auto Split From Global
                                </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
                                {dayWiseMealDrafts.map((row) => (
                                    <label key={row.dayNumber} className="flex flex-col gap-1 text-[11px]">
                                        <span className="text-text-secondary">Day {row.dayNumber} Coupons</span>
                                        <input
                                            type="number"
                                            min={0}
                                            value={row.coupons}
                                            onChange={(e) => updateDayWiseDraft(row.dayNumber, e.target.value)}
                                            placeholder="0"
                                            className="bg-bg-card border border-border rounded px-2 py-1.5 text-xs"
                                        />
                                    </label>
                                ))}
                            </div>

                            <div>
                                <button
                                    onClick={saveDayWiseMealLimits}
                                    disabled={saveGlobalMealLimitMutation.isPending}
                                    className="px-3 py-2 text-xs rounded bg-warning/20 text-warning disabled:opacity-50"
                                >
                                    {saveGlobalMealLimitMutation.isPending ? 'Saving...' : 'Save Day-wise Split'}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="bg-bg-dark rounded-lg border border-border p-3">
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold">Participants Meal Tracker (All Participants)</h4>
                            <span className="text-xs text-text-secondary">Showing: {filteredParticipants.length} / {participantsQuery.data?.total ?? 0}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                            <input
                                value={participantSearchInput}
                                onChange={(e) => setParticipantSearchInput(e.target.value)}
                                placeholder="Search by name, email, login ID, enrollment"
                                className="w-full md:w-80 bg-bg-card border border-border rounded px-2 py-1.5 text-xs"
                            />
                            <button
                                onClick={() => setParticipantSearchTerm(participantSearchInput)}
                                className="px-3 py-1.5 rounded bg-primary/20 text-primary text-xs"
                            >
                                Search Participant
                            </button>
                            <button
                                onClick={() => {
                                    setParticipantSearchInput('')
                                    setParticipantSearchTerm('')
                                }}
                                className="px-3 py-1.5 rounded bg-bg-hover text-xs"
                            >
                                Clear
                            </button>
                        </div>
                        <div className="space-y-2 max-h-[34rem] overflow-y-auto">
                            {filteredParticipants.map((participant: any) => {
                                const stats = participant.mealStats || {}
                                const draft = getDraftForParticipant(participant)
                                const remainingText = stats.remaining == null ? 'Unlimited' : String(stats.remaining)
                                const effectiveMaxText = stats.effectiveMaxMeals == null ? 'Unlimited' : String(stats.effectiveMaxMeals)

                                return (
                                    <div key={participant.id} className="text-xs border border-border rounded p-3 space-y-2">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div>
                                                <p className="font-semibold">{participant.fullName}</p>
                                                <p className="text-text-secondary">{participant.email} • Login: {participant.loginId}</p>
                                                <p className="text-warning">PW: {participant.passwordHint || participant.phone}</p>
                                            </div>
                                            <div className="text-right">
                                                <p>Consumed: <span className="font-semibold">{stats.consumed ?? 0}</span></p>
                                                <p>Remaining: <span className="font-semibold">{remainingText}</span></p>
                                                <p>Effective Max: <span className="font-semibold">{effectiveMaxText}</span></p>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-end gap-2">
                                            <label className="flex flex-col gap-1">
                                                <span className="text-text-secondary">Max Meals (ID override)</span>
                                                <input
                                                    type="number"
                                                    min={1}
                                                    value={draft.maxMealsAllowed}
                                                    onChange={(e) => updateDraftField(participant, 'maxMealsAllowed', e.target.value)}
                                                    placeholder="Blank = use global"
                                                    className="w-44 bg-bg-card border border-border rounded px-2 py-1"
                                                />
                                            </label>
                                            <label className="flex flex-col gap-1">
                                                <span className="text-text-secondary">Meals Consumed</span>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    value={draft.mealsConsumed}
                                                    onChange={(e) => updateDraftField(participant, 'mealsConsumed', e.target.value)}
                                                    className="w-36 bg-bg-card border border-border rounded px-2 py-1"
                                                />
                                            </label>
                                            <button
                                                onClick={() => saveParticipantMealDraft(participant)}
                                                disabled={saveParticipantMealsMutation.isPending}
                                                className="px-3 py-1 rounded bg-warning/20 text-warning disabled:opacity-50"
                                            >
                                                {saveParticipantMealsMutation.isPending ? 'Saving...' : 'Save'}
                                            </button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        <div className="bg-bg-dark rounded-lg border border-border p-3 space-y-2">
                            <h4 className="font-semibold">Daily Report Recipients (8:00 PM auto mail)</h4>
                            <textarea
                                value={recipientInput || (selectedEvent.reportRecipients || []).join(', ')}
                                onChange={(e) => setRecipientInput(e.target.value)}
                                rows={6}
                                className="w-full bg-bg-card border border-border rounded px-3 py-2 text-sm"
                                placeholder="warden@college.edu, dean@college.edu"
                            />
                            <button
                                onClick={() => saveRecipientsMutation.mutate(parseRecipients(recipientInput || (selectedEvent.reportRecipients || []).join(', ')))}
                                className="px-3 py-1 text-xs rounded bg-primary/20 text-primary"
                            >
                                Save Recipients
                            </button>
                        </div>
                    </div>

                    <div className="bg-bg-dark rounded-lg border border-border p-3 space-y-2">
                        <div className="flex items-center gap-2">
                            <Upload size={14} />
                            <h4 className="font-semibold text-sm">Import Additional Participants (CSV/Excel/PDF)</h4>
                        </div>
                        <input
                            type="file"
                            accept=".csv,.xlsx,.xls,.pdf"
                            onChange={async (e) => {
                                const file = e.target.files?.[0]
                                if (!file) return
                                await onImportFile(file)
                            }}
                            className="text-xs"
                        />
                        <p className="text-xs text-text-secondary">Ready: {participantPreview.valid} valid / {participantPreview.invalid} invalid</p>
                        <button
                            onClick={() => {
                                if (!selectedEventId || participantRows.length === 0) {
                                    toast.error('No participants loaded')
                                    return
                                }
                                importMutation.mutate({ eventId: selectedEventId, participants: participantRows })
                            }}
                            className="px-3 py-1 text-xs rounded bg-warning/20 text-warning"
                        >
                            Import To Selected Event
                        </button>

                        <div className="pt-2 border-t border-border space-y-2">
                            <div className="flex items-center gap-2">
                                <UserPlus size={14} />
                                <h5 className="text-xs font-semibold">Manual Participant Entry</h5>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
                                <input
                                    value={manualParticipant.fullName}
                                    onChange={(e) => setManualParticipant((prev) => ({ ...prev, fullName: e.target.value }))}
                                    placeholder="Full Name"
                                    className="bg-bg-card border border-border rounded px-2 py-1.5 text-xs"
                                />
                                <input
                                    value={manualParticipant.email}
                                    onChange={(e) => setManualParticipant((prev) => ({ ...prev, email: e.target.value }))}
                                    placeholder="Email"
                                    className="bg-bg-card border border-border rounded px-2 py-1.5 text-xs"
                                />
                                <input
                                    value={manualParticipant.phone}
                                    onChange={(e) => setManualParticipant((prev) => ({ ...prev, phone: e.target.value }))}
                                    placeholder="Phone"
                                    className="bg-bg-card border border-border rounded px-2 py-1.5 text-xs"
                                />
                                <input
                                    value={manualParticipant.enrollmentNo}
                                    onChange={(e) => setManualParticipant((prev) => ({ ...prev, enrollmentNo: e.target.value }))}
                                    placeholder="Enrollment No (optional)"
                                    className="bg-bg-card border border-border rounded px-2 py-1.5 text-xs"
                                />
                                <input
                                    value={manualParticipant.department}
                                    onChange={(e) => setManualParticipant((prev) => ({ ...prev, department: e.target.value }))}
                                    placeholder="Department (optional)"
                                    className="bg-bg-card border border-border rounded px-2 py-1.5 text-xs"
                                />
                                <input
                                    type="number"
                                    min={1}
                                    max={4}
                                    value={manualParticipant.year}
                                    onChange={(e) => setManualParticipant((prev) => ({ ...prev, year: e.target.value }))}
                                    placeholder="Year (1-4)"
                                    className="bg-bg-card border border-border rounded px-2 py-1.5 text-xs"
                                />
                                <select
                                    value={manualParticipant.studentType}
                                    onChange={(e) => setManualParticipant((prev) => ({ ...prev, studentType: e.target.value }))}
                                    className="bg-bg-card border border-border rounded px-2 py-1.5 text-xs"
                                >
                                    <option value="DAY_SCHOLAR">DAY_SCHOLAR</option>
                                    <option value="HOSTELLER_BOYS">HOSTELLER_BOYS</option>
                                    <option value="HOSTELLER_GIRLS">HOSTELLER_GIRLS</option>
                                </select>
                                <button
                                    onClick={addManualParticipantToQueue}
                                    className="px-3 py-1.5 text-xs rounded bg-primary/20 text-primary"
                                >
                                    Add Manual Entry
                                </button>
                            </div>
                        </div>

                        <div className="pt-2 border-t border-border space-y-2">
                            <h5 className="text-xs font-semibold">Loaded Participant Preview ({participantRows.length})</h5>
                            <div className="max-h-72 overflow-y-auto space-y-1">
                                {participantRows.length === 0 ? (
                                    <p className="text-xs text-text-secondary">No rows loaded yet.</p>
                                ) : (
                                    participantRows.map((row, index) => (
                                        <div key={`${row.email}-${index}`} className="text-[11px] border border-border rounded px-2 py-1.5">
                                            <p className="font-semibold">{row.fullName}</p>
                                            <p className="text-text-secondary">{row.email} • {row.phone}</p>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Campus Event" size="lg">
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input
                            value={form.name}
                            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                            placeholder="Event Name"
                            className="bg-bg-dark border border-border rounded px-3 py-2 text-sm"
                        />
                        <input
                            value={form.description}
                            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                            placeholder="Description"
                            className="bg-bg-dark border border-border rounded px-3 py-2 text-sm"
                        />
                        <input
                            type="date"
                            value={form.eventDate}
                            onChange={(e) => {
                                const nextDate = e.target.value
                                setForm((prev) => ({
                                    ...prev,
                                    eventDate: nextDate,
                                    endDate: prev.endDate < nextDate ? nextDate : prev.endDate,
                                }))
                            }}
                            className="bg-bg-dark border border-border rounded px-3 py-2 text-sm"
                        />
                        <input
                            type="date"
                            value={form.endDate}
                            min={form.eventDate}
                            onChange={(e) => setForm((prev) => ({ ...prev, endDate: e.target.value }))}
                            className="bg-bg-dark border border-border rounded px-3 py-2 text-sm"
                        />
                        <div className="grid grid-cols-2 gap-2">
                            <input
                                type="time"
                                value={form.startTime}
                                onChange={(e) => setForm((prev) => ({ ...prev, startTime: e.target.value }))}
                                className="bg-bg-dark border border-border rounded px-3 py-2 text-sm"
                            />
                            <input
                                type="time"
                                value={form.endTime}
                                onChange={(e) => setForm((prev) => ({ ...prev, endTime: e.target.value }))}
                                className="bg-bg-dark border border-border rounded px-3 py-2 text-sm"
                            />
                        </div>
                        <input
                            value={form.hostelGateLabel}
                            onChange={(e) => setForm((prev) => ({ ...prev, hostelGateLabel: e.target.value }))}
                            placeholder="Hostel Gate Label"
                            className="bg-bg-dark border border-border rounded px-3 py-2 text-sm"
                        />
                        <select
                            value={form.appliesTo}
                            onChange={(e) => setForm((prev) => ({ ...prev, appliesTo: e.target.value }))}
                            className="bg-bg-dark border border-border rounded px-3 py-2 text-sm"
                        >
                            <option value="ALL">Available for All Students</option>
                            <option value="BTECH CSE">BTECH CSE</option>
                            <option value="BTECH IT">BTECH IT</option>
                            <option value="BTECH MAC">BTECH MAC</option>
                            <option value="MCA">MCA</option>
                            <option value="MBA">MBA</option>
                        </select>
                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={form.isStayHostel}
                                onChange={(e) => setForm((prev) => ({ ...prev, isStayHostel: e.target.checked }))}
                            />
                            Stay-Hostel Event
                        </label>
                    </div>

                    <div className="space-y-2">
                        <p className="text-sm font-semibold">Step 1: Import CSV / Excel (Email=Login ID, Phone=Password)</p>
                        <input
                            type="file"
                            accept=".csv,.xlsx,.xls,.pdf"
                            onChange={async (e) => {
                                const file = e.target.files?.[0]
                                if (!file) return
                                await onImportFile(file)
                            }}
                            className="text-xs"
                        />
                        <p className="text-xs text-text-secondary">Loaded {participantPreview.total} records • Valid {participantPreview.valid} • Invalid {participantPreview.invalid}</p>
                    </div>

                    <div className="space-y-2">
                        <p className="text-sm font-semibold">Daily Report Emails (8 PM)</p>
                        <textarea
                            value={recipientInput}
                            onChange={(e) => setRecipientInput(e.target.value)}
                            rows={3}
                            className="w-full bg-bg-dark border border-border rounded px-3 py-2 text-sm"
                            placeholder="warden@college.edu, dean@college.edu"
                        />
                    </div>

                    <div className="flex justify-end gap-2">
                        <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded bg-bg-hover text-sm">Cancel</button>
                        <button
                            onClick={handleCreateEvent}
                            disabled={createMutation.isPending}
                            className="px-4 py-2 rounded bg-accent text-sm text-white disabled:opacity-50"
                        >
                            {createMutation.isPending ? 'Creating...' : 'Create Event'}
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    )
}
