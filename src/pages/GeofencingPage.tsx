import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { LocateFixed, MapPin, Save } from 'lucide-react'
import toast from 'react-hot-toast'

import api from '../api/axios'
import LoadingSpinner from '../components/ui/LoadingSpinner'

type GeofencingSettings = {
    campusCenterLat: number
    campusCenterLng: number
    campusRadiusMetres: number
    attendanceRadiusMetres: number
    eventScanRadiusMetres: number
    accessQrTtlSeconds: number
    accessRequireGeofence: boolean
    updatedAt?: string | null
}

type Gate = {
    id: string
    name: string
    hasGeofence?: boolean
}

type GateGeofence = {
    center_lat: number
    center_lng: number
    radius: number
    shape?: 'CIRCLE' | 'POLYGON'
}

const defaultSettings: GeofencingSettings = {
    campusCenterLat: 26.2183,
    campusCenterLng: 78.1828,
    campusRadiusMetres: 500,
    attendanceRadiusMetres: 200,
    eventScanRadiusMetres: 500,
    accessQrTtlSeconds: 30,
    accessRequireGeofence: false,
    updatedAt: null,
}

const defaultGateGeo: GateGeofence = {
    center_lat: 0,
    center_lng: 0,
    radius: 120,
    shape: 'CIRCLE',
}

