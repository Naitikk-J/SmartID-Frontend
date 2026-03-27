import { useState, useRef, useEffect, useCallback } from 'react'
import { Camera, LogIn, LogOut, AlertCircle, Shield, ShieldAlert, Activity, Eye, Users, Clock, Zap } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '../api/axios'

/* ═══════════════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════════════ */

interface TrackedFace {
    trackId: number | null
    studentId?: string
    studentName?: string
    enrollmentNo?: string
    studentType?: string
    confidence: number
    bbox: number[]          // [x1, y1, x2, y2] in original image coords
    isLive: boolean
    antiSpoofScore: number
    detScore: number
    firstSeenAt: number     // timestamp ms
    lastSeenAt: number
    color: string           // assigned track colour
}

interface MatchedStudent {
    id: string
    name: string
    confidence: number
    trackId?: number | null
    lastSeen?: string
}

interface PerformanceStats {
    fps: number
    latencyMs: number
    totalDetections: number
    activeTracks: number
}

/* ═══════════════════════════════════════════════════════════════
   Color palette for multi-person tracking
   ═══════════════════════════════════════════════════════════════ */

const TRACK_COLORS = [
    '#4F46E5', '#10B981', '#F59E0B', '#F43F5E', '#8B5CF6',
    '#06B6D4', '#EC4899', '#14B8A6', '#F97316', '#6366F1',
]

const getTrackColor = (trackId: number | null): string => {
    if (trackId === null) return '#94A3B8'
    return TRACK_COLORS[trackId % TRACK_COLORS.length]
}

/* ═══════════════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════════════ */

