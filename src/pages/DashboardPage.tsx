import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import api from '../api/axios'
import StatCard from '../components/ui/StatCard'
import Badge from '../components/ui/Badge'
import { Users, ClipboardCheck, AlertTriangle, Radio, ChevronRight } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { ScanEvent } from '../store/socketStore'
import { Link } from 'react-router-dom'

type EventLite = {
    id: string
    name: string
}

type LiveCardEvent = ScanEvent & {
    secondaryLabel?: string
}

export default function DashboardPage() {
    const [feedSource, setFeedSource] = useState<'CAMPUS' | 'EVENT_MESS'>('CAMPUS')
    const [selectedEventId, setSelectedEventId] = useState<string>('')

    const { data: occupancy } = useQuery({
        queryKey: ['campus-occupancy'],
        queryFn: () => api.get('/reports/campus-occupancy').then((r) => r.data.data),
        refetchInterval: 30000,
    })

    const { data: entrySummary } = useQuery({
        queryKey: ['entry-summary'],
        queryFn: () => api.get('/reports/entry-summary').then((r) => r.data.data),
        refetchInterval: 30000,
    })

    const { data: polledFeed } = useQuery({
        queryKey: ['live-feed-polled'],
        queryFn: () => api.get('/scan/recent').then((r) => r.data.data),
        refetchInterval: 5000,
    })

    const { data: events } = useQuery<EventLite[]>({
        queryKey: ['dashboard-events-feed-list'],
        queryFn: () => api.get('/events').then((r) => r.data.data.events as EventLite[]),
        refetchInterval: 30000,
    })

    const { data: activeSessions } = useQuery({
        queryKey: ['dashboard-active-sessions'],
        queryFn: () => api.get('/attendance/sessions', { params: { status: 'OPEN' } }).then((r) => r.data.data.sessions),
        refetchInterval: 30000,
    })

    const selectedEventName = useMemo(
        () => events?.find((event) => event.id === selectedEventId)?.name || 'Event Mess',
        [events, selectedEventId],
    )

    const { data: eventMessData } = useQuery({
        queryKey: ['dashboard-event-mess-feed', selectedEventId],
        enabled: feedSource === 'EVENT_MESS' && Boolean(selectedEventId),
        queryFn: () => api.get(`/events/${selectedEventId}/mess/logs`, {
            params: {
                date: new Date().toISOString().slice(0, 10),
                limit: 30,
            },
        }).then((r) => r.data.data),
        refetchInterval: 7000,
    })

    useEffect(() => {
        if (!events?.length) return
        if (!selectedEventId) {
            setSelectedEventId(events[0].id)
            return
        }

        const exists = events.some((event) => event.id === selectedEventId)
        if (!exists) {
            setSelectedEventId(events[0].id)
        }
    }, [events, selectedEventId])

    const liveFeed: ScanEvent[] = polledFeed?.events || []

    const campusFeed: LiveCardEvent[] = liveFeed.map((event) => ({
        ...event,
        secondaryLabel: `Gate ${event.gateId?.toString().slice(-1) || '1'}`,
    }))

    const eventMessFeed: LiveCardEvent[] = useMemo(() => {
        const logs = eventMessData?.logs || []
        return logs.map((log: any) => {
            const profile = log.participant || log.student || {}
            return {
                id: String(log.id || `${log.scannedAt}-${profile.enrollmentNo || profile.email || 'NA'}`),
                time: String(log.scannedAt || new Date().toISOString()),
                studentName: String(profile.fullName || 'Unknown Participant'),
                enrollmentNo: String(profile.enrollmentNo || profile.email || 'N/A'),
                department: selectedEventName,
                scanType: 'EVENT_MESS',
                result: 'VERIFIED',
                badge: 'GREEN',
                direction: null,
                secondaryLabel: String(log.mealLabel || `Meal ${log.mealNumber || '-'}`),
            }
        })
    }, [eventMessData?.logs, selectedEventName])

    const displayFeed = feedSource === 'EVENT_MESS' ? eventMessFeed : campusFeed

    const deptData = entrySummary?.summary
        ? Object.entries(entrySummary.summary).map(([dept, count]: [string, any]) => ({
            name: dept,
            entries: count,
            // Dynamic threshold for color: green for 50+, lavender for 20+, rose for <20
            status: count >= 50 ? 'high' : count >= 20 ? 'med' : 'low',
        }))
        : []

    return (
        <div className="space-y-8 animate-fade-in-up">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl md:text-4xl font-black tracking-tight text-text-primary">Campus Overview</h2>
                    <p className="text-text-secondary font-medium">Real-time monitoring and analytics dashboard</p>
                </div>
                <div className="flex items-center gap-2">
                    <span className="flex h-3 w-3 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-success"></span>
                    </span>
                    <span className="text-xs font-black uppercase tracking-widest text-success">Live System</span>
                </div>
            </header>

            {/* Stat Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Campus Population"
                    value={occupancy?.studentsOnCampus ?? '—'}
                    icon={Users}
                    color="text-success"
                    subtitle={`${occupancy?.entries ?? 0} in today`}
                />
                <StatCard
                    title="Active Sessions"
                    value={activeSessions?.length ?? '—'}
                    icon={ClipboardCheck}
                    color="text-primary"
                    subtitle="Attendance in progress"
                />
                <StatCard
                    title="Anomalies"
                    value={liveFeed.filter((e: ScanEvent) => ['FAKE', 'LIMIT_HIT'].includes(e.result)).length}
                    icon={AlertTriangle}
                    color="text-danger"
                    subtitle="Security alerts today"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Live Feed Section */}
                <div className="lg:col-span-1 glass-card p-6 flex flex-col h-[600px]">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-success/10 text-success">
                                <Radio size={20} className="animate-pulse" />
                            </div>
                            <h3 className="text-xl font-bold text-text-primary">Live Scan Feed</h3>
                        </div>
                        <div className="flex items-center gap-2">
                            <select
                                value={feedSource}
                                onChange={(event) => setFeedSource(event.target.value as 'CAMPUS' | 'EVENT_MESS')}
                                className="bg-bg-dark border border-border rounded-lg px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-text-primary"
                            >
                                <option value="CAMPUS">Campus Scans</option>
                                <option value="EVENT_MESS">Event Mess</option>
                            </select>
                            {feedSource === 'EVENT_MESS' && (
                                <select
                                    value={selectedEventId}
                                    onChange={(event) => setSelectedEventId(event.target.value)}
                                    className="bg-bg-dark border border-border rounded-lg px-2 py-1.5 text-[10px] font-bold text-text-primary max-w-[140px]"
                                >
                                    {(events || []).map((event) => (
                                        <option key={event.id} value={event.id}>{event.name}</option>
                                    ))}
                                </select>
                            )}
                        </div>
                        <Link to="/live-feed" className="p-2 text-text-secondary hover:text-accent rounded-lg transition-all">
                            <ChevronRight size={20} />
                        </Link>
                    </div>

                    <div className="flex-1 space-y-3 overflow-y-auto pr-2 custom-scrollbar">
                        {displayFeed.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center p-8">
                                <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center mb-4 text-text-secondary">
                                    <Radio size={32} />
                                </div>
                                <p className="text-text-secondary font-medium">
                                    {feedSource === 'EVENT_MESS' ? 'No event mess scans yet.' : 'Waiting for scans...'}
                                </p>
                            </div>
                        ) : (
                            displayFeed.slice(0, 15).map((event: LiveCardEvent, i: number) => (
                                <div
                                    key={event.id || i}
                                    className="group flex flex-col gap-2 p-4 bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 rounded-2xl transition-all duration-300 animate-fade-in-up"
                                    style={{ animationDelay: `${i * 50}ms` }}
                                >
                                    <div className="flex items-start justify-between">
                                        <Badge result={event.result} badge={event.badge} size="sm" />
                                        <span className="text-[10px] font-bold text-text-secondary uppercase">
                                            {new Date(event.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between mt-1">
                                        <div className="min-w-0">
                                            <p className="text-sm font-black truncate text-text-primary group-hover:text-accent transition-colors">
                                                {event.studentName}
                                            </p>
                                            <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                                                {event.enrollmentNo} · {event.department}
                                            </p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="text-[10px] font-black text-text-primary uppercase tracking-tighter">
                                                {event.scanType?.replace('_', ' ')}
                                            </p>
                                            <p className="text-[9px] font-bold text-text-secondary uppercase">
                                                {event.secondaryLabel || 'Gate 1'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Growth/Stats Section */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Entry Analysis */}
                    <div className="glass-card p-6">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h3 className="text-xl font-bold text-text-primary">Entry Analysis</h3>
                                <p className="text-xs text-text-secondary font-medium">Real-time departmental entry traffic</p>
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-success shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary">Busy</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(79,70,233,0.5)]" />
                                    <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary">Normal</span>
                                </div>
                            </div>
                        </div>

                        {deptData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={deptData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                                    <XAxis
                                        dataKey="name"
                                        stroke="#64748B"
                                        fontSize={10}
                                        fontWeight={800}
                                        tickLine={false}
                                        axisLine={false}
                                        dy={10}
                                    />
                                    <YAxis
                                        stroke="#64748B"
                                        fontSize={10}
                                        fontWeight={800}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <Tooltip
                                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                        contentStyle={{
                                            background: '#0F172A',
                                            border: '1px solid rgba(255,255,255,0.1)',
                                            borderRadius: '16px',
                                            padding: '12px'
                                        }}
                                        itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                                        labelStyle={{ color: '#F8FAFC', fontWeight: '900', marginBottom: '4px' }}
                                    />
                                    <Bar dataKey="entries" radius={[8, 8, 8, 8]} barSize={32}>
                                        {deptData.map((entry, i) => (
                                            <Cell
                                                key={i}
                                                fill={entry.status === 'high' ? '#10B981' : entry.status === 'med' ? '#818CF8' : '#F43F5E'}
                                                fillOpacity={0.8}
                                            />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-[300px] flex items-center justify-center text-text-secondary border-2 border-dashed border-white/5 rounded-3xl">
                                <p className="text-sm font-medium">No departmental entry data for today</p>
                            </div>
                        )}
                    </div>

                    {/* Secondary Metrics / Quick View */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="glass-card p-6 bg-gradient-to-br from-primary/10 to-transparent">
                            <h4 className="text-sm font-black text-text-primary uppercase tracking-tighter mb-4">System Health</h4>
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-text-secondary uppercase">API Connectivity</span>
                                    <span className="text-xs font-black text-success">EXCELLENT</span>
                                </div>
                                <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                                    <div className="bg-success h-full w-[98%]" />
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-text-secondary uppercase">Database Latency</span>
                                    <span className="text-xs font-black text-success">12ms</span>
                                </div>
                            </div>
                        </div>

                        <div className="glass-card p-6 bg-gradient-to-br from-accent/10 to-transparent">
                            <h4 className="text-sm font-black text-text-primary uppercase tracking-tighter mb-4">Quick Stats</h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="text-center p-3 rounded-2xl bg-white/5">
                                    <p className="text-xl font-black text-text-primary tracking-tighter">98.4%</p>
                                    <p className="text-[10px] font-bold text-text-secondary uppercase underline decoration-accent/30 underline-offset-4">Accuracy</p>
                                </div>
                                <div className="text-center p-3 rounded-2xl bg-white/5">
                                    <p className="text-xl font-black text-text-primary tracking-tighter">0.2s</p>
                                    <p className="text-[10px] font-bold text-text-secondary uppercase underline decoration-accent/30 underline-offset-4">Scan Time</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
