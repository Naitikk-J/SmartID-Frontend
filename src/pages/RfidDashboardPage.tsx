import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import api from '../api/axios'
import {
    Cpu, CreditCard, Wifi, Activity, CheckCircle2, XCircle, AlertTriangle,
    ArrowRight, Radio, ShieldCheck, Clock, ExternalLink
} from 'lucide-react'
import { useSocketStore } from '../store/socketStore'
import { useRfidSocket } from '../hooks/useRfidSocket'
import Badge from '../components/ui/Badge'

export default function RfidDashboardPage() {
    useRfidSocket()
    const { rfidFeed, connected } = useSocketStore()

    const { data: statsData, isLoading, refetch } = useQuery({
        queryKey: ['rfid-stats'],
        queryFn: () => api.get('/rfid/stats').then(res => res.data.stats),
        refetchInterval: 10000,
    })

    const { data: readerStatusData } = useQuery({
        queryKey: ['rfid-readers-status'],
        queryFn: () => api.get('/rfid/readers/status').then(res => res.data.readers),
        refetchInterval: 15000,
    })

    const stats = statsData || {
        cards: { total: 0, active: 0, revoked: 0, expired: 0, suspended: 0 },
        readers: { active: 0, offline: 0 },
        today: { transactions: 0, granted: 0, denied: 0 },
    }

    const readers = readerStatusData || []

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-sm">
                        <Cpu size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-text-primary tracking-tight">RFID Platform Overview</h1>
                        <p className="text-xs text-text-muted">Smart contactless identity, readers & access telemetry</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${connected ? 'bg-success/10 text-success border-success/20' : 'bg-danger/10 text-danger border-danger/20'}`}>
                        <Radio size={14} className={connected ? 'animate-pulse' : ''} />
                        {connected ? 'Live Sync Active' : 'Disconnected'}
                    </div>
                    <Link
                        to="/rfid/live"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-white hover:bg-primary-hover shadow-sm transition-colors"
                    >
                        Live Monitor <ArrowRight size={14} />
                    </Link>
                </div>
            </div>

            {/* Top Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Active Cards */}
                <div className="p-5 rounded-2xl bg-bg-card border border-border flex flex-col justify-between shadow-xs">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Active Cards</span>
                        <div className="p-2 rounded-xl bg-primary/10 text-primary">
                            <CreditCard size={18} />
                        </div>
                    </div>
                    <div className="mt-4 flex items-baseline gap-2">
                        <span className="text-3xl font-extrabold text-text-primary">
                            {isLoading ? '...' : stats.cards.active}
                        </span>
                        <span className="text-xs text-text-muted">/ {stats.cards.total} total</span>
                    </div>
                    <div className="mt-3 flex items-center gap-3 text-xs text-text-muted">
                        <span>Revoked: {stats.cards.revoked}</span>
                        <span>•</span>
                        <span>Suspended: {stats.cards.suspended}</span>
                    </div>
                </div>

                {/* Online Readers */}
                <div className="p-5 rounded-2xl bg-bg-card border border-border flex flex-col justify-between shadow-xs">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Online Readers</span>
                        <div className="p-2 rounded-xl bg-success/10 text-success">
                            <Wifi size={18} />
                        </div>
                    </div>
                    <div className="mt-4 flex items-baseline gap-2">
                        <span className="text-3xl font-extrabold text-success">
                            {isLoading ? '...' : stats.readers.active}
                        </span>
                        <span className="text-xs text-text-muted">active devices</span>
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-xs">
                        <span className={stats.readers.offline > 0 ? 'text-danger font-medium' : 'text-text-muted'}>
                            {stats.readers.offline} offline
                        </span>
                    </div>
                </div>

                {/* Today's Taps */}
                <div className="p-5 rounded-2xl bg-bg-card border border-border flex flex-col justify-between shadow-xs">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Today's Transactions</span>
                        <div className="p-2 rounded-xl bg-accent/10 text-accent">
                            <Activity size={18} />
                        </div>
                    </div>
                    <div className="mt-4 flex items-baseline gap-2">
                        <span className="text-3xl font-extrabold text-text-primary">
                            {isLoading ? '...' : stats.today.transactions}
                        </span>
                        <span className="text-xs text-text-muted">taps recorded</span>
                    </div>
                    <div className="mt-3 flex items-center gap-3 text-xs text-text-muted">
                        <span className="text-success font-medium flex items-center gap-1"><CheckCircle2 size={12} /> {stats.today.granted}</span>
                        <span className="text-danger font-medium flex items-center gap-1"><XCircle size={12} /> {stats.today.denied}</span>
                    </div>
                </div>

                {/* System State */}
                <div className="p-5 rounded-2xl bg-bg-card border border-border flex flex-col justify-between shadow-xs">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Security State</span>
                        <div className="p-2 rounded-xl bg-primary/10 text-primary">
                            <ShieldCheck size={18} />
                        </div>
                    </div>
                    <div className="mt-4">
                        <span className="text-lg font-bold text-success flex items-center gap-1.5">
                            <CheckCircle2 size={18} /> HMAC Protected
                        </span>
                        <p className="text-xs text-text-muted mt-1">Replay protection ±30s enabled</p>
                    </div>
                    <div className="mt-3 text-xs text-text-muted">
                        Hardware: ESP32 + MFRC522
                    </div>
                </div>
            </div>

            {/* Quick Navigation Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Link
                    to="/rfid/cards"
                    className="p-5 rounded-2xl bg-bg-card border border-border hover:border-primary/40 transition-all group flex items-center justify-between"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                            <CreditCard size={20} />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-text-primary">Card Management</h3>
                            <p className="text-xs text-text-muted">Assign, revoke & replace student RFID tags</p>
                        </div>
                    </div>
                    <ArrowRight size={16} className="text-text-muted group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </Link>

                <Link
                    to="/rfid/readers"
                    className="p-5 rounded-2xl bg-bg-card border border-border hover:border-primary/40 transition-all group flex items-center justify-between"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                            <Wifi size={20} />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-text-primary">RFID Readers</h3>
                            <p className="text-xs text-text-muted">Configure gates, heartbeat & zone routing</p>
                        </div>
                    </div>
                    <ArrowRight size={16} className="text-text-muted group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </Link>

                <Link
                    to="/rfid/transactions"
                    className="p-5 rounded-2xl bg-bg-card border border-border hover:border-primary/40 transition-all group flex items-center justify-between"
                >
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-105 transition-transform">
                            <Activity size={20} />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-text-primary">Transaction Logs</h3>
                            <p className="text-xs text-text-muted">Audit trail with timestamp & zone filtering</p>
                        </div>
                    </div>
                    <ArrowRight size={16} className="text-text-muted group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </Link>
            </div>

            {/* Bottom Grid: Live Activity Feed + Reader Map */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Live Feed (2 cols) */}
                <div className="lg:col-span-2 rounded-2xl bg-bg-card border border-border p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Activity size={18} className="text-primary" />
                            <h2 className="text-base font-bold text-text-primary">Recent RFID Activity</h2>
                        </div>
                        <Link to="/rfid/live" className="text-xs text-primary hover:underline flex items-center gap-1 font-medium">
                            Full Monitor <ExternalLink size={12} />
                        </Link>
                    </div>

                    {rfidFeed.length === 0 ? (
                        <div className="text-center py-12 text-text-muted">
                            <Cpu size={32} className="mx-auto text-text-muted/50 mb-2" />
                            <p className="text-sm">No live taps received in this session</p>
                            <p className="text-xs mt-1">Tap an RFID card on any connected ESP32 reader</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border/50 max-h-80 overflow-y-auto custom-scrollbar">
                            {rfidFeed.slice(0, 8).map((evt) => (
                                <div key={evt.id} className="py-3 flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${evt.accessResult === 'GRANTED' || evt.result === 'VERIFIED' ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}`}>
                                            {evt.accessResult === 'GRANTED' || evt.result === 'VERIFIED' ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-text-primary truncate">{evt.studentName || evt.cardUid || 'Unknown'}</p>
                                            <p className="text-xs text-text-muted truncate">{evt.enrollmentNo} • {evt.readerName || evt.readerId || 'Reader'}</p>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <Badge variant={evt.accessResult === 'GRANTED' ? 'success' : 'danger'}>
                                            {evt.accessResult || evt.result || 'TAP'}
                                        </Badge>
                                        <p className="text-[10px] text-text-muted mt-1">{new Date(evt.time).toLocaleTimeString()}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Reader Status List (1 col) */}
                <div className="rounded-2xl bg-bg-card border border-border p-6 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Wifi size={18} className="text-primary" />
                            <h2 className="text-base font-bold text-text-primary">Reader Health</h2>
                        </div>
                        <Link to="/rfid/readers" className="text-xs text-primary hover:underline">
                            Manage
                        </Link>
                    </div>

                    {readers.length === 0 ? (
                        <p className="text-xs text-text-muted py-6 text-center">No readers registered yet.</p>
                    ) : (
                        <div className="space-y-2.5">
                            {readers.map((r: any) => (
                                <div key={r.id} className="p-3 rounded-xl bg-bg-subtle border border-border flex items-center justify-between">
                                    <div className="flex items-center gap-2.5">
                                        <span className={`w-2.5 h-2.5 rounded-full ${r.isOnline ? 'bg-success animate-pulse' : 'bg-danger'}`} />
                                        <div>
                                            <p className="text-xs font-semibold text-text-primary">{r.deviceName}</p>
                                            <p className="text-[10px] text-text-muted">{r.zone || r.location || r.readerId}</p>
                                        </div>
                                    </div>
                                    <span className={`text-[10px] font-bold uppercase tracking-wider ${r.isOnline ? 'text-success' : 'text-danger'}`}>
                                        {r.isOnline ? 'Online' : 'Offline'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
