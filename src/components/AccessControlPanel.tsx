import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { QRCodeSVG } from 'qrcode.react'
import { MapPin, RefreshCw, ShieldAlert, Timer, TriangleAlert } from 'lucide-react'
import api from '../api/axios'

type Gate = {
    id: string
    name: string
    hasGeofence?: boolean
}

type GeofencePayload = {
    center_lat: number
    center_lng: number
    radius: number
    shape?: 'CIRCLE' | 'POLYGON'
}

export default function AccessControlPanel() {
    const queryClient = useQueryClient()

    const [selectedGateId, setSelectedGateId] = useState('')
    const [countdown, setCountdown] = useState(0)
    const [accessSearch, setAccessSearch] = useState('')
    const [accessStatus, setAccessStatus] = useState('')
    const [accessDate, setAccessDate] = useState(new Date().toISOString().split('T')[0])
    const [accessPage, setAccessPage] = useState(1)

    const [geoForm, setGeoForm] = useState<GeofencePayload>({
        center_lat: 23.2599,
        center_lng: 77.4126,
        radius: 80,
        shape: 'CIRCLE',
    })

    const { data: gates = [], isLoading: isLoadingGates } = useQuery({
        queryKey: ['access-gates'],
        queryFn: async () => {
            const response = await api.get('/access/gates')
            return (response.data?.data?.gates || []) as Gate[]
        },
    })

    useEffect(() => {
        if (!selectedGateId && gates.length > 0) {
            setSelectedGateId(gates[0].id)
        }
    }, [gates, selectedGateId])

    const selectedGate = useMemo(
        () => gates.find((gate) => gate.id === selectedGateId),
        [gates, selectedGateId],
    )

    const {
        data: liveQr,
        isLoading: isQrLoading,
        refetch: refetchQr,
    } = useQuery({
        queryKey: ['access-live-qr', selectedGateId],
        enabled: Boolean(selectedGateId),
        refetchInterval: 5000,
        queryFn: async () => {
            const response = await api.get('/qr/generate', {
                params: { gate_id: selectedGateId },
            })
            return response.data?.data
        },
    })

    useEffect(() => {
        if (!liveQr?.expires_at) {
            setCountdown(0)
            return
        }

        const tick = () => {
            const remainingMs = new Date(liveQr.expires_at).getTime() - Date.now()
            setCountdown(Math.max(0, Math.ceil(remainingMs / 1000)))
        }

        tick()
        const id = window.setInterval(tick, 1000)
        return () => window.clearInterval(id)
    }, [liveQr?.expires_at])

    const { data: geofenceData, isLoading: isGeofenceLoading } = useQuery({
        queryKey: ['access-geofence', selectedGateId],
        enabled: Boolean(selectedGateId),
        queryFn: async () => {
            const response = await api.get('/access/geofence', {
                params: { gateId: selectedGateId },
            })
            return response.data?.data
        },
    })

    useEffect(() => {
        const geo = geofenceData?.geofence
        if (!geo) return
        setGeoForm((prev) => ({
            ...prev,
            center_lat: Number(geo.center_lat ?? prev.center_lat),
            center_lng: Number(geo.center_lng ?? prev.center_lng),
            radius: Number(geo.radius ?? prev.radius),
            shape: geo.shape || 'CIRCLE',
        }))
    }, [geofenceData])

    const saveGeofenceMutation = useMutation({
        mutationFn: async () => {
            return api.put('/access/geofence', {
                gateId: selectedGateId,
                ...geoForm,
            })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['access-geofence', selectedGateId] })
            queryClient.invalidateQueries({ queryKey: ['access-gates'] })
        },
    })

    const { data: activityData, isLoading: isActivityLoading } = useQuery({
        queryKey: ['access-activity', accessSearch, accessStatus, accessDate, accessPage],
        queryFn: async () => {
            const response = await api.get('/access/activity-logs', {
                params: {
                    search: accessSearch || undefined,
                    status: accessStatus || undefined,
                    date: accessDate || undefined,
                    page: accessPage,
                    limit: 20,
                },
            })
            return response.data?.data
        },
    })

    const activityEvents = activityData?.events || []
    const activityPages = Math.max(1, Number(activityData?.pages || 1))

    return (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <section className="xl:col-span-1 rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-black text-text-primary flex items-center gap-2">
                        <Timer size={18} className="text-primary" />
                        Live Gate QR
                    </h3>
                    <button
                        onClick={() => refetchQr()}
                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-text-secondary"
                        title="Refresh now"
                    >
                        <RefreshCw size={16} />
                    </button>
                </div>

                <label className="block text-xs text-text-secondary">Gate</label>
                <select
                    value={selectedGateId}
                    onChange={(e) => setSelectedGateId(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-text-primary"
                    disabled={isLoadingGates}
                >
                    {gates.map((gate) => (
                        <option key={gate.id} value={gate.id}>{gate.name}</option>
                    ))}
                </select>

                <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                    {isQrLoading || !liveQr?.qr_token ? (
                        <p className="text-sm text-text-secondary">Generating dynamic QR...</p>
                    ) : (
                        <div className="space-y-3">
                            <div className="mx-auto w-fit bg-white p-3 rounded-xl">
                                <QRCodeSVG value={liveQr.qr_token} size={176} />
                            </div>
                            <p className="text-xs text-text-secondary break-all">{liveQr.qr_token}</p>
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-text-secondary">TTL</p>
                                <p className={`text-sm font-bold ${countdown <= 3 ? 'text-warning' : 'text-success'}`}>
                                    {countdown}s
                                </p>
                            </div>
                            <p className="text-xs text-text-secondary">Auto-refresh every 5s. Share only with students present at this gate.</p>
                        </div>
                    )}
                </div>

                {selectedGate && (
                    <p className="text-xs text-text-secondary">
                        Active gate: <span className="text-text-primary font-semibold">{selectedGate.name}</span>
                    </p>
                )}
            </section>

            <section className="xl:col-span-1 rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4">
                <h3 className="text-lg font-black text-text-primary flex items-center gap-2">
                    <MapPin size={18} className="text-accent" />
                    Geofence Zone
                </h3>

                <div className="rounded-xl border border-white/10 h-44 relative overflow-hidden">
                    <iframe 
                        width="100%" 
                        height="100%" 
                        frameBorder="0" 
                        scrolling="no" 
                        marginHeight={0} 
                        marginWidth={0} 
                        title="Geofence Map"
                        src={`https://maps.google.com/maps?q=${geoForm.center_lat},${geoForm.center_lng}&t=m&z=16&output=embed&iwloc=near`}
                        className="absolute inset-0 z-0 opacity-80 mix-blend-luminosity"
                        style={{ filter: "invert(90%) hue-rotate(180deg) contrast(1.2)" }} 
                    ></iframe>
                    
                    {/* Circle overlay to represent the geofence radius. Real map radius is tricky without API, but we provide an approximation visual */}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        <div
                            className="rounded-full border border-accent/70 bg-accent/20 transition-all duration-300 pointer-events-none"
                            style={{
                                width: `${Math.min(180, Math.max(30, geoForm.radius * 2))}px`,
                                height: `${Math.min(180, Math.max(30, geoForm.radius * 2))}px`,
                            }}
                        />
                    </div>

                    <div className="absolute bottom-2 left-2 text-[11px] font-bold text-white bg-black/60 backdrop-blur-md px-2 py-1 rounded pointer-events-none z-10">
                        {selectedGate?.name} Location
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <input
                        type="number"
                        step="0.000001"
                        value={geoForm.center_lat}
                        onChange={(e) => setGeoForm((prev) => ({ ...prev, center_lat: Number(e.target.value) }))}
                        className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-text-primary"
                        placeholder="Center lat"
                    />
                    <input
                        type="number"
                        step="0.000001"
                        value={geoForm.center_lng}
                        onChange={(e) => setGeoForm((prev) => ({ ...prev, center_lng: Number(e.target.value) }))}
                        className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-text-primary"
                        placeholder="Center lng"
                    />
                </div>

                <div>
                    <label className="text-xs text-text-secondary">Radius: {geoForm.radius}m</label>
                    <input
                        type="range"
                        min={20}
                        max={200}
                        value={geoForm.radius}
                        onChange={(e) => setGeoForm((prev) => ({ ...prev, radius: Number(e.target.value) }))}
                        className="w-full"
                    />
                </div>

                <button
                    onClick={() => saveGeofenceMutation.mutate()}
                    disabled={!selectedGateId || saveGeofenceMutation.isPending || isGeofenceLoading}
                    className="w-full px-4 py-2.5 rounded-xl bg-accent text-white font-bold disabled:opacity-50"
                >
                    {saveGeofenceMutation.isPending ? 'Saving...' : 'Save Geofence'}
                </button>

                <p className="text-xs text-text-secondary">
                    Current status: {isGeofenceLoading ? 'Loading...' : geofenceData?.geofence ? 'Configured' : 'Not configured'}
                </p>
            </section>

            <section className="xl:col-span-3 rounded-2xl border border-white/10 bg-white/5 p-4 space-y-3">
                <h3 className="text-lg font-black text-text-primary flex items-center gap-2">
                    <ShieldAlert size={18} className="text-warning" />
                    Student Activity Logs
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                    <input
                        type="text"
                        value={accessSearch}
                        onChange={(e) => { setAccessSearch(e.target.value); setAccessPage(1) }}
                        placeholder="Search student"
                        className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-text-primary"
                    />
                    <input
                        type="date"
                        value={accessDate}
                        onChange={(e) => { setAccessDate(e.target.value); setAccessPage(1) }}
                        className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-text-primary"
                    />
                    <select
                        value={accessStatus}
                        onChange={(e) => { setAccessStatus(e.target.value); setAccessPage(1) }}
                        className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-text-primary"
                    >
                        <option value="">All status</option>
                        <option value="VERIFIED">Verified</option>
                        <option value="QR_EXPIRED">QR Expired</option>
                        <option value="OUTSIDE_GEOFENCE">Outside Geofence</option>
                        <option value="FACE_FAIL">Face Fail</option>
                    </select>
                    <button
                        onClick={() => queryClient.invalidateQueries({ queryKey: ['access-activity'] })}
                        className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-text-secondary"
                    >
                        Refresh Logs
                    </button>
                </div>

                <div className="overflow-x-auto rounded-xl border border-white/10">
                    <table className="w-full min-w-[900px]">
                        <thead>
                            <tr className="border-b border-white/10 text-xs text-text-secondary uppercase tracking-wider">
                                <th className="text-left px-4 py-3">Student</th>
                                <th className="text-left px-4 py-3">Type</th>
                                <th className="text-left px-4 py-3">Time</th>
                                <th className="text-left px-4 py-3">Gate</th>
                                <th className="text-left px-4 py-3">Geo</th>
                                <th className="text-left px-4 py-3">Face</th>
                                <th className="text-left px-4 py-3">Final</th>
                                <th className="text-left px-4 py-3">Trust</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isActivityLoading ? (
                                <tr>
                                    <td className="px-4 py-8 text-sm text-text-secondary" colSpan={8}>Loading activity logs...</td>
                                </tr>
                            ) : activityEvents.length === 0 ? (
                                <tr>
                                    <td className="px-4 py-8 text-sm text-text-secondary" colSpan={8}>No activity logs found.</td>
                                </tr>
                            ) : (
                                activityEvents.map((event: any) => (
                                    <tr key={event.id} className="border-b border-white/5 text-sm">
                                        <td className="px-4 py-3">
                                            <div className="font-semibold text-text-primary">{event.student_name}</div>
                                            <div className="text-[11px] text-text-secondary mt-0.5">{event.student_email || event.student_name}</div>
                                        </td>
                                        <td className="px-4 py-3 text-text-secondary">{event.event_type}</td>
                                        <td className="px-4 py-3 text-text-secondary">{new Date(event.time).toLocaleString()}</td>
                                        <td className="px-4 py-3 text-text-secondary">{String(event.gate_id)}</td>
                                        <td className={`px-4 py-3 font-semibold ${event.geo_status === 'PASS' ? 'text-success' : 'text-error'}`}>
                                            {event.geo_status}
                                        </td>
                                        <td className={`px-4 py-3 font-semibold ${event.face_status === 'PASS' ? 'text-success' : 'text-error'}`}>
                                            {event.face_status}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${event.overall_status === 'SUCCESS' ? 'bg-success/15 text-success' : 'bg-error/15 text-error'}`}>
                                                    {event.overall_status}
                                                </span>
                                                {event.suspicious && <TriangleAlert size={14} className="text-warning" />}
                                            </div>
                                            {event.failure_reason && (
                                                <p className="text-[11px] text-warning mt-1">{event.failure_reason}</p>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-text-secondary">{event.location_trust_score}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="flex items-center justify-between">
                    <p className="text-xs text-text-secondary">Page {accessPage} of {activityPages}</p>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setAccessPage((p) => Math.max(1, p - 1))}
                            disabled={accessPage <= 1}
                            className="px-3 py-1.5 rounded-lg bg-white/5 disabled:opacity-40"
                        >
                            Previous
                        </button>
                        <button
                            onClick={() => setAccessPage((p) => Math.min(activityPages, p + 1))}
                            disabled={accessPage >= activityPages}
                            className="px-3 py-1.5 rounded-lg bg-white/5 disabled:opacity-40"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </section>
        </div>
    )
}
