// ─────────────────────────────────────────────────────────────
// Student pass — post-login page. Shows a rotating dynamic QR.
//
// Spec constraints:
//   • no visible countdown / TTL for the QR
//   • a warning banner: "system-generated QR, valid briefly"
//   • QR rotates automatically without user action
//   • after entry has been recorded server-side, we STOP rotating
//     and show an "Entry recorded" success state instead.
//
// Refresh cadence: the backend returns ttlSeconds (default 20s).
// We refresh at ~55% of that so a slightly slow scanner still
// catches a fresh token.
// ─────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, LogOut, ShieldAlert, Loader2, WifiOff } from 'lucide-react'
import {
    fetchStudentQr,
    fetchStudentStatus,
    fetchStudentMe,
    readStudentAuth,
    writeStudentAuth,
} from '../api/campusEntry'

interface QrState {
    token: string
    ttlSeconds: number
}

interface Me {
    id: string
    fullName: string
    email: string
    enrollmentNo: string
    department?: string | null
    year?: number | null
    photoUrl?: string | null
}

export default function StudentPassPage() {
    const navigate = useNavigate()
    const [me, setMe] = useState<Me | null>(null)
    const [qr, setQr] = useState<QrState | null>(null)
    const [entered, setEntered] = useState(false)
    const [enteredAt, setEnteredAt] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [offline, setOffline] = useState(!navigator.onLine)

    // Kept in refs so the setInterval closure sees the current values
    // without re-scheduling the interval on every render.
    const stopRef = useRef(false)
    const timerRef = useRef<number | null>(null)

    // ── Boot ────────────────────────────────────────────────
    useEffect(() => {
        const { accessToken } = readStudentAuth()
        if (!accessToken) {
            navigate('/student/login', { replace: true })
            return
        }
        (async () => {
            try {
                const [meResp, statusResp] = await Promise.all([
                    fetchStudentMe(),
                    fetchStudentStatus(),
                ])
                setMe(meResp)
                if (statusResp?.entered) {
                    setEntered(true)
                    setEnteredAt(statusResp.enteredAt)
                    stopRef.current = true
                    return
                }
                await refreshQr()
                scheduleNextRefresh(15)
            } catch (err: any) {
                setError(err?.response?.data?.error || err.message || 'Failed to load your pass')
            }
        })()

        function onOnline() { setOffline(false) }
        function onOffline() { setOffline(true) }
        window.addEventListener('online', onOnline)
        window.addEventListener('offline', onOffline)

        return () => {
            stopRef.current = true
            if (timerRef.current) window.clearTimeout(timerRef.current)
            window.removeEventListener('online', onOnline)
            window.removeEventListener('offline', onOffline)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // ── QR refresh loop ─────────────────────────────────────
    async function refreshQr() {
        try {
            const data = await fetchStudentQr()
            if (stopRef.current) return
            setQr({ token: data.token, ttlSeconds: data.ttlSeconds })
            setError(null)
            if (data.alreadyUsed) {
                // Server-side entered already; probe /status for the
                // authoritative timestamp then stop rotating.
                const s = await fetchStudentStatus()
                setEntered(true)
                setEnteredAt(s?.enteredAt || null)
                stopRef.current = true
            }
        } catch (err: any) {
            const status = err?.response?.status
            if (status === 401) {
                // Interceptor already redirected; still bail out.
                return
            }
            if (status === 403 && err?.response?.data?.code === 'NOT_ENROLLED') {
                setError('You are not enrolled for campus entry. Contact the admin.')
                stopRef.current = true
                return
            }
            setError('Could not refresh QR. Retrying...')
        }
    }

    function scheduleNextRefresh(fallbackSec: number) {
        if (stopRef.current) return
        const ttl = qr?.ttlSeconds || fallbackSec
        // Refresh at ~55% of TTL, min 5s, max 30s. Keeps the QR
        // fresh enough that a slow phone display + slow scanner
        // still lines up.
        const nextMs = Math.max(5, Math.min(30, Math.floor(ttl * 0.55))) * 1000
        timerRef.current = window.setTimeout(async () => {
            await refreshQr()
            scheduleNextRefresh(fallbackSec)
        }, nextMs)
    }

    function handleLogout() {
        writeStudentAuth(null)
        navigate('/student/login', { replace: true })
    }

    // ── UI ──────────────────────────────────────────────────
    return (
        <div className="min-h-screen w-full bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 text-white flex flex-col">
            <header className="flex items-center justify-between p-4 sm:p-6">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
                        <span className="text-[10px] font-bold tracking-wider">MITS</span>
                    </div>
                    <div className="leading-tight">
                        <p className="text-xs font-semibold">Smart ID</p>
                        <p className="text-[10px] uppercase tracking-widest text-white/50">Campus Entry</p>
                    </div>
                </div>
                <button
                    onClick={handleLogout}
                    className="text-xs text-white/60 hover:text-white flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/5"
                >
                    <LogOut size={13} /> Sign out
                </button>
            </header>

            <main className="flex-1 flex flex-col items-center justify-center px-6 pb-8">
                {offline && (
                    <div className="mb-4 flex items-center gap-2 text-xs bg-amber-500/10 text-amber-200 border border-amber-500/30 px-3 py-1.5 rounded-full">
                        <WifiOff size={13} /> You are offline — the gate will reject stale QRs.
                    </div>
                )}

                {error && !entered && (
                    <div className="mb-4 text-xs text-red-200 bg-red-500/10 border border-red-500/30 px-3 py-1.5 rounded-full max-w-sm text-center">
                        {error}
                    </div>
                )}

                {entered ? (
                    <EnteredState enteredAt={enteredAt} me={me} />
                ) : (
                    <LivePass me={me} qr={qr} />
                )}
            </main>

            <footer className="text-center pb-6 text-[10px] uppercase tracking-widest text-white/30">
                © {new Date().getFullYear()} MITS Gwalior
            </footer>
        </div>
    )
}

// ── Live pass card (rotating QR) ────────────────────────────
function LivePass({ me, qr }: { me: Me | null; qr: QrState | null }) {
    return (
        <div className="w-full max-w-sm">
            {/* Warning banner — spec-required, positioned so the student
                sees it BEFORE showing the QR to the guard. */}
            <div className="mb-4 flex items-start gap-2 text-[11px] bg-white/5 border border-white/10 text-white/80 px-3 py-2 rounded-lg">
                <ShieldAlert size={14} className="text-amber-300 mt-0.5 shrink-0" />
                <p className="leading-snug">
                    This is a system-generated QR. It is only valid for a short time and
                    refreshes automatically. Do not share screenshots — they will not work
                    at the gate.
                </p>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-2xl shadow-indigo-500/20">
                <div className="text-center">
                    <p className="text-[10px] uppercase tracking-[0.2em] font-semibold text-slate-400">
                        MITS Smart ID — Entry Pass
                    </p>
                    <p className="text-slate-900 font-bold text-lg mt-1">{me?.fullName || '—'}</p>
                    <p className="text-slate-500 text-xs">
                        {me?.enrollmentNo}
                        {me?.department ? ` · ${me.department}` : ''}
                        {me?.year ? ` · Year ${me.year}` : ''}
                    </p>
                </div>

                <div className="mt-5 flex items-center justify-center">
                    {qr?.token ? (
                        <div className="p-3 rounded-2xl bg-white border border-slate-100">
                            {/* Note: we intentionally do NOT surface qr.ttlSeconds
                                to the UI. The refresh is a background concern. */}
                            <QRCodeCanvas
                                value={qr.token}
                                size={240}
                                level="M"
                                marginSize={2}
                            />
                        </div>
                    ) : (
                        <div className="w-[240px] h-[240px] flex items-center justify-center text-slate-400">
                            <Loader2 className="animate-spin" size={22} />
                        </div>
                    )}
                </div>

                <p className="text-center text-[10px] text-slate-400 mt-4 tracking-wide">
                    Show this screen to the scanner at the gate.
                </p>
            </div>
        </div>
    )
}

// ── Post-entry state — no more rotation, no QR ──────────────
function EnteredState({ enteredAt, me }: { enteredAt: string | null; me: Me | null }) {
    return (
        <div className="w-full max-w-sm">
            <div className="rounded-3xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-400/30 p-8 text-center shadow-2xl shadow-emerald-500/10">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="text-emerald-300" size={32} />
                </div>
                <h2 className="text-2xl font-bold text-emerald-100 mt-4">Entry recorded</h2>
                <p className="text-emerald-200/80 text-sm mt-2">
                    You have already entered campus and cannot enter again on this pass.
                </p>
                {me && (
                    <div className="mt-6 text-left text-xs bg-black/20 rounded-xl px-4 py-3">
                        <div className="flex justify-between text-white/70"><span>Name</span><span className="text-white">{me.fullName}</span></div>
                        <div className="flex justify-between text-white/70 mt-1"><span>Enrollment</span><span className="text-white">{me.enrollmentNo}</span></div>
                        {enteredAt && (
                            <div className="flex justify-between text-white/70 mt-1">
                                <span>Entered at</span>
                                <span className="text-white">{new Date(enteredAt).toLocaleString()}</span>
                            </div>
                        )}
                    </div>
                )}
                <p className="text-[11px] text-emerald-200/60 mt-6 leading-relaxed">
                    If you need to re-enter, contact the admin to revoke your entry.
                </p>
            </div>
        </div>
    )
}
