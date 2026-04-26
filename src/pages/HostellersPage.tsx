import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../api/axios'
import toast from 'react-hot-toast'
import {
    Search, Download, Filter, ChevronLeft, ChevronRight,
    Users, LogIn, LogOut, Camera, Scan, Eye, Activity, BarChart3, Shield, AlertTriangle, Ticket
} from 'lucide-react'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import FaceRegistration from '../components/FaceRegistration'
import FaceLiveDetectionPanel from '../components/FaceLiveDetectionPanel'
import AccessControlPanel from '../components/AccessControlPanel'
import PinkSlipManager from '../components/PinkSlipManager'
import CurfewManager from '../components/CurfewManager' // Import the new component
import HostellerImportPanel from '../components/HostellerImportPanel'

export default function HostellersPage() {
    const queryClient = useQueryClient()
    const [search, setSearch] = useState('')
    const [dateFilter, setDateFilter] = useState('')
    const [directionFilter, setDirectionFilter] = useState<'ENTRY' | 'EXIT' | ''>('')
    const [page, setPage] = useState(1)
    const [apiError, setApiError] = useState<string | null>(null)
    const [showFaceRegistration, setShowFaceRegistration] = useState(false)
    const [selectedStudentId, setSelectedStudentId] = useState<string>('')
    const [selectedStudentName, setSelectedStudentName] = useState<string>('')
    const [showLiveDetection, setShowLiveDetection] = useState(false)
    const [activeFaceTab, setActiveFaceTab] = useState<'NONE' | 'LIVE' | 'REGISTER'>('NONE')
    const [showCurfewManager, setShowCurfewManager] = useState(false) // State for modal
    const [ticketSearch, setTicketSearch] = useState('')
    const [ticketResult, setTicketResult] = useState<any | null>(null)
    const [insightsUnavailable, setInsightsUnavailable] = useState(false)

    const resolveTicketId = (item: any) => {
        const apiTicket = item?.ticketId?.toString()?.trim()
        if (apiTicket) return apiTicket.toUpperCase()

        const rawId = item?.id?.toString()?.trim() || ''
        if (!rawId) return 'N/A'

        let hash = 0
        const source = rawId.toUpperCase()
        for (let i = 0; i < source.length; i += 1) {
            hash = (hash * 31 + source.charCodeAt(i)) % 10000
        }
        return `PS-${String(hash).padStart(4, '0')}`
    }

    // Fetch hosteller entry/exit logs
    const { data: logsData, isLoading: isLoadingLogs, error } = useQuery({
        queryKey: ['hosteller-logs', search, dateFilter, directionFilter, page],
        refetchInterval: 30000,
        queryFn: async () => {
            try {
                const response = await api.get('/scan/recent', {
                    params: {
                        date: dateFilter || undefined,
                        studentType: 'HOSTELLER',
                        search: search || undefined,
                        direction: directionFilter || undefined,
                        page, limit: 50,
                    },
                })
                setApiError(null)
                return response.data.data
            } catch (err: any) {
                const errorMsg = err.response?.data?.error || err.message || 'Failed to fetch logs'
                setApiError(errorMsg)
                throw err
            }
        },
    })

    // Fetch curfew rules
    const { data: curfewData, isLoading: isLoadingCurfew } = useQuery({
        queryKey: ['curfewRules'],
        queryFn: async () => {
            const response = await api.get('/rules/curfew');
            return response.data.data;
        },
    });

    const { data: outsideData, isLoading: isLoadingOutside } = useQuery({
        queryKey: ['hostellerOutside', dateFilter],
        refetchInterval: 30000,
        queryFn: async () => {
            const response = await api.get('/scan/hosteller/outside', {
                params: {
                    date: dateFilter || undefined,
                },
            })
            return response.data.data
        },
    })

    const { data: insightsData, isLoading: isLoadingInsights } = useQuery({
        queryKey: ['hostellerInsights'],
        enabled: !insightsUnavailable,
        refetchInterval: 60000,
        retry: (failureCount, err: any) => {
            if (err?.response?.status === 404) return false
            return failureCount < 2
        },
        queryFn: async () => {
            try {
                const response = await api.get('/admin/hosteller-insights')
                setInsightsUnavailable(false)
                return response.data.data
            } catch (err: any) {
                if (err?.response?.status === 404) {
                    setInsightsUnavailable(true)
                    setApiError('Hosteller insights API is not available on current backend deployment. Redeploy backend to enable this section.')
                    return {
                        highRiskStudents: [],
                        lateReturn: {
                            pendingCount: 0,
                            pendingRequests: [],
                        },
                    }
                }
                throw err
            }
        },
    })

    const { data: pendingPinkSlipsCount = 0 } = useQuery({
        queryKey: ['hostellerPendingPinkSlipsCount'],
        refetchInterval: 30000,
        queryFn: async () => {
            const response = await api.get('/pink-slips', {
                params: {
                    status: 'PENDING',
                    studentType: 'HOSTELLER',
                    page: 1,
                    limit: 1,
                },
            })
            const responseData = response.data?.data
            if (typeof responseData?.total === 'number') return responseData.total
            if (Array.isArray(responseData?.pinkSlips)) return responseData.pinkSlips.length
            if (Array.isArray(responseData)) return responseData.length
            return 0
        },
    })



    const manualEntryMutation = useMutation({
        mutationFn: async ({ studentId, gateId }: { studentId: string; gateId?: string | null }) => {
            const response = await api.post('/gates/exit-override', {
                studentId,
                gateId: gateId || undefined,
                direction: 'ENTRY',
            })
            return response.data
        },
        onSuccess: () => {
            setApiError(null)
            toast.success('Manual entry marked successfully')
            queryClient.invalidateQueries({ queryKey: ['hosteller-logs'] })
            queryClient.invalidateQueries({ queryKey: ['hostellerOutside'] })
        },
        onError: (err: any) => {
            const errorMsg = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to mark manual entry'
            setApiError(errorMsg)
        },
    })

    const sendStudentAlertMutation = useMutation({
        mutationFn: async ({ studentId, studentName }: { studentId: string; studentName?: string }) => {
            const response = await api.post('/alerts/student', {
                studentId,
                title: 'Hostel Re-entry Alert',
                body: `${studentName || 'Student'}, please return to hostel and mark entry immediately.`,
                targetId: studentId,
                targetType: 'GENERIC',
                screen: 'activity',
            })
            return response.data
        },
        onSuccess: () => {
            toast.success('Alert sent to student app')
        },
        onError: (err: any) => {
            const errorMsg = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to send alert'
            toast.error(errorMsg)
        },
    })

    const ticketLookupMutation = useMutation({
        mutationFn: async (ticketId: string) => {
            const response = await api.get(`/pink-slips/ticket/${encodeURIComponent(ticketId)}`)
            return response.data.data
        },
        onSuccess: (data) => {
            setTicketResult(data)
            toast.success('Pink slip ticket found')
        },
        onError: (err: any) => {
            setTicketResult(null)
            const errorMsg = err.response?.data?.error || err.message || 'Ticket lookup failed'
            toast.error(errorMsg)
        },
    })

    const resolveLateReturnMutation = useMutation({
        mutationFn: async ({ id, status, adminNote }: { id: string; status: 'ACKNOWLEDGED' | 'RESOLVED' | 'REJECTED'; adminNote?: string }) => {
            const response = await api.patch(`/late-return/${id}/status`, {
                status,
                adminNote,
            })
            return response.data
        },
        onSuccess: (_, variables) => {
            toast.success(`Late return marked ${variables.status.toLowerCase()}`)
            queryClient.invalidateQueries({ queryKey: ['hostellerInsights'] })
        },
        onError: (err: any) => {
            const errorMsg = err.response?.data?.error || err.message || 'Failed to update late return request'
            toast.error(errorMsg)
        },
    })

    const logs = logsData?.events || logsData || []
    const total = logsData?.total || logs.length
    const pages = Math.ceil(total / 50)

    // Compute stats from logs
    const todayLogs = Array.isArray(logs) ? logs : []
    const uniqueStudents = new Set(todayLogs.map((l: any) => l.student?.id || l.studentId)).size
    const avgConfidence = todayLogs.length > 0
        ? Math.round(todayLogs.reduce((sum: number, l: any) => sum + (l.confidence || 0), 0) / todayLogs.length)
        : 0
    const entryCount = todayLogs.filter((l: any) => l.direction === 'ENTRY').length
    const exitCount = todayLogs.filter((l: any) => l.direction === 'EXIT').length
    const manualEntryCount = todayLogs.filter((l: any) => l.direction === 'ENTRY' && l.source === 'MANUAL_OVERRIDE').length
    const longOutsideCount = Array.isArray(outsideData?.students)
        ? outsideData.students.filter((s: any) => {
            const seen = new Date(s.lastSeenAt)
            const diffHours = (Date.now() - seen.getTime()) / (1000 * 60 * 60)
            return diffHours >= 2
        }).length
        : 0

    const lateOutsideAlerts = Array.isArray(outsideData?.students)
        ? outsideData.students
            .map((s: any) => {
                const seen = new Date(s.lastSeenAt)
                const diffHours = (Date.now() - seen.getTime()) / (1000 * 60 * 60)
                return {
                    ...s,
                    outsideHours: diffHours,
                }
            })
            .filter((s: any) => s.outsideHours >= 2)
            .sort((a: any, b: any) => b.outsideHours - a.outsideHours)
        : []

    const gateLoadMap = todayLogs.reduce((acc: Record<string, number>, l: any) => {
        const gate = l.gate?.name || l.gateName || 'Main Gate'
        acc[gate] = (acc[gate] || 0) + 1
        return acc
    }, {})
    const gateLoad = Object.entries(gateLoadMap)
        .map(([gate, count]) => ({ gate, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6)
    const maxGateCount = gateLoad.length ? Math.max(...gateLoad.map((g) => g.count)) : 1
    const highRiskStudents = Array.isArray(insightsData?.highRiskStudents) ? insightsData.highRiskStudents : []
    const pendingLateReturnCount = Number(insightsData?.lateReturn?.pendingCount || 0)
    const pendingLateReturns = Array.isArray(insightsData?.lateReturn?.pendingRequests) ? insightsData.lateReturn.pendingRequests : []

    const formatOutsideDuration = (hours: number) => {
        const h = Math.floor(hours)
        const m = Math.floor((hours - h) * 60)
        if (h <= 0) return `${m}m`
        return `${h}h ${m}m`
    }

    const getActiveCurfewWindow = () => {
        if (!curfewData) return "Loading...";
        const boys = curfewData.find((r: any) => r.studentType === 'HOSTELLER_BOYS');
        const girls = curfewData.find((r: any) => r.studentType === 'HOSTELLER_GIRLS');
        if (boys && girls) {
            return `B: ${boys.startTime} — ${boys.endTime} | G: ${girls.startTime} — ${girls.endTime}`;
        }
        const fallback = boys || girls || curfewData[0];
        if (!fallback) return "Not configured";
        return `${fallback.startTime} — ${fallback.endTime}`;
    };

    const downloadCSV = () => {
        if (logs.length === 0) return
        const headers = ['Name', 'Enrollment', 'Type', 'Direction', 'Gate', 'Time', 'Status']
        const rows = todayLogs.map((log: any) => [
            log.student?.fullName || log.studentName || 'N/A',
            log.student?.enrollmentNo || log.enrollmentNo || 'N/A',
            (log.student?.studentType || log.studentType || '').replace('_', ' '),
            log.direction || 'N/A',
            log.gate?.name || log.gateName || 'N/A',
            new Date(log.scannedAt || log.scanTime).toLocaleString(),
            log.result || 'N/A',
        ])
        const csv = [headers, ...rows].map((row) => row.join(',')).join('\n')
        const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
        const a = document.createElement('a')
        a.href = url
        const exportDate = dateFilter || new Date().toLocaleDateString('en-CA')
        a.download = `hosteller-logs-${exportDate}.csv`
        a.click()
        URL.revokeObjectURL(url)
    }

    const getDirectionIcon = (direction: string) => {
        return direction === 'ENTRY'
            ? <LogIn size={16} className="text-success" />
            : <LogOut size={16} className="text-warning" />
    }

    const getStatusColor = (result: string) => {
        switch (result) {
            case 'GREEN': case 'VERIFIED':
                return 'bg-success/10 text-success border border-success/20'
            case 'RED':
                return 'bg-error/10 text-error border border-error/20'
            case 'AMBER':
                return 'bg-warning/10 text-warning border border-warning/20'
            default:
                return 'bg-gray-500/10 text-gray-400 border border-gray-500/20'
        }
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2.5 bg-primary/10 border border-primary/20 rounded-xl">
                        <Users className="text-primary" size={24} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black tracking-tight text-text-primary">Hosteller Logs</h1>
                        <p className="text-text-secondary text-sm">Real-time face recognition entry and exit tracking</p>
                    </div>
                </div>
            </div>

            {/* ═══ Statistics Cards ═══ */}
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                {[
                    {
                        icon: <Eye size={20} />, label: 'Total Detections', value: total || 0,
                        color: 'from-primary/20 to-accent/20', textColor: 'text-primary', borderColor: 'border-primary/20',
                    },
                    {
                        icon: <Users size={20} />, label: 'Unique Persons', value: uniqueStudents,
                        color: 'from-success/20 to-emerald-600/20', textColor: 'text-success', borderColor: 'border-success/20',
                    },
                    {
                        icon: <Shield size={20} />, label: 'Avg Confidence', value: avgConfidence ? `${avgConfidence}%` : '—',
                        color: 'from-accent/20 to-violet-600/20', textColor: 'text-accent', borderColor: 'border-accent/20',
                    },
                    {
                        icon: <BarChart3 size={20} />, label: 'Entry / Exit', value: `${entryCount} / ${exitCount}`,
                        color: 'from-warning/20 to-amber-600/20', textColor: 'text-warning', borderColor: 'border-warning/20',
                    },
                    {
                        icon: <LogIn size={20} />, label: 'Manual Entries', value: manualEntryCount,
                        color: 'from-emerald-500/20 to-green-500/20', textColor: 'text-success', borderColor: 'border-success/20',
                    },
                    {
                        icon: <Shield size={20} />, label: 'Outside > 2h', value: isLoadingOutside ? '...' : longOutsideCount,
                        color: 'from-rose-500/20 to-orange-500/20', textColor: 'text-warning', borderColor: 'border-warning/20',
                    },
                    {
                        icon: <Users size={20} />, label: 'Pending Slips', value: pendingPinkSlipsCount,
                        color: 'from-sky-500/20 to-blue-500/20', textColor: 'text-primary', borderColor: 'border-primary/20',
                    },
                    {
                        icon: <AlertTriangle size={20} />, label: 'Late Return Pending', value: isLoadingInsights ? '...' : pendingLateReturnCount,
                        color: 'from-rose-500/20 to-red-500/20', textColor: 'text-warning', borderColor: 'border-warning/20',
                    },
                ].map((stat) => (
                    <div key={stat.label}
                        className={`bg-gradient-to-br ${stat.color} rounded-2xl border ${stat.borderColor} p-4 hover:shadow-lg transition-all`}
                    >
                        <div className={`${stat.textColor} mb-2`}>{stat.icon}</div>
                        <p className="text-text-secondary text-xs font-bold uppercase tracking-wider">{stat.label}</p>
                        <p className="text-text-primary text-2xl font-black mt-0.5">{stat.value}</p>
                    </div>
                ))}
            </div>

            {/* Hosteller Operations Insights */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                <section className="glass-card p-5 border border-warning/30 bg-warning/5">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-black uppercase tracking-wider text-text-primary">Late Re-Entry Alerts</h3>
                        <div className="flex items-center gap-1 text-warning text-xs font-black">
                            <AlertTriangle size={14} />
                            {lateOutsideAlerts.length}
                        </div>
                    </div>

                    {lateOutsideAlerts.length === 0 ? (
                        <p className="text-xs text-text-secondary">No student has been outside for more than 2 hours.</p>
                    ) : (
                        <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                            {lateOutsideAlerts.slice(0, 8).map((item: any) => (
                                <div key={item.student?.id} className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 px-3 py-2.5">
                                    <div>
                                        <p className="text-sm font-bold text-text-primary">{item.student?.fullName}</p>
                                        <p className="text-[11px] text-text-secondary">{item.student?.enrollmentNo} • {item.gateName || 'Main Gate'}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-black text-warning">{formatOutsideDuration(item.outsideHours)}</span>
                                        <button
                                            onClick={() => sendStudentAlertMutation.mutate({ studentId: item.student?.id, studentName: item.student?.fullName })}
                                            disabled={sendStudentAlertMutation.isPending || !item.student?.id}
                                            className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-warning/20 text-warning hover:bg-warning/30 disabled:opacity-50"
                                        >
                                            Alert
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                <section className="glass-card p-5 border border-primary/30 bg-primary/5">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-black uppercase tracking-wider text-text-primary">Gate-Wise Hosteller Load</h3>
                        <span className="text-[11px] text-text-secondary">Today</span>
                    </div>

                    {gateLoad.length === 0 ? (
                        <p className="text-xs text-text-secondary">No gate activity recorded for selected date.</p>
                    ) : (
                        <div className="space-y-2">
                            {gateLoad.map((item) => (
                                <div key={item.gate} className="space-y-1">
                                    <div className="flex items-center justify-between text-[11px]">
                                        <span className="text-text-primary font-bold truncate pr-3">{item.gate}</span>
                                        <span className="text-text-secondary font-black">{item.count}</span>
                                    </div>
                                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-primary rounded-full"
                                            style={{ width: `${Math.max(8, Math.round((item.count / maxGateCount) * 100))}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>

            {/* 1st Year Hosteller Setup Panel */}
            <HostellerImportPanel />

            {/* ═══ Face Recognition Section ═══ */}
            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <button
                        onClick={() => { setActiveFaceTab('LIVE'); setShowLiveDetection(true) }}
                        className={`group p-5 rounded-2xl border transition-all hover:shadow-lg ${activeFaceTab === 'LIVE'
                            ? 'border-primary/60 bg-gradient-to-br from-primary/20 to-accent/20 shadow-lg shadow-primary/10'
                            : 'border-white/10 bg-gradient-to-br from-primary/10 to-accent/10 hover:border-primary/40'
                            }`}
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-primary/20 rounded-xl group-hover:scale-110 transition-transform">
                                <Camera size={22} className="text-primary" />
                            </div>
                            <div className="text-left flex-1">
                                <h3 className="font-bold text-text-primary flex items-center gap-2">
                                    Live Face Detection
                                    <Activity size={14} className="text-primary" />
                                </h3>
                                <p className="text-xs text-text-secondary mt-0.5">Real-time multi-person tracking with AI recognition</p>
                            </div>
                            <div className="ml-auto">
                                <div className={`w-2.5 h-2.5 rounded-full ${activeFaceTab === 'LIVE' ? 'bg-success animate-pulse' : 'bg-text-secondary/30'}`} />
                            </div>
                        </div>
                    </button>

                    <button
                        onClick={() => {
                            setActiveFaceTab('REGISTER')
                            setShowFaceRegistration(true)
                            setSelectedStudentId('')
                            setSelectedStudentName('')
                        }}
                        className={`group p-5 rounded-2xl border transition-all hover:shadow-lg ${activeFaceTab === 'REGISTER'
                            ? 'border-success/60 bg-gradient-to-br from-success/20 to-accent/20 shadow-lg shadow-success/10'
                            : 'border-white/10 bg-gradient-to-br from-success/10 to-accent/10 hover:border-success/40'
                            }`}
                    >
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-success/20 rounded-xl group-hover:scale-110 transition-transform">
                                <Scan size={22} className="text-success" />
                            </div>
                            <div className="text-left flex-1">
                                <h3 className="font-bold text-text-primary">Register New Face</h3>
                                <p className="text-xs text-text-secondary mt-0.5">Multi-angle enrollment with liveness verification</p>
                            </div>
                        </div>
                    </button>
                </div>

                {showLiveDetection && (
                    <div className="space-y-3 animate-fade-in-up">
                        <div className="flex items-center justify-between px-1">
                            <p className="text-sm text-text-secondary flex items-center gap-1.5">
                                <span className="w-2 h-2 bg-success rounded-full animate-pulse" />
                                Live face detection & tracking is active
                            </p>
                            <button
                                onClick={() => {
                                    setShowLiveDetection(false)
                                    if (activeFaceTab === 'LIVE') setActiveFaceTab('NONE')
                                }}
                                className="text-xs px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-text-secondary transition-colors"
                            >
                                Close Preview
                            </button>
                        </div>
                        <FaceLiveDetectionPanel />
                    </div>
                )}
            </div>

            {/* Curfew Timings Section */}
            <div className="glass-card p-6 border border-primary/20 bg-primary/5">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/20 rounded-lg text-primary">
                            <Shield size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-text-primary leading-tight text-lg">Hostel Curfew Rules</h3>
                            <p className="text-xs text-text-secondary">Automated exit/entry restriction windows</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="text-right">
                            <p className="text-[10px] font-black text-text-secondary uppercase tracking-widest">Active Window</p>
                            <p className="text-sm font-black text-primary">{isLoadingCurfew ? '...' : getActiveCurfewWindow()}</p>
                        </div>
                        <button
                            onClick={() => setShowCurfewManager(true)}
                            className="bg-primary/10 hover:bg-primary/20 text-primary px-4 py-2 rounded-xl text-xs font-black transition-all"
                        >
                            Configure timings
                        </button>
                    </div>
                </div>
            </div>

            {/* Pink Slip Ticket Checker */}
            <div className="glass-card p-6 border border-accent/20 bg-accent/5">
                <div className="flex items-center justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-accent/20 rounded-lg text-accent">
                            <Ticket size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-text-primary leading-tight text-lg">Pink Slip Ticket Checker</h3>
                            <p className="text-xs text-text-secondary">Enter ticket id (example: PS-1234) to fetch complete details</p>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 mb-4">
                    <input
                        type="text"
                        value={ticketSearch}
                        onChange={(e) => setTicketSearch(e.target.value)}
                        placeholder="PS-... ticket id"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-text-primary focus:outline-none focus:border-accent/50"
                    />
                    <button
                        onClick={() => {
                            const ticketId = ticketSearch.trim()
                            if (!ticketId) {
                                toast.error('Please enter ticket id')
                                return
                            }
                            ticketLookupMutation.mutate(ticketId)
                        }}
                        disabled={ticketLookupMutation.isPending}
                        className="px-5 py-3 rounded-xl bg-accent text-white text-xs font-black uppercase tracking-widest hover:bg-accent/90 disabled:opacity-60"
                    >
                        {ticketLookupMutation.isPending ? 'Checking...' : 'Check Ticket'}
                    </button>
                </div>

                {ticketResult && (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-2">
                        <p className="text-xs text-text-secondary">Ticket: <span className="text-text-primary font-black">{resolveTicketId(ticketResult)}</span></p>
                        <p className="text-sm text-text-primary font-bold">{ticketResult.student?.fullName || 'Unknown Student'}</p>
                        <p className="text-xs text-text-secondary">{ticketResult.student?.enrollmentNo || 'N/A'} • {ticketResult.student?.department || 'N/A'} • {String(ticketResult.student?.studentType || '').split('_').join(' ')}</p>
                        <p className="text-xs text-text-secondary">From: {new Date(ticketResult.fromDate).toLocaleString()}</p>
                        <p className="text-xs text-text-secondary">To: {new Date(ticketResult.toDate).toLocaleString()}</p>
                        <p className="text-xs text-text-secondary">Status: <span className="font-black text-text-primary">{ticketResult.status}</span></p>
                        {ticketResult.remarks && <p className="text-xs text-text-secondary">Remarks: {ticketResult.remarks}</p>}
                        {ticketResult.approvedBy?.name && <p className="text-xs text-text-secondary">Processed by: {ticketResult.approvedBy.name}</p>}
                    </div>
                )}
            </div>



            {/* Students Currently Outside */}
            <div className="glass-card p-6 border border-warning/30 bg-warning/5">
                <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                        <h3 className="font-bold text-text-primary leading-tight text-lg">Students Currently Outside</h3>
                        <p className="text-xs text-text-secondary">Latest movement is EXIT (no re-entry recorded yet)</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-black text-text-secondary uppercase tracking-widest">Count</p>
                        <p className="text-2xl font-black text-warning">
                            {isLoadingOutside ? '...' : (outsideData?.count ?? 0)}
                        </p>
                    </div>
                </div>

                {isLoadingOutside ? (
                    <div className="flex justify-center items-center h-20">
                        <LoadingSpinner />
                    </div>
                ) : !outsideData?.students?.length ? (
                    <p className="text-sm text-text-secondary">No students are currently outside for selected date.</p>
                ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {outsideData.students.slice(0, 20).map((item: any) => (
                            <div key={item.student?.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                                <div>
                                    <p className="text-sm font-bold text-text-primary">{item.student?.fullName}</p>
                                    <p className="text-xs text-text-secondary">
                                        {item.student?.enrollmentNo} • {item.student?.department || 'N/A'}
                                    </p>
                                </div>
                                <div className="text-right flex flex-col items-end gap-1.5">
                                    <p className="text-xs font-bold text-warning">EXIT</p>
                                    <p className="text-[11px] text-text-secondary">
                                        {new Date(item.lastSeenAt).toLocaleString()}
                                    </p>
                                    <button
                                        onClick={() => manualEntryMutation.mutate({ studentId: item.student?.id, gateId: item.gateId })}
                                        disabled={manualEntryMutation.isPending || !item.student?.id}
                                        className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-success/20 text-success hover:bg-success/30 disabled:opacity-50"
                                    >
                                        {manualEntryMutation.isPending ? 'Marking...' : 'Mark Manual Entry'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* High-Risk Hosteller List */}
            <div className="glass-card p-6 border border-error/20 bg-error/5">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="font-bold text-text-primary leading-tight text-lg">High-Risk Students (Weekly Pattern)</h3>
                        <p className="text-xs text-text-secondary">Repeated late entries + unusual movement score</p>
                    </div>
                    <p className="text-sm font-black text-error">{isLoadingInsights ? '...' : highRiskStudents.length}</p>
                </div>

                {insightsUnavailable && (
                    <p className="text-xs text-warning mb-3">Insights API not found on current backend deployment. Deploy latest backend release to enable high-risk and late-return analytics.</p>
                )}

                {isLoadingInsights ? (
                    <div className="flex justify-center items-center h-16">
                        <LoadingSpinner />
                    </div>
                ) : highRiskStudents.length === 0 ? (
                    <p className="text-sm text-text-secondary">No high-risk students detected this week.</p>
                ) : (
                    <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {highRiskStudents.slice(0, 20).map((item: any) => (
                            <div key={item.student?.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                                <div>
                                    <p className="text-sm font-bold text-text-primary">{item.student?.fullName}</p>
                                    <p className="text-xs text-text-secondary">{item.student?.enrollmentNo} • {item.student?.department || 'N/A'}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs font-black text-warning">Risk: {item.riskScore}</p>
                                    <p className="text-[11px] text-text-secondary">Late In: {item.lateEntries} | Late Out: {item.lateExits} | Unusual: {item.unusualMovement}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="glass-card p-6 border border-warning/20 bg-warning/5">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="font-bold text-text-primary leading-tight text-lg">Late Return Requests</h3>
                        <p className="text-xs text-text-secondary">Student ETA + location alerts requiring warden action</p>
                    </div>
                    <p className="text-sm font-black text-warning">{isLoadingInsights ? '...' : pendingLateReturns.length}</p>
                </div>

                {isLoadingInsights ? (
                    <div className="flex justify-center items-center h-16">
                        <LoadingSpinner />
                    </div>
                ) : pendingLateReturns.length === 0 ? (
                    <p className="text-sm text-text-secondary">No pending late return requests.</p>
                ) : (
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                        {pendingLateReturns.slice(0, 30).map((item: any) => (
                            <div key={item.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="text-sm font-bold text-text-primary">{item.student?.fullName}</p>
                                        <p className="text-xs text-text-secondary">{item.student?.enrollmentNo} • ETA: {new Date(item.eta).toLocaleString()}</p>
                                        <p className="text-xs text-text-secondary mt-1">Reason: {item.reason}</p>
                                        {Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude)) ? (
                                            <div className="mt-2 inline-flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/10 px-2.5 py-1.5">
                                                <span className="text-[10px] font-black uppercase tracking-wider text-primary">Location</span>
                                                <span className="text-[11px] font-bold text-text-primary">{Number(item.latitude).toFixed(5)}, {Number(item.longitude).toFixed(5)}</span>
                                                <a
                                                    href={`https://maps.google.com/?q=${Number(item.latitude)},${Number(item.longitude)}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="text-[10px] font-black uppercase tracking-wider text-accent hover:underline"
                                                >
                                                    Open Map
                                                </a>
                                            </div>
                                        ) : (
                                            <div className="mt-2 inline-flex items-center rounded-lg border border-warning/25 bg-warning/10 px-2.5 py-1.5 text-[11px] font-bold text-warning">
                                                Location unavailable
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => resolveLateReturnMutation.mutate({ id: item.id, status: 'ACKNOWLEDGED', adminNote: 'Request noted. Return safely and contact warden if delayed further.' })}
                                            disabled={resolveLateReturnMutation.isPending}
                                            className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-success/20 text-success hover:bg-success/30 disabled:opacity-50"
                                        >
                                            Acknowledge
                                        </button>
                                        <button
                                            onClick={() => resolveLateReturnMutation.mutate({ id: item.id, status: 'REJECTED', adminNote: 'Please contact warden immediately.' })}
                                            disabled={resolveLateReturnMutation.isPending}
                                            className="px-2.5 py-1 rounded-lg text-[10px] font-black bg-error/20 text-error hover:bg-error/30 disabled:opacity-50"
                                        >
                                            Reject
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Pink Slip Management */}
            <PinkSlipManager />

            {/* Access Control Operations */}
            <AccessControlPanel />

            {/* Error Alerts */}
            {apiError && (
                <div className="p-4 bg-error/10 border border-error/30 rounded-2xl">
                    <p className="text-error text-sm font-medium">⚠️ API Error: {apiError}</p>
                    <p className="text-error/70 text-xs mt-1">Make sure the backend API is running at {api.defaults.baseURL}</p>
                </div>
            )}
            {error && !apiError && (
                <div className="p-4 bg-warning/10 border border-warning/30 rounded-2xl">
                    <p className="text-warning text-sm font-medium">⚠️ Connection Error: Unable to reach backend API</p>
                </div>
            )}

            {/* ═══ Filters ═══ */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="relative">
                    <Search className="absolute left-4 top-3.5 text-text-secondary" size={18} />
                    <input
                        type="text"
                        placeholder="Search by name or enrollment..."
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-3.5 text-sm font-bold text-text-primary focus:border-accent/40 focus:bg-white/[0.08] focus:outline-none transition-all placeholder:text-text-secondary/50 shadow-inner"
                    />
                </div>
                <div className="relative">
                    <Filter className="absolute left-4 top-3.5 text-text-secondary" size={18} />
                    <input
                        type="date"
                        value={dateFilter}
                        onChange={(e) => { setDateFilter(e.target.value); setPage(1) }}
                        className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-3.5 text-sm font-bold text-text-primary focus:border-accent/40 focus:bg-white/[0.08] focus:outline-none transition-all placeholder:text-text-secondary/50 shadow-inner"
                    />
                </div>
                <select
                    value={directionFilter}
                    onChange={(e) => { setDirectionFilter(e.target.value as 'ENTRY' | 'EXIT' | ''); setPage(1) }}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-sm font-bold text-text-primary focus:border-accent/40 focus:bg-white/[0.08] focus:outline-none transition-all"
                >
                    <option value="">All Directions</option>
                    <option value="ENTRY">Entry Only</option>
                    <option value="EXIT">Exit Only</option>
                </select>
                <button
                    onClick={downloadCSV}
                    disabled={logs.length === 0 || isLoadingLogs}
                    className="flex items-center gap-2 justify-center px-6 py-3 bg-accent text-white font-bold rounded-2xl hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95"
                >
                    <Download size={18} />
                    Export CSV
                </button>
            </div>

            {/* ═══ Table ═══ */}
            <div className="overflow-x-auto rounded-3xl border border-white/10 shadow-xl bg-bg-card/50 backdrop-blur-sm">
                {isLoadingLogs ? (
                    <div className="flex justify-center items-center h-96">
                        <LoadingSpinner />
                    </div>
                ) : logs.length === 0 ? (
                    <div className="text-center py-12">
                        <Users className="mx-auto text-text-secondary/50 mb-4" size={48} />
                        <p className="text-text-secondary">No hosteller logs found for the selected filters</p>
                        <p className="text-text-secondary/50 text-sm mt-1">Try changing filters or checking API connection</p>
                    </div>
                ) : (
                    <table className="w-full" id="hosteller-logs-table">
                        <thead>
                            <tr className="border-b border-white/10">
                                <th className="px-6 py-4 text-left text-xs font-bold text-text-secondary uppercase tracking-wider">Name</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-text-secondary uppercase tracking-wider">Enrollment</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-text-secondary uppercase tracking-wider">Branch</th>
                                <th className="px-6 py-4 text-center text-xs font-bold text-text-secondary uppercase tracking-wider">Direction</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-text-secondary uppercase tracking-wider">Gate</th>
                                <th className="px-6 py-4 text-left text-xs font-bold text-text-secondary uppercase tracking-wider">Time</th>
                                <th className="px-6 py-4 text-center text-xs font-bold text-text-secondary uppercase tracking-wider">Confidence</th>
                                <th className="px-6 py-4 text-center text-xs font-bold text-text-secondary uppercase tracking-wider">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {todayLogs.map((log: any) => (
                                <tr key={log.id} className="hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-4 text-sm font-semibold text-text-primary">
                                        {log.student?.fullName || log.studentName}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-text-secondary">
                                        {log.student?.enrollmentNo || log.enrollmentNo}
                                    </td>
                                    <td className="px-6 py-4 text-sm font-bold text-accent uppercase tracking-tighter">
                                        {log.student?.department || log.department || 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="flex justify-center items-center gap-1.5">
                                            {getDirectionIcon(log.direction)}
                                            <span className={`text-xs font-bold ${log.direction === 'ENTRY' ? 'text-success' : 'text-warning'}`}>
                                                {log.direction}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-text-secondary">
                                        {log.gate?.name || log.gateName || 'N/A'}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-text-secondary">
                                        {new Date(log.scannedAt || log.scanTime || log.timestamp).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {log.confidence ? (
                                            <div className="flex items-center justify-center gap-1.5">
                                                <div className="w-12 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full ${log.confidence > 90 ? 'bg-success' : log.confidence > 80 ? 'bg-warning' : 'bg-error'
                                                            }`}
                                                        style={{ width: `${log.confidence}%` }}
                                                    />
                                                </div>
                                                <span className="text-xs font-bold text-text-secondary">{log.confidence}%</span>
                                            </div>
                                        ) : (
                                            <span className="text-xs text-text-secondary/50">—</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`inline-block px-3 py-1 text-xs font-bold rounded-full ${getStatusColor(log.result)}`}>
                                            {log.result || 'PENDING'}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Pagination */}
            {pages > 1 && (
                <div className="flex items-center justify-between">
                    <p className="text-sm text-text-secondary">
                        Showing page {page} of {pages} ({total} total logs)
                    </p>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setPage(Math.max(1, page - 1))}
                            disabled={page === 1}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronLeft size={18} />
                            Previous
                        </button>
                        <button
                            onClick={() => setPage(Math.min(pages, page + 1))}
                            disabled={page === pages}
                            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            Next
                            <ChevronRight size={18} />
                        </button>
                    </div>
                </div>
            )}

            {showFaceRegistration && (
                <FaceRegistration
                    studentId={selectedStudentId || 'new-student'}
                    studentName={selectedStudentName || 'New Student'}
                    onSuccess={() => {
                        setShowFaceRegistration(false)
                        if (activeFaceTab === 'REGISTER') setActiveFaceTab('NONE')
                        setSelectedStudentId('')
                        setSelectedStudentName('')
                    }}
                    onCancel={() => {
                        setShowFaceRegistration(false)
                        if (activeFaceTab === 'REGISTER') setActiveFaceTab('NONE')
                        setSelectedStudentId('')
                        setSelectedStudentName('')
                    }}
                />
            )}

            {showCurfewManager && <CurfewManager onClose={() => setShowCurfewManager(false)} />}
        </div>
    )
}
