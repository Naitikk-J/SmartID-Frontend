// ─────────────────────────────────────────────────────────────
// Scanner camera page — for guards / EVENT_MANAGERs.
//
// Behaviour:
//   • Continuous camera scan (no button-per-scan)
//   • After every decode we POST to /campus-entry/scan
//   • Full-screen success (GREEN) or duplicate/error (AMBER/RED) UI
//     with student name + enrollment + branch + photo
//   • Auto-clears after 2.5s so the next student can walk up
//   • Same QR can't be scanned twice in a row (debounce by hash)
//
// Deliberately simple: no history table on this page, so a guard
// with WARDEN / SECURITY_GUARD access only sees the camera + the
// last-result banner. Admin sees the full stream elsewhere.
// ─────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'
import { CheckCircle2, XCircle, AlertTriangle, Camera, Loader2 } from 'lucide-react'
import { scanCampusEntry, warmupCampusEntry, type ScanResult } from '../api/campusEntry'

// Perceived-latency helpers: fire immediately on decode, before the
// server round-trip completes. A vibrating phone + a snap of visual
// feedback makes a 150ms API call feel instant to the guard.
function haptic(pattern: number | number[]) {
    try { navigator.vibrate?.(pattern) } catch { /* not supported on iOS Safari */ }
}

const CAMERA_ELEMENT_ID = 'campus-entry-camera'

type Banner = {
    kind: 'success' | 'warning' | 'error'
    title: string
    body?: string
    result?: ScanResult
    expiresAt: number
} | null

