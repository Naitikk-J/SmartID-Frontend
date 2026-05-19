import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import api from '../api/axios'
import StatCard from '../components/ui/StatCard'
import Badge from '../components/ui/Badge'
import { Users, ClipboardCheck, AlertTriangle, Radio, ChevronRight, Activity, Gauge } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { ScanEvent } from '../store/socketStore'
import { Link } from 'react-router-dom'
import { useThemeStore } from '../store/themeStore'

type EventLite = { id: string; name: string }
type LiveCardEvent = ScanEvent & { secondaryLabel?: string }

export default function DashboardPage() {
    const [feedSource, setFeedSource] = useState<'CAMPUS' | 'EVENT_MESS'>('CAMPUS')
    const [selectedEventId, setSelectedEventId] = useState<string>('')
    const isDark = useThemeStore((s) => s.resolved === 'dark')

    // ── Data ─────────────────────────────────────────────────
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
            params: { date: new Date().toISOString().slice(0, 10), limit: 30 },
        }).then((r) => r.data.data),
        refetchInterval: 7000,
    })

    useEffect(() => {
        if (!events?.length) return
        if (!selectedEventId) { setSelectedEventId(events[0].id); return }
        if (!events.some((e) => e.id === selectedEventId)) setSelectedEventId(events[0].id)
    }, [events, selectedEventId])

    // ── Derived ──────────────────────────────────────────────
    const liveFeed: ScanEvent[] = polledFeed?.events || []
    const campusFeed: LiveCardEvent[] = liveFeed.map((e) => ({
        ...e,
        secondaryLabel: `Gate ${e.gateId?.toString().slice(-1) || '1'}`,
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
            status: count >= 50 ? 'high' : count >= 20 ? 'med' : 'low',
        }))
        : []

    // ── Chart theme tokens (refresh on theme change) ────────
    const axisColor = isDark ? '#71717A' : '#71717A'
    const tooltipBg = isDark ? '#18181B' : '#FFFFFF'
    const tooltipBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(24,24,27,0.10)'
    const labelColor = isDark ? '#FAFAFA' : '#18181B'

    return (
        <div className="space-y-6 animate-fade-in-up">
            {/* ── Page header ──────────────────────────────── */}
            <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-text-muted">Live</p>
                    <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-text-primary mt-1">
                        Campus overview
                    </h2>
                    <p className="text-text-secondary text-sm mt-1">
                        Real-time scans, attendance, and gate activity at a glance.
                    </p>
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-bg-card">
                    <span className="relative flex h-2.5 w-2.5">
                        <span className="absolute inset-0 rounded-full bg-success/40 animate-ping" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success" />
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                        Live system
                    </span>
                </div>
            </header>

            {/* ── KPI row ──────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="On Campus"
                    value={occupancy?.studentsOnCampus ?? '—'}
                    icon={Users}
                    color="text-success"
                    subtitle={`${occupancy?.entries ?? 0} entries today`}
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
                    subtitle="Flagged today"
                />
                <StatCard
                    title="Scan Health"
                    value="98.4%"
                    icon={Gauge}
                    color="text-accent"
                    subtitle="Successful verifications"
                />
            </div>

            {/* ── Live feed + analytics ───────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Live feed card */}
                <section className="lg:col-span-1 glass-card p-5 flex flex-col h-[600px]">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-lg bg-[color-mix(in_oklab,var(--color-success)_14%,transparent)] text-success">
                                <Radio size={16} />
                            </div>
                            <div>
                                <h3 className="text-sm font-semibold text-text-primary">Live Feed</h3>
                                <p className="text-[11px] text-text-muted">{displayFeed.length} recent</p>
                            </div>
                        </div>
                        <Link
                            to="/live-feed"
                            className="text-text-muted hover:text-text-primary inline-flex items-center text-xs font-medium gap-0.5 transition-colors"
                        >
                            View all <ChevronRight size={14} />
                        </Link>
                    </div>

                    <div className="flex items-center gap-2 mb-3">
                        <select
                            value={feedSource}
                            onChange={(e) => setFeedSource(e.target.value as 'CAMPUS' | 'EVENT_MESS')}
                            className="input-premium py-1.5 text-xs flex-1"
                        >
                            <option value="CAMPUS">Campus Scans</option>
                            <option value="EVENT_MESS">Event Mess</option>
                        </select>
                        {feedSource === 'EVENT_MESS' && (
                            <select
                                value={selectedEventId}
                                onChange={(e) => setSelectedEventId(e.target.value)}
                                className="input-premium py-1.5 text-xs flex-1"
                            >
                                {(events || []).map((event) => (
                                    <option key={event.id} value={event.id}>{event.name}</option>
                                ))}
                            </select>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar -mr-1">
                        {displayFeed.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-center px-6">
                                <div className="w-12 h-12 rounded-full bg-bg-subtle text-text-muted flex items-center justify-center mb-3">
                                    <Activity size={20} />
                                </div>
                                <p className="text-sm font-medium text-text-secondary">
                                    {feedSource === 'EVENT_MESS' ? 'No event mess scans yet.' : 'Waiting for scans…'}
                                </p>
                                <p className="text-xs text-text-muted mt-1">New events appear here in real time.</p>
                            </div>
                        ) : (
                            <ul className="space-y-2">
                                {displayFeed.slice(0, 15).map((event, i) => (
                                    <li
                                        key={event.id || i}
                                        className="group p-3 rounded-xl bg-bg-subtle/60 hover:bg-bg-subtle border border-transparent hover:border-border transition-colors"
                                    >
                                        <div className="flex items-center justify-between mb-1.5">
                                            <Badge result={event.result} badge={event.badge} size="sm" />
                                            <span className="text-[10px] tabular-nums font-semibold text-text-muted">
                                                {new Date(event.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold truncate text-text-primary">
                                                    {event.studentName}
                                                </p>
                                                <p className="text-[11px] text-text-muted truncate">
                                                    {event.enrollmentNo} · {event.department}
                                                </p>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide">
                                                    {event.scanType?.replace('_', ' ')}
                                                </p>
                                                <p className="text-[10px] text-text-muted">
                                                    {event.secondaryLabel || 'Gate 1'}
                                                </p>
                                            </div>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </section>

                {/* Analytics column */}
                <div className="lg:col-span-2 space-y-6">
                    <section className="glass-card p-5">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-sm font-semibold text-text-primary">Entry by Department</h3>
                                <p className="text-xs text-text-muted mt-0.5">Real-time entry volume across departments</p>
                            </div>
                            <div className="hidden sm:flex items-center gap-3 text-[11px] text-text-secondary">
                                <span className="inline-flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-success" /> Busy
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-primary" /> Normal
                                </span>
                                <span className="inline-flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-danger" /> Quiet
                                </span>
                            </div>
                        </div>

                        {deptData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={deptData} margin={{ top: 0, right: 8, left: -16, bottom: 0 }}>
                                    <XAxis
                                        dataKey="name"
                                        stroke={axisColor}
                                        fontSize={11}
                                        fontWeight={500}
                                        tickLine={false}
                                        axisLine={false}
                                        dy={8}
                                    />
                                    <YAxis
                                        stroke={axisColor}
                                        fontSize={11}
                                        fontWeight={500}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <Tooltip
                                        cursor={{ fill: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(24,24,27,0.04)' }}
                                        contentStyle={{
                                            background: tooltipBg,
                                            border: `1px solid ${tooltipBorder}`,
                                            borderRadius: '12px',
                                            padding: '10px 12px',
                                            boxShadow: '0 8px 24px -8px rgba(0,0,0,0.18)',
                                        }}
                                        itemStyle={{ fontSize: '12px', fontWeight: 500, color: labelColor }}
                                        labelStyle={{ color: labelColor, fontWeight: 600, marginBottom: '4px', fontSize: '12px' }}
                                    />
                                    <Bar dataKey="entries" radius={[6, 6, 6, 6]} barSize={28}>
                                        {deptData.map((entry, i) => (
                                            <Cell
                                                key={i}
                                                fill={
                                                    entry.status === 'high' ? 'var(--color-success)'
                                                        : entry.status === 'med' ? 'var(--color-primary)'
                                                            : 'var(--color-danger)'
                                                }
                                            />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-[280px] flex items-center justify-center text-text-muted border border-dashed border-border rounded-xl">
                                <p className="text-sm">No departmental entry data for today</p>
                            </div>
                        )}
                    </section>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <section className="glass-card p-5">
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="text-sm font-semibold text-text-primary">System Health</h4>
                                <span className="chip">All green</span>
                            </div>
                            <ul className="space-y-3 text-sm">
                                <li>
                                    <div className="flex items-center justify-between text-xs mb-1.5">
                                        <span className="text-text-secondary">API connectivity</span>
                                        <span className="font-semibold text-success tabular-nums">98%</span>
                                    </div>
                                    <div className="h-1.5 bg-bg-subtle rounded-full overflow-hidden">
                                        <div className="h-full bg-success rounded-full" style={{ width: '98%' }} />
                                    </div>
                                </li>
                                <li>
                                    <div className="flex items-center justify-between text-xs mb-1.5">
                                        <span className="text-text-secondary">DB latency</span>
                                        <span className="font-semibold text-success tabular-nums">12 ms</span>
                                    </div>
                                    <div className="h-1.5 bg-bg-subtle rounded-full overflow-hidden">
                                        <div className="h-full bg-success rounded-full" style={{ width: '92%' }} />
                                    </div>
                                </li>
                                <li>
                                    <div className="flex items-center justify-between text-xs mb-1.5">
                                        <span className="text-text-secondary">Redis</span>
                                        <span className="font-semibold text-success">Healthy</span>
                                    </div>
                                    <div className="h-1.5 bg-bg-subtle rounded-full overflow-hidden">
                                        <div className="h-full bg-success rounded-full" style={{ width: '100%' }} />
                                    </div>
                                </li>
                            </ul>
                        </section>

                        <section className="glass-card p-5">
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="text-sm font-semibold text-text-primary">Quick Stats</h4>
                                <span className="chip">Last 24h</span>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="rounded-xl bg-bg-subtle border border-border p-3">
                                    <p className="text-[10px] uppercase tracking-wider text-text-muted">Accuracy</p>
                                    <p className="mt-1 text-xl font-bold tracking-tight text-text-primary tabular-nums">98.4%</p>
                                </div>
                                <div className="rounded-xl bg-bg-subtle border border-border p-3">
                                    <p className="text-[10px] uppercase tracking-wider text-text-muted">Scan time</p>
                                    <p className="mt-1 text-xl font-bold tracking-tight text-text-primary tabular-nums">0.2s</p>
                                </div>
                                <div className="rounded-xl bg-bg-subtle border border-border p-3">
                                    <p className="text-[10px] uppercase tracking-wider text-text-muted">Active gates</p>
                                    <p className="mt-1 text-xl font-bold tracking-tight text-text-primary tabular-nums">6</p>
                                </div>
                                <div className="rounded-xl bg-bg-subtle border border-border p-3">
                                    <p className="text-[10px] uppercase tracking-wider text-text-muted">Events live</p>
                                    <p className="mt-1 text-xl font-bold tracking-tight text-text-primary tabular-nums">
                                        {events?.length ?? 0}
                                    </p>
                                </div>
                            </div>
                        </section>
                    </div>
                </div>
            </div>
        </div>
    )
}
