import { useQuery } from '@tanstack/react-query'
import api from '../api/axios'
import StatCard from '../components/ui/StatCard'
import Badge from '../components/ui/Badge'
import { Users, ClipboardCheck, AlertTriangle, Wallet, Radio } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { ScanEvent } from '../store/socketStore'

export default function DashboardPage() {

    const { data: occupancy } = useQuery({
        queryKey: ['campus-occupancy'],
        queryFn: () => api.get('/reports/campus-occupancy').then((r) => r.data.data),
        refetchInterval: 30000,
    })

    const { data: attendanceSummary } = useQuery({
        queryKey: ['attendance-summary'],
        queryFn: () => api.get('/reports/attendance-summary').then((r) => r.data.data),
        refetchInterval: 30000,
    })

    const { data: polledFeed } = useQuery({
        queryKey: ['live-feed-polled'],
        queryFn: () => api.get('/scan/recent').then((r) => r.data.data),
        refetchInterval: 5000, // Poll every 5 seconds
    })

    const liveFeed: ScanEvent[] = polledFeed || []

    const deptData = attendanceSummary?.summary
        ? Object.entries(attendanceSummary.summary).map(([dept, vals]: [string, any]) => ({
            name: dept,
            sessions: vals.totalSessions,
            records: vals.totalRecords,
            pct: vals.totalSessions > 0 ? Math.round((vals.totalRecords / (vals.totalSessions * 50)) * 100) : 0,
        }))
        : []

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold">Campus Overview</h2>

            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Students on Campus"
                    value={occupancy?.studentsOnCampus ?? '—'}
                    icon={Users}
                    color="text-success"
                    subtitle={`${occupancy?.entries ?? 0} entries, ${occupancy?.exits ?? 0} exits today`}
                />
                <StatCard
                    title="Active Sessions"
                    value="—"
                    icon={ClipboardCheck}
                    color="text-accent"
                    subtitle="Attendance sessions open now"
                />
                <StatCard
                    title="Alerts"
                    value={liveFeed.filter((e: ScanEvent) => ['FAKE', 'LIMIT_HIT'].includes(e.result)).length}
                    icon={AlertTriangle}
                    color="text-danger"
                    subtitle="Fake + limit hit in feed"
                />
                <StatCard
                    title="Canteen Revenue"
                    value="—"
                    icon={Wallet}
                    color="text-warning"
                    subtitle="Today's debit transactions"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Live Feed */}
                <div className="bg-bg-card rounded-xl border border-border p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <Radio size={18} className="text-success animate-pulse-badge" />
                        <h3 className="text-lg font-semibold">Live Scan Feed</h3>
                        <span className="text-xs text-text-secondary ml-auto">{liveFeed.length} events</span>
                    </div>
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {liveFeed.length === 0 ? (
                            <p className="text-text-secondary text-sm text-center py-8">No scan events yet. Waiting for scans...</p>
                        ) : (
                            liveFeed.slice(0, 20).map((event: ScanEvent, i: number) => (
                                <div key={event.id || i} className="flex items-center gap-3 p-3 bg-bg-dark rounded-lg animate-slide-in">
                                    <Badge result={event.result} badge={event.badge} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{event.studentName}</p>
                                        <p className="text-xs text-text-secondary">{event.enrollmentNo} · {event.department}</p>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-xs text-text-secondary">{event.scanType?.replace('_', ' ')}</p>
                                        <p className="text-xs text-text-secondary">{new Date(event.time).toLocaleTimeString()}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Attendance Chart */}
                <div className="bg-bg-card rounded-xl border border-border p-5">
                    <h3 className="text-lg font-semibold mb-4">Attendance by Department</h3>
                    {deptData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={350}>
                            <BarChart data={deptData}>
                                <XAxis dataKey="name" stroke="#94A3B8" fontSize={12} />
                                <YAxis stroke="#94A3B8" fontSize={12} />
                                <Tooltip
                                    contentStyle={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '8px' }}
                                    labelStyle={{ color: '#F8FAFC' }}
                                />
                                <Bar dataKey="records" radius={[6, 6, 0, 0]}>
                                    {deptData.map((entry, i) => (
                                        <Cell key={i} fill={entry.pct >= 75 ? '#16A34A' : '#DC2626'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <p className="text-text-secondary text-sm text-center py-8">No attendance data available</p>
                    )}
                </div>
            </div>
        </div>
    )
}