export default function ScannerCameraPage() {
    const [ready, setReady] = useState(false)
    const [banner, setBanner] = useState<Banner>(null)
    const [gateLabel, setGateLabel] = useState<string>(() => localStorage.getItem('mits-gate-label') || '')
    const [error, setError] = useState<string | null>(null)

    const scannerRef = useRef<Html5Qrcode | null>(null)
    const inFlightRef = useRef(false)
    // Tokens that have been sent to the server this camera session.
    // We NEVER re-send a token we've already consumed — this stops the
    // camera from re-scanning the same on-screen QR every 4 seconds
    // and flipping the guard's banner from "Entry recorded" to
    // "Already entered" a moment later. Cleared on unmount.
    const consumedTokensRef = useRef<Set<string>>(new Set())

    useEffect(() => {
        // Fire a warm-up request the moment the scanner mounts so the
        // first REAL scan of the day doesn't eat a Vercel cold start
        // (~1-2s). This request is cheap and safe to fail.
        warmupCampusEntry().catch(() => { /* ignore */ })

        let cancelled = false
        const scanner = new Html5Qrcode(CAMERA_ELEMENT_ID, /* verbose= */ false)
        scannerRef.current = scanner

        ;(async () => {
            try {
                const devices = await Html5Qrcode.getCameras()
                if (cancelled) return
                if (!devices || devices.length === 0) {
                    setError('No camera detected on this device.')
                    return
                }
                // Prefer a rear camera if we can identify one from the label.
                const rear = devices.find((d) => /back|rear|environment/i.test(d.label))
                    || devices[devices.length - 1]

                await scanner.start(
                    rear.id,
                    {
                        // 30 fps = the practical max any modern phone camera
                        // will actually deliver. Decode attempts every ~33ms
                        // — QR-in-frame to request-sent is now ~35ms.
                        fps: 30,
                        // qrbox: responsive to viewport (min 220px, capped
                        // at 320px). Smaller box = faster decode because the
                        // library only scans that pixel region.
                        qrbox: (vw, vh) => {
                            const min = Math.min(vw, vh)
                            const size = Math.max(220, Math.min(320, Math.floor(min * 0.7)))
                            return { width: size, height: size }
                        },
                        aspectRatio: 1.0,
                    },
                    onDecode,
                    () => { /* ignore per-frame decode failures */ },
                )
                if (cancelled) {
                    try { await scanner.stop() } catch { /* ignore */ }
                    return
                }
                setReady(true)
            } catch (err: any) {
                setError(err?.message || 'Failed to open camera. Grant camera permission and reload.')
            }
        })()

        return () => {
            cancelled = true
            const s = scannerRef.current
            scannerRef.current = null
            if (s) {
                s.stop().catch(() => {}).finally(() => {
                    try { s.clear() } catch { /* ignore */ }
                })
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Auto-clear banner
    useEffect(() => {
        if (!banner) return
        const remaining = Math.max(500, banner.expiresAt - Date.now())
        const t = window.setTimeout(() => setBanner(null), remaining)
        return () => window.clearTimeout(t)
    }, [banner])

    async function onDecode(decoded: string) {
        if (inFlightRef.current) return
        // If we've already sent THIS exact token to the server in this
        // session, skip forever. Student QRs rotate every ~11s so a
        // "next" scan of the same person will produce a different
        // string. Prevents the "Already entered" flip-back bug where
        // the camera keeps decoding the same QR after a successful
        // scan and the server correctly, but confusingly, replies
        // ALREADY_ENTERED on the second call.
        if (consumedTokensRef.current.has(decoded)) return

        consumedTokensRef.current.add(decoded)
        inFlightRef.current = true

        // Immediate feedback — buzz the phone the INSTANT we decoded a
        // QR, before the /scan round-trip returns. Guards feel this as
        // "scanned!" even if the network takes 200ms.
        haptic(40)
        // Optimistic pending banner so the screen doesn't sit blank
        // while waiting. Gets replaced by the real result below.
        setBanner({ kind: 'success', title: 'Verifying…', expiresAt: Date.now() + 3000 })

        try {
            const result = await scanCampusEntry(decoded, gateLabel ? { gateLabel } : undefined)
            if (result.ok) {
                haptic([30, 40, 30]) // triple pulse = success
                setBanner({
                    kind: 'success',
                    title: 'Entry recorded',
                    body: `${result.student?.fullName || 'Student'}`,
                    result,
                    // Snappy for a rush at the gate — guard can also tap
                    // "Next student" on the banner to dismiss immediately.
                    expiresAt: Date.now() + 1500,
                })
            } else if (result.reason === 'ALREADY_ENTERED') {
                haptic([80, 60, 80]) // longer double = warning
                setBanner({
                    kind: 'warning',
                    title: 'Already entered',
                    body: 'This student has already entered and cannot enter again.',
                    result,
                    expiresAt: Date.now() + 3000,
                })
            } else if (result.reason === 'EXPIRED') {
                haptic(200)
                setBanner({
                    kind: 'error',
                    title: 'QR expired',
                    body: 'Ask the student to open a fresh pass.',
                    expiresAt: Date.now() + 2500,
                })
            } else {
                haptic(200)
                setBanner({
                    kind: 'error',
                    title: 'Invalid QR',
                    body: result.message || result.reason,
                    expiresAt: Date.now() + 2500,
                })
            }
        } catch (err: any) {
            haptic(200)
            setBanner({
                kind: 'error',
                title: 'Scan failed',
                body: err?.response?.data?.error || err.message || 'Network error',
                expiresAt: Date.now() + 2500,
            })
        } finally {
            // No cooldown — inFlightRef alone is enough to prevent
            // parallel requests, and consumedTokensRef prevents the
            // same QR being sent twice. The next DIFFERENT token can
            // fire the very next frame, so throughput is bound only
            // by the API latency (~100-150ms per scan).
            inFlightRef.current = false
        }
    }

    return (
        <div className="fixed inset-0 bg-black text-white flex flex-col overflow-hidden">
            <header className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
                <div className="flex items-center gap-2">
                    <Camera size={18} className="text-emerald-400" />
                    <span className="text-sm font-semibold">Campus Entry Scanner</span>
                </div>
                <label className="text-xs text-white/60 flex items-center gap-2">
                    <span className="hidden sm:inline">Gate label</span>
                    <input
                        type="text"
                        value={gateLabel}
                        onChange={(e) => {
                            const v = e.target.value.slice(0, 40)
                            setGateLabel(v)
                            localStorage.setItem('mits-gate-label', v)
                        }}
                        placeholder="e.g. MAIN GATE"
                        className="rounded-md bg-white/5 border border-white/10 px-2 py-1 text-xs w-32 outline-none focus:border-white/40"
                    />
                </label>
            </header>

            <div className="relative flex-1 min-h-0">
                {/* html5-qrcode injects its own <video> here */}
                <div
                    id={CAMERA_ELEMENT_ID}
                    className="absolute inset-0 flex items-center justify-center [&_video]:!w-full [&_video]:!h-full [&_video]:!object-cover"
                />

                {!ready && !error && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-white/60">
                        <Loader2 className="animate-spin" size={22} />
                        <p className="text-xs">Starting camera…</p>
                    </div>
                )}

                {error && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center p-6">
                        <XCircle className="text-red-400" size={28} />
                        <p className="text-sm font-semibold text-red-200">{error}</p>
                        <button
                            onClick={() => window.location.reload()}
                            className="mt-2 text-xs px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20"
                        >
                            Retry
                        </button>
                    </div>
                )}

                {/* No custom aim overlay here — html5-qrcode already
                    draws its own qrbox with L-brackets + a shaded
                    background. Adding a second frame on top of it
                    produces the double-frame you saw on iOS. */}

                {banner && (
                    <div className="absolute inset-0 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
                        <BannerCard banner={banner} onDismiss={() => setBanner(null)} />
                    </div>
                )}

                {/* Subtle "camera live" indicator so a guard knows the
                    scanner is actually watching, even between students. */}
                {ready && !banner && (
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 text-[11px] text-white/70 bg-black/40 px-3 py-1 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Ready — hold student QR inside the frame
                    </div>
                )}
            </div>
        </div>
    )
}

function BannerCard({ banner, onDismiss }: { banner: NonNullable<Banner>; onDismiss: () => void }) {
    const palette = banner.kind === 'success'
        ? { bg: 'from-emerald-500/20 to-emerald-500/5', border: 'border-emerald-400/40', icon: <CheckCircle2 size={40} className="text-emerald-300" /> }
        : banner.kind === 'warning'
        ? { bg: 'from-amber-500/20 to-amber-500/5', border: 'border-amber-400/40', icon: <AlertTriangle size={40} className="text-amber-300" /> }
        : { bg: 'from-red-500/20 to-red-500/5', border: 'border-red-400/40', icon: <XCircle size={40} className="text-red-300" /> }

    const s = banner.result?.student
    return (
        <div className={`w-full max-w-sm rounded-3xl border ${palette.border} bg-gradient-to-br ${palette.bg} p-6 text-center shadow-2xl`}>
            <div className="flex justify-center">{palette.icon}</div>
            <h2 className="text-2xl font-bold mt-3">{banner.title}</h2>
            {banner.body && <p className="text-sm text-white/70 mt-1">{banner.body}</p>}

            {s && (
                <div className="mt-5 text-left rounded-xl bg-black/30 border border-white/10 p-3 text-xs space-y-1.5">
                    {s.photoUrl && (
                        <div className="flex justify-center mb-2">
                            <img
                                src={s.photoUrl}
                                alt=""
                                className="w-16 h-16 rounded-full object-cover border border-white/20"
                                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
                            />
                        </div>
                    )}
                    <Row k="Name" v={s.fullName} />
                    <Row k="Enrollment" v={s.enrollmentNo} />
                    {s.department && <Row k="Branch" v={s.department} />}
                    {s.year && <Row k="Year" v={String(s.year)} />}
                    {s.section && <Row k="Section" v={s.section} />}
                    {banner.result?.scannedAt && <Row k="Time" v={new Date(banner.result.scannedAt).toLocaleTimeString()} />}
                    {banner.kind === 'warning' && s.usedAt && (
                        <Row k="First entered" v={new Date(s.usedAt).toLocaleString()} />
                    )}
                </div>
            )}

            <button
                onClick={onDismiss}
                className="mt-5 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-sm font-semibold transition"
            >
                Next student
            </button>
        </div>
    )
}

function Row({ k, v }: { k: string; v: string }) {
    return (
        <div className="flex items-center justify-between gap-3">
            <span className="text-white/50">{k}</span>
            <span className="text-white font-medium truncate max-w-[65%]">{v}</span>
        </div>
    )
}
