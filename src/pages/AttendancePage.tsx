import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../api/axios'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { ClipboardCheck, RefreshCw, CheckCircle, XCircle, UserCheck, Maximize2, X, Download, Clock, History } from 'lucide-react'
import toast from 'react-hot-toast'
import { QRCodeSVG } from 'qrcode.react'

interface Subject {
    id: string
    code: string
    name: string
    department?: string
}

interface AttendanceSession {
    id: string
    status: string
    className?: string
    classListId?: string
    qrMode?: string
    qrValiditySeconds?: number
    windowMinutes?: number
    qrToken?: string
    qrExpiresAt?: string
    startedAt?: string
    closedAt?: string
    subject?: Subject
    faculty?: { id: string; name: string; email: string }
    _count?: { records: number }
    marked?: Student[]
    unmarked?: Student[]
    totalStudents?: number
    presentCount?: number
    absentCount?: number
}

interface ClassList {
    id: string
    name: string
    department: string
    year: number
    section?: string
    studentCount: number
}

interface Student {
    id: string
    fullName: string
    enrollmentNo: string
    email: string
    photoUrl?: string
    department: string
    year: number
    markedAt?: string
    method?: string
}

function normalizeEnrollmentValue(value: string): string {
    return value.replace(/^"|"$/g, '').trim().toUpperCase()
}

function parseEnrollmentNumbers(raw: string): string[] {
    const lines = raw
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)

    if (!lines.length) return []

    const firstRow = lines[0].split(',').map((cell) => cell.trim().toLowerCase())
    const headerAliases = ['enrollmentno', 'enrollment_no', 'enrollment', 'rollno', 'roll_no']
    const enrollmentColIndex = firstRow.findIndex((cell) => {
        const normalized = cell.replace(/[^a-z0-9]/g, '')
        return headerAliases.includes(normalized)
    })

    const startIndex = enrollmentColIndex >= 0 ? 1 : 0
    const resolvedIndex = enrollmentColIndex >= 0 ? enrollmentColIndex : 0
    const uniqueEnrollmentNos = new Set<string>()

    for (let i = startIndex; i < lines.length; i += 1) {
        const row = lines[i]
        const columns = row.split(',')
        const candidate = normalizeEnrollmentValue(columns[resolvedIndex] ?? row)
        if (candidate) uniqueEnrollmentNos.add(candidate)
    }

    return Array.from(uniqueEnrollmentNos)
}

