import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Maximize2, QrCode, RefreshCw } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import toast from 'react-hot-toast'
import api from '../api/axios'

type EventProjectItem = {
    id: string
    name: string
    isActive: boolean
}

type ProjectGateItem = {
    id: string
    name: string
}

const LIVE_GATE_PROJECT_OPTION = '__LIVE_GATE__'

export default function QrProjectorPage() {
    const [projectEventId, setProjectEventId] = useState('')
    const [projectQrType, setProjectQrType] = useState<'MESS' | 'STAY'>('STAY')
    const [projectGateId, setProjectGateId] = useState('')
    const [projectCountdown, setProjectCountdown] = useState(0)
    const projectQrContainerRef = useRef<HTMLDivElement | null>(null)

    const { data: eventProjectList = [], isLoading: isLoadingEventProjectList, error: eventProjectListError } = useQuery({
        queryKey: ['qrProjectorEventList'],
        refetchInterval: 60000,
        queryFn: async () => {
            const response = await api.get('/events')
            return (response.data?.data?.events || []) as EventProjectItem[]
        },
    })

    const { data: projectGates = [], isLoading: isLoadingProjectGates, error: projectGatesError } = useQuery({
        queryKey: ['qrProjectorGates'],
        refetchInterval: 60000,
        queryFn: async () => {
            const response = await api.get('/access/gates')
            return (response.data?.data?.gates || []) as ProjectGateItem[]
        },
    })

    const activeProjectEvents = useMemo(
        () => eventProjectList.filter((event) => event.isActive),
        [eventProjectList],
    )
    const selectableProjectEvents = useMemo(
        () => (activeProjectEvents.length > 0 ? activeProjectEvents : eventProjectList),
        [activeProjectEvents, eventProjectList],
    )

    const isLiveGateProjector = projectEventId === LIVE_GATE_PROJECT_OPTION

    useEffect(() => {
        if (!projectGateId && projectGates.length > 0) {
            setProjectGateId(projectGates[0].id)
            return
        }

        if (projectGateId && !projectGates.some((gate) => gate.id === projectGateId)) {
            setProjectGateId(projectGates[0]?.id || '')
        }
    }, [projectGateId, projectGates])

    useEffect(() => {
        if (!projectEventId && selectableProjectEvents.length > 0) {
            setProjectEventId(selectableProjectEvents[0].id)
            return
        }

        if (
            projectEventId
            && projectEventId !== LIVE_GATE_PROJECT_OPTION
            && !eventProjectList.some((event) => event.id === projectEventId)
        ) {
            setProjectEventId(selectableProjectEvents[0]?.id || '')
        }
    }, [projectEventId, eventProjectList, selectableProjectEvents])

    const {
        data: projectorQrData,
        isLoading: isLoadingProjectorQr,
        refetch: refetchProjectorQr,
    } = useQuery({
        queryKey: ['qrProjectorData', projectEventId, projectQrType, projectGateId],
        enabled: isLiveGateProjector ? Boolean(projectGateId) : Boolean(projectEventId),
        refetchInterval: isLiveGateProjector ? 20000 : false,
        queryFn: async () => {
            if (isLiveGateProjector) {
                const response = await api.get('/qr/generate', {
                    params: { gate_id: projectGateId },
                })
                return {
                    token: String(response.data?.data?.qr_token || ''),
                    expiresAt: response.data?.data?.expires_at || response.data?.data?.expiresAt || null,
                }
            }

            if (!projectEventId) return { token: '', expiresAt: null as string | null }

            if (projectQrType === 'STAY') {
                const response = await api.get(`/events/${projectEventId}/stay/qr`)
                return {
                    token: String(response.data?.data?.qr_token || ''),
                    expiresAt: null,
                }
            }

            const response = await api.get(`/events/${projectEventId}/mess/qr`)
            const shared = String(response.data?.data?.sharedQrToken || '')
            return {
                token: shared,
                expiresAt: null,
            }
        },
    })

    useEffect(() => {
        if (!projectorQrData?.expiresAt || projectQrType === 'STAY' || projectQrType === 'MESS') {
            setProjectCountdown(0)
            return
        }
        const tick = () => {
            const remainingMs = new Date(projectorQrData.expiresAt as string).getTime() - Date.now()
            setProjectCountdown(Math.max(0, Math.ceil(remainingMs / 1000)))
        }
        tick()
        const timerId = window.setInterval(tick, 1000)
        return () => window.clearInterval(timerId)
    }, [projectorQrData?.expiresAt, projectQrType])

    const toggleProjectorFullscreen = async () => {
        try {
            if (document.fullscreenElement) {
                await document.exitFullscreen()
                return
            }

            if (projectQrContainerRef.current) {
                await projectQrContainerRef.current.requestFullscreen()
            }
        } catch {
            toast.error('Fullscreen mode is not available in this browser context')
        }
    }

    return (
        <div className="space-y-6">
            <div>
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2.5 bg-primary/10 border border-primary/20 rounded-xl">
                        <QrCode className="text-primary" size={24} />
                    </div>
                    <div>
                        <h1 className="text-3xl font-black tracking-tight text-text-primary">QR Projector</h1>
                        <p className="text-text-secondary text-sm">Project Event and Live Gate QR on a dedicated screen.</p>
                    </div>
                </div>
            </div>

            <div className="glass-card p-6 border border-primary/20 bg-primary/5 space-y-4">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <h3 className="font-bold text-text-primary leading-tight text-lg flex items-center gap-2">
                            <QrCode size={20} className="text-primary" />
                            Event Dynamic QR Projector
                        </h3>
                        <p className="text-xs text-text-secondary mt-0.5">Project live event or gate QR on a large screen for check-in.</p>
                    </div>
                    <button
                        onClick={toggleProjectorFullscreen}
                        className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-text-primary text-xs font-black uppercase tracking-wider flex items-center gap-2"
                    >
                        <Maximize2 size={14} />
                        Fullscreen
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
                    <select
                        value={projectEventId}
                        onChange={(e) => setProjectEventId(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-text-primary"
                        disabled={isLoadingEventProjectList && isLoadingProjectGates}
                    >
                        <option value={LIVE_GATE_PROJECT_OPTION}>Live Gate QR</option>
                        {selectableProjectEvents.length === 0 && <option value="">No events found</option>}
                        {selectableProjectEvents.map((event) => (
                            <option key={event.id} value={event.id}>
                                {event.name}{event.isActive ? '' : ' (Inactive)'}
                            </option>
                        ))}
                    </select>

                    {!isLiveGateProjector ? (
                        <div className="flex rounded-xl border border-white/10 overflow-hidden w-full md:w-auto">
                            <button
                                onClick={() => setProjectQrType('MESS')}
                                className={`px-4 py-3 text-xs font-black tracking-wider ${projectQrType === 'MESS' ? 'bg-primary text-white' : 'bg-white/5 text-text-secondary hover:bg-white/10'}`}
                            >
                                Mess QR
                            </button>
                            <button
                                onClick={() => setProjectQrType('STAY')}
                                className={`px-4 py-3 text-xs font-black tracking-wider ${projectQrType === 'STAY' ? 'bg-primary text-white' : 'bg-white/5 text-text-secondary hover:bg-white/10'}`}
                            >
                                Stay QR
                            </button>
                        </div>
                    ) : (
                        <select
                            value={projectGateId}
                            onChange={(e) => setProjectGateId(e.target.value)}
                            className="w-full md:w-auto bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-text-primary"
                            disabled={isLoadingProjectGates || projectGates.length === 0}
                        >
                            {projectGates.length === 0 && <option value="">No gates found</option>}
                            {projectGates.map((gate) => (
                                <option key={gate.id} value={gate.id}>{gate.name}</option>
                            ))}
                        </select>
                    )}
                </div>

                {eventProjectListError && (
                    <p className="text-xs text-error">Unable to load events list for projector. Check backend auth/API availability.</p>
                )}
                {projectGatesError && (
                    <p className="text-xs text-error">Unable to load gates for Live Gate QR. Check access gate API configuration.</p>
                )}
                {!isLoadingEventProjectList && !eventProjectListError && selectableProjectEvents.length > 0 && activeProjectEvents.length === 0 && (
                    <p className="text-xs text-warning">No active events right now. Showing all events so you can still project and test QR.</p>
                )}

                <div ref={projectQrContainerRef} className="rounded-2xl border border-primary/30 bg-black/20 p-6 flex flex-col items-center justify-center min-h-[420px]">
                    {isLoadingProjectorQr ? (
                        <p className="text-sm text-text-secondary">Generating dynamic QR...</p>
                    ) : projectorQrData?.token ? (
                        <div className="w-full flex flex-col items-center gap-4">
                            <div className="bg-white p-4 rounded-2xl shadow-2xl shadow-black/30">
                                <QRCodeSVG value={projectorQrData.token} size={320} />
                            </div>
                            <div className="flex items-center gap-4 text-xs text-text-secondary">
                                <span className="uppercase tracking-widest font-black">{isLiveGateProjector ? 'LIVE_GATE' : projectQrType} mode</span>
                                {isLiveGateProjector ? (
                                    <span className={`font-black ${projectCountdown <= 3 ? 'text-warning' : 'text-success'}`}>
                                        TTL: {projectCountdown > 0 ? `${projectCountdown}s` : 'Rotating'}
                                    </span>
                                ) : null}
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-warning">No QR available. Select an active event/gate and retry.</p>
                    )}
                </div>
                <p className="text-[11px] text-text-secondary">Tip: Use fullscreen mode and keep this tab open. QR auto-refreshes every 20 seconds.</p>
            </div>
        </div>
    )
}