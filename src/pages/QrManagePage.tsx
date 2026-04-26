import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { QRCodeSVG } from 'qrcode.react'
import toast from 'react-hot-toast'
import api from '../api/axios'
import {
    QrCode, RefreshCw, Maximize2, Timer, MapPin, Copy,
    Zap, Lock, Settings2, Radio, Download, Plus, Pencil, Check, X
} from 'lucide-react'

type Gate = { id: string; name: string; hasGeofence?: boolean }
type EventItem = { id: string; name: string; isActive: boolean }
type QrSource = 'GATE' | 'EVENT'
type QrMode = 'DYNAMIC' | 'STATIC'
type EventQrKind = 'STAY' | 'MESS'

export default function QrManagePage() {
    const queryClient = useQueryClient()
    const qrContainerRef = useRef<HTMLDivElement | null>(null)

    const [qrSource, setQrSource] = useState<QrSource>('GATE')
    const [selectedGateId, setSelectedGateId] = useState('')
    const [selectedEventId, setSelectedEventId] = useState('')
    const [eventQrKind, setEventQrKind] = useState<EventQrKind>('STAY')
    const [qrMode, setQrMode] = useState<QrMode>('DYNAMIC')
    const [customTtl, setCustomTtl] = useState(20)
    const [countdown, setCountdown] = useState(0)
    const [staticToken, setStaticToken] = useState('')

    // Gate management state
    const [newGateName, setNewGateName] = useState('')
    const [showCreateGate, setShowCreateGate] = useState(false)
    const [renamingGateId, setRenamingGateId] = useState<string | null>(null)
    const [renameValue, setRenameValue] = useState('')

    const { data: gates = [], isLoading: isLoadingGates } = useQuery({
        queryKey: ['qr-manage-gates'],
        queryFn: async () => {
            const res = await api.get('/access/gates')
            return (res.data?.data?.gates || []) as Gate[]
        },
    })

    const { data: events = [], isLoading: isLoadingEvents } = useQuery({
        queryKey: ['qr-manage-events'],
        queryFn: async () => {
            const res = await api.get('/events')
            return (res.data?.data?.events || []) as EventItem[]
        },
    })

    const activeEvents = useMemo(() => events.filter(e => e.isActive), [events])
    const displayEvents = useMemo(() => activeEvents.length > 0 ? activeEvents : events, [activeEvents, events])

    useEffect(() => {
        if (!selectedGateId && gates.length > 0) setSelectedGateId(gates[0].id)
    }, [gates, selectedGateId])

    useEffect(() => {
        if (!selectedEventId && displayEvents.length > 0) setSelectedEventId(displayEvents[0].id)
    }, [displayEvents, selectedEventId])

    const selectedGate = useMemo(() => gates.find(g => g.id === selectedGateId), [gates, selectedGateId])
    const selectedEvent = useMemo(() => events.find(e => e.id === selectedEventId), [events, selectedEventId])

    const isDynamic = qrMode === 'DYNAMIC'
    const isGateMode = qrSource === 'GATE'

    const queryEnabled = isDynamic && (isGateMode ? Boolean(selectedGateId) : Boolean(selectedEventId))

    const { data: dynamicQr, isLoading: isQrLoading, refetch: refetchQr } = useQuery({
        queryKey: ['qr-manage-live', qrSource, selectedGateId, selectedEventId, eventQrKind],
        enabled: queryEnabled,
        refetchInterval: isDynamic ? customTtl * 1000 : false,
        queryFn: async () => {
            if (isGateMode) {
                const res = await api.get('/qr/generate', { params: { gate_id: selectedGateId } })
                return { token: String(res.data?.data?.qr_token || ''), expiresAt: res.data?.data?.expires_at || null, ttl: res.data?.data?.ttl_seconds || customTtl, gateName: res.data?.data?.gate_name || '' }
            } else if (eventQrKind === 'STAY') {
                const res = await api.get(`/events/${selectedEventId}/stay/qr`)
                return { token: String(res.data?.data?.qr_token || ''), expiresAt: res.data?.data?.expires_at || null, ttl: customTtl, gateName: '' }
            } else {
                const res = await api.get(`/events/${selectedEventId}/mess/qr`)
                return { token: String(res.data?.data?.sharedQrToken || ''), expiresAt: null, ttl: 0, gateName: '' }
            }
        },
    })

    useEffect(() => {
        if (!isDynamic || !dynamicQr?.expiresAt) { setCountdown(0); return }
        const tick = () => { setCountdown(Math.max(0, Math.ceil((new Date(dynamicQr.expiresAt).getTime() - Date.now()) / 1000))) }
        tick()
        const id = window.setInterval(tick, 1000)
        return () => window.clearInterval(id)
    }, [dynamicQr?.expiresAt, isDynamic])

    // ── Gate CRUD mutations ──
    const createGateMutation = useMutation({
        mutationFn: async (name: string) => {
            const res = await api.post('/access/gates', { name })
            return res.data.data
        },
        onSuccess: (data) => {
            toast.success(`Gate "${data.name}" created`)
            queryClient.invalidateQueries({ queryKey: ['qr-manage-gates'] })
            setNewGateName('')
            setShowCreateGate(false)
            setSelectedGateId(data.id)
            setQrSource('GATE')
        },
        onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to create gate'),
    })

    const renameGateMutation = useMutation({
        mutationFn: async ({ id, name }: { id: string; name: string }) => {
            const res = await api.patch(`/access/gates/${id}`, { name })
            return res.data.data
        },
        onSuccess: (data) => {
            toast.success(`Gate renamed to "${data.name}"`)
            queryClient.invalidateQueries({ queryKey: ['qr-manage-gates'] })
            setRenamingGateId(null)
            setRenameValue('')
        },
        onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to rename gate'),
    })

    const generateStaticToken = () => {
        const label = isGateMode ? (selectedGate?.name || 'Gate') : (selectedEvent?.name || 'Event')
        setStaticToken(`SMART-ID|STATIC|${label}|${Date.now()}`)
        toast.success('Static QR generated')
    }

    const activeToken = isDynamic ? (dynamicQr?.token || '') : staticToken
    const activeLabel = isGateMode ? (selectedGate?.name || 'Select Gate') : (selectedEvent?.name || 'Select Event')

    const toggleFullscreen = async () => {
        try {
            if (document.fullscreenElement) await document.exitFullscreen()
            else if (qrContainerRef.current) await qrContainerRef.current.requestFullscreen()
        } catch { toast.error('Fullscreen not available') }
    }

    const copyToken = () => { if (!activeToken) return; navigator.clipboard.writeText(activeToken); toast.success('QR token copied') }

    const downloadQrPng = () => {
        const svgEl = qrContainerRef.current?.querySelector('svg')
        if (!svgEl) return
        const svgData = new XMLSerializer().serializeToString(svgEl)
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        const img = new Image()
        img.onload = () => {
            canvas.width = img.width * 2; canvas.height = img.height * 2
            ctx!.fillStyle = '#fff'; ctx!.fillRect(0, 0, canvas.width, canvas.height)
            ctx!.drawImage(img, 0, 0, canvas.width, canvas.height)
            const a = document.createElement('a')
            a.download = `qr-${activeLabel.replace(/\s+/g, '-').toLowerCase()}.png`
            a.href = canvas.toDataURL('image/png'); a.click()
        }
        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)))
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2.5 bg-accent/10 border border-accent/20 rounded-xl">
                        <Settings2 className="text-accent" size={24} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black tracking-tight text-text-primary">QR Management</h1>
                        <p className="text-text-secondary text-sm">Create, configure and project QR codes for any gate or event</p>
                    </div>
                </div>
            </div>

            {/* Source Tabs */}
            <div className="flex rounded-2xl border border-white/10 overflow-hidden w-fit">
                {(['GATE', 'EVENT'] as QrSource[]).map(src => (
                    <button key={src} onClick={() => setQrSource(src)}
                        className={`px-6 py-3 text-sm font-black tracking-wider flex items-center gap-2 transition-all ${qrSource === src ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-white/5 text-text-secondary hover:bg-white/10'}`}>
                        {src === 'GATE' ? <MapPin size={16} /> : <Radio size={16} />}
                        {src === 'GATE' ? 'Gate QR' : 'Event QR'}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Left Controls */}
                <div className="xl:col-span-1 space-y-4">
                    {/* Gate/Event Selector */}
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
                        <h3 className="text-sm font-black uppercase tracking-wider text-text-primary flex items-center gap-2">
                            <MapPin size={16} className="text-accent" />
                            {isGateMode ? 'Select Gate' : 'Select Event'}
                        </h3>

                        {isGateMode ? (
                            <select value={selectedGateId} onChange={(e) => setSelectedGateId(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-text-primary focus:outline-none focus:border-accent/50" disabled={isLoadingGates}>
                                {gates.map(g => <option key={g.id} value={g.id}>{g.name}{g.hasGeofence ? ' ✓ Geo' : ''}</option>)}
                            </select>
                        ) : (
                            <>
                                <select value={selectedEventId} onChange={(e) => setSelectedEventId(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-text-primary focus:outline-none focus:border-accent/50" disabled={isLoadingEvents}>
                                    {displayEvents.length === 0 && <option value="">No events</option>}
                                    {displayEvents.map(e => <option key={e.id} value={e.id}>{e.name}{e.isActive ? '' : ' (Inactive)'}</option>)}
                                </select>
                                <div className="flex rounded-xl border border-white/10 overflow-hidden">
                                    {(['STAY', 'MESS'] as EventQrKind[]).map(kind => (
                                        <button key={kind} onClick={() => setEventQrKind(kind)}
                                            className={`flex-1 px-4 py-2.5 text-xs font-black tracking-wider transition-all ${eventQrKind === kind ? 'bg-accent text-white' : 'bg-white/5 text-text-secondary hover:bg-white/10'}`}>
                                            {kind} QR
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    {/* QR Mode */}
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
                        <h3 className="text-sm font-black uppercase tracking-wider text-text-primary flex items-center gap-2">
                            <Zap size={16} className="text-warning" /> QR Mode
                        </h3>
                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => setQrMode('DYNAMIC')}
                                className={`p-4 rounded-xl border transition-all text-center ${qrMode === 'DYNAMIC' ? 'border-primary/60 bg-primary/15 shadow-lg shadow-primary/10' : 'border-white/10 bg-white/5 hover:border-primary/30'}`}>
                                <Zap size={20} className={`mx-auto mb-2 ${qrMode === 'DYNAMIC' ? 'text-primary' : 'text-text-secondary'}`} />
                                <p className={`text-xs font-black ${qrMode === 'DYNAMIC' ? 'text-primary' : 'text-text-secondary'}`}>Dynamic</p>
                                <p className="text-[10px] text-text-secondary mt-0.5">Auto-rotates</p>
                            </button>
                            <button onClick={() => { setQrMode('STATIC'); if (!staticToken) generateStaticToken() }}
                                className={`p-4 rounded-xl border transition-all text-center ${qrMode === 'STATIC' ? 'border-success/60 bg-success/15 shadow-lg shadow-success/10' : 'border-white/10 bg-white/5 hover:border-success/30'}`}>
                                <Lock size={20} className={`mx-auto mb-2 ${qrMode === 'STATIC' ? 'text-success' : 'text-text-secondary'}`} />
                                <p className={`text-xs font-black ${qrMode === 'STATIC' ? 'text-success' : 'text-text-secondary'}`}>Static</p>
                                <p className="text-[10px] text-text-secondary mt-0.5">Fixed token</p>
                            </button>
                        </div>
                    </div>

                    {/* TTL */}
                    {isDynamic && (
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3">
                            <h3 className="text-sm font-black uppercase tracking-wider text-text-primary flex items-center gap-2">
                                <Timer size={16} className="text-primary" /> Refresh Interval
                            </h3>
                            <div className="flex items-center gap-3">
                                <input type="range" min={10} max={60} step={5} value={customTtl} onChange={(e) => setCustomTtl(Number(e.target.value))} className="flex-1" />
                                <span className="text-sm font-black text-primary w-10 text-right">{customTtl}s</span>
                            </div>
                            <p className="text-[10px] text-text-secondary">QR will auto-fetch a new token every {customTtl} seconds</p>
                        </div>
                    )}

                    {/* Quick Actions */}
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-2">
                        <h3 className="text-sm font-black uppercase tracking-wider text-text-primary mb-3">Quick Actions</h3>
                        <button onClick={() => isDynamic ? refetchQr() : generateStaticToken()}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-black transition-all border border-primary/20">
                            <RefreshCw size={14} /> {isDynamic ? 'Force Refresh' : 'Regenerate Static QR'}
                        </button>
                        <button onClick={copyToken} disabled={!activeToken}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-text-secondary text-xs font-black transition-all border border-white/10 disabled:opacity-40">
                            <Copy size={14} /> Copy Token
                        </button>
                        <button onClick={downloadQrPng} disabled={!activeToken}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-text-secondary text-xs font-black transition-all border border-white/10 disabled:opacity-40">
                            <Download size={14} /> Download QR PNG
                        </button>
                        <button onClick={toggleFullscreen}
                            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-accent/10 hover:bg-accent/20 text-accent text-xs font-black transition-all border border-accent/20">
                            <Maximize2 size={14} /> Fullscreen Projector
                        </button>
                    </div>
                </div>

                {/* Right: Live QR Preview */}
                <div className="xl:col-span-2">
                    <div ref={qrContainerRef}
                        className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-8 flex flex-col items-center justify-center min-h-[560px] relative overflow-hidden">
                        <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-primary/8 blur-[100px] rounded-full pointer-events-none" />
                        <div className="absolute bottom-[-20%] left-[-10%] w-[40%] h-[40%] bg-accent/8 blur-[80px] rounded-full pointer-events-none" />

                        <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
                            <div className="flex items-center gap-2">
                                <span className={`w-2.5 h-2.5 rounded-full ${isDynamic ? 'bg-success animate-pulse' : 'bg-warning'}`} />
                                <span className="text-xs font-black uppercase tracking-widest text-text-secondary">
                                    {isDynamic ? 'LIVE' : 'STATIC'} • {isGateMode ? 'GATE' : 'EVENT'}
                                </span>
                            </div>
                            {isDynamic && countdown > 0 && (
                                <div className={`px-3 py-1.5 rounded-lg text-xs font-black ${countdown <= 5 ? 'bg-warning/20 text-warning' : 'bg-success/20 text-success'}`}>
                                    TTL: {countdown}s
                                </div>
                            )}
                        </div>

                        {isQrLoading && isDynamic ? (
                            <div className="flex flex-col items-center gap-3">
                                <div className="w-12 h-12 border-3 border-primary/30 border-t-primary rounded-full animate-spin" />
                                <p className="text-sm text-text-secondary font-bold">Generating QR...</p>
                            </div>
                        ) : activeToken ? (
                            <div className="flex flex-col items-center gap-5 relative z-10">
                                <div className="text-center">
                                    <p className="text-lg font-black text-text-primary">{activeLabel}</p>
                                    <p className="text-xs text-text-secondary mt-0.5">
                                        {isDynamic ? `Auto-refreshes every ${customTtl}s` : 'Static — does not expire'}
                                    </p>
                                </div>
                                <div className="bg-white p-5 rounded-2xl shadow-2xl shadow-black/30 transition-all hover:scale-[1.01]">
                                    <QRCodeSVG value={activeToken} size={280} />
                                </div>
                                <div className="max-w-sm text-center">
                                    <p className="text-[10px] text-text-secondary font-mono break-all">
                                        {activeToken.length > 60 ? activeToken.slice(0, 60) + '…' : activeToken}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-3 relative z-10">
                                <QrCode size={48} className="text-text-secondary/30" />
                                <p className="text-sm text-text-secondary font-bold">
                                    {isDynamic ? 'Select a gate or event to generate QR' : 'Click "Regenerate Static QR" to create one'}
                                </p>
                            </div>
                        )}

                        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between z-10">
                            <p className="text-[10px] text-text-secondary/50 font-bold">SMART-ID QR System</p>
                            <p className="text-[10px] text-text-secondary/50 font-bold">{new Date().toLocaleTimeString()}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* ═══ All Gates — Create & Rename ═══ */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-black uppercase tracking-wider text-text-primary flex items-center gap-2">
                        <MapPin size={16} className="text-primary" />
                        All Registered Gates
                    </h3>
                    <button onClick={() => setShowCreateGate(!showCreateGate)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${showCreateGate ? 'bg-error/10 text-error border border-error/20 hover:bg-error/20' : 'bg-success/10 text-success border border-success/20 hover:bg-success/20'}`}>
                        {showCreateGate ? <><X size={14} /> Cancel</> : <><Plus size={14} /> New Gate</>}
                    </button>
                </div>

                {/* Create Gate Form */}
                {showCreateGate && (
                    <div className="mb-4 p-4 rounded-xl border border-success/30 bg-success/5 animate-fade-in-up">
                        <p className="text-xs font-black text-text-primary mb-2">Create New Gate</p>
                        <div className="flex gap-2">
                            <input type="text" value={newGateName} onChange={(e) => setNewGateName(e.target.value)}
                                placeholder="e.g. Hostel Gate, Library Gate, Main Gate..."
                                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-text-primary focus:outline-none focus:border-success/50 placeholder:text-text-secondary/50"
                                onKeyDown={(e) => { if (e.key === 'Enter' && newGateName.trim().length >= 2) createGateMutation.mutate(newGateName.trim()) }} />
                            <button onClick={() => { if (newGateName.trim().length >= 2) createGateMutation.mutate(newGateName.trim()) }}
                                disabled={newGateName.trim().length < 2 || createGateMutation.isPending}
                                className="px-5 py-3 rounded-xl bg-success text-white text-xs font-black uppercase tracking-wider hover:bg-success/90 disabled:opacity-50 transition-all">
                                {createGateMutation.isPending ? 'Creating...' : 'Create'}
                            </button>
                        </div>
                    </div>
                )}

                {/* Gates Grid */}
                {isLoadingGates ? (
                    <p className="text-xs text-text-secondary">Loading gates...</p>
                ) : gates.length === 0 ? (
                    <p className="text-xs text-text-secondary">No gates registered yet. Click "New Gate" above to create one.</p>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                        {gates.map(gate => (
                            <div key={gate.id}
                                className={`p-4 rounded-xl border transition-all hover:shadow-lg group relative ${isGateMode && selectedGateId === gate.id ? 'border-primary/60 bg-primary/10 shadow-lg shadow-primary/10' : 'border-white/10 bg-white/5 hover:border-primary/30'}`}>

                                {renamingGateId === gate.id ? (
                                    /* Inline rename */
                                    <div className="space-y-2">
                                        <input type="text" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} autoFocus
                                            className="w-full bg-white/10 border border-accent/30 rounded-lg px-3 py-2 text-sm font-bold text-text-primary focus:outline-none focus:border-accent/60"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && renameValue.trim().length >= 2) renameGateMutation.mutate({ id: gate.id, name: renameValue.trim() })
                                                if (e.key === 'Escape') { setRenamingGateId(null); setRenameValue('') }
                                            }} />
                                        <div className="flex gap-1">
                                            <button onClick={() => { if (renameValue.trim().length >= 2) renameGateMutation.mutate({ id: gate.id, name: renameValue.trim() }) }}
                                                disabled={renameValue.trim().length < 2 || renameGateMutation.isPending}
                                                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-black bg-success/20 text-success hover:bg-success/30 disabled:opacity-50">
                                                <Check size={12} /> {renameGateMutation.isPending ? '...' : 'Save'}
                                            </button>
                                            <button onClick={() => { setRenamingGateId(null); setRenameValue('') }}
                                                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-black bg-white/5 text-text-secondary hover:bg-white/10">
                                                <X size={12} /> Cancel
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    /* Normal gate card */
                                    <>
                                        <div className="cursor-pointer" onClick={() => { setQrSource('GATE'); setSelectedGateId(gate.id) }}>
                                            <p className="text-sm font-bold text-text-primary truncate pr-6">{gate.name}</p>
                                            <div className="flex items-center gap-1.5 mt-1">
                                                <span className={`w-1.5 h-1.5 rounded-full ${gate.hasGeofence ? 'bg-success' : 'bg-warning'}`} />
                                                <span className="text-[10px] text-text-secondary">{gate.hasGeofence ? 'Geo Active' : 'No Geofence'}</span>
                                            </div>
                                        </div>
                                        <button onClick={(e) => { e.stopPropagation(); setRenamingGateId(gate.id); setRenameValue(gate.name) }}
                                            className="absolute top-3 right-3 p-1.5 rounded-lg bg-white/5 hover:bg-accent/20 text-text-secondary hover:text-accent opacity-0 group-hover:opacity-100 transition-all"
                                            title="Rename gate">
                                            <Pencil size={12} />
                                        </button>
                                    </>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