export default function AttendancePage() {
    const queryClient = useQueryClient()
    const [subjectId, setSubjectId] = useState('')
    const [className, setClassName] = useState('')
    const [scheduledAt, setScheduledAt] = useState('')
    const [qrMode, setQrMode] = useState<'STATIC' | 'DYNAMIC'>('STATIC')
    const [qrValiditySeconds, setQrValiditySeconds] = useState(60)
    const [windowMinutes, setWindowMinutes] = useState(15)
    const [classListId, setClassListId] = useState('')
    const [activeTab, setActiveTab] = useState<'create' | 'live' | 'history'>('create')
    const [selectedSessionId, setSelectedSessionId] = useState('')
    const [lastScanNotification, setLastScanNotification] = useState<Student | null>(null)
    const [uploadName, setUploadName] = useState('')
    const [uploadDepartment, setUploadDepartment] = useState('CSE')
    const [uploadYear, setUploadYear] = useState(1)
    const [uploadSection, setUploadSection] = useState('')
    const [uploadFile, setUploadFile] = useState<File | null>(null)
    const [projectorSessionId, setProjectorSessionId] = useState('')
    const [projectorQrToken, setProjectorQrToken] = useState('')
    const [projectorQrExpiresAt, setProjectorQrExpiresAt] = useState<string | null>(null)
    const [projectorCountdown, setProjectorCountdown] = useState(0)
    const [isProjectorFullscreen, setIsProjectorFullscreen] = useState(false)
    const [, setTimerTick] = useState(0)
    const prevMarkedCountRef = useRef(0)

    // Tick every second so session countdown timers update live
    useEffect(() => {
        const interval = setInterval(() => setTimerTick((t) => t + 1), 1000)
        return () => clearInterval(interval)
    }, [])
    const projectorContainerRef = useRef<HTMLDivElement | null>(null)
    const projectorRefreshingRef = useRef(false)

    const { data: subjects } = useQuery<Subject[]>({
        queryKey: ['attendance', 'subjects'],
        queryFn: () => api.get('/attendance/subjects').then((r) => r.data.data.subjects),
        staleTime: 1000 * 60 * 5,
    })

    const { data: sessions, isLoading: isLoadingSessions } = useQuery<AttendanceSession[]>({
        queryKey: ['attendance', 'sessions'],
        queryFn: () => api.get('/attendance/sessions', { params: { status: 'OPEN' } }).then((r) => r.data.data.sessions),
        refetchInterval: 30000,
    })

    const { data: historySessions, isLoading: isLoadingHistory } = useQuery<AttendanceSession[]>({
        queryKey: ['attendance', 'sessions', 'history'],
        queryFn: () => api.get('/attendance/sessions', { params: { limit: 50 } }).then((r) => r.data.data.sessions),
        enabled: activeTab === 'history',
    })

    const { data: defaulters, isLoading: isLoadingDefaulters } = useQuery({
        queryKey: ['attendance', 'defaulters'],
        queryFn: () => api.get('/attendance/defaulters', { params: { threshold: 75 } }).then((r) => r.data.data.defaulters),
    })

    const { data: classLists, isLoading: isLoadingClassLists } = useQuery<ClassList[]>({
        queryKey: ['attendance', 'class-lists'],
        queryFn: () => api.get('/attendance/class-lists').then((r) => r.data.data.classLists),
        staleTime: 1000 * 60 * 5,
    })

    const { data: liveSession } = useQuery<AttendanceSession>({
        queryKey: ['attendance', 'sessions', selectedSessionId, 'live'],
        queryFn: () => api.get(`/attendance/sessions/${selectedSessionId}/live`).then((r) => r.data.data.session),
        enabled: !!selectedSessionId && activeTab === 'live',
        refetchInterval: activeTab === 'live' ? 3000 : false,
    })

    const projectorSession = sessions?.find((session) => session.id === projectorSessionId) || null

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsProjectorFullscreen(Boolean(document.fullscreenElement))
        }

        document.addEventListener('fullscreenchange', handleFullscreenChange)
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }, [])

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && projectorSessionId) {
                void closeProjectorView()
            }
        }
        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [projectorSessionId])

    useEffect(() => {
        if (!projectorSessionId) return
        if (!projectorSession) {
            setProjectorSessionId('')
            setProjectorQrToken('')
            setProjectorQrExpiresAt(null)
            return
        }

        if (projectorSession.qrToken) {
            setProjectorQrToken(projectorSession.qrToken)
            setProjectorQrExpiresAt(projectorSession.qrExpiresAt || null)
        }
    }, [projectorSessionId, projectorSession])

    useEffect(() => {
        if (!projectorQrExpiresAt) {
            setProjectorCountdown(0)
            return
        }

        const tick = () => {
            const remainingMs = new Date(projectorQrExpiresAt).getTime() - Date.now()
            setProjectorCountdown(Math.max(0, Math.ceil(remainingMs / 1000)))
        }

        tick()
        const timerId = window.setInterval(tick, 1000)
        return () => window.clearInterval(timerId)
    }, [projectorQrExpiresAt])

    const refreshProjectorQr = useCallback(async () => {
        if (!projectorSessionId || projectorRefreshingRef.current) return

        projectorRefreshingRef.current = true
        try {
            const response = await api.post(`/attendance/sessions/${projectorSessionId}/refresh-qr`)
            const session = response?.data?.data?.session

            if (session?.qrToken) {
                setProjectorQrToken(String(session.qrToken))
                setProjectorQrExpiresAt(session.qrExpiresAt || null)
            }

            queryClient.invalidateQueries({ queryKey: ['attendance', 'sessions'] })
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Unable to refresh projector QR')
        } finally {
            projectorRefreshingRef.current = false
        }
    }, [projectorSessionId, queryClient])

    useEffect(() => {
        if (!projectorSession || projectorSession.qrMode !== 'DYNAMIC') return

        const timerId = window.setInterval(() => {
            if (projectorRefreshingRef.current) return

            if (!projectorQrExpiresAt) {
                void refreshProjectorQr()
                return
            }

            const remainingMs = new Date(projectorQrExpiresAt).getTime() - Date.now()
            if (remainingMs <= 4000) {
                void refreshProjectorQr()
            }
        }, 1000)

        return () => window.clearInterval(timerId)
    }, [projectorSession, projectorQrExpiresAt, refreshProjectorQr])

    const openProjectorView = (session: AttendanceSession) => {
        if (!session.qrToken) {
            toast.error('QR token is not ready yet for this session')
            return
        }

        setProjectorSessionId(session.id)
        setProjectorQrToken(session.qrToken)
        setProjectorQrExpiresAt(session.qrExpiresAt || null)
    }

    const closeProjectorView = async () => {
        if (document.fullscreenElement) {
            await document.exitFullscreen().catch(() => undefined)
        }

        setProjectorSessionId('')
        setProjectorQrToken('')
        setProjectorQrExpiresAt(null)
        setIsProjectorFullscreen(false)
    }

    const toggleProjectorFullscreen = async () => {
        if (!projectorContainerRef.current) return

        if (document.fullscreenElement) {
            await document.exitFullscreen().catch(() => undefined)
            return
        }

        await projectorContainerRef.current.requestFullscreen().catch(() => {
            toast.error('Fullscreen mode is not available in this browser')
        })
    }

    // Show notification when a new student is marked
    React.useEffect(() => {
        if (liveSession?.marked && liveSession.marked.length > prevMarkedCountRef.current) {
            const latest = liveSession.marked[0]
            setLastScanNotification(latest)
            toast.success(`${latest.fullName} marked present!`)
            // Auto-dismiss after 5 seconds
            const timer = setTimeout(() => setLastScanNotification(null), 5000)
            return () => clearTimeout(timer)
        }
        prevMarkedCountRef.current = liveSession?.marked?.length || 0
    }, [liveSession?.marked])

    const createSessionMutation = useMutation({
        mutationFn: (payload: Record<string, unknown>) => api.post('/attendance/sessions/start', payload),
        onSuccess: () => {
            toast.success('Attendance session created')
            queryClient.invalidateQueries({ queryKey: ['attendance', 'sessions'] })
            queryClient.invalidateQueries({ queryKey: ['attendance', 'defaulters'] })
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.error || 'Unable to create session')
        },
    })

    const closeSessionMutation = useMutation({
        mutationFn: (sessionId: string) => api.post(`/attendance/sessions/${sessionId}/close`),
        onSuccess: () => {
            toast.success('Session closed')
            queryClient.invalidateQueries({ queryKey: ['attendance', 'sessions'] })
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.error || 'Unable to close session')
        },
    })

    const refreshQrMutation = useMutation({
        mutationFn: (sessionId: string) => api.post(`/attendance/sessions/${sessionId}/refresh-qr`),
        onSuccess: () => {
            toast.success('QR refreshed')
            queryClient.invalidateQueries({ queryKey: ['attendance', 'sessions'] })
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.error || 'Unable to refresh QR')
        },
    })

    const manualMarkMutation = useMutation({
        mutationFn: ({ sessionId, studentId, action }: { sessionId: string; studentId: string; action: 'mark' | 'unmark' }) =>
            api.post(`/attendance/sessions/${sessionId}/manual-mark`, { studentId, action }),
        onSuccess: () => {
            toast.success('Attendance updated')
            queryClient.invalidateQueries({ queryKey: ['attendance', 'sessions', selectedSessionId, 'live'] })
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.error || 'Failed to update attendance')
        },
    })

    const createClassListFromUploadMutation = useMutation({
        mutationFn: async () => {
            if (!uploadFile) {
                throw new Error('Please select a CSV/text file')
            }
            if (!uploadName.trim()) {
                throw new Error('Please enter class list name')
            }

            const content = await uploadFile.text()
            const enrollmentNos = parseEnrollmentNumbers(content)
            if (!enrollmentNos.length) {
                throw new Error('No enrollment numbers found in selected file')
            }

            const studentResponse = await api.get('/students', {
                params: {
                    dept: uploadDepartment,
                    year: uploadYear,
                    limit: 2000,
                    userType: 'COLLEGE_STUDENT',
                },
            })

            const students: Array<{ id: string; enrollmentNo: string }> = studentResponse?.data?.data?.students || []
            const studentByEnrollment = new Map(
                students.map((student) => [normalizeEnrollmentValue(student.enrollmentNo), student.id]),
            )

            const missing = enrollmentNos.filter((enrollmentNo) => !studentByEnrollment.has(enrollmentNo))
            if (missing.length > 0) {
                throw new Error(`Missing ${missing.length} students in ${uploadDepartment} year ${uploadYear}: ${missing.slice(0, 5).join(', ')}`)
            }

            const studentIds = enrollmentNos
                .map((enrollmentNo) => studentByEnrollment.get(enrollmentNo))
                .filter(Boolean)

            return api.post('/attendance/class-lists', {
                name: uploadName.trim(),
                department: uploadDepartment,
                year: uploadYear,
                section: uploadSection.trim() || undefined,
                studentIds,
            })
        },
        onSuccess: () => {
            toast.success('Class list created and ready for dropdown selection')
            queryClient.invalidateQueries({ queryKey: ['attendance', 'class-lists'] })
            setUploadName('')
            setUploadSection('')
            setUploadFile(null)
        },
        onError: (err: any) => {
            toast.error(err?.response?.data?.error || err?.message || 'Failed to create class list')
        },
    })

    const handleCreateSession = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        if (!subjectId) {
            toast.error('Please select a subject')
            return
        }

        await createSessionMutation.mutateAsync({
            subjectId,
            className: className || undefined,
            classListId: classListId || undefined,
            scheduledAt: scheduledAt || undefined,
            qrMode,
            qrValiditySeconds: qrMode === 'DYNAMIC' ? qrValiditySeconds : undefined,
            windowMinutes,
        })

        setClassName('')
        setScheduledAt('')
        setClassListId('')
    }

    const renderQrInfo = (session: AttendanceSession) => {
        if (!session.qrToken) return null
        return (
            <div className="mt-4 rounded-2xl border border-border bg-bg-subtle p-4 text-xs font-mono text-text-secondary">
                <p className="mb-2 font-semibold text-text-primary">Session QR token</p>
                <p className="break-all">{session.qrToken}</p>
                {session.qrExpiresAt && <p className="mt-3 text-xs text-text-secondary">Expires at: {new Date(session.qrExpiresAt).toLocaleString()}</p>}
            </div>
        )
    }

    const renderLiveConsole = () => {
        if (!selectedSessionId) {
            return (
                <div className="bg-bg-card rounded-xl border border-border p-8 text-center">
                    <p className="text-text-secondary">Select a session from Active Sessions to view live attendance</p>
                    <button
                        onClick={() => setActiveTab('create')}
                        className="mt-4 px-4 py-2 bg-primary text-white rounded-lg text-sm"
                    >
                        Go to Sessions
                    </button>
                </div>
            )
        }

        if (!liveSession) {
            return <LoadingSpinner />
        }

        return (
            <div className="space-y-6 relative">
                {/* Live Scan Popup Notification */}
                {lastScanNotification && (
                    <div className="fixed top-24 right-6 z-50 max-w-sm animate-in slide-in-from-right fade-in duration-300">
                        <div className="bg-bg-card border border-success/30 rounded-2xl p-4 shadow-2xl shadow-success/10 backdrop-blur-sm">
                            <div className="flex items-center gap-3">
                                {lastScanNotification.photoUrl ? (
                                    <img src={lastScanNotification.photoUrl} alt={lastScanNotification.fullName} className="w-12 h-12 rounded-full object-cover ring-2 ring-success/30" />
                                ) : (
                                    <div className="w-12 h-12 rounded-full bg-success/20 flex items-center justify-center text-success font-bold text-lg">
                                        {lastScanNotification.fullName.charAt(0)}
                                    </div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-text-primary truncate">{lastScanNotification.fullName}</p>
                                    <p className="text-xs text-text-secondary">{lastScanNotification.enrollmentNo}</p>
                                    <p className="text-xs text-success font-medium mt-0.5">✓ Attendance marked</p>
                                </div>
                                <button
                                    onClick={() => setLastScanNotification(null)}
                                    className="text-text-secondary hover:text-text-primary p-1"
                                >
                                    <XCircle size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Header */}
                <div className="bg-bg-card rounded-xl border border-border p-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-semibold">{liveSession.subject?.code} — {liveSession.subject?.name}</h3>
                            <p className="text-sm text-text-secondary">{liveSession.className} · {liveSession.qrMode} QR</p>
                        </div>
                        <div className="text-right">
                            <p className="text-2xl font-bold text-primary">{liveSession.presentCount} / {liveSession.totalStudents}</p>
                            <p className="text-xs text-text-secondary">Present / Total</p>
                        </div>
                    </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
                    {/* Marked Students */}
                    <div className="bg-bg-card rounded-xl border border-border p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <CheckCircle className="text-success" size={20} />
                            <h3 className="text-lg font-semibold">Marked ({liveSession.marked?.length || 0})</h3>
                        </div>
                        <div className="space-y-2 max-h-125 overflow-y-auto">
                            {liveSession.marked?.map((student) => (
                                <div key={student.id} className="flex items-center gap-3 p-3 rounded-lg bg-bg-subtle">
                                    {student.photoUrl ? (
                                        <img src={student.photoUrl} alt={student.fullName} className="w-10 h-10 rounded-full object-cover" />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold">
                                            {student.fullName.charAt(0)}
                                        </div>
                                    )}
                                    <div className="flex-1">
                                        <p className="text-sm font-medium">{student.fullName}</p>
                                        <p className="text-xs text-text-secondary">{student.enrollmentNo} · {student.method}</p>
                                    </div>
                                    <button
                                        onClick={() => manualMarkMutation.mutate({ sessionId: selectedSessionId, studentId: student.id, action: 'unmark' })}
                                        className="p-2 text-danger hover:bg-danger/10 rounded-lg"
                                        disabled={manualMarkMutation.isPending}
                                    >
                                        <XCircle size={18} />
                                    </button>
                                </div>
                            ))}
                            {(!liveSession.marked || liveSession.marked.length === 0) && (
                                <p className="text-center text-text-secondary py-8">No students marked yet</p>
                            )}
                        </div>
                    </div>

                    {/* Unmarked Students */}
                    <div className="bg-bg-card rounded-xl border border-border p-6">
                        <div className="flex items-center gap-2 mb-4">
                            <XCircle className="text-danger" size={20} />
                            <h3 className="text-lg font-semibold">Unmarked ({liveSession.unmarked?.length || 0})</h3>
                        </div>
                        <div className="space-y-2 max-h-125 overflow-y-auto">
                            {liveSession.unmarked?.map((student) => (
                                <div key={student.id} className="flex items-center gap-3 p-3 rounded-lg bg-bg-subtle">
                                    {student.photoUrl ? (
                                        <img src={student.photoUrl} alt={student.fullName} className="w-10 h-10 rounded-full object-cover" />
                                    ) : (
                                        <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-semibold">
                                            {student.fullName.charAt(0)}
                                        </div>
                                    )}
                                    <div className="flex-1">
                                        <p className="text-sm font-medium">{student.fullName}</p>
                                        <p className="text-xs text-text-secondary">{student.enrollmentNo}</p>
                                    </div>
                                    <button
                                        onClick={() => manualMarkMutation.mutate({ sessionId: selectedSessionId, studentId: student.id, action: 'mark' })}
                                        className="p-2 text-success hover:bg-success/10 rounded-lg"
                                        disabled={manualMarkMutation.isPending}
                                    >
                                        <CheckCircle size={18} />
                                    </button>
                                </div>
                            ))}
                            {(!liveSession.unmarked || liveSession.unmarked.length === 0) && (
                                <p className="text-center text-text-secondary py-8">All students marked!</p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    const handleDownloadCsv = async (sessionId: string) => {
        try {
            const response = await api.get(`/attendance/sessions/${sessionId}/export`, { responseType: 'blob' })
            const blob = new Blob([response.data], { type: 'text/csv' })
            const url = window.URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            const disposition = response.headers['content-disposition']
            const filename = disposition?.match(/filename="?(.+?)"?$/)?.[1] || `attendance_${sessionId}.csv`
            link.download = filename
            document.body.appendChild(link)
            link.click()
            link.remove()
            window.URL.revokeObjectURL(url)
            toast.success('CSV downloaded!')
        } catch (err: any) {
            toast.error(err?.response?.data?.error || 'Failed to download CSV')
        }
    }

    const getSessionRemainingTime = (session: AttendanceSession): string | null => {
        if (session.status !== 'OPEN' || !session.startedAt || !session.windowMinutes) return null
        const endMs = new Date(session.startedAt).getTime() + session.windowMinutes * 60 * 1000
        const remainMs = endMs - Date.now()
        if (remainMs <= 0) return 'Expired'
        const mins = Math.floor(remainMs / 60000)
        const secs = Math.floor((remainMs % 60000) / 1000)
        return `${mins}m ${secs}s left`
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold flex items-center gap-2"><ClipboardCheck size={28} /> Attendance</h2>
                <div className="flex gap-2">
                    {(['create', 'live', 'history'] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1.5 ${activeTab === tab
                                    ? 'bg-primary text-white'
                                    : 'bg-bg-card border border-border text-text-secondary hover:text-text-primary'
                                }`}
                        >
                            {tab === 'history' && <History size={14} />}
                            {tab === 'create' ? 'Create Session' : tab === 'live' ? 'Live Console' : 'History'}
                        </button>
                    ))}
                </div>
            </div>

            {activeTab === 'create' ? (
                <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
                    <div className="bg-bg-card rounded-xl border border-border p-6">
                        <h3 className="text-lg font-semibold mb-4">Start attendance session</h3>
                        <form className="space-y-4" onSubmit={handleCreateSession}>
                            <div className="grid gap-3 md:grid-cols-2">
                                <label className="space-y-2">
                                    <span className="text-sm text-text-secondary">Subject</span>
                                    <select
                                        className="w-full rounded-xl border border-border bg-bg-base px-3 py-2 text-sm text-text-primary"
                                        value={subjectId}
                                        onChange={(e) => setSubjectId(e.target.value)}
                                    >
                                        <option value="">Select subject</option>
                                        {subjects?.map((subject) => (
                                            <option key={subject.id} value={subject.id}>
                                                {subject.code} — {subject.name}
                                            </option>
                                        ))}
                                    </select>
                                </label>

                                <label className="space-y-2">
                                    <span className="text-sm text-text-secondary">Class list</span>
                                    <select
                                        className="w-full rounded-xl border border-border bg-bg-base px-3 py-2 text-sm text-text-primary"
                                        value={classListId}
                                        onChange={(e) => {
                                            setClassListId(e.target.value)
                                            const selected = classLists?.find(c => c.id === e.target.value)
                                            if (selected) {
                                                setClassName(`${selected.department} - Year ${selected.year} ${selected.section || ''}`)
                                            }
                                        }}
                                        disabled={isLoadingClassLists}
                                    >
                                        <option value="">{isLoadingClassLists ? 'Loading...' : 'Select class list'}</option>
                                        {classLists?.map((list) => (
                                            <option key={list.id} value={list.id}>
                                                {list.name} ({list.department}, Y{list.year}) - {list.studentCount} students
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                                <label className="space-y-2">
                                    <span className="text-sm text-text-secondary">Class name (auto or custom)</span>
                                    <input
                                        className="w-full rounded-xl border border-border bg-bg-base px-3 py-2 text-sm text-text-primary"
                                        value={className}
                                        onChange={(e) => setClassName(e.target.value)}
                                        placeholder="Optional - auto-filled from class list"
                                    />
                                </label>

                                <label className="space-y-2">
                                    <span className="text-sm text-text-secondary">Window (minutes)</span>
                                    <input
                                        type="number"
                                        min={1}
                                        className="w-full rounded-xl border border-border bg-bg-base px-3 py-2 text-sm text-text-primary"
                                        value={windowMinutes}
                                        onChange={(e) => setWindowMinutes(Number(e.target.value))}
                                    />
                                </label>
                            </div>

                            <div className="grid gap-3 md:grid-cols-2">
                                <label className="space-y-2">
                                    <span className="text-sm text-text-secondary">QR mode</span>
                                    <select
                                        className="w-full rounded-xl border border-border bg-bg-base px-3 py-2 text-sm text-text-primary"
                                        value={qrMode}
                                        onChange={(e) => setQrMode(e.target.value as 'STATIC' | 'DYNAMIC')}
                                    >
                                        <option value="STATIC">Static session token</option>
                                        <option value="DYNAMIC">Dynamic expiring token</option>
                                    </select>
                                </label>

                                {qrMode === 'DYNAMIC' && (
                                    <label className="space-y-2">
                                        <span className="text-sm text-text-secondary">QR validity (seconds)</span>
                                        <input
                                            type="number"
                                            min={10}
                                            className="w-full rounded-xl border border-border bg-bg-base px-3 py-2 text-sm text-text-primary"
                                            value={qrValiditySeconds}
                                            onChange={(e) => setQrValiditySeconds(Number(e.target.value))}
                                        />
                                    </label>
                                )}
                            </div>

                            <button
                                type="submit"
                                className="inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
                                disabled={createSessionMutation.isPending || !subjectId}
                            >
                                {createSessionMutation.isPending ? 'Starting...' : 'Start session'}
                            </button>

                            <div className="mt-4 rounded-xl border border-border bg-bg-subtle p-4 space-y-3">
                                <div>
                                    <p className="text-sm font-semibold text-text-primary">Upload class list</p>
                                    <p className="text-xs text-text-secondary mt-1">
                                        Upload CSV/text with enrollment numbers. Saved list appears in class dropdown for future sessions.
                                    </p>
                                </div>

                                <div className="grid gap-3 md:grid-cols-2">
                                    <input
                                        className="w-full rounded-xl border border-border bg-bg-base px-3 py-2 text-sm text-text-primary"
                                        value={uploadName}
                                        onChange={(e) => setUploadName(e.target.value)}
                                        placeholder="Class list name (e.g. CSE-3A)"
                                    />
                                    <input
                                        className="w-full rounded-xl border border-border bg-bg-base px-3 py-2 text-sm text-text-primary"
                                        value={uploadDepartment}
                                        onChange={(e) => setUploadDepartment(e.target.value.toUpperCase())}
                                        placeholder="Department (e.g. CSE)"
                                    />
                                </div>

                                <div className="grid gap-3 md:grid-cols-3">
                                    <input
                                        type="number"
                                        min={1}
                                        max={4}
                                        className="w-full rounded-xl border border-border bg-bg-base px-3 py-2 text-sm text-text-primary"
                                        value={uploadYear}
                                        onChange={(e) => setUploadYear(Number(e.target.value))}
                                        placeholder="Year"
                                    />
                                    <input
                                        className="w-full rounded-xl border border-border bg-bg-base px-3 py-2 text-sm text-text-primary"
                                        value={uploadSection}
                                        onChange={(e) => setUploadSection(e.target.value)}
                                        placeholder="Section (optional)"
                                    />
                                    <input
                                        type="file"
                                        accept=".csv,.txt"
                                        className="w-full rounded-xl border border-border bg-bg-base px-3 py-2 text-xs text-text-primary"
                                        onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                                    />
                                </div>

                                <button
                                    type="button"
                                    className="inline-flex items-center justify-center rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
                                    onClick={() => createClassListFromUploadMutation.mutate()}
                                    disabled={createClassListFromUploadMutation.isPending || !uploadName.trim() || !uploadDepartment.trim() || !uploadFile}
                                >
                                    {createClassListFromUploadMutation.isPending ? 'Creating class list...' : 'Create class list from file'}
                                </button>
                            </div>
                        </form>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-bg-card rounded-xl border border-border p-6">
                            <h3 className="text-lg font-semibold mb-4">Active sessions</h3>
                            {isLoadingSessions ? (
                                <LoadingSpinner />
                            ) : !sessions?.length ? (
                                <p className="text-sm text-text-secondary">No open attendance sessions found.</p>
                            ) : (
                                <div className="space-y-3">
                                    {sessions.map((session) => (
                                        <div key={session.id} className="rounded-2xl border border-border/60 bg-bg-base p-4">
                                            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                                <div>
                                                    <p className="text-sm font-semibold">{session.subject?.code} — {session.subject?.name}</p>
                                                    <p className="text-xs text-text-secondary">{session.className || 'Default class'} · {session.qrMode} · {session.status}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xs text-text-secondary">Started: {session.startedAt ? new Date(session.startedAt).toLocaleString() : 'N/A'}</p>
                                                    <p className="text-xs font-semibold text-warning mt-1 flex items-center justify-end gap-1">
                                                        <Clock size={12} /> {getSessionRemainingTime(session)}
                                                    </p>
                                                </div>
                                            </div>
                                            {renderQrInfo(session)}
                                            {session.status === 'OPEN' && (
                                                <div className="mt-4 flex gap-2">
                                                    {session.qrMode === 'DYNAMIC' && (
                                                        <button
                                                            type="button"
                                                            className="rounded-xl bg-accent px-3 py-2 text-xs font-semibold text-white flex items-center gap-1"
                                                            onClick={() => refreshQrMutation.mutate(session.id)}
                                                            disabled={refreshQrMutation.isPending}
                                                        >
                                                            <RefreshCw size={14} /> Refresh QR
                                                        </button>
                                                    )}
                                                    <button
                                                        type="button"
                                                        className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-white flex items-center gap-1"
                                                        onClick={() => {
                                                            setSelectedSessionId(session.id)
                                                            setActiveTab('live')
                                                        }}
                                                    >
                                                        <UserCheck size={14} /> Live View
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white flex items-center gap-1"
                                                        onClick={() => openProjectorView(session)}
                                                    >
                                                        <Maximize2 size={14} /> Projector
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="rounded-xl bg-bg-subtle px-3 py-2 text-xs font-semibold text-text-primary border border-border flex items-center gap-1 hover:bg-bg-hover"
                                                        onClick={() => handleDownloadCsv(session.id)}
                                                    >
                                                        <Download size={14} /> Report
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="rounded-xl bg-danger px-3 py-2 text-xs font-semibold text-white"
                                                        onClick={() => closeSessionMutation.mutate(session.id)}
                                                        disabled={closeSessionMutation.isPending}
                                                    >
                                                        Close
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="bg-bg-card rounded-xl border border-border p-6">
                            <h3 className="text-lg font-semibold mb-4">Defaulters (&lt; 75%)</h3>
                            {isLoadingDefaulters ? (
                                <LoadingSpinner />
                            ) : (
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-border">
                                            <th className="text-left text-xs text-text-secondary px-4 py-3">Student</th>
                                            <th className="text-left text-xs text-text-secondary px-4 py-3">Subject</th>
                                            <th className="text-left text-xs text-text-secondary px-4 py-3">Present/Total</th>
                                            <th className="text-left text-xs text-text-secondary px-4 py-3">%</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {defaulters?.length === 0 ? (
                                            <tr><td colSpan={4} className="text-center text-text-secondary py-8">No defaulters found</td></tr>
                                        ) : defaulters?.map((d: any, i: number) => (
                                            <tr key={i} className="border-b border-border/50 hover:bg-bg-hover">
                                                <td className="px-4 py-3"><p className="text-sm font-medium">{d.student?.fullName}</p><p className="text-xs text-text-secondary">{d.student?.enrollmentNo}</p></td>
                                                <td className="px-4 py-3 text-sm">{d.subjectCode} — {d.subjectName}</td>
                                                <td className="px-4 py-3 text-sm">{d.present}/{d.total}</td>
                                                <td className="px-4 py-3"><span className={`text-sm font-bold ${d.percentage < 50 ? 'text-danger' : 'text-warning'}`}>{d.percentage}%</span></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            ) : activeTab === 'live' ? (
                renderLiveConsole()
            ) : (
                <div className="bg-bg-card rounded-xl border border-border p-6">
                    <h3 className="text-lg font-semibold mb-4">Session History</h3>
                    {isLoadingHistory ? (
                        <LoadingSpinner />
                    ) : !historySessions?.length ? (
                        <p className="text-sm text-text-secondary">No closed sessions found.</p>
                    ) : (
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-border">
                                    <th className="text-left text-xs text-text-secondary px-4 py-3">Date</th>
                                    <th className="text-left text-xs text-text-secondary px-4 py-3">Subject</th>
                                    <th className="text-left text-xs text-text-secondary px-4 py-3">Class</th>
                                    <th className="text-left text-xs text-text-secondary px-4 py-3">Present</th>
                                    <th className="text-left text-xs text-text-secondary px-4 py-3">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {historySessions.map((session) => (
                                    <tr key={session.id} className="border-b border-border/50 hover:bg-bg-hover">
                                        <td className="px-4 py-3 text-sm">
                                            {session.startedAt ? new Date(session.startedAt).toLocaleString() : 'N/A'}
                                            {session.status === 'OPEN' && <span className="ml-2 inline-flex items-center rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success">Live</span>}
                                        </td>
                                        <td className="px-4 py-3">
                                            <p className="text-sm font-medium">{session.subject?.code}</p>
                                            <p className="text-xs text-text-secondary">{session.subject?.name}</p>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-text-secondary">{session.className || 'Default'}</td>
                                        <td className="px-4 py-3 text-sm font-bold text-primary">{session._count?.records || 0}</td>
                                        <td className="px-4 py-3">
                                            <button
                                                onClick={() => handleDownloadCsv(session.id)}
                                                className="p-2 text-text-secondary hover:text-primary hover:bg-primary/10 rounded-lg transition"
                                                title="Download CSV Report"
                                            >
                                                <Download size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}

            {projectorSessionId && (
                <div ref={projectorContainerRef} className="fixed inset-0 z-[70] bg-black text-white p-5 md:p-8">
                    <div className="h-full w-full max-w-7xl mx-auto flex flex-col">
                        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
                            <div>
                                <h3 className="text-2xl font-bold tracking-tight">Attendance QR Projector</h3>
                                <p className="text-sm text-white/70 mt-1">
                                    {projectorSession?.subject?.code} — {projectorSession?.subject?.name} · {projectorSession?.className || 'Default class'}
                                </p>
                                <p className="text-xs text-white/55 mt-1">
                                    {projectorSession?.qrMode === 'DYNAMIC' ? 'Dynamic QR (auto-rotating)' : 'Static QR'}
                                </p>
                            </div>

                            <div className="flex items-center gap-2">
                                {projectorSession?.qrMode === 'DYNAMIC' && (
                                    <button
                                        type="button"
                                        onClick={() => void refreshProjectorQr()}
                                        className="px-3 py-2 rounded-xl bg-primary text-white text-xs font-semibold flex items-center gap-1"
                                    >
                                        <RefreshCw size={14} /> Refresh
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => void toggleProjectorFullscreen()}
                                    className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold flex items-center gap-1"
                                >
                                    <Maximize2 size={14} /> {isProjectorFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => void closeProjectorView()}
                                    className="px-3 py-2 rounded-xl bg-danger text-white text-xs font-semibold flex items-center gap-1"
                                >
                                    <X size={14} /> Close
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 flex items-center justify-center">
                            {projectorQrToken ? (
                                <div className="flex flex-col items-center gap-5">
                                    <div className="bg-white p-6 md:p-8 rounded-3xl shadow-2xl shadow-black/60">
                                        <QRCodeSVG
                                            value={projectorQrToken}
                                            size={Math.min(window.innerWidth * 0.55, 600)}
                                            level="L"
                                            boostLevel={false}
                                            marginSize={2}
                                        />
                                    </div>
                                    <div className="text-center">
                                        {projectorSession?.qrMode === 'DYNAMIC' ? (
                                            <p className={`text-xl font-black tracking-wide ${projectorCountdown <= 4 ? 'text-warning' : 'text-success'}`}>
                                                TTL: {projectorCountdown > 0 ? `${projectorCountdown}s` : 'Rotating'}
                                            </p>
                                        ) : (
                                            <p className="text-xl font-black tracking-wide text-accent">Static QR</p>
                                        )}
                                        <p className="text-xs text-white/60 mt-2">Keep this screen open on projector for student attendance scan.</p>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-warning">No QR token available for projector yet.</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
