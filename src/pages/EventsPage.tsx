import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import api from '../api/axios'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import Modal from '../components/ui/Modal'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'
import { Calendar, Download, Mail, Plus, QrCode, Upload } from 'lucide-react'

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

interface MessRuleInput {
    mealNumber: number
    mealLabel: string
    startTime: string
    endTime: string
    isActive: boolean
}

function toIso(date: string, time?: string): string {
    if (!time) return new Date(date).toISOString()
    return new Date(`${date}T${time}:00`).toISOString()
}

function normalizeParticipantRows(rawRows: Record<string, unknown>[]): ParticipantImportRow[] {
    return rawRows
        .map((raw) => {
            const fullName = String(raw.fullName || raw.name || raw.studentName || raw.student_name || '').trim()
            const email = String(raw.email || raw.loginId || raw.login_id || '').trim().toLowerCase()
            const phone = String(raw.phone || raw.mobile || raw.password || '').trim()
            const enrollmentNo = String(raw.enrollmentNo || raw.enrollment || raw.enrollment_no || '').trim()
            const department = String(raw.department || '').trim()
            const yearRaw = Number(raw.year || 0)
            const studentType = String(raw.studentType || raw.student_type || '').trim().toUpperCase()

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

export default function EventsPage() {
    const [showCreate, setShowCreate] = useState(false)
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
    const [reportDate, setReportDate] = useState<string>(new Date().toISOString().slice(0, 10))
    const [participantRows, setParticipantRows] = useState<ParticipantImportRow[]>([])
    const [recipientInput, setRecipientInput] = useState('')
    const [stayQrToken, setStayQrToken] = useState<string>('')
    const [messQrToken, setMessQrToken] = useState<string>('')
    const [form, setForm] = useState({
        name: '',
        description: '',
        eventDate: new Date().toISOString().slice(0, 10),
        startTime: '09:00',
        endTime: '18:00',
        isStayHostel: true,
        hostelGateLabel: 'Event Hostel Gate',
        timezone: 'Asia/Kolkata',
    })
    const [messRules, setMessRules] = useState<MessRuleInput[]>([
        { mealNumber: 1, mealLabel: 'Breakfast', startTime: '07:00', endTime: '09:30', isActive: true },
        { mealNumber: 2, mealLabel: 'Lunch', startTime: '12:00', endTime: '15:00', isActive: true },
        { mealNumber: 3, mealLabel: 'Dinner', startTime: '19:00', endTime: '22:00', isActive: true },
    ])

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
        queryKey: ['event-participants', selectedEventId],
        enabled: Boolean(selectedEventId),
        queryFn: () => api.get(`/events/${selectedEventId}/participants`, { params: { limit: 20 } }).then((r) => r.data.data),
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

    const messRulesQuery = useQuery({
        queryKey: ['event-mess-rules', selectedEventId],
        enabled: Boolean(selectedEventId),
        queryFn: () => api.get(`/events/${selectedEventId}/mess/rules`).then((r) => r.data.data.rules),
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
            qc.invalidateQueries({ queryKey: ['event-participants', selectedEventId] })
            qc.invalidateQueries({ queryKey: ['events'] })
            toast.success('Participants imported')
            setParticipantRows([])
        },
    })

    const saveMessRulesMutation = useMutation({
        mutationFn: (rules: MessRuleInput[]) => api.put(`/events/${selectedEventId}/mess/rules`, { rules }),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['event-mess-rules', selectedEventId] })
            toast.success('Mess rules updated')
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

    const participantPreview = useMemo(() => {
        const valid = participantRows.filter((row) => row.fullName && row.email && row.phone).length
        return {
            total: participantRows.length,
            valid,
            invalid: participantRows.length - valid,
        }
    }, [participantRows])

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

    const handleCreateEvent = async (): Promise<void> => {
        if (!form.name.trim()) {
            toast.error('Event name is required')
            return
        }
        const payload = {
            name: form.name.trim(),
            description: form.description.trim() || null,
            eventDate: toIso(form.eventDate),
            startTime: toIso(form.eventDate, form.startTime),
            endTime: toIso(form.eventDate, form.endTime),
            isStayHostel: form.isStayHostel,
            hostelGateLabel: form.hostelGateLabel.trim() || null,
            timezone: form.timezone,
            participants: participantRows,
            messRules,
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

    if (isLoading) return <LoadingSpinner />

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
                        </div>
                    </div>
                ))}
            </div>

            {selectedEvent && (
                <div className="bg-bg-card rounded-xl border border-border p-5 space-y-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h3 className="text-xl font-bold">{selectedEvent.name} Console</h3>
                            <p className="text-xs text-text-secondary">Manage QR scans, mess rules, participants and daily exports.</p>
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

                    <div className="bg-bg-dark rounded-lg border border-border p-3">
                        <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold">Participants (Top 20)</h4>
                            <span className="text-xs text-text-secondary">Total: {participantsQuery.data?.total ?? 0}</span>
                        </div>
                        <div className="space-y-2 max-h-72 overflow-y-auto">
                            {(participantsQuery.data?.participants || []).map((participant: any) => (
                                <div key={participant.id} className="text-xs border border-border rounded p-2 flex items-center justify-between gap-2">
                                    <div>
                                        <p className="font-semibold">{participant.fullName}</p>
                                        <p className="text-text-secondary">{participant.email} • Login: {participant.loginId}</p>
                                    </div>
                                    <span className="text-warning">PW: {participant.passwordHint || participant.phone}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        <div className="bg-bg-dark rounded-lg border border-border p-3 space-y-2">
                            <h4 className="font-semibold">Update Mess Rules</h4>
                            {messRules.map((rule, index) => (
                                <div key={`rule-${rule.mealNumber}-${index}`} className="grid grid-cols-4 gap-2 text-xs">
                                    <input
                                        type="number"
                                        value={rule.mealNumber}
                                        onChange={(e) => {
                                            const next = [...messRules]
                                            next[index] = { ...next[index], mealNumber: Number(e.target.value) }
                                            setMessRules(next)
                                        }}
                                        className="bg-bg-card border border-border rounded px-2 py-1"
                                    />
                                    <input
                                        value={rule.mealLabel}
                                        onChange={(e) => {
                                            const next = [...messRules]
                                            next[index] = { ...next[index], mealLabel: e.target.value }
                                            setMessRules(next)
                                        }}
                                        className="bg-bg-card border border-border rounded px-2 py-1"
                                    />
                                    <input
                                        type="time"
                                        value={rule.startTime}
                                        onChange={(e) => {
                                            const next = [...messRules]
                                            next[index] = { ...next[index], startTime: e.target.value }
                                            setMessRules(next)
                                        }}
                                        className="bg-bg-card border border-border rounded px-2 py-1"
                                    />
                                    <input
                                        type="time"
                                        value={rule.endTime}
                                        onChange={(e) => {
                                            const next = [...messRules]
                                            next[index] = { ...next[index], endTime: e.target.value }
                                            setMessRules(next)
                                        }}
                                        className="bg-bg-card border border-border rounded px-2 py-1"
                                    />
                                </div>
                            ))}
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setMessRules((prev) => [...prev, { mealNumber: prev.length + 1, mealLabel: `Meal ${prev.length + 1}`, startTime: '09:00', endTime: '10:00', isActive: true }])}
                                    className="px-3 py-1 text-xs rounded bg-bg-hover"
                                >
                                    Add Rule
                                </button>
                                <button onClick={() => saveMessRulesMutation.mutate(messRules)} className="px-3 py-1 text-xs rounded bg-success/20 text-success">
                                    Save Rules
                                </button>
                                <button onClick={() => setMessRules(messRulesQuery.data || messRules)} className="px-3 py-1 text-xs rounded bg-bg-hover">
                                    Reset
                                </button>
                            </div>
                        </div>

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
                            <h4 className="font-semibold text-sm">Import Additional Participants (CSV/Excel)</h4>
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
                            onChange={(e) => setForm((prev) => ({ ...prev, eventDate: e.target.value }))}
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
                        <p className="text-sm font-semibold">Mess Rules</p>
                        {messRules.map((rule, index) => (
                            <div key={`create-rule-${index}`} className="grid grid-cols-4 gap-2 text-xs">
                                <input
                                    type="number"
                                    value={rule.mealNumber}
                                    onChange={(e) => {
                                        const next = [...messRules]
                                        next[index] = { ...next[index], mealNumber: Number(e.target.value) }
                                        setMessRules(next)
                                    }}
                                    className="bg-bg-dark border border-border rounded px-2 py-1"
                                />
                                <input
                                    value={rule.mealLabel}
                                    onChange={(e) => {
                                        const next = [...messRules]
                                        next[index] = { ...next[index], mealLabel: e.target.value }
                                        setMessRules(next)
                                    }}
                                    className="bg-bg-dark border border-border rounded px-2 py-1"
                                />
                                <input
                                    type="time"
                                    value={rule.startTime}
                                    onChange={(e) => {
                                        const next = [...messRules]
                                        next[index] = { ...next[index], startTime: e.target.value }
                                        setMessRules(next)
                                    }}
                                    className="bg-bg-dark border border-border rounded px-2 py-1"
                                />
                                <input
                                    type="time"
                                    value={rule.endTime}
                                    onChange={(e) => {
                                        const next = [...messRules]
                                        next[index] = { ...next[index], endTime: e.target.value }
                                        setMessRules(next)
                                    }}
                                    className="bg-bg-dark border border-border rounded px-2 py-1"
                                />
                            </div>
                        ))}
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
