import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../api/axios'
import {
    Monitor, Radio, CheckCircle2, XCircle, Wifi, ShieldAlert,
    Trash2, Pause, Play, Volume2, VolumeX, Activity, ArrowDown
} from 'lucide-react'
import { useSocketStore } from '../store/socketStore'
import { useRfidSocket } from '../hooks/useRfidSocket'
import Badge from '../components/ui/Badge'

export default function RfidLiveMonitorPage() {
    useRfidSocket()
    const { rfidFeed, clearRfidFeed, connected, readerStatuses } = useSocketStore()
    const [isPaused, setIsPaused] = useState(false)
    const [frozenFeed, setFrozenFeed] = useState<any[]>([])
    const [soundEnabled, setSoundEnabled] = useState(true)

    // Initial readers list
    const { data: initialReaders = [] } = useQuery({
        queryKey: ['rfid-readers-live-mon'],
        queryFn: () => api.get('/rfid/readers/status').then(res => res.data.readers),
        refetchInterval: 15000,
    })

    const displayEvents = isPaused ? frozenFeed : rfidFeed

    const handlePauseToggle = () => {
        if (!isPaused) {
            setFrozenFeed([...rfidFeed])
        }
        setIsPaused(!isPaused)
    }

    // Play tone on event if sound enabled
    useEffect(() => {
        if (!soundEnabled || rfidFeed.length === 0) return
        const latest = rfidFeed[0]
        try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.connect(gain)
            gain.connect(ctx.destination)

            if (latest.accessResult === 'GRANTED' || latest.result === 'VERIFIED') {
                osc.frequency.setValueAtTime(880, ctx.currentTime) // High pitch
                gain.gain.setValueAtTime(0.08, ctx.currentTime)
                osc.start()
                osc.stop(ctx.currentTime + 0.15)
            } else {
                osc.frequency.setValueAtTime(220, ctx.currentTime) // Low buzz
                gain.gain.setValueAtTime(0.12, ctx.currentTime)
                osc.start()
                osc.stop(ctx.currentTime + 0.3)
            }
        } catch (e) {
            // Audio context blocked
        }
    }, [rfidFeed, soundEnabled])

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-sm">
                        <Monitor size={24} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-bold text-text-primary tracking-tight">Real-Time RFID Monitor</h1>
                            <div className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${connected ? 'bg-success/10 text-success border-success/30 animate-pulse' : 'bg-danger/10 text-danger border-danger/30'}`}>
                                {connected ? 'STREAM LIVE' : 'OFFLINE'}
                            </div>
                        </div>
                        <p className="text-xs text-text-muted">Instant event stream from all connected campus access points</p>
                    </div>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setSoundEnabled(!soundEnabled)}
                        className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors ${soundEnabled ? 'bg-primary/10 text-primary border-primary/30' : 'border-border text-text-muted hover:bg-bg-subtle'}`}
                        title={soundEnabled ? 'Mute Audio Tone' : 'Enable Audio Tone'}
                    >
                        {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                    </button>
                    <button
                        onClick={handlePauseToggle}
                        className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-colors ${isPaused ? 'bg-warning/10 text-warning border-warning/30' : 'border-border text-text-secondary hover:bg-bg-subtle'}`}
                    >
                        {isPaused ? <Play size={15} /> : <Pause size={15} />}
                        {isPaused ? 'Resume Stream' : 'Pause Stream'}
                    </button>
                    <button
                        onClick={clearRfidFeed}
                        className="px-3 py-2 rounded-xl border border-border text-xs font-semibold text-text-secondary hover:text-danger hover:bg-danger/10 transition-colors flex items-center gap-1.5"
                    >
                        <Trash2 size={15} /> Clear
                    </button>
                </div>
            </div>

            {/* Layout: Main Feed (3 cols) + Readers Status (1 col) */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Main Live Feed */}
                <div className="lg:col-span-3 space-y-3">
                    <div className="p-4 rounded-2xl bg-bg-card border border-border flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Activity size={16} className="text-primary animate-pulse" />
                            <span className="text-xs font-bold text-text-primary uppercase tracking-wider">Live Tap Stream</span>
                        </div>
                        <span className="text-xs text-text-muted font-mono">{displayEvents.length} events buffered</span>
                    </div>

                    {displayEvents.length === 0 ? (
                        <div className="rounded-2xl bg-bg-card border border-border p-16 text-center text-text-muted space-y-3">
                            <Radio size={48} className={`mx-auto ${connected ? 'text-primary/60 animate-pulse' : 'text-text-muted/40'}`} />
                            <h3 className="text-base font-bold text-text-primary">Awaiting RFID Card Taps</h3>
                            <p className="text-xs max-w-sm mx-auto text-text-muted">
                                When a student taps their MIFARE card on any connected ESP32 terminal, the telemetry event will appear here in under 200ms.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2.5 max-h-[650px] overflow-y-auto custom-scrollbar pr-1">
                            {displayEvents.map((evt, idx) => {
                                const isGranted = evt.accessResult === 'GRANTED' || evt.result === 'VERIFIED'
                                return (
                                    <div
                                        key={evt.id || idx}
                                        className={`p-4 rounded-2xl border transition-all duration-300 flex items-center justify-between gap-4 ${
                                            isGranted
                                                ? 'bg-success/5 border-success/20 hover:border-success/40'
                                                : 'bg-danger/5 border-danger/20 hover:border-danger/40'
                                        } ${idx === 0 ? 'scale-[1.01] shadow-sm' : ''}`}
                                    >
                                        <div className="flex items-center gap-3.5 min-w-0">
                                            <div
                                                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                                    isGranted ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'
                                                }`}
                                            >
                                                {isGranted ? <CheckCircle2 size={22} /> : <XCircle size={22} />}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-bold text-text-primary truncate">
                                                        {evt.studentName || evt.cardUid || 'Unknown Card'}
                                                    </p>
                                                    <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-bg-card border border-border text-text-muted">
                                                        {evt.cardUid}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-text-muted truncate">
                                                    {evt.enrollmentNo && `${evt.enrollmentNo} • `}
                                                    {evt.department && `${evt.department} • `}
                                                    <span className="font-semibold text-text-secondary">{evt.readerName || evt.readerId || 'Gate Reader'}</span>
                                                    {evt.zone && ` (${evt.zone})`}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="text-right shrink-0 flex flex-col items-end gap-1">
                                            <Badge variant={isGranted ? 'success' : 'danger'}>
                                                {isGranted ? (evt.eventType || 'ACCESS GRANTED') : (evt.denialReason || 'ACCESS DENIED')}
                                            </Badge>
                                            <span className="text-[11px] text-text-muted font-mono">
                                                {new Date(evt.time).toLocaleTimeString()}
                                            </span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Right Sidebar: Active Readers Health */}
                <div className="space-y-4">
                    <div className="p-4 rounded-2xl bg-bg-card border border-border">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <Wifi size={16} className="text-primary" />
                                <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">Gate Terminals</h3>
                            </div>
                        </div>

                        <div className="space-y-2 max-h-[580px] overflow-y-auto custom-scrollbar">
                            {initialReaders.map((r: any) => {
                                const liveState = readerStatuses[r.readerId]
                                const isOnline = liveState ? liveState.isOnline : r.isOnline

                                return (
                                    <div
                                        key={r.id}
                                        className="p-3 rounded-xl bg-bg-subtle border border-border space-y-1.5"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className={`w-2.5 h-2.5 rounded-full ${isOnline ? 'bg-success animate-pulse' : 'bg-danger'}`} />
                                                <span className="text-xs font-bold text-text-primary truncate">{r.deviceName}</span>
                                            </div>
                                            <span className={`text-[9px] font-extrabold uppercase tracking-wider ${isOnline ? 'text-success' : 'text-danger'}`}>
                                                {isOnline ? 'Online' : 'Offline'}
                                            </span>
                                        </div>
                                        <div className="text-[10px] text-text-muted flex justify-between">
                                            <span>Zone: {r.zone || 'None'}</span>
                                            <span className="font-mono">{r.readerId}</span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
