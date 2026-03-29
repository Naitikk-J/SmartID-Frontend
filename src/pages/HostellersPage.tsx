import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../api/axios'
import {
    Search, Download, Filter, ChevronLeft, ChevronRight,
    Users, LogIn, LogOut, Camera, Scan, Eye, Activity, BarChart3, Shield
} from 'lucide-react'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import FaceRegistration from '../components/FaceRegistration'
import FaceLiveDetectionPanel from '../components/FaceLiveDetectionPanel'
import AccessControlPanel from '../components/AccessControlPanel'
import PinkSlipManager from '../components/PinkSlipManager'
import CurfewManager from '../components/CurfewManager' // Import the new component

export default function HostellersPage() {
    const queryClient = useQueryClient()
    const [search, setSearch] = useState('')
    const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0])
    const [directionFilter, setDirectionFilter] = useState<'ENTRY' | 'EXIT' | ''>('')
    const [page, setPage] = useState(1)
    const [apiError, setApiError] = useState<string | null>(null)
    const [showFaceRegistration, setShowFaceRegistration] = useState(false)
    const [selectedStudentId, setSelectedStudentId] = useState<string>('')
    const [selectedStudentName, setSelectedStudentName] = useState<string>('')
    const [showLiveDetection, setShowLiveDetection] = useState(false)
    const [activeFaceTab, setActiveFaceTab] = useState<'NONE' | 'LIVE' | 'REGISTER'>('NONE')
    const [showCurfewManager, setShowCurfewManager] = useState(false) // State for modal

    // Fetch hosteller entry/exit logs
    const { data: logsData, isLoading: isLoadingLogs, error } = useQuery({
        queryKey: ['hosteller-logs', search, dateFilter, directionFilter, page],
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
        queryFn: async () => {
            const response = await api.get('/scan/hosteller/outside', {
                params: {
                    date: dateFilter || undefined,
                },
            })
            return response.data.data
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
            queryClient.invalidateQueries({ queryKey: ['hosteller-logs'] })
            queryClient.invalidateQueries({ queryKey: ['hostellerOutside'] })
        },
        onError: (err: any) => {
            const errorMsg = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to mark manual entry'
            setApiError(errorMsg)
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

    const getActiveCurfewWindow = () => {
        if (!curfewData) return "Loading...";
        const rule = curfewData.find((r: any) => r.studentType === 'HOSTELLER') || curfewData[0];
        if (!rule) return "Not configured";
        return `${rule.startTime} — ${rule.endTime}`;
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
        a.download = `hosteller-logs-${new Date().toISOString().split('T')[0]}.csv`
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
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
                        <p className="text-text-secondary">No hosteller logs found for the selected date</p>
                        <p className="text-text-secondary/50 text-sm mt-1">Try changing the date or checking API connection</p>
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
