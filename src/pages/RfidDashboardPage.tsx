import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import api from '../api/axios'
import {
    Cpu, CreditCard, Wifi, Activity, CheckCircle2, XCircle,
    ArrowRight, Radio, ShieldCheck, ExternalLink
} from 'lucide-react'
import { useSocketStore } from '../store/socketStore'
import { useRfidSocket } from '../hooks/useRfidSocket'
import Badge from '../components/ui/Badge'
import toast from 'react-hot-toast'

export default function RfidDashboardPage() {
    useRfidSocket()
    const { rfidFeed, connected } = useSocketStore()

    const { data: statsData, isLoading } = useQuery({
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
                                        <Badge variant={evt.accessResult === 'GRANTED' || evt.result === 'VERIFIED' ? 'success' : 'danger'}>
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

            {/* Re-entry Cooldown & Anti-Passback Security Controls */}
            <CooldownSettingsPanel />
        </div>
    )
}

function CooldownSettingsPanel() {
    const queryClient = useQueryClient()
    const [overrideRoll, setOverrideRoll] = useState('')
    const [overrideReason, setOverrideReason] = useState('')

    const { data: cooldownData, isLoading } = useQuery({
        queryKey: ['rfid-cooldown-settings'],
        queryFn: () => api.get('/rfid/cooldown/settings').then(res => res.data.settings),
    })

    const [formState, setFormState] = useState<any>(null)

    const activeSettings = formState || cooldownData || {
        reentryCooldownSeconds: 120,
        stayCooldownSeconds: 60,
        tapDebounceSeconds: 5,
        antiPassbackMode: 'TIMED',
        dayScholarExempt: true,
    }

    const updateMutation = useMutation({
        mutationFn: (payload: any) => api.put('/rfid/cooldown/settings', payload),
        onSuccess: () => {
            toast.success('Cooldown & Anti-Passback settings updated!')
            queryClient.invalidateQueries({ queryKey: ['rfid-cooldown-settings'] })
            setFormState(null)
        },
        onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to update cooldown settings'),
    })

    const overrideMutation = useMutation({
        mutationFn: (payload: any) => api.post('/rfid/cooldown/override', payload),
        onSuccess: () => {
            toast.success(`15-min cooldown override granted for student!`)
            setOverrideRoll('')
            setOverrideReason('')
        },
        onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to grant cooldown override'),
    })

    const handleSave = () => {
        updateMutation.mutate({
            reentryCooldownSeconds: Number(activeSettings.reentryCooldownSeconds),
            stayCooldownSeconds: Number(activeSettings.stayCooldownSeconds),
            tapDebounceSeconds: Number(activeSettings.tapDebounceSeconds),
            antiPassbackMode: activeSettings.antiPassbackMode,
            dayScholarExempt: Boolean(activeSettings.dayScholarExempt),
        })
    }

    const handleOverrideSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!overrideRoll.trim()) return toast.error('Enter student Roll Number or ID')
        try {
            // Find student by enrollmentNo
            const studentRes = await api.get('/students', { params: { search: overrideRoll.trim(), limit: 1 } })
            const students = studentRes.data.data?.students || studentRes.data.students || []
            if (students.length === 0) return toast.error('Student not found')
            
            overrideMutation.mutate({
                studentId: students[0].id,
                reason: overrideReason || 'Manual Security Guard Bypass',
            })
        } catch {
            toast.error('Could not find student')
        }
    }

    if (isLoading) return null

    return (
        <div className="rounded-2xl bg-bg-card border border-border p-6 shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500">
                        <ShieldCheck size={20} />
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-text-primary">Re-entry Cooldown & Anti-Passback Settings</h2>
                        <p className="text-xs text-text-muted">Enforce minimum stay durations, prevent credential sharing, and configure rapid tap suppression</p>
                    </div>
                </div>
                <button
                    onClick={handleSave}
                    disabled={updateMutation.isPending}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-white hover:bg-primary-hover shadow-sm transition-colors self-start sm:self-auto disabled:opacity-50"
                >
                    {updateMutation.isPending ? 'Saving...' : 'Save Cooldown Rules'}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Re-entry Cooldown Window */}
                <div className="p-4 rounded-xl bg-bg-subtle border border-border space-y-2">
                    <label className="text-xs font-bold text-text-primary flex items-center justify-between">
                        <span>Re-entry Cooldown (After Exit)</span>
                        <span className="font-mono text-primary font-bold">{activeSettings.reentryCooldownSeconds}s ({Math.round(activeSettings.reentryCooldownSeconds / 60)} min)</span>
                    </label>
                    <input
                        type="range"
                        min="0"
                        max="1800"
                        step="15"
                        value={activeSettings.reentryCooldownSeconds}
                        onChange={(e) => setFormState({ ...activeSettings, reentryCooldownSeconds: Number(e.target.value) })}
                        className="w-full accent-primary"
                    />
                    <p className="text-[11px] text-text-muted">Minimum seconds a student must wait after EXIT before they can RE-ENTER campus.</p>
                </div>

                {/* Minimum Stay Cooldown */}
                <div className="p-4 rounded-xl bg-bg-subtle border border-border space-y-2">
                    <label className="text-xs font-bold text-text-primary flex items-center justify-between">
                        <span>Minimum Campus Stay Cooldown</span>
                        <span className="font-mono text-primary font-bold">{activeSettings.stayCooldownSeconds}s</span>
                    </label>
                    <input
                        type="range"
                        min="0"
                        max="600"
                        step="10"
                        value={activeSettings.stayCooldownSeconds}
                        onChange={(e) => setFormState({ ...activeSettings, stayCooldownSeconds: Number(e.target.value) })}
                        className="w-full accent-primary"
                    />
                    <p className="text-[11px] text-text-muted">Minimum seconds a student must stay inside after ENTRY before allowed to EXIT.</p>
                </div>

                {/* Anti-Passback Mode */}
                <div className="p-4 rounded-xl bg-bg-subtle border border-border space-y-2">
                    <label className="text-xs font-bold text-text-primary">Anti-Passback (APB) Mode</label>
                    <select
                        value={activeSettings.antiPassbackMode}
                        onChange={(e) => setFormState({ ...activeSettings, antiPassbackMode: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl bg-bg-card border border-border text-xs text-text-primary focus:outline-none focus:border-primary"
                    >
                        <option value="TIMED">TIMED (Cooldown Window Based)</option>
                        <option value="STRICT">STRICT (Requires Alternating ENTRY/EXIT)</option>
                        <option value="DISABLED">DISABLED (Open Taps)</option>
                    </select>
                    <p className="text-[11px] text-text-muted">Strict mode prevents double entries without an intervening exit.</p>
                </div>
            </div>

            {/* Emergency 15-Minute Cooldown Bypass Form */}
            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h3 className="text-xs font-bold text-text-primary flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500" />
                        Emergency Student Cooldown Bypass (15-Min Window)
                    </h3>
                    <p className="text-[11px] text-text-muted mt-0.5">Allows security guards / wardens to instantly clear a cooldown for a specific student</p>
                </div>
                <form onSubmit={handleOverrideSubmit} className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                    <input
                        type="text"
                        placeholder="Enrollment / Roll No"
                        value={overrideRoll}
                        onChange={(e) => setOverrideRoll(e.target.value)}
                        className="px-3 py-1.5 rounded-xl bg-bg-card border border-border text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary"
                    />
                    <input
                        type="text"
                        placeholder="Reason (optional)"
                        value={overrideReason}
                        onChange={(e) => setOverrideReason(e.target.value)}
                        className="px-3 py-1.5 rounded-xl bg-bg-card border border-border text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary"
                    />
                    <button
                        type="submit"
                        disabled={overrideMutation.isPending}
                        className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-amber-500 text-white hover:bg-amber-600 shadow-sm transition-colors disabled:opacity-50"
                    >
                        {overrideMutation.isPending ? 'Applying...' : 'Grant Bypass'}
                    </button>
                </form>
            </div>
        </div>
    )
}

