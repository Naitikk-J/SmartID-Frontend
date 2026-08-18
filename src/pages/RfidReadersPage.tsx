import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../api/axios'
import {
    Wifi, Plus, MapPin, Clock, Edit, Ban, RefreshCw
} from 'lucide-react'
import Badge from '../components/ui/Badge'
import toast from 'react-hot-toast'

export default function RfidReadersPage() {
    const queryClient = useQueryClient()
    const [showAddModal, setShowAddModal] = useState(false)
    const [editingReader, setEditingReader] = useState<any>(null)
    const [revokingReader, setRevokingReader] = useState<any>(null)

    // Form state for add reader
    const [readerId, setReaderId] = useState('')
    const [deviceName, setDeviceName] = useState('')
    const [location, setLocation] = useState('')
    const [zone, setZone] = useState('')
    const [deviceSecret, setDeviceSecret] = useState('')

    // Fetch readers
    const { data: readers = [], isLoading, refetch } = useQuery({
        queryKey: ['rfid-readers-list'],
        queryFn: () => api.get('/rfid/readers').then(res => res.data.readers),
        refetchInterval: 10000,
    })

    // Register reader mutation
    const addMutation = useMutation({
        mutationFn: (payload: any) => api.post('/rfid/readers', payload),
        onSuccess: () => {
            toast.success('Reader registered successfully')
            setShowAddModal(false)
            setReaderId('')
            setDeviceName('')
            setLocation('')
            setZone('')
            setDeviceSecret('')
            queryClient.invalidateQueries({ queryKey: ['rfid-readers-list'] })
        },
        onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to register reader'),
    })

    // Update reader mutation
    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => api.put(`/rfid/readers/${id}`, data),
        onSuccess: () => {
            toast.success('Reader updated')
            setEditingReader(null)
            queryClient.invalidateQueries({ queryKey: ['rfid-readers-list'] })
        },
        onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to update reader'),
    })

    // Revoke reader mutation
    const revokeMutation = useMutation({
        mutationFn: (id: string) => api.post(`/rfid/readers/${id}/revoke`),
        onSuccess: () => {
            toast.success('Reader revoked')
            setRevokingReader(null)
            queryClient.invalidateQueries({ queryKey: ['rfid-readers-list'] })
        },
        onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to revoke reader'),
    })

    const generateSecret = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*'
        let res = ''
        for (let i = 0; i < 32; i++) {
            res += chars.charAt(Math.floor(Math.random() * chars.length))
        }
        setDeviceSecret(res)
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-text-primary tracking-tight">ESP32 RFID Readers</h1>
                    <p className="text-xs text-text-muted">Edge devices, gate zones, security credentials & real-time telemetry</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => refetch()}
                        className="p-2 rounded-xl border border-border text-text-secondary hover:bg-bg-subtle transition-colors"
                        title="Refresh list"
                    >
                        <RefreshCw size={15} />
                    </button>
                    <button
                        onClick={() => { generateSecret(); setShowAddModal(true) }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-white hover:bg-primary-hover shadow-sm transition-colors"
                    >
                        <Plus size={16} /> Register New Reader
                    </button>
                </div>
            </div>

            {/* Readers Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {isLoading ? (
                    <div className="col-span-full py-12 text-center text-text-muted">Loading readers...</div>
                ) : readers.length === 0 ? (
                    <div className="col-span-full py-12 text-center text-text-muted rounded-2xl bg-bg-card border border-border">
                        <Wifi size={36} className="mx-auto text-text-muted/50 mb-2" />
                        <p className="text-sm font-semibold">No RFID Readers Registered</p>
                        <p className="text-xs mt-1">Register an ESP32 edge reader to start capturing RFID card taps.</p>
                    </div>
                ) : (
                    readers.map((r: any) => (
                        <div
                            key={r.id}
                            className="p-5 rounded-2xl bg-bg-card border border-border flex flex-col justify-between space-y-4 shadow-xs hover:border-primary/30 transition-colors"
                        >
                            <div>
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2.5">
                                        <div className={`w-3 h-3 rounded-full ${r.isOnline ? 'bg-success shadow-xs shadow-success/50 animate-pulse' : 'bg-danger'}`} />
                                        <div>
                                            <h3 className="text-sm font-bold text-text-primary">{r.deviceName}</h3>
                                            <p className="text-[11px] font-mono text-text-muted">{r.readerId}</p>
                                        </div>
                                    </div>
                                    <Badge
                                        variant={
                                            r.status === 'ACTIVE' ? (r.isOnline ? 'success' : 'neutral') :
                                            r.status === 'REVOKED' ? 'danger' : 'warning'
                                        }
                                    >
                                        {r.isOnline ? 'ONLINE' : r.status}
                                    </Badge>
                                </div>

                                <div className="mt-4 space-y-2 text-xs">
                                    <div className="flex items-center gap-2 text-text-secondary">
                                        <MapPin size={14} className="text-text-muted shrink-0" />
                                        <span className="truncate">{r.location || 'Location unassigned'} ({r.zone || 'NO ZONE'})</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-text-muted">
                                        <Clock size={14} className="text-text-muted shrink-0" />
                                        <span>Last ping: {r.lastHeartbeat ? new Date(r.lastHeartbeat).toLocaleTimeString() : 'Never'}</span>
                                    </div>
                                    {r.ipAddress && (
                                        <div className="flex items-center gap-2 text-text-muted font-mono text-[11px]">
                                            <Wifi size={14} className="text-text-muted shrink-0" />
                                            <span>IP: {r.ipAddress} • v{r.firmwareVersion || '1.0.0'}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="pt-3 border-t border-border/50 flex items-center justify-between">
                                <span className="text-[11px] text-text-muted">
                                    {r._count?.transactions || 0} lifetime taps
                                </span>
                                <div className="flex items-center gap-1.5">
                                    <button
                                        onClick={() => setEditingReader(r)}
                                        className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary/10 transition-colors"
                                        title="Edit reader settings"
                                    >
                                        <Edit size={14} />
                                    </button>
                                    {r.status !== 'REVOKED' && (
                                        <button
                                            onClick={() => setRevokingReader(r)}
                                            className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                                            title="Revoke reader"
                                        >
                                            <Ban size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Register Reader Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-bg-overlay backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-bg-card border border-border rounded-2xl p-6 w-full max-w-md space-y-4 shadow-xl">
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-bold text-text-primary">Register New RFID Reader</h3>
                            <button onClick={() => setShowAddModal(false)} className="text-text-muted hover:text-text-primary">✕</button>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-text-muted">Reader Identifier</label>
                            <input
                                type="text"
                                value={readerId}
                                onChange={(e) => setReaderId(e.target.value.toUpperCase())}
                                placeholder="e.g. READER_HOSTEL_GATE_01"
                                className="w-full px-3 py-2 font-mono uppercase rounded-xl bg-bg-subtle border border-border text-xs text-text-primary focus:outline-none focus:border-primary"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-text-muted">Device Name</label>
                            <input
                                type="text"
                                value={deviceName}
                                onChange={(e) => setDeviceName(e.target.value)}
                                placeholder="e.g. Boys Hostel Main Gate"
                                className="w-full px-3 py-2 rounded-xl bg-bg-subtle border border-border text-xs text-text-primary focus:outline-none focus:border-primary"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-text-muted">Zone</label>
                                <select
                                    value={zone}
                                    onChange={(e) => setZone(e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl bg-bg-subtle border border-border text-xs text-text-primary focus:outline-none focus:border-primary"
                                >
                                    <option value="">Select Zone</option>
                                    <option value="HOSTEL_GATE">HOSTEL_GATE</option>
                                    <option value="CAMPUS_GATE">CAMPUS_GATE</option>
                                    <option value="LAB_BLOCK">LAB_BLOCK</option>
                                    <option value="LIBRARY">LIBRARY</option>
                                    <option value="ADMIN_BLOCK">ADMIN_BLOCK</option>
                                    <option value="EVENT_VENUE">EVENT_VENUE</option>
                                </select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-text-muted">Location Name</label>
                                <input
                                    type="text"
                                    value={location}
                                    onChange={(e) => setLocation(e.target.value)}
                                    placeholder="e.g. Gate 1"
                                    className="w-full px-3 py-2 rounded-xl bg-bg-subtle border border-border text-xs text-text-primary focus:outline-none focus:border-primary"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-semibold text-text-muted">Device Secret (HMAC Key)</label>
                                <button onClick={generateSecret} className="text-[10px] text-primary hover:underline">Regenerate</button>
                            </div>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={deviceSecret}
                                    onChange={(e) => setDeviceSecret(e.target.value)}
                                    className="w-full px-3 py-2 font-mono text-xs rounded-xl bg-bg-subtle border border-border text-text-primary focus:outline-none focus:border-primary"
                                />
                            </div>
                            <p className="text-[10px] text-text-muted">Flash this exact secret into the ESP32 firmware config.h</p>
                        </div>

                        <div className="flex gap-2 pt-2">
                            <button onClick={() => setShowAddModal(false)} className="flex-1 py-2 rounded-xl border border-border text-xs font-semibold text-text-secondary">Cancel</button>
                            <button
                                disabled={!readerId.trim() || !deviceName.trim() || !deviceSecret.trim() || addMutation.isPending}
                                onClick={() => addMutation.mutate({
                                    readerId: readerId.trim(),
                                    deviceName: deviceName.trim(),
                                    location: location.trim() || undefined,
                                    zone: zone || undefined,
                                    deviceSecret: deviceSecret.trim(),
                                })}
                                className="flex-1 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-hover disabled:opacity-50"
                            >
                                Register Reader
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {editingReader && (
                <div className="fixed inset-0 bg-bg-overlay backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-bg-card border border-border rounded-2xl p-6 w-full max-w-md space-y-4 shadow-xl">
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-bold text-text-primary">Edit Reader: {editingReader.readerId}</h3>
                            <button onClick={() => setEditingReader(null)} className="text-text-muted hover:text-text-primary">✕</button>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-text-muted">Device Name</label>
                            <input
                                type="text"
                                defaultValue={editingReader.deviceName}
                                id="edit-device-name"
                                className="w-full px-3 py-2 rounded-xl bg-bg-subtle border border-border text-xs text-text-primary focus:outline-none focus:border-primary"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-text-muted">Zone</label>
                                <input
                                    type="text"
                                    defaultValue={editingReader.zone || ''}
                                    id="edit-zone"
                                    className="w-full px-3 py-2 rounded-xl bg-bg-subtle border border-border text-xs text-text-primary focus:outline-none focus:border-primary"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-text-muted">Location</label>
                                <input
                                    type="text"
                                    defaultValue={editingReader.location || ''}
                                    id="edit-location"
                                    className="w-full px-3 py-2 rounded-xl bg-bg-subtle border border-border text-xs text-text-primary focus:outline-none focus:border-primary"
                                />
                            </div>
                        </div>

                        <div className="flex gap-2 pt-2">
                            <button onClick={() => setEditingReader(null)} className="flex-1 py-2 rounded-xl border border-border text-xs font-semibold text-text-secondary">Cancel</button>
                            <button
                                onClick={() => {
                                    const name = (document.getElementById('edit-device-name') as HTMLInputElement)?.value
                                    const z = (document.getElementById('edit-zone') as HTMLInputElement)?.value
                                    const loc = (document.getElementById('edit-location') as HTMLInputElement)?.value
                                    updateMutation.mutate({ id: editingReader.id, data: { deviceName: name, zone: z, location: loc } })
                                }}
                                className="flex-1 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-hover"
                            >
                                Save Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Revoke Confirmation Modal */}
            {revokingReader && (
                <div className="fixed inset-0 bg-bg-overlay backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-bg-card border border-border rounded-2xl p-6 w-full max-w-md space-y-4 shadow-xl">
                        <h3 className="text-base font-bold text-danger">Revoke Reader</h3>
                        <p className="text-xs text-text-muted">
                            Are you sure you want to revoke reader <span className="font-bold text-text-primary">{revokingReader.deviceName}</span> ({revokingReader.readerId})? Any further requests signed with its credentials will be rejected.
                        </p>
                        <div className="flex gap-2 pt-2">
                            <button onClick={() => setRevokingReader(null)} className="flex-1 py-2 rounded-xl border border-border text-xs font-semibold text-text-secondary">Cancel</button>
                            <button
                                onClick={() => revokeMutation.mutate(revokingReader.id)}
                                className="flex-1 py-2 rounded-xl bg-danger text-white text-xs font-semibold hover:bg-danger/90"
                            >
                                Confirm Revoke
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
