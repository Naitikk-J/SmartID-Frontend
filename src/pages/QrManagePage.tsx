import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { QRCodeSVG } from 'qrcode.react'
import toast from 'react-hot-toast'
import api from '../api/axios'
import {
    QrCode, RefreshCw, Maximize2, Timer, MapPin, Copy, Save,
    Zap, Lock, Settings2, Radio, Plus, Pencil, Check, X
} from 'lucide-react'

type Gate = { id: string; name: string; hasGeofence?: boolean }
type EventItem = { id: string; name: string; isActive: boolean }

export default function QrManagePage() {
    const qc = useQueryClient()
    const qrRef = useRef<HTMLDivElement | null>(null)

    const [qrSource, setQrSource] = useState<'GATE'|'EVENT'>('GATE')
    const [gateId, setGateId] = useState('')
    const [eventId, setEventId] = useState('')
    const [eventKind, setEventKind] = useState<'STAY'|'MESS'>('STAY')
    const [qrMode, setQrMode] = useState<'DYNAMIC'|'STATIC'>('DYNAMIC')
    const [ttl, setTtl] = useState(20)
    const [countdown, setCountdown] = useState(0)
    const [staticToken, setStaticToken] = useState('')
    const [validInCampus, setValidInCampus] = useState(true)
    const [validInHostel, setValidInHostel] = useState(true)
    const [newGateName, setNewGateName] = useState('')
    const [showCreate, setShowCreate] = useState(false)
    const [renameId, setRenameId] = useState<string|null>(null)
    const [renameVal, setRenameVal] = useState('')
    const [configDirty, setConfigDirty] = useState(false)

    const { data: gates=[], isLoading: loadGates } = useQuery({
        queryKey: ['qr-gates'], queryFn: async () => { const r = await api.get('/access/gates'); return (r.data?.data?.gates||[]) as Gate[] }
    })
    const { data: events=[] } = useQuery({
        queryKey: ['qr-events'], queryFn: async () => { const r = await api.get('/events'); return (r.data?.data?.events||[]) as EventItem[] }
    })

    const dispEvents = useMemo(() => { const a = events.filter(e=>e.isActive); return a.length ? a : events }, [events])
    useEffect(() => { if (!gateId && gates.length) setGateId(gates[0].id) }, [gates, gateId])
    useEffect(() => { if (!eventId && dispEvents.length) setEventId(dispEvents[0].id) }, [dispEvents, eventId])

    const selGate = useMemo(() => gates.find(g=>g.id===gateId), [gates, gateId])
    const selEvent = useMemo(() => events.find(e=>e.id===eventId), [events, eventId])
    const isGate = qrSource === 'GATE'
    const isDyn = qrMode === 'DYNAMIC'

    // Load per-gate QR config when gate changes
    const { data: gateConfig } = useQuery({
        queryKey: ['gate-qr-cfg', gateId],
        enabled: isGate && Boolean(gateId),
        queryFn: async () => { const r = await api.get(`/access/gates/${gateId}/qr-config`); return r.data?.data }
    })
    useEffect(() => {
        if (gateConfig && isGate) {
            setQrMode(gateConfig.qrMode || 'DYNAMIC')
            setTtl(gateConfig.qrTtlSeconds || 20)
            setValidInCampus(gateConfig.validInCampus ?? true)
            setValidInHostel(gateConfig.validInHostel ?? true)
            setConfigDirty(false)
        }
    }, [gateConfig, isGate])

    // Save per-gate config
    const saveConfigMut = useMutation({
        mutationFn: async () => { await api.put(`/access/gates/${gateId}/qr-config`, { qrMode, qrTtlSeconds: ttl, validInCampus, validInHostel }) },
        onSuccess: () => { toast.success('QR config saved — all pages will use this'); qc.invalidateQueries({ queryKey: ['gate-qr-cfg'] }); setConfigDirty(false) },
        onError: (e:any) => toast.error(e.response?.data?.error || 'Save failed')
    })

    const enabled = isDyn && (isGate ? Boolean(gateId) : Boolean(eventId))
    const { data: dynQr, isLoading: qrLoading, refetch } = useQuery({
        queryKey: ['qr-live', qrSource, gateId, eventId, eventKind],
        enabled,
        refetchInterval: isDyn ? ttl * 1000 : false,
        queryFn: async () => {
            if (isGate) { const r = await api.get('/qr/generate', { params: { gate_id: gateId } }); return { token: r.data?.data?.qr_token||'', exp: r.data?.data?.expires_at } }
            if (eventKind==='STAY') { const r = await api.get(`/events/${eventId}/stay/qr`); return { token: r.data?.data?.qr_token||'', exp: r.data?.data?.expires_at } }
            const r = await api.get(`/events/${eventId}/mess/qr`); return { token: r.data?.data?.sharedQrToken||'', exp: null }
        }
    })

    useEffect(() => {
        if (!isDyn || !dynQr?.exp) { setCountdown(0); return }
        const tick = () => setCountdown(Math.max(0, Math.ceil((new Date(dynQr.exp).getTime()-Date.now())/1000)))
        tick(); const id = setInterval(tick, 1000); return () => clearInterval(id)
    }, [dynQr?.exp, isDyn])

    const createMut = useMutation({
        mutationFn: async (n:string) => (await api.post('/access/gates', { name: n })).data.data,
        onSuccess: (d) => { toast.success(`Gate "${d.name}" created`); qc.invalidateQueries({ queryKey: ['qr-gates'] }); setNewGateName(''); setShowCreate(false); setGateId(d.id); setQrSource('GATE') },
        onError: (e:any) => toast.error(e.response?.data?.error || 'Failed')
    })
    const renameMut = useMutation({
        mutationFn: async ({ id, name }:{ id:string; name:string }) => (await api.patch(`/access/gates/${id}`, { name })).data.data,
        onSuccess: (d) => { toast.success(`Renamed to "${d.name}"`); qc.invalidateQueries({ queryKey: ['qr-gates'] }); setRenameId(null) },
        onError: (e:any) => toast.error(e.response?.data?.error || 'Failed')
    })

    const genStatic = () => { setStaticToken(`SMART-ID|STATIC|${isGate?selGate?.name:'Event'}|${Date.now()}`); toast.success('Static QR generated') }
    const token = isDyn ? (dynQr?.token||'') : staticToken
    const label = isGate ? (selGate?.name||'Gate') : (selEvent?.name||'Event')

    const fullscreen = async () => { try { document.fullscreenElement ? await document.exitFullscreen() : await qrRef.current?.requestFullscreen() } catch { toast.error('N/A') } }
    const copy = () => { if(token){ navigator.clipboard.writeText(token); toast.success('Copied') } }

    return (
        <div className="space-y-6">
            <div><div className="flex items-center gap-3 mb-2">
                <div className="p-2.5 bg-accent/10 border border-accent/20 rounded-xl"><Settings2 className="text-accent" size={24}/></div>
                <div><h1 className="text-3xl font-black tracking-tight text-text-primary">QR Management</h1>
                <p className="text-text-secondary text-sm">Central control — settings here override all other pages</p></div>
            </div></div>

            {/* Source tabs */}
            <div className="flex rounded-2xl border border-white/10 overflow-hidden w-fit">
                {(['GATE','EVENT'] as const).map(s=>(
                    <button key={s} onClick={()=>setQrSource(s)} className={`px-6 py-3 text-sm font-black tracking-wider flex items-center gap-2 transition-all ${qrSource===s?'bg-primary text-white shadow-lg shadow-primary/20':'bg-white/5 text-text-secondary hover:bg-white/10'}`}>
                        {s==='GATE'?<MapPin size={16}/>:<Radio size={16}/>} {s==='GATE'?'Gate QR':'Event QR'}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* LEFT CONTROLS */}
                <div className="xl:col-span-1 space-y-4">
                    {/* Selector */}
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
                        <h3 className="text-sm font-black uppercase tracking-wider text-text-primary flex items-center gap-2"><MapPin size={16} className="text-accent"/>{isGate?'Select Gate':'Select Event'}</h3>
                        {isGate ? (
                            <select value={gateId} onChange={e=>{setGateId(e.target.value);setConfigDirty(false)}} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-text-primary focus:outline-none focus:border-accent/50" disabled={loadGates}>
                                {gates.map(g=><option key={g.id} value={g.id}>{g.name}{g.hasGeofence?' ✓ Geo':''}</option>)}
                            </select>
                        ) : (
                            <>
                                <select value={eventId} onChange={e=>setEventId(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-text-primary focus:outline-none focus:border-accent/50">
                                    {dispEvents.length===0&&<option value="">No events</option>}
                                    {dispEvents.map(e=><option key={e.id} value={e.id}>{e.name}{e.isActive?'':' (Inactive)'}</option>)}
                                </select>
                                <div className="flex rounded-xl border border-white/10 overflow-hidden">
                                    {(['STAY','MESS'] as const).map(k=>(
                                        <button key={k} onClick={()=>setEventKind(k)} className={`flex-1 px-4 py-2.5 text-xs font-black tracking-wider ${eventKind===k?'bg-accent text-white':'bg-white/5 text-text-secondary hover:bg-white/10'}`}>{k} QR</button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    {/* QR Mode */}
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
                        <h3 className="text-sm font-black uppercase tracking-wider text-text-primary flex items-center gap-2"><Zap size={16} className="text-warning"/> QR Mode</h3>
                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={()=>{setQrMode('DYNAMIC');setConfigDirty(true)}} className={`p-4 rounded-xl border transition-all text-center ${qrMode==='DYNAMIC'?'border-primary/60 bg-primary/15 shadow-lg shadow-primary/10':'border-white/10 bg-white/5 hover:border-primary/30'}`}>
                                <Zap size={20} className={`mx-auto mb-2 ${qrMode==='DYNAMIC'?'text-primary':'text-text-secondary'}`}/>
                                <p className={`text-xs font-black ${qrMode==='DYNAMIC'?'text-primary':'text-text-secondary'}`}>Dynamic</p>
                                <p className="text-[10px] text-text-secondary mt-0.5">Auto-rotates</p>
                            </button>
                            <button onClick={()=>{setQrMode('STATIC');setConfigDirty(true);if(!staticToken)genStatic()}} className={`p-4 rounded-xl border transition-all text-center ${qrMode==='STATIC'?'border-success/60 bg-success/15 shadow-lg shadow-success/10':'border-white/10 bg-white/5 hover:border-success/30'}`}>
                                <Lock size={20} className={`mx-auto mb-2 ${qrMode==='STATIC'?'text-success':'text-text-secondary'}`}/>
                                <p className={`text-xs font-black ${qrMode==='STATIC'?'text-success':'text-text-secondary'}`}>Static</p>
                                <p className="text-[10px] text-text-secondary mt-0.5">Fixed token</p>
                            </button>
                        </div>
                    </div>

                    {/* TTL */}
                    {isDyn && (
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-3">
                            <h3 className="text-sm font-black uppercase tracking-wider text-text-primary flex items-center gap-2"><Timer size={16} className="text-primary"/> Refresh TTL</h3>
                            <div className="flex items-center gap-3">
                                <input type="range" min={10} max={120} step={5} value={ttl} onChange={e=>{setTtl(Number(e.target.value));setConfigDirty(true)}} className="flex-1"/>
                                <span className="text-sm font-black text-primary w-12 text-right">{ttl}s</span>
                            </div>
                            <p className="text-[10px] text-text-secondary">Auto-refresh every {ttl}s. Range: 10–120s</p>
                        </div>
                    )}

                    {/* Gate Scope Toggles */}
                    {isGate && (
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
                            <h3 className="text-sm font-black uppercase tracking-wider text-text-primary flex items-center gap-2"><MapPin size={16} className="text-primary"/> Valid In</h3>
                            <div className="flex flex-col gap-3">
                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <div className={`w-10 h-6 rounded-full p-1 transition-all flex items-center ${validInCampus ? 'bg-success' : 'bg-white/10'}`}>
                                        <div className={`w-4 h-4 rounded-full bg-white transition-all ${validInCampus ? 'translate-x-4' : 'translate-x-0'}`}/>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-text-primary">Campus Entry/Exit</p>
                                        <p className="text-[10px] text-text-secondary">Allow main campus access</p>
                                    </div>
                                    <input type="checkbox" className="hidden" checked={validInCampus} onChange={e=>{setValidInCampus(e.target.checked);setConfigDirty(true)}}/>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <div className={`w-10 h-6 rounded-full p-1 transition-all flex items-center ${validInHostel ? 'bg-success' : 'bg-white/10'}`}>
                                        <div className={`w-4 h-4 rounded-full bg-white transition-all ${validInHostel ? 'translate-x-4' : 'translate-x-0'}`}/>
                                    </div>
                                    <div>
                                        <p className="text-sm font-bold text-text-primary">Hostel</p>
                                        <p className="text-[10px] text-text-secondary">Allow hostel access</p>
                                    </div>
                                    <input type="checkbox" className="hidden" checked={validInHostel} onChange={e=>{setValidInHostel(e.target.checked);setConfigDirty(true)}}/>
                                </label>
                            </div>
                        </div>
                    )}


                    {/* SAVE CONFIG — the key feature */}
                    {isGate && gateId && (
                        <button onClick={()=>saveConfigMut.mutate()} disabled={saveConfigMut.isPending || !configDirty}
                            className={`w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl text-sm font-black transition-all border ${configDirty ? 'bg-accent text-white border-accent/60 hover:bg-accent/90 shadow-lg shadow-accent/20' : 'bg-white/5 text-text-secondary border-white/10 opacity-60'}`}>
                            <Save size={16}/> {saveConfigMut.isPending ? 'Saving...' : configDirty ? 'Save Config (applies everywhere)' : 'Config Saved ✓'}
                        </button>
                    )}

                    {/* Actions */}
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-2">
                        <h3 className="text-sm font-black uppercase tracking-wider text-text-primary mb-3">Actions</h3>
                        <button onClick={()=>isDyn?refetch():genStatic()} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-xs font-black border border-primary/20"><RefreshCw size={14}/>{isDyn?'Force Refresh':'Regenerate'}</button>
                        <button onClick={copy} disabled={!token} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-text-secondary text-xs font-black border border-white/10 disabled:opacity-40"><Copy size={14}/>Copy Token</button>
                        <button onClick={fullscreen} className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-accent/10 hover:bg-accent/20 text-accent text-xs font-black border border-accent/20"><Maximize2 size={14}/>Fullscreen</button>
                    </div>
                </div>

                {/* QR PREVIEW */}
                <div className="xl:col-span-2">
                    <div ref={qrRef} className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-8 flex flex-col items-center justify-center min-h-[560px] relative overflow-hidden">
                        <div className="absolute top-[-20%] right-[-10%] w-[50%] h-[50%] bg-primary/8 blur-[100px] rounded-full pointer-events-none"/>
                        <div className="absolute bottom-[-20%] left-[-10%] w-[40%] h-[40%] bg-accent/8 blur-[80px] rounded-full pointer-events-none"/>
                        <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
                            <div className="flex items-center gap-2">
                                <span className={`w-2.5 h-2.5 rounded-full ${isDyn?'bg-success animate-pulse':'bg-warning'}`}/>
                                <span className="text-xs font-black uppercase tracking-widest text-text-secondary">{isDyn?'LIVE':'STATIC'} • {isGate?'GATE':'EVENT'}</span>
                            </div>
                            {isDyn&&countdown>0&&<div className={`px-3 py-1.5 rounded-lg text-xs font-black ${countdown<=5?'bg-warning/20 text-warning':'bg-success/20 text-success'}`}>TTL: {countdown}s</div>}
                        </div>
                        {qrLoading&&isDyn ? (
                            <div className="flex flex-col items-center gap-3"><div className="w-12 h-12 border-3 border-primary/30 border-t-primary rounded-full animate-spin"/><p className="text-sm text-text-secondary font-bold">Generating...</p></div>
                        ) : token ? (
                            <div className="flex flex-col items-center gap-5 relative z-10">
                                <div className="text-center"><p className="text-lg font-black text-text-primary">{label}</p><p className="text-xs text-text-secondary mt-0.5">{isDyn?`Auto-refreshes every ${ttl}s`:'Static — does not expire'}</p></div>
                                <div className="p-4 bg-white rounded-2xl shadow-[0_0_50px_rgba(255,255,255,0.15)] hover:scale-[1.02] transition-all duration-500 ease-out">
                                    <QRCodeSVG value={token} size={250} level="H" includeMargin={false} />
                                </div>
                                <p className="text-[10px] text-text-secondary font-mono break-all max-w-sm text-center">{token.length>60?token.slice(0,60)+'…':token}</p>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-3 z-10"><QrCode size={48} className="text-text-secondary/30"/><p className="text-sm text-text-secondary font-bold">{isDyn?'Select a gate or event':'Click Regenerate'}</p></div>
                        )}
                        <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between z-10">
                            <p className="text-[10px] text-text-secondary/50 font-bold">SMART-ID QR System</p>
                            <p className="text-[10px] text-text-secondary/50 font-bold">{new Date().toLocaleTimeString()}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* GATES GRID — Create & Rename */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-black uppercase tracking-wider text-text-primary flex items-center gap-2"><MapPin size={16} className="text-primary"/>All Gates</h3>
                    <button onClick={()=>setShowCreate(!showCreate)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all ${showCreate?'bg-error/10 text-error border border-error/20':'bg-success/10 text-success border border-success/20 hover:bg-success/20'}`}>
                        {showCreate?<><X size={14}/>Cancel</>:<><Plus size={14}/>New Gate</>}
                    </button>
                </div>
                {showCreate&&(
                    <div className="mb-4 p-4 rounded-xl border border-success/30 bg-success/5">
                        <p className="text-xs font-black text-text-primary mb-2">Create New Gate</p>
                        <div className="flex gap-2">
                            <input type="text" value={newGateName} onChange={e=>setNewGateName(e.target.value)} placeholder="e.g. Hostel Gate, Main Gate..."
                                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-text-primary focus:outline-none focus:border-success/50 placeholder:text-text-secondary/50"
                                onKeyDown={e=>{if(e.key==='Enter'&&newGateName.trim().length>=2)createMut.mutate(newGateName.trim())}}/>
                            <button onClick={()=>{if(newGateName.trim().length>=2)createMut.mutate(newGateName.trim())}} disabled={newGateName.trim().length<2||createMut.isPending}
                                className="px-5 py-3 rounded-xl bg-success text-white text-xs font-black uppercase tracking-wider disabled:opacity-50">{createMut.isPending?'...':'Create'}</button>
                        </div>
                    </div>
                )}
                {loadGates?<p className="text-xs text-text-secondary">Loading...</p>:gates.length===0?<p className="text-xs text-text-secondary">No gates. Click "New Gate" to create.</p>:(
                    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
                        {gates.map(g=>(
                            <div key={g.id} className={`p-4 rounded-xl border transition-all hover:shadow-lg group relative ${isGate&&gateId===g.id?'border-primary/60 bg-primary/10 shadow-lg shadow-primary/10':'border-white/10 bg-white/5 hover:border-primary/30'}`}>
                                {renameId===g.id?(
                                    <div className="space-y-2">
                                        <input type="text" value={renameVal} onChange={e=>setRenameVal(e.target.value)} autoFocus
                                            className="w-full bg-white/10 border border-accent/30 rounded-lg px-3 py-2 text-sm font-bold text-text-primary focus:outline-none"
                                            onKeyDown={e=>{if(e.key==='Enter'&&renameVal.trim().length>=2)renameMut.mutate({id:g.id,name:renameVal.trim()});if(e.key==='Escape')setRenameId(null)}}/>
                                        <div className="flex gap-1">
                                            <button onClick={()=>{if(renameVal.trim().length>=2)renameMut.mutate({id:g.id,name:renameVal.trim()})}} disabled={renameVal.trim().length<2||renameMut.isPending}
                                                className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-black bg-success/20 text-success disabled:opacity-50"><Check size={12}/>{renameMut.isPending?'...':'Save'}</button>
                                            <button onClick={()=>setRenameId(null)} className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-black bg-white/5 text-text-secondary"><X size={12}/>Cancel</button>
                                        </div>
                                    </div>
                                ):(
                                    <>
                                        <div className="cursor-pointer" onClick={()=>{setQrSource('GATE');setGateId(g.id)}}>
                                            <p className="text-sm font-bold text-text-primary truncate pr-6">{g.name}</p>
                                            <div className="flex items-center gap-1.5 mt-1">
                                                <span className={`w-1.5 h-1.5 rounded-full ${g.hasGeofence?'bg-success':'bg-warning'}`}/>
                                                <span className="text-[10px] text-text-secondary">{g.hasGeofence?'Geo Active':'No Geofence'}</span>
                                            </div>
                                        </div>
                                        <button onClick={e=>{e.stopPropagation();setRenameId(g.id);setRenameVal(g.name)}}
                                            className="absolute top-3 right-3 p-1.5 rounded-lg bg-white/5 hover:bg-accent/20 text-text-secondary hover:text-accent opacity-0 group-hover:opacity-100 transition-all" title="Rename">
                                            <Pencil size={12}/>
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