export default function GeofencingPage() {
    const qc = useQueryClient()

    const [settingsForm, setSettingsForm] = useState<GeofencingSettings>(defaultSettings)
    const [selectedGateId, setSelectedGateId] = useState('')
    const [gateGeoForm, setGateGeoForm] = useState<GateGeofence>(defaultGateGeo)

    const { data: settingsData, isLoading: isLoadingSettings } = useQuery({
        queryKey: ['geofencing-settings'],
        queryFn: async () => {
            const response = await api.get('/geofencing/settings')
            return response.data?.data
        },
    })

    const { data: gates = [], isLoading: isLoadingGates } = useQuery({
        queryKey: ['geofence-gates'],
        queryFn: async () => {
            const response = await api.get('/access/gates')
            return (response.data?.data?.gates || []) as Gate[]
        },
    })

    useEffect(() => {
        if (settingsData?.settings) {
            setSettingsForm({
                ...defaultSettings,
                ...settingsData.settings,
            })
        }
    }, [settingsData])

    useEffect(() => {
        if (!selectedGateId && gates.length > 0) {
            setSelectedGateId(gates[0].id)
        }
    }, [selectedGateId, gates])

    const { data: gateGeofenceData, isLoading: isLoadingGateGeofence } = useQuery({
        queryKey: ['gate-geofence-single', selectedGateId],
        enabled: Boolean(selectedGateId),
        queryFn: async () => {
            const response = await api.get('/access/geofence', {
                params: { gateId: selectedGateId },
            })
            return response.data?.data
        },
    })

    useEffect(() => {
        const geo = gateGeofenceData?.geofence
        if (!geo) {
            setGateGeoForm(defaultGateGeo)
            return
        }

        setGateGeoForm({
            center_lat: Number(geo.center_lat),
            center_lng: Number(geo.center_lng),
            radius: Number(geo.radius ?? 120),
            shape: geo.shape || 'CIRCLE',
        })
    }, [gateGeofenceData])

    const selectedGate = useMemo(
        () => gates.find((gate) => gate.id === selectedGateId),
        [gates, selectedGateId],
    )

    const saveSettingsMutation = useMutation({
        mutationFn: async () => {
            const payload = {
                campusCenterLat: Number(settingsForm.campusCenterLat),
                campusCenterLng: Number(settingsForm.campusCenterLng),
                campusRadiusMetres: Number(settingsForm.campusRadiusMetres),
                attendanceRadiusMetres: Number(settingsForm.attendanceRadiusMetres),
                eventScanRadiusMetres: Number(settingsForm.eventScanRadiusMetres),
                accessQrTtlSeconds: Number(settingsForm.accessQrTtlSeconds),
                accessRequireGeofence: Boolean(settingsForm.accessRequireGeofence),
            }
            const response = await api.put('/geofencing/settings', payload)
            return response.data?.data
        },
        onSuccess: () => {
            toast.success('Global geofencing settings updated')
            qc.invalidateQueries({ queryKey: ['geofencing-settings'] })
        },
        onError: () => toast.error('Unable to update geofencing settings'),
    })

    const saveGateMutation = useMutation({
        mutationFn: async () => {
            if (!selectedGateId) {
                throw new Error('Please select a gate first')
            }

            const payload = {
                gateId: selectedGateId,
                center_lat: Number(gateGeoForm.center_lat),
                center_lng: Number(gateGeoForm.center_lng),
                radius: Number(gateGeoForm.radius),
                shape: gateGeoForm.shape || 'CIRCLE',
            }

            const response = await api.put('/access/geofence', payload)
            return response.data?.data
        },
        onSuccess: () => {
            toast.success('Gate geofence updated')
            qc.invalidateQueries({ queryKey: ['gate-geofence-single', selectedGateId] })
            qc.invalidateQueries({ queryKey: ['geofence-gates'] })
        },
        onError: () => toast.error('Unable to update gate geofence'),
    })

    const useCurrentLocationForGate = () => {
        if (!navigator.geolocation) {
            toast.error('Browser location is not available on this device')
            return
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = Number(position.coords.latitude.toFixed(6))
                const lng = Number(position.coords.longitude.toFixed(6))
                setGateGeoForm((prev) => ({
                    ...prev,
                    center_lat: lat,
                    center_lng: lng,
                }))
                toast.success('Current browser location loaded in gate geofence form')
            },
            () => toast.error('Unable to read browser location'),
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0,
            },
        )
    }

    const useCurrentLocationForGlobal = () => {
        if (!navigator.geolocation) {
            toast.error('Browser location is not available on this device')
            return
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = Number(position.coords.latitude.toFixed(6))
                const lng = Number(position.coords.longitude.toFixed(6))
                setSettingsForm((prev) => ({
                    ...prev,
                    campusCenterLat: lat,
                    campusCenterLng: lng,
                }))
                toast.success('Current browser location loaded in global settings form')
            },
            () => toast.error('Unable to read browser location'),
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0,
            },
        )
    }

    if (isLoadingSettings) return <LoadingSpinner />

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-text-primary">Geofencing Control Center</h2>
                <p className="text-sm text-text-secondary mt-1">
                    Update campus, attendance, event, and access geofencing settings from a single page.
                </p>
                <p className="text-xs text-warning mt-2">
                    Note: Settings are updated at runtime. Environmental defaults may be restored after a server restart.
                </p>
            </div>

            <section className="rounded-2xl border border-border bg-bg-card p-5 space-y-4">
                <h3 className="text-lg font-bold text-text-primary">Global Geofencing Settings</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    <label className="space-y-1">
                        <span className="text-xs text-text-secondary">Campus Center Latitude</span>
                        <input
                            type="number"
                            step="0.000001"
                            value={settingsForm.campusCenterLat}
                            onChange={(e) => setSettingsForm((prev) => ({ ...prev, campusCenterLat: Number(e.target.value) }))}
                            className="w-full bg-bg-dark border border-border rounded-xl px-3 py-2 text-sm"
                        />
                    </label>

                    <label className="space-y-1">
                        <span className="text-xs text-text-secondary">Campus Center Longitude</span>
                        <input
                            type="number"
                            step="0.000001"
                            value={settingsForm.campusCenterLng}
                            onChange={(e) => setSettingsForm((prev) => ({ ...prev, campusCenterLng: Number(e.target.value) }))}
                            className="w-full bg-bg-dark border border-border rounded-xl px-3 py-2 text-sm"
                        />
                    </label>

                    <label className="space-y-1">
                        <span className="text-xs text-text-secondary">Campus Radius (m)</span>
                        <input
                            type="number"
                            value={settingsForm.campusRadiusMetres}
                            onChange={(e) => setSettingsForm((prev) => ({ ...prev, campusRadiusMetres: Number(e.target.value) }))}
                            className="w-full bg-bg-dark border border-border rounded-xl px-3 py-2 text-sm"
                        />
                    </label>

                    <label className="space-y-1">
                        <span className="text-xs text-text-secondary">Attendance Radius (m)</span>
                        <input
                            type="number"
                            value={settingsForm.attendanceRadiusMetres}
                            onChange={(e) => setSettingsForm((prev) => ({ ...prev, attendanceRadiusMetres: Number(e.target.value) }))}
                            className="w-full bg-bg-dark border border-border rounded-xl px-3 py-2 text-sm"
                        />
                    </label>

                    <label className="space-y-1">
                        <span className="text-xs text-text-secondary">Event Scan Radius (m)</span>
                        <input
                            type="number"
                            value={settingsForm.eventScanRadiusMetres}
                            onChange={(e) => setSettingsForm((prev) => ({ ...prev, eventScanRadiusMetres: Number(e.target.value) }))}
                            className="w-full bg-bg-dark border border-border rounded-xl px-3 py-2 text-sm"
                        />
                    </label>

                    <label className="space-y-1">
                        <span className="text-xs text-text-secondary">Access QR TTL (seconds)</span>
                        <input
                            type="number"
                            value={settingsForm.accessQrTtlSeconds}
                            onChange={(e) => setSettingsForm((prev) => ({ ...prev, accessQrTtlSeconds: Number(e.target.value) }))}
                            className="w-full bg-bg-dark border border-border rounded-xl px-3 py-2 text-sm"
                        />
                    </label>
                </div>

                <label className="inline-flex items-center gap-2 text-sm text-text-primary">
                    <input
                        type="checkbox"
                        checked={settingsForm.accessRequireGeofence}
                        onChange={(e) => setSettingsForm((prev) => ({ ...prev, accessRequireGeofence: e.target.checked }))}
                    />
                    Require geofencing for access scans
                </label>

                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={useCurrentLocationForGlobal}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-bg-dark text-text-primary"
                    >
                        <LocateFixed size={16} />
                        Use Current Location
                    </button>
                    <button
                        onClick={() => saveSettingsMutation.mutate()}
                        disabled={saveSettingsMutation.isPending}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white font-semibold disabled:opacity-50"
                    >
                        <Save size={16} />
                        {saveSettingsMutation.isPending ? 'Saving...' : 'Save Global Settings'}
                    </button>
                    <span className="text-xs text-text-secondary">
                        Last updated: {settingsData?.settings?.updatedAt ? new Date(settingsData.settings.updatedAt).toLocaleString() : 'Not updated yet'}
                    </span>
                </div>
            </section>

            <section className="rounded-2xl border border-border bg-bg-card p-5 space-y-4">
                <h3 className="text-lg font-bold text-text-primary">Gate-level Geofence</h3>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="space-y-3">
                        <label className="space-y-1 block">
                            <span className="text-xs text-text-secondary">Select Gate</span>
                            <select
                                value={selectedGateId}
                                onChange={(e) => setSelectedGateId(e.target.value)}
                                disabled={isLoadingGates}
                                className="w-full bg-bg-dark border border-border rounded-xl px-3 py-2 text-sm"
                            >
                                {gates.map((gate) => (
                                    <option key={gate.id} value={gate.id}>
                                        {gate.name}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <div className="grid grid-cols-2 gap-3">
                            <label className="space-y-1 block">
                                <span className="text-xs text-text-secondary">Center Lat</span>
                                <input
                                    type="number"
                                    step="0.000001"
                                    value={gateGeoForm.center_lat}
                                    onChange={(e) => setGateGeoForm((prev) => ({ ...prev, center_lat: Number(e.target.value) }))}
                                    className="w-full bg-bg-dark border border-border rounded-xl px-3 py-2 text-sm"
                                />
                            </label>
                            <label className="space-y-1 block">
                                <span className="text-xs text-text-secondary">Center Lng</span>
                                <input
                                    type="number"
                                    step="0.000001"
                                    value={gateGeoForm.center_lng}
                                    onChange={(e) => setGateGeoForm((prev) => ({ ...prev, center_lng: Number(e.target.value) }))}
                                    className="w-full bg-bg-dark border border-border rounded-xl px-3 py-2 text-sm"
                                />
                            </label>
                        </div>

                        <label className="space-y-1 block">
                            <span className="text-xs text-text-secondary">Radius: {gateGeoForm.radius}m</span>
                            <input
                                type="range"
                                min={20}
                                max={200}
                                value={gateGeoForm.radius}
                                onChange={(e) => setGateGeoForm((prev) => ({ ...prev, radius: Number(e.target.value) }))}
                                className="w-full"
                            />
                        </label>

                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                onClick={useCurrentLocationForGate}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-bg-dark text-text-primary"
                            >
                                <LocateFixed size={15} />
                                Use Current Browser Location
                            </button>

                            <button
                                onClick={() => saveGateMutation.mutate()}
                                disabled={saveGateMutation.isPending || isLoadingGateGeofence || !selectedGateId}
                                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accent text-white font-semibold disabled:opacity-50"
                            >
                                <Save size={15} />
                                {saveGateMutation.isPending ? 'Saving...' : 'Save Gate Geofence'}
                            </button>
                        </div>

                        <p className="text-xs text-text-secondary">
                            Active Gate: <span className="text-text-primary font-semibold">{selectedGate?.name || 'N/A'}</span>
                        </p>
                    </div>

                    <div className="rounded-xl border border-border overflow-hidden relative min-h-64">
                        {selectedGateId && Number.isFinite(gateGeoForm.center_lat) && Number.isFinite(gateGeoForm.center_lng) ? (
                            <>
                                <iframe
                                    title="Gate geofence map"
                                    width="100%"
                                    height="100%"
                                    frameBorder="0"
                                    scrolling="no"
                                    marginHeight={0}
                                    marginWidth={0}
                                    src={`https://maps.google.com/maps?q=${gateGeoForm.center_lat},${gateGeoForm.center_lng}&t=m&z=16&output=embed&iwloc=near`}
                                    className="absolute inset-0"
                                    style={{ filter: 'invert(90%) hue-rotate(180deg) contrast(1.2)' }}
                                />
                                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                                    <div
                                        className="rounded-full border border-accent/70 bg-accent/20"
                                        style={{
                                            width: `${Math.min(180, Math.max(30, gateGeoForm.radius * 2))}px`,
                                            height: `${Math.min(180, Math.max(30, gateGeoForm.radius * 2))}px`,
                                        }}
                                    />
                                </div>
                                <div className="absolute bottom-2 left-2 text-[11px] font-bold text-white bg-black/60 px-2 py-1 rounded inline-flex items-center gap-1">
                                    <MapPin size={12} /> {selectedGate?.name || 'Gate'}
                                </div>
                            </>
                        ) : (
                            <div className="h-full min-h-64 flex items-center justify-center text-sm text-text-secondary px-4 text-center">
                                Select a gate to configure its geofence coordinates.
                            </div>
                        )}
                    </div>
                </div>
            </section>
        </div>
    )
}