export default function FaceLiveDetectionPanel() {
    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
    const animationRef = useRef<number | undefined>(undefined)
    const streamIdRef = useRef(`hosteller-stream-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`)

    const [cameraActive, setCameraActive] = useState(false)
    const [matchedStudents, setMatchedStudents] = useState<MatchedStudent[]>([])
    const [isLogging, setIsLogging] = useState(false)
    const [recentMatches, setRecentMatches] = useState<MatchedStudent[]>([])
    const [cameraError, setCameraError] = useState<string | null>(null)
    const [matchingMode, setMatchingMode] = useState<'BACKEND' | 'LOCAL'>('BACKEND')

    // ─── Tracked faces state ───
    const [trackedFaces, setTrackedFaces] = useState<TrackedFace[]>([])
    const trackedFacesMapRef = useRef<Map<number, TrackedFace>>(new Map())

    // ─── Performance stats ───
    const [perfStats, setPerfStats] = useState<PerformanceStats>({
        fps: 0, latencyMs: 0, totalDetections: 0, activeTracks: 0,
    })
    const frameTimesRef = useRef<number[]>([])
    const totalDetectionsRef = useRef(0)

    // ─── Refs for current values in async callbacks ───
    const lastExtractAttemptRef = useRef(0)
    const lastMatchAttemptRef = useRef(0)
    const faceMatchAvailableRef = useRef(true)
    const matchingModeRef = useRef<'BACKEND' | 'LOCAL'>('BACKEND')
    const autoLogCooldownRef = useRef<Record<string, number>>({})
    const lastDirectionRef = useRef<Record<string, 'ENTRY' | 'EXIT'>>({})
    const autoLogInFlightRef = useRef(false)

    const AUTO_LOG_MIN_CONFIDENCE = 88
    const AUTO_LOG_COOLDOWN_MS = 15000
    const EXTRACT_INTERVAL_MS = 90
    const MATCH_INTERVAL_MS = 420

    /* ─── Auto-log entry/exit ─── */
    const attemptAutoLog = async (student: MatchedStudent, matchConfidence: number) => {
        if (matchConfidence < AUTO_LOG_MIN_CONFIDENCE) return
        if (!faceMatchAvailableRef.current || matchingModeRef.current !== 'BACKEND') return
        if (autoLogInFlightRef.current) return

        const now = Date.now()
        const lastLoggedAt = autoLogCooldownRef.current[student.id] || 0
        if (now - lastLoggedAt < AUTO_LOG_COOLDOWN_MS) return

        const previousDirection = lastDirectionRef.current[student.id]
        const direction: 'ENTRY' | 'EXIT' = previousDirection === 'ENTRY' ? 'EXIT' : 'ENTRY'

        autoLogInFlightRef.current = true
        try {
            const response = await api.post(
                '/scan/face-detection',
                { studentId: student.id, direction, confidence: matchConfidence, timestamp: new Date().toISOString() },
                { validateStatus: (status) => status < 500 }
            )
            if (response.status >= 200 && response.status < 300) {
                autoLogCooldownRef.current[student.id] = now
                lastDirectionRef.current[student.id] = direction
                setRecentMatches((prev) => [student, ...prev.filter((e) => e.id !== student.id).slice(0, 4)])
                toast.success(`Auto ${direction.toLowerCase()} logged for ${student.name}`)
            }
        } catch { /* silent */ } finally {
            autoLogInFlightRef.current = false
        }
    }

    const switchToLocalMode = (message: string) => {
        faceMatchAvailableRef.current = false
        matchingModeRef.current = 'LOCAL'
        setMatchingMode('LOCAL')
        setCameraError(message)
    }

    /* ─── Compressed frame builder ─── */
    const buildCompressedFrame = () => {
        if (!canvasRef.current) return null
        const src = canvasRef.current
        const maxW = 352
        const scale = src.width > maxW ? maxW / src.width : 1
        const w = Math.max(1, Math.round(src.width * scale))
        const h = Math.max(1, Math.round(src.height * scale))
        const small = document.createElement('canvas')
        small.width = w
        small.height = h
        const ctx = small.getContext('2d')
        if (!ctx) return null
        ctx.drawImage(src, 0, 0, w, h)
        return {
            imageFrame: small.toDataURL('image/jpeg', 0.42),
            frameWidth: w,
            frameHeight: h,
        }
    }

    /* ═══════════════════════════════════════════════════════════
       Draw bounding boxes + track labels on overlay canvas
       ═══════════════════════════════════════════════════════════ */
    const drawOverlay = useCallback((faces: TrackedFace[], videoW: number, videoH: number) => {
        const overlay = overlayCanvasRef.current
        if (!overlay) return
        const ctx = overlay.getContext('2d')
        if (!ctx) return

        overlay.width = videoW
        overlay.height = videoH
        ctx.clearRect(0, 0, videoW, videoH)

        // Scan line animation
        const scanY = (Date.now() % 3000) / 3000 * videoH
        const scanGrad = ctx.createLinearGradient(0, scanY - 2, 0, scanY + 2)
        scanGrad.addColorStop(0, 'rgba(79, 70, 229, 0)')
        scanGrad.addColorStop(0.5, 'rgba(79, 70, 229, 0.4)')
        scanGrad.addColorStop(1, 'rgba(79, 70, 229, 0)')
        ctx.fillStyle = scanGrad
        ctx.fillRect(0, scanY - 2, videoW, 4)

        // Corner crosshair
        ctx.strokeStyle = 'rgba(79, 70, 229, 0.3)'
        ctx.lineWidth = 1
        const cx = videoW / 2, cy = videoH / 2, ch = 30
        ctx.beginPath()
        ctx.moveTo(cx - ch, cy); ctx.lineTo(cx + ch, cy)
        ctx.moveTo(cx, cy - ch); ctx.lineTo(cx, cy + ch)
        ctx.stroke()

        for (const face of faces) {
            const [x1, y1, x2, y2] = face.bbox
            const w = x2 - x1
            const h = y2 - y1
            const color = face.color
            const cornerLen = Math.min(20, w * 0.3, h * 0.3)

            // Glow effect
            ctx.shadowColor = color
            ctx.shadowBlur = 12

            // Bounding box with corner brackets
            ctx.strokeStyle = color
            ctx.lineWidth = 2.5
            ctx.beginPath()
            // Top-left
            ctx.moveTo(x1, y1 + cornerLen); ctx.lineTo(x1, y1); ctx.lineTo(x1 + cornerLen, y1)
            // Top-right
            ctx.moveTo(x2 - cornerLen, y1); ctx.lineTo(x2, y1); ctx.lineTo(x2, y1 + cornerLen)
            // Bottom-right
            ctx.moveTo(x2, y2 - cornerLen); ctx.lineTo(x2, y2); ctx.lineTo(x2 - cornerLen, y2)
            // Bottom-left
            ctx.moveTo(x1 + cornerLen, y2); ctx.lineTo(x1, y2); ctx.lineTo(x1, y2 - cornerLen)
            ctx.stroke()

            // Thin connecting lines
            ctx.strokeStyle = color.replace(')', ', 0.3)').replace('rgb(', 'rgba(').replace('#', '')
            ctx.strokeStyle = `${color}50`
            ctx.lineWidth = 1
            ctx.strokeRect(x1, y1, w, h)

            ctx.shadowBlur = 0

            // Label background
            const label = face.studentName
                ? `${face.studentName} · ${Math.round(face.confidence)}%`
                : face.trackId !== null
                    ? `Person #${face.trackId} · ${Math.round(face.detScore * 100)}%`
                    : 'Detecting...'

            ctx.font = 'bold 12px "Outfit", "Inter", sans-serif'
            const textMetrics = ctx.measureText(label)
            const labelW = textMetrics.width + 16
            const labelH = 24
            const labelX = x1
            const labelY = y1 - labelH - 4

            // Label pill
            ctx.fillStyle = `${color}CC`
            ctx.beginPath()
            const r = 6
            ctx.roundRect(labelX, labelY, labelW, labelH, r)
            ctx.fill()

            // Label text
            ctx.fillStyle = '#FFFFFF'
            ctx.textBaseline = 'middle'
            ctx.fillText(label, labelX + 8, labelY + labelH / 2)

            // Anti-spoof badge
            const spoofLabel = face.isLive ? '✓ LIVE' : '✗ SPOOF'
            const spoofColor = face.isLive ? '#10B981' : '#F43F5E'
            const spoofW = ctx.measureText(spoofLabel).width + 12
            ctx.fillStyle = `${spoofColor}CC`
            ctx.beginPath()
            ctx.roundRect(x2 - spoofW, y1 - labelH - 4, spoofW, labelH, r)
            ctx.fill()
            ctx.fillStyle = '#FFFFFF'
            ctx.font = 'bold 10px "Outfit", "Inter", sans-serif'
            ctx.fillText(spoofLabel, x2 - spoofW + 6, y1 - labelH - 4 + labelH / 2)

            // Confidence bar under bbox
            const barW = w
            const barH = 4
            const barY = y2 + 6
            ctx.fillStyle = 'rgba(255,255,255,0.1)'
            ctx.beginPath()
            ctx.roundRect(x1, barY, barW, barH, 2)
            ctx.fill()
            const conf = face.confidence / 100
            ctx.fillStyle = face.confidence > 90 ? '#10B981' : face.confidence > 75 ? '#F59E0B' : '#F43F5E'
            ctx.beginPath()
            ctx.roundRect(x1, barY, barW * conf, barH, 2)
            ctx.fill()
        }
    }, [])

    /* ═══════════════════════════════════════════════════════════
       Camera start / stop
       ═══════════════════════════════════════════════════════════ */
    const startCamera = async () => {
        try {
            setCameraError(null)
            faceMatchAvailableRef.current = true
            matchingModeRef.current = 'BACKEND'
            setMatchingMode('BACKEND')
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
                audio: false,
            })
            streamIdRef.current = `hosteller-stream-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
            if (videoRef.current) {
                videoRef.current.srcObject = stream
                setCameraActive(true)
                videoRef.current.onloadedmetadata = () => {
                    videoRef.current?.play().catch(() => undefined)
                    detectFacesInRealTime()
                }
            }
        } catch {
            setCameraError('Camera access is blocked. Allow camera permission in your browser settings.')
            toast.error('Camera access denied')
        }
    }

    const stopCamera = () => {
        if (videoRef.current?.srcObject) {
            ; (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop())
            setCameraActive(false)
        }
        if (animationRef.current) cancelAnimationFrame(animationRef.current)
        setTrackedFaces([])
        setMatchedStudents([])
        trackedFacesMapRef.current.clear()
        totalDetectionsRef.current = 0
        setPerfStats({ fps: 0, latencyMs: 0, totalDetections: 0, activeTracks: 0 })
    }

    /* ═══════════════════════════════════════════════════════════
       Real-time detection loop
       ═══════════════════════════════════════════════════════════ */
    const detectFacesInRealTime = async () => {
        if (!videoRef.current || !canvasRef.current) return

        const context = canvasRef.current.getContext('2d')
        if (!context) return

        const processFrame = async () => {
            try {
                if (!videoRef.current || !canvasRef.current) {
                    animationRef.current = requestAnimationFrame(processFrame)
                    return
                }

                const vw = videoRef.current.videoWidth
                const vh = videoRef.current.videoHeight
                if (vw === 0 || vh === 0) {
                    animationRef.current = requestAnimationFrame(processFrame)
                    return
                }

                canvasRef.current.width = vw
                canvasRef.current.height = vh
                context.drawImage(videoRef.current, 0, 0)

                // Always draw overlay (scan line animation)
                const currentFaces = Array.from(trackedFacesMapRef.current.values())
                drawOverlay(currentFaces, vw, vh)

                // FPS tracking
                const now = Date.now()
                frameTimesRef.current.push(now)
                frameTimesRef.current = frameTimesRef.current.filter((t) => now - t < 1000)

                const imageFrame = buildCompressedFrame()
                if (!imageFrame) {
                    animationRef.current = requestAnimationFrame(processFrame)
                    return
                }

                const scaleBboxToVideo = (bbox: number[]): number[] => {
                    const sx = vw / Math.max(1, imageFrame.frameWidth)
                    const sy = vh / Math.max(1, imageFrame.frameHeight)

                    const [x1, y1, x2, y2] = bbox
                    return [
                        Math.max(0, Math.min(vw, x1 * sx)),
                        Math.max(0, Math.min(vh, y1 * sy)),
                        Math.max(0, Math.min(vw, x2 * sx)),
                        Math.max(0, Math.min(vh, y2 * sy)),
                    ]
                }

                // Fast backend extraction for dynamic tracking
                if (faceMatchAvailableRef.current) {
                    const shouldAttemptExtract = now - lastExtractAttemptRef.current >= EXTRACT_INTERVAL_MS
                    if (shouldAttemptExtract) {
                        lastExtractAttemptRef.current = now
                        const extractStart = Date.now()

                        try {
                            const extractResponse = await api.post(
                                '/scan/face-extract',
                                { imageFrame: imageFrame.imageFrame, streamId: streamIdRef.current },
                                { validateStatus: (status) => status < 500 }
                            )

                            const extractLatency = Date.now() - extractStart
                            const extractData = extractResponse.data?.data || {}

                            if (extractData?.aiUnavailable) {
                                switchToLocalMode(extractData?.aiMessage || 'Face extraction API unavailable. Running local preview mode.')
                            } else {
                                const trackedFacesFromApi: any[] = Array.isArray(extractData.trackedFaces) ? extractData.trackedFaces : []
                                const detectedPersons = Number(extractData.detectedPersons || trackedFacesFromApi.length || 0)

                                const updated = new Map<number, TrackedFace>()
                                const nowMs = Date.now()

                                trackedFacesFromApi.forEach((trackedFace, faceIndex) => {
                                    if (!Array.isArray(trackedFace?.bbox) || trackedFace.bbox.length < 4) return

                                    const normalizedBbox = trackedFace.bbox.slice(0, 4).map((value: unknown) => Number(value))
                                    if (normalizedBbox.some((value: number) => Number.isNaN(value))) return
                                    const displayBbox = scaleBboxToVideo(normalizedBbox)

                                    const rawTrackId = trackedFace?.trackId
                                    const trackKey = typeof rawTrackId === 'number' ? rawTrackId : -(faceIndex + 1)
                                    const existing = trackedFacesMapRef.current.get(trackKey)
                                    const confidence = Number(
                                        trackedFace?.confidence || (Number(trackedFace?.detScore || 0) * 100) || 0
                                    )

                                    updated.set(trackKey, {
                                        trackId: typeof rawTrackId === 'number' ? rawTrackId : null,
                                        studentId: existing?.studentId,
                                        studentName: existing?.studentName,
                                        enrollmentNo: existing?.enrollmentNo,
                                        studentType: existing?.studentType,
                                        confidence,
                                        bbox: displayBbox,
                                        isLive: trackedFace?.isLive !== false,
                                        antiSpoofScore: Number(trackedFace?.antiSpoofScore || 0),
                                        detScore: Number(trackedFace?.detScore || 0),
                                        firstSeenAt: existing?.firstSeenAt || nowMs,
                                        lastSeenAt: nowMs,
                                        color: existing?.color || getTrackColor(typeof rawTrackId === 'number' ? rawTrackId : faceIndex),
                                    })
                                })

                                trackedFacesMapRef.current.forEach((face, tid) => {
                                    if (!updated.has(tid) && nowMs - face.lastSeenAt < 1000) {
                                        updated.set(tid, face)
                                    }
                                })

                                trackedFacesMapRef.current = updated
                                totalDetectionsRef.current += detectedPersons
                                setTrackedFaces(Array.from(updated.values()))
                                setPerfStats((prev) => ({
                                    ...prev,
                                    fps: frameTimesRef.current.length,
                                    latencyMs: extractLatency,
                                    totalDetections: totalDetectionsRef.current,
                                    activeTracks: updated.size,
                                }))
                            }
                        } catch {
                            switchToLocalMode('Face extraction API unavailable. Running local preview mode.')
                        }
                    }

                    const shouldAttemptMatch = now - lastMatchAttemptRef.current >= MATCH_INTERVAL_MS
                    if (shouldAttemptMatch) {
                        lastMatchAttemptRef.current = now

                        try {
                            const response = await api.post(
                                '/scan/face-match',
                                { imageFrame: imageFrame.imageFrame, streamId: streamIdRef.current },
                                { validateStatus: (status) => status < 500 }
                            )

                            if (response.status === 404) {
                                switchToLocalMode('Face match API is not deployed. Running local preview mode.')
                            } else {
                                const data = response.data?.data || response.data || {}
                                if (data?.aiUnavailable) {
                                    switchToLocalMode(data?.aiMessage || 'Face match AI unavailable. Running local preview mode.')
                                } else {
                                    const matches: any[] = Array.isArray(data.matches) ? data.matches : []
                                    const uniqueMatchedStudents = Array.from(
                                        new Map(
                                            matches
                                                .filter((match) => match?.studentId && Number(match?.confidence || 0) > 70)
                                                .map((match) => [
                                                    `${match.studentId}:${typeof match.trackId === 'number' ? match.trackId : 'na'}`,
                                                    {
                                                        id: match.studentId,
                                                        name: match.studentName,
                                                        confidence: Number(match.confidence || 0),
                                                        trackId: match.trackId,
                                                    },
                                                ])
                                        ).values()
                                    )

                                    if (matches.length > 0) {
                                        const enriched = new Map(trackedFacesMapRef.current)
                                        for (const match of matches) {
                                            const trackKey = typeof match.trackId === 'number' ? match.trackId : null
                                            if (trackKey === null) continue
                                            const existing = enriched.get(trackKey)
                                            if (!existing) continue
                                            enriched.set(trackKey, {
                                                ...existing,
                                                studentId: match.studentId || existing.studentId,
                                                studentName: match.studentName || existing.studentName,
                                                enrollmentNo: match.enrollmentNo || existing.enrollmentNo,
                                                studentType: match.studentType || existing.studentType,
                                                confidence: Number(match.confidence || existing.confidence),
                                            })
                                        }
                                        trackedFacesMapRef.current = enriched
                                        setTrackedFaces(Array.from(enriched.values()))
                                    }

                                    setMatchedStudents(uniqueMatchedStudents)

                                    if (uniqueMatchedStudents.length > 0) {
                                        const best = [...uniqueMatchedStudents].sort((a, b) => b.confidence - a.confidence)[0]
                                        await attemptAutoLog(best, best.confidence)
                                    }
                                }
                            }
                        } catch {
                            switchToLocalMode('Face match API unavailable. Running local preview mode.')
                        }
                    }
                }

                // Local fallback
                if (!faceMatchAvailableRef.current || matchingModeRef.current === 'LOCAL') {
                    const mockFace: TrackedFace = {
                        trackId: 1,
                        confidence: 88 + Math.random() * 10,
                        bbox: [canvasRef.current!.width * 0.3, canvasRef.current!.height * 0.15,
                        canvasRef.current!.width * 0.7, canvasRef.current!.height * 0.85],
                        isLive: true,
                        antiSpoofScore: 75,
                        detScore: 0.92,
                        firstSeenAt: Date.now() - 5000,
                        lastSeenAt: Date.now(),
                        color: TRACK_COLORS[1],
                        studentName: 'Local Preview',
                    }
                    setTrackedFaces([mockFace])
                    trackedFacesMapRef.current.set(1, mockFace)
                    setMatchedStudents([{
                        id: 'local-preview',
                        name: 'Local Preview Student',
                        confidence: mockFace.confidence,
                        trackId: 1,
                    }])
                    setPerfStats((prev) => ({
                        ...prev,
                        fps: frameTimesRef.current.length,
                        activeTracks: 1,
                    }))
                }

                animationRef.current = requestAnimationFrame(processFrame)
            } catch (error) {
                console.error('Frame processing error:', error)
                animationRef.current = requestAnimationFrame(processFrame)
            }
        }

        animationRef.current = requestAnimationFrame(processFrame)
    }

    /* ─── Manual entry/exit log ─── */
    const logEntryExit = async (direction: 'ENTRY' | 'EXIT') => {
        const best = matchedStudents.sort((a, b) => b.confidence - a.confidence)[0]
        if (!best || best.confidence < 85) {
            toast.error('Insufficient confidence. Face not clearly visible.')
            return
        }

        if (best.id === 'local-preview') {
            toast.error('Live backend recognition unavailable. Entry/exit logging is disabled in local preview mode.')
            return
        }

        setIsLogging(true)
        try {
            const response = await api.post(
                '/scan/face-detection',
                { studentId: best.id, direction, confidence: best.confidence, timestamp: new Date().toISOString() },
                { validateStatus: (status) => status < 500 }
            )
            if (response.status === 404) {
                setRecentMatches([best, ...recentMatches.slice(0, 4)])
                toast.success(`${direction === 'ENTRY' ? 'Entry' : 'Exit'} saved locally (endpoint not deployed)`)
            } else if (response.status === 200) {
                setRecentMatches([best, ...recentMatches.slice(0, 4)])
                toast.success(`${direction === 'ENTRY' ? 'Entry' : 'Exit'} logged for ${best.name}`)
            }
            setTimeout(() => { setMatchedStudents([]); }, 1200)
        } catch {
            toast.error('Failed to log entry/exit')
        } finally {
            setIsLogging(false)
        }
    }

    useEffect(() => {
        return () => { stopCamera() }
    }, [])

    const bestMatch = matchedStudents.sort((a, b) => b.confidence - a.confidence)[0] || null

    /* ═══════════════════════════════════════════════════════════
       Render
       ═══════════════════════════════════════════════════════════ */
    return (
        <div className="bg-gradient-to-br from-[#1e2139]/80 to-[#2a2d47]/80 backdrop-blur-md rounded-3xl border border-white/10 p-6 lg:p-8">
            <div className="space-y-5">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-2xl font-bold text-text-primary flex items-center gap-3">
                            <div className="bg-primary/20 border border-primary p-2 rounded-xl relative">
                                <Camera size={24} className="text-primary" />
                                {cameraActive && (
                                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-success rounded-full animate-pulse border-2 border-[#1e2139]" />
                                )}
                            </div>
                            Face Recognition Entry System
                        </h3>
                        <p className="text-text-secondary text-sm mt-1.5">
                            Real-time multi-person face detection, tracking &amp; automatic logging
                        </p>
                    </div>
                    <div className="hidden md:flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${matchingMode === 'BACKEND'
                            ? 'bg-primary/10 text-primary border-primary/30'
                            : 'bg-warning/10 text-warning border-warning/30'
                            }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${matchingMode === 'BACKEND' ? 'bg-primary' : 'bg-warning'}`} />
                            {matchingMode === 'BACKEND' ? 'AI Backend' : 'Local Preview'}
                        </span>
                    </div>
                </div>

                {/* Performance Stats Bar */}
                {cameraActive && (
                    <div className="grid grid-cols-4 gap-2">
                        {[
                            { icon: <Zap size={14} />, label: 'FPS', value: perfStats.fps, color: 'text-primary' },
                            { icon: <Activity size={14} />, label: 'Latency', value: `${perfStats.latencyMs}ms`, color: 'text-accent' },
                            { icon: <Eye size={14} />, label: 'Detections', value: perfStats.totalDetections, color: 'text-success' },
                            { icon: <Users size={14} />, label: 'Tracks', value: perfStats.activeTracks, color: 'text-warning' },
                        ].map((stat) => (
                            <div key={stat.label} className="bg-white/5 border border-white/10 rounded-xl p-2.5 text-center">
                                <div className={`flex items-center justify-center gap-1.5 ${stat.color} mb-0.5`}>
                                    {stat.icon}
                                    <span className="text-[10px] uppercase tracking-wider font-bold opacity-70">{stat.label}</span>
                                </div>
                                <p className="text-text-primary font-black text-lg leading-none">{stat.value}</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* Camera Feed + Overlay */}
                <div className="relative bg-black rounded-2xl overflow-hidden aspect-video min-h-[260px]">
                    <video ref={videoRef} autoPlay playsInline muted
                        className={`absolute inset-0 w-full h-full object-cover ${!cameraActive ? 'hidden' : ''}`}
                    />
                    <canvas ref={canvasRef} className="hidden" />
                    {/* Visual overlay canvas (bounding boxes, labels, scan line) */}
                    <canvas ref={overlayCanvasRef}
                        className={`absolute inset-0 w-full h-full object-cover pointer-events-none z-10 ${!cameraActive ? 'hidden' : ''}`}
                    />

                    {!cameraActive ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black z-10">
                            <div className="relative">
                                <Camera size={48} className="text-text-secondary" />
                                <div className="absolute -inset-4 border-2 border-dashed border-primary/30 rounded-2xl animate-pulse" />
                            </div>
                            <div className="text-center">
                                <p className="text-text-secondary text-sm mb-3">Multi-person face recognition with real-time tracking</p>
                                <button
                                    onClick={startCamera}
                                    className="px-8 py-3.5 bg-gradient-to-r from-primary to-accent text-white font-bold rounded-2xl hover:shadow-lg hover:shadow-primary/30 transition-all active:scale-95"
                                >
                                    <Camera className="inline mr-2" size={18} />
                                    Activate Camera
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Top-left: Detection count */}
                            <div className="absolute top-3 left-3 z-20 bg-black/60 backdrop-blur-sm border border-white/15 rounded-lg px-3 py-2 space-y-0.5">
                                <p className="text-white text-xs font-bold flex items-center gap-1.5">
                                    <Eye size={12} className="text-primary" />
                                    Detected: <span className="text-primary">{trackedFaces.length}</span>
                                </p>
                                <p className="text-white/70 text-[10px] flex items-center gap-1.5">
                                    <Users size={10} />
                                    Tracked: <span className="text-accent">{perfStats.activeTracks}</span>
                                </p>
                            </div>

                            {/* Top-right: Live indicator */}
                            <div className="absolute top-3 right-3 z-20 flex items-center gap-2 bg-black/60 backdrop-blur-sm border border-white/15 rounded-lg px-3 py-2">
                                <div className="w-2.5 h-2.5 bg-success rounded-full animate-pulse" />
                                <span className="text-white text-xs font-bold">
                                    {trackedFaces.length > 0 ? `${trackedFaces.length} Face${trackedFaces.length > 1 ? 's' : ''} Detected` : 'Scanning...'}
                                </span>
                            </div>
                        </>
                    )}
                </div>

                {cameraError && (
                    <div className="bg-error/10 border border-error/30 rounded-2xl p-4 flex items-start gap-3">
                        <AlertCircle size={18} className="text-error flex-shrink-0 mt-0.5" />
                        <p className="text-error text-sm">{cameraError}</p>
                    </div>
                )}

                {/* ═══ Multi-Person Tracking Panel ═══ */}
                {cameraActive && trackedFaces.length > 0 && (
                    <div className="space-y-3">
                        <p className="text-sm font-bold text-text-primary flex items-center gap-2">
                            <Users size={16} className="text-accent" />
                            Active Tracked Persons ({trackedFaces.length})
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {trackedFaces.map((face, idx) => {
                                const duration = Math.round((face.lastSeenAt - face.firstSeenAt) / 1000)
                                return (
                                    <div key={face.trackId ?? idx}
                                        className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center gap-3 hover:bg-white/[0.08] transition-colors"
                                    >
                                        {/* Color dot */}
                                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: face.color }} />

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-text-primary font-bold text-sm truncate">
                                                {face.studentName || `Person #${face.trackId ?? '?'}`}
                                            </p>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span className="text-[10px] text-text-secondary flex items-center gap-1">
                                                    <Clock size={10} />
                                                    {duration}s
                                                </span>
                                                <span className={`text-[10px] font-bold flex items-center gap-0.5 ${face.isLive ? 'text-success' : 'text-error'}`}>
                                                    {face.isLive ? <Shield size={10} /> : <ShieldAlert size={10} />}
                                                    {face.isLive ? 'LIVE' : 'SPOOF'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Confidence */}
                                        <div className="text-right">
                                            <p className={`text-lg font-black ${face.confidence > 90 ? 'text-success' : face.confidence > 75 ? 'text-warning' : 'text-error'
                                                }`}>
                                                {Math.round(face.confidence)}%
                                            </p>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* ═══ Best Match Action Panel ═══ */}
                {cameraActive && bestMatch && (
                    <div className={`rounded-2xl p-5 border transition-all ${bestMatch.confidence > 90
                        ? 'bg-success/10 border-success/50'
                        : bestMatch.confidence > 85
                            ? 'bg-warning/10 border-warning/50'
                            : 'bg-error/10 border-error/50'
                        }`}>
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <p className="text-text-secondary text-xs uppercase tracking-wider font-bold">Best Match</p>
                                <h4 className="text-xl font-black text-text-primary mt-0.5">{bestMatch.name}</h4>
                            </div>
                            <div className="text-right">
                                <p className="text-text-secondary text-xs">Confidence</p>
                                <div className="text-3xl font-black text-primary">{Math.round(bestMatch.confidence)}%</div>
                            </div>
                        </div>

                        {/* Confidence Bar */}
                        <div className="mb-4">
                            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${bestMatch.confidence > 90 ? 'bg-success'
                                        : bestMatch.confidence > 85 ? 'bg-warning' : 'bg-error'
                                        }`}
                                    style={{ width: `${bestMatch.confidence}%` }}
                                />
                            </div>
                        </div>

                        {bestMatch.confidence < 85 && (
                            <div className="flex items-start gap-2 text-warning mb-4">
                                <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                                <span className="text-sm">Confidence below threshold. Position face more clearly.</span>
                            </div>
                        )}

                        {/* Action Buttons */}
                        {bestMatch.confidence >= 85 && (
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => logEntryExit('ENTRY')}
                                    disabled={isLogging}
                                    className="px-4 py-3 bg-success text-white font-bold rounded-xl hover:bg-success/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <LogIn size={18} />
                                    Log Entry
                                </button>
                                <button
                                    onClick={() => logEntryExit('EXIT')}
                                    disabled={isLogging}
                                    className="px-4 py-3 bg-error text-white font-bold rounded-xl hover:bg-error/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center justify-center gap-2"
                                >
                                    <LogOut size={18} />
                                    Log Exit
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* No detection placeholder */}
                {cameraActive && trackedFaces.length === 0 && (
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center">
                        <div className="animate-pulse mb-2">
                            <Eye size={24} className="mx-auto text-text-secondary/50" />
                        </div>
                        <p className="text-text-secondary text-sm">Scanning for faces — position person within the camera frame</p>
                    </div>
                )}

                {/* Person Tracking Timeline */}
                {cameraActive && trackedFaces.length > 0 && (
                    <div>
                        <p className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <Activity size={12} />
                            Tracking Timeline
                        </p>
                        <div className="bg-white/5 border border-white/10 rounded-xl p-3 space-y-2">
                            {trackedFaces.map((face, idx) => {
                                const total = Math.max(1, Date.now() - face.firstSeenAt)
                                const maxDuration = 60000
                                const barWidth = Math.min(100, (total / maxDuration) * 100)
                                return (
                                    <div key={face.trackId ?? idx} className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: face.color }} />
                                        <span className="text-[11px] text-text-secondary w-20 truncate">
                                            {face.studentName || `#${face.trackId ?? '?'}`}
                                        </span>
                                        <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all duration-1000"
                                                style={{ width: `${barWidth}%`, backgroundColor: face.color }}
                                            />
                                        </div>
                                        <span className="text-[10px] text-text-secondary/70 w-8 text-right">
                                            {Math.round(total / 1000)}s
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* Recent Matches */}
                {cameraActive && recentMatches.length > 0 && (
                    <div>
                        <p className="text-sm font-bold text-text-primary mb-2">Recent Logs</p>
                        <div className="space-y-1.5">
                            {recentMatches.map((match) => (
                                <div key={match.id}
                                    className="bg-white/5 border border-white/10 rounded-xl p-2.5 flex items-center justify-between"
                                >
                                    <span className="text-text-secondary text-sm">{match.name}</span>
                                    <span className="text-primary font-bold text-sm">{Math.round(match.confidence)}%</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Camera Control */}
                {cameraActive && (
                    <button
                        onClick={stopCamera}
                        className="w-full px-4 py-3 bg-white/5 border border-white/10 text-text-primary font-bold rounded-xl hover:bg-white/10 transition-colors"
                    >
                        Stop Camera
                    </button>
                )}
            </div>
        </div>
    )
}
