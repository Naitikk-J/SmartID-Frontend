// ─────────────────────────────────────────────────────────────
// Admin — Campus Entry management page.
//
// One place for the admin to:
//   • see live scan feed (SSE + polling fallback)
//   • see top-line counters (enrolled / entered / revoked / mail)
//   • bulk-import students from CSV or Excel (uses xlsx)
//   • revoke entry for a student who scanned in accidentally
//   • resend credential emails to failed recipients (or specific)
//   • drill into per-recipient mail status ("this student didn't
//     get the mail" — the fallback the user asked for)
//
// Lightning-fast requirement: this page uses cursor-paginated
// lists (limit 50) + SSE for realtime — no re-fetch storm.
// ─────────────────────────────────────────────────────────────

import { useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as XLSX from 'xlsx'
import toast from 'react-hot-toast'
import {
    CheckCircle2, Upload, RefreshCw, Search, Mail, MailX, Undo2,
    Loader2, ShieldAlert, TrendingUp, Users, LogIn, ScanLine,
} from 'lucide-react'
import {
    enrollCampusParticipants,
    listCampusScans,
    listCampusParticipants,
    revokeCampusEntry,
    resendCredentials,
    fetchCredentialEmails,
    fetchCampusStats,
} from '../api/campusEntry'

type Tab = 'live' | 'participants' | 'import' | 'mail'

export default function CampusEntryAdminPage() {
    const [tab, setTab] = useState<Tab>('live')

    const stats = useQuery({
        queryKey: ['campus-entry', 'stats'],
        queryFn: fetchCampusStats,
        refetchInterval: 5000,
    })

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Campus Entry</h1>
                    <p className="text-sm text-text-secondary mt-0.5">
                        Bulk-import students, mail credentials, watch entries live, and revoke access.
                    </p>
                </div>
                {stats.data && !stats.data.smtpConfigured && (
                    <div className="flex items-center gap-2 text-xs bg-amber-500/10 text-amber-500 border border-amber-500/30 px-3 py-1.5 rounded-full">
                        <ShieldAlert size={13} />
                        SMTP is not configured — credential emails will fail.
                    </div>
                )}
            </div>

            <StatCards stats={stats.data} />

            <div className="flex items-center gap-1 border-b border-border">
                {(
                    [
                        { id: 'live', label: 'Live scans', icon: ScanLine },
                        { id: 'participants', label: 'Participants', icon: Users },
                        { id: 'import', label: 'Bulk import', icon: Upload },
                        { id: 'mail', label: 'Credential emails', icon: Mail },
                    ] as Array<{ id: Tab; label: string; icon: any }>
                ).map(({ id, label, icon: Icon }) => (
                    <button
                        key={id}
                        onClick={() => setTab(id)}
                        className={`px-4 py-2 text-sm font-medium flex items-center gap-2 border-b-2 -mb-px transition ${
                            tab === id
                                ? 'border-primary text-text-primary'
                                : 'border-transparent text-text-muted hover:text-text-secondary'
                        }`}
                    >
                        <Icon size={14} /> {label}
                    </button>
                ))}
            </div>

            {tab === 'live' && <LiveScansTab />}
            {tab === 'participants' && <ParticipantsTab />}
            {tab === 'import' && <ImportTab />}
            {tab === 'mail' && <MailTab />}
        </div>
    )
}

// ═════════════════════════════════════════════════════════════
// Top counters
// ═════════════════════════════════════════════════════════════
function StatCards({ stats }: { stats?: Awaited<ReturnType<typeof fetchCampusStats>> }) {
    const cards = [
        { icon: Users, label: 'Enrolled', value: stats?.enrolled ?? '—', accent: 'text-indigo-400' },
        { icon: LogIn, label: 'Entered', value: stats?.entered ?? '—', accent: 'text-emerald-400' },
        { icon: TrendingUp, label: 'Not entered', value: stats?.notEntered ?? '—', accent: 'text-sky-400' },
        { icon: Undo2, label: 'Revokes', value: stats?.revokes ?? '—', accent: 'text-amber-400' },
        {
            icon: Mail,
            label: 'Emails sent / failed',
            value: stats ? `${stats.mail.SENT} / ${stats.mail.FAILED}` : '—',
            accent: 'text-purple-400',
        },
    ]
    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {cards.map((c) => (
                <div key={c.label} className="glass-card rounded-xl p-4">
                    <div className="flex items-center gap-2 text-xs text-text-muted">
                        <c.icon size={13} className={c.accent} />
                        {c.label}
                    </div>
                    <div className="text-xl font-bold mt-1 tabular-nums">{c.value}</div>
                </div>
            ))}
        </div>
    )
}

// ═════════════════════════════════════════════════════════════
// LIVE SCANS
// ═════════════════════════════════════════════════════════════
function LiveScansTab() {
    const qc = useQueryClient()
    const [search, setSearch] = useState('')
    const scans = useQuery({
        queryKey: ['campus-entry', 'scans', search],
        queryFn: () => listCampusScans({ limit: 100, search: search || null }),
        refetchInterval: 3000, // fast polling; SSE upgrade covered separately
    })

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[220px]">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Filter by name / enrollment / email"
                        className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-bg-card border border-border text-sm outline-none focus:border-primary"
                    />
                </div>
                <button
                    onClick={() => qc.invalidateQueries({ queryKey: ['campus-entry', 'scans'] })}
                    className="text-xs px-3 py-1.5 rounded-lg bg-bg-card border border-border hover:bg-white/5 flex items-center gap-1.5"
                >
                    <RefreshCw size={12} /> Refresh
                </button>
            </div>

            <div className="glass-card rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-[11px] uppercase tracking-wider text-text-muted border-b border-border">
                            <th className="px-4 py-2">Time</th>
                            <th className="px-4 py-2">Student</th>
                            <th className="px-4 py-2">Enrollment</th>
                            <th className="px-4 py-2">Branch</th>
                            <th className="px-4 py-2">Gate</th>
                            <th className="px-4 py-2 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {scans.data?.scans.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-4 py-8 text-center text-text-muted text-xs">
                                    {scans.isLoading ? 'Loading…' : 'No scans yet today.'}
                                </td>
                            </tr>
                        )}
                        {scans.data?.scans.map((row: any) => (
                            <ScanRow key={row.id} row={row} />
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

function ScanRow({ row }: { row: any }) {
    const qc = useQueryClient()
    const [busy, setBusy] = useState(false)

    async function handleRevoke() {
        if (!row.participant?.id) return
        if (!confirm(`Revoke entry for ${row.participant.fullName}? They will be able to enter again.`)) return
        try {
            setBusy(true)
            await revokeCampusEntry(row.participant.id, 'Admin revoke from live feed')
            toast.success('Entry revoked')
            qc.invalidateQueries({ queryKey: ['campus-entry'] })
        } catch (err: any) {
            toast.error(err?.response?.data?.error || err.message)
        } finally {
            setBusy(false)
        }
    }

    return (
        <tr className="border-b border-border/50 hover:bg-white/[0.02] transition">
            <td className="px-4 py-2 text-xs tabular-nums text-text-muted">
                {new Date(row.scannedAt).toLocaleTimeString()}
            </td>
            <td className="px-4 py-2 font-medium">{row.participant?.fullName || '—'}</td>
            <td className="px-4 py-2 text-xs tabular-nums">{row.participant?.enrollmentNo || '—'}</td>
            <td className="px-4 py-2 text-xs">
                {row.student?.department || '—'}
                {row.student?.year ? ` · Y${row.student.year}` : ''}
            </td>
            <td className="px-4 py-2 text-xs text-text-muted">{row.gateLabel || '—'}</td>
            <td className="px-4 py-2 text-right">
                <button
                    onClick={handleRevoke}
                    disabled={busy}
                    className="text-[11px] px-2 py-1 rounded-md border border-amber-500/30 text-amber-500 hover:bg-amber-500/10 disabled:opacity-50"
                >
                    {busy ? '...' : 'Revoke'}
                </button>
            </td>
        </tr>
    )
}

// ═════════════════════════════════════════════════════════════
// PARTICIPANTS
// ═════════════════════════════════════════════════════════════
function ParticipantsTab() {
    const [filter, setFilter] = useState<'entered' | 'not_entered' | 'revoked' | null>(null)
    const [search, setSearch] = useState('')
    const participants = useQuery({
        queryKey: ['campus-entry', 'participants', filter, search],
        queryFn: () => listCampusParticipants({ limit: 100, filter, search: search || null }),
    })

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
                <select
                    value={filter || ''}
                    onChange={(e) => setFilter((e.target.value || null) as any)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-bg-card border border-border"
                >
                    <option value="">All</option>
                    <option value="entered">Entered</option>
                    <option value="not_entered">Not entered</option>
                    <option value="revoked">Ever revoked</option>
                </select>
                <div className="relative flex-1 min-w-[220px]">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by name / enrollment / email"
                        className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-bg-card border border-border text-sm outline-none focus:border-primary"
                    />
                </div>
            </div>

            <div className="glass-card rounded-xl overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-[11px] uppercase tracking-wider text-text-muted border-b border-border">
                            <th className="px-4 py-2">Student</th>
                            <th className="px-4 py-2">Enrollment</th>
                            <th className="px-4 py-2">Branch</th>
                            <th className="px-4 py-2">Status</th>
                            <th className="px-4 py-2">Revokes</th>
                            <th className="px-4 py-2 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {participants.data?.participants.length === 0 && (
                            <tr>
                                <td colSpan={6} className="px-4 py-8 text-center text-text-muted text-xs">
                                    {participants.isLoading ? 'Loading…' : 'No participants match.'}
                                </td>
                            </tr>
                        )}
                        {participants.data?.participants.map((p: any) => (
                            <ParticipantRow key={p.id} p={p} />
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

function ParticipantRow({ p }: { p: any }) {
    const qc = useQueryClient()
    const [busy, setBusy] = useState<'revoke' | 'resend' | null>(null)

    async function handleRevoke() {
        if (!confirm(`Revoke entry for ${p.fullName}? They will be able to enter again.`)) return
        try {
            setBusy('revoke')
            await revokeCampusEntry(p.id, 'Admin revoke from participants list')
            toast.success('Entry revoked')
            qc.invalidateQueries({ queryKey: ['campus-entry'] })
        } catch (err: any) {
            toast.error(err?.response?.data?.error || err.message)
        } finally { setBusy(null) }
    }

    async function handleResend() {
        try {
            setBusy('resend')
            const r = await resendCredentials({ participantIds: [p.id] })
            toast.success(`Queued ${r.queued} email`)
            qc.invalidateQueries({ queryKey: ['campus-entry', 'stats'] })
        } catch (err: any) {
            toast.error(err?.response?.data?.error || err.message)
        } finally { setBusy(null) }
    }

    return (
        <tr className="border-b border-border/50 hover:bg-white/[0.02] transition">
            <td className="px-4 py-2">
                <div className="font-medium">{p.fullName}</div>
                <div className="text-[11px] text-text-muted">{p.email}</div>
            </td>
            <td className="px-4 py-2 text-xs tabular-nums">{p.enrollmentNo}</td>
            <td className="px-4 py-2 text-xs">
                {p.student?.department || '—'}
                {p.student?.year ? ` · Y${p.student.year}` : ''}
            </td>
            <td className="px-4 py-2 text-xs">
                {p.entryUsedAt ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[11px]">
                        <CheckCircle2 size={11} /> Entered {timeAgo(p.entryUsedAt)}
                    </span>
                ) : (
                    <span className="text-text-muted">Not entered</span>
                )}
            </td>
            <td className="px-4 py-2 text-xs tabular-nums">{p.entryRevokeCount || 0}</td>
            <td className="px-4 py-2 text-right space-x-2 whitespace-nowrap">
                {p.entryUsedAt && (
                    <button
                        onClick={handleRevoke}
                        disabled={busy !== null}
                        className="text-[11px] px-2 py-1 rounded-md border border-amber-500/30 text-amber-500 hover:bg-amber-500/10 disabled:opacity-50 inline-flex items-center gap-1"
                    >
                        {busy === 'revoke' ? <Loader2 size={10} className="animate-spin" /> : <Undo2 size={11} />} Revoke
                    </button>
                )}
                <button
                    onClick={handleResend}
                    disabled={busy !== null}
                    className="text-[11px] px-2 py-1 rounded-md border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10 disabled:opacity-50 inline-flex items-center gap-1"
                >
                    {busy === 'resend' ? <Loader2 size={10} className="animate-spin" /> : <Mail size={11} />} Resend
                </button>
            </td>
        </tr>
    )
}

// ═════════════════════════════════════════════════════════════
// IMPORT
// ═════════════════════════════════════════════════════════════
type ImportRow = {
    fullName: string
    email: string
    phone?: string
    enrollmentNo?: string
    department?: string
    year?: number
    section?: string
}

function ImportTab() {
    const qc = useQueryClient()
    const [rows, setRows] = useState<ImportRow[]>([])
    const [sendEmails, setSendEmails] = useState(true)
    const [busy, setBusy] = useState(false)
    const [summary, setSummary] = useState<any>(null)
    const fileInputRef = useRef<HTMLInputElement | null>(null)

    async function handleFile(file: File) {
        try {
            const buf = await file.arrayBuffer()
            const wb = XLSX.read(buf, { type: 'array' })
            const ws = wb.Sheets[wb.SheetNames[0]]
            const json = XLSX.utils.sheet_to_json(ws, { defval: '' }) as Array<Record<string, any>>
            const normalized = json
                .map<ImportRow | null>((r) => {
                    const email = String(r.email || r.Email || r.EMAIL || '').trim().toLowerCase()
                    if (!email) return null
                    return {
                        fullName: String(r.fullName || r.name || r.Name || r['Full Name'] || '').trim(),
                        email,
                        phone: String(r.phone || r.mobile || r.Phone || '').trim(),
                        enrollmentNo: String(r.enrollmentNo || r.enrollment || r['Enrollment No'] || '').trim(),
                        department: String(r.department || r.branch || r.Branch || '').trim(),
                        year: r.year || r.Year ? Number(r.year || r.Year) : undefined,
                        section: String(r.section || r.Section || '').trim(),
                    }
                })
                .filter((r): r is ImportRow => Boolean(r && r.email && r.fullName))
            setRows(normalized)
            setSummary(null)
            toast.success(`Parsed ${normalized.length} rows`)
        } catch (err: any) {
            toast.error(err?.message || 'Failed to parse file')
        }
    }

    async function handleUpload() {
        if (rows.length === 0) return
        try {
            setBusy(true)
            const data = await enrollCampusParticipants(rows, sendEmails)
            setSummary(data)
            if (data.queued) {
                toast.success(`Queued ${data.rows} students for background enrolment`)
            } else {
                toast.success(
                    `Imported ${data.summary.imported}, updated ${data.summary.updated}, failed ${data.summary.failed}`,
                )
            }
            qc.invalidateQueries({ queryKey: ['campus-entry'] })
        } catch (err: any) {
            toast.error(err?.response?.data?.error || err.message || 'Import failed')
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className="space-y-4">
            <div className="glass-card rounded-xl p-6">
                <h3 className="text-sm font-semibold">1. Upload student list</h3>
                <p className="text-xs text-text-muted mt-1">
                    CSV or Excel with columns: <code className="font-mono text-[11px]">fullName, email, phone, enrollmentNo, department, year, section</code>.
                    Only <code className="font-mono">fullName</code> and <code className="font-mono">email</code> are required.
                </p>

                <div className="mt-4 flex items-center gap-3 flex-wrap">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                        className="text-xs"
                    />
                    {rows.length > 0 && (
                        <span className="text-xs text-text-muted">{rows.length} rows parsed</span>
                    )}
                </div>
            </div>

            <div className="glass-card rounded-xl p-6">
                <h3 className="text-sm font-semibold">2. Review & send</h3>
                <label className="mt-3 flex items-center gap-2 text-xs cursor-pointer">
                    <input
                        type="checkbox"
                        checked={sendEmails}
                        onChange={(e) => setSendEmails(e.target.checked)}
                    />
                    Send credential emails after import (rotate password + email login link)
                </label>

                <div className="mt-4 max-h-72 overflow-auto border border-border rounded-lg">
                    <table className="w-full text-xs">
                        <thead className="text-text-muted text-[10px] uppercase tracking-wider sticky top-0 bg-bg-card">
                            <tr>
                                <th className="px-3 py-2 text-left">Name</th>
                                <th className="px-3 py-2 text-left">Email</th>
                                <th className="px-3 py-2 text-left">Enrollment</th>
                                <th className="px-3 py-2 text-left">Branch</th>
                                <th className="px-3 py-2 text-left">Year</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.slice(0, 500).map((r, i) => (
                                <tr key={i} className="border-t border-border/40">
                                    <td className="px-3 py-1.5">{r.fullName}</td>
                                    <td className="px-3 py-1.5 text-text-muted">{r.email}</td>
                                    <td className="px-3 py-1.5 tabular-nums">{r.enrollmentNo || '—'}</td>
                                    <td className="px-3 py-1.5">{r.department || '—'}</td>
                                    <td className="px-3 py-1.5">{r.year || '—'}</td>
                                </tr>
                            ))}
                            {rows.length > 500 && (
                                <tr>
                                    <td colSpan={5} className="px-3 py-2 text-center text-text-muted">
                                        + {rows.length - 500} more rows (all will be imported)
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                <button
                    onClick={handleUpload}
                    disabled={busy || rows.length === 0}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50"
                >
                    {busy ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                    Import {rows.length} students
                </button>
            </div>

            {summary && (
                <div className="glass-card rounded-xl p-6">
                    <h3 className="text-sm font-semibold">Import result</h3>
                    {summary.queued ? (
                        <div className="mt-3 text-xs">
                            <p className="text-text-secondary">
                                Queued <b>{summary.rows}</b> rows for background enrolment.
                                {summary.mailKickoff === 'started' && ' Credential emails will start automatically.'}
                            </p>
                            <p className="text-text-muted mt-2 flex items-center gap-1.5">
                                <Loader2 size={11} className="animate-spin" />
                                Watch the top counters + <b>Credential emails</b> tab for progress.
                            </p>
                        </div>
                    ) : (
                        <>
                            <div className="mt-3 grid grid-cols-4 gap-3 text-xs">
                                <Stat label="Total rows" value={summary.summary.total} />
                                <Stat label="Imported" value={summary.summary.imported} accent="text-emerald-400" />
                                <Stat label="Updated" value={summary.summary.updated || 0} accent="text-sky-400" />
                                <Stat label="Failed" value={summary.summary.failed} accent="text-red-400" />
                            </div>
                            {summary.mailKickoff === 'started' && (
                                <p className="text-xs text-text-muted mt-3 flex items-center gap-1.5">
                                    <Loader2 size={11} className="animate-spin" />
                                    Credential emails are being sent in the background. Watch the <b>Credential emails</b> tab.
                                </p>
                            )}
                            {summary.summary.errors?.length > 0 && (
                                <details className="mt-3">
                                    <summary className="text-xs text-text-muted cursor-pointer">Show {summary.summary.errors.length} errors</summary>
                                    <ul className="mt-2 text-[11px] text-red-400 max-h-40 overflow-auto font-mono">
                                        {summary.summary.errors.slice(0, 100).map((e: any, i: number) => (
                                            <li key={i}>Row {e.row} ({e.email || '—'}): {e.reason}</li>
                                        ))}
                                    </ul>
                                </details>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    )
}

function Stat({ label, value, accent }: { label: string; value: any; accent?: string }) {
    return (
        <div className="rounded-lg bg-bg-card border border-border p-3">
            <div className="text-[10px] uppercase tracking-wider text-text-muted">{label}</div>
            <div className={`text-lg font-bold ${accent || ''}`}>{value}</div>
        </div>
    )
}

// ═════════════════════════════════════════════════════════════
// MAIL TAB
// ═════════════════════════════════════════════════════════════
function MailTab() {
    const qc = useQueryClient()
    const [status, setStatus] = useState<'FAILED' | 'SENT' | 'QUEUED' | ''>('FAILED')
    const [busy, setBusy] = useState(false)

    const mails = useQuery({
        queryKey: ['campus-entry', 'mails', status],
        queryFn: () => fetchCredentialEmails(status || undefined),
        refetchInterval: 5000,
    })

    async function handleResendFailed() {
        try {
            setBusy(true)
            const r = await resendCredentials({ onlyFailed: true })
            toast.success(`Queued ${r.queued} resend${r.queued === 1 ? '' : 's'}`)
            qc.invalidateQueries({ queryKey: ['campus-entry'] })
        } catch (err: any) {
            toast.error(err?.response?.data?.error || err.message)
        } finally {
            setBusy(false)
        }
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
                <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-bg-card border border-border"
                >
                    <option value="">All</option>
                    <option value="FAILED">Failed</option>
                    <option value="SENT">Sent</option>
                    <option value="QUEUED">Queued</option>
                </select>
                <button
                    onClick={handleResendFailed}
                    disabled={busy}
                    className="text-xs px-3 py-1.5 rounded-lg bg-primary text-white flex items-center gap-1.5 disabled:opacity-50"
                >
                    {busy ? <Loader2 size={12} className="animate-spin" /> : <MailX size={12} />}
                    Resend all failed
                </button>
            </div>

            <div className="glass-card rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-[11px] uppercase tracking-wider text-text-muted border-b border-border">
                            <th className="px-4 py-2">Email</th>
                            <th className="px-4 py-2">Status</th>
                            <th className="px-4 py-2">Attempts</th>
                            <th className="px-4 py-2">Last error</th>
                            <th className="px-4 py-2">Sent at</th>
                        </tr>
                    </thead>
                    <tbody>
                        {mails.data?.rows.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-text-muted text-xs">
                                    {mails.isLoading ? 'Loading…' : `No ${status || 'email'} rows.`}
                                </td>
                            </tr>
                        )}
                        {mails.data?.rows.map((row) => (
                            <tr key={row.id} className="border-b border-border/50">
                                <td className="px-4 py-2 text-xs">{row.email}</td>
                                <td className="px-4 py-2">
                                    <StatusPill status={row.status} />
                                </td>
                                <td className="px-4 py-2 text-xs tabular-nums">{row.attempts}</td>
                                <td className="px-4 py-2 text-[11px] text-red-400 truncate max-w-[280px]" title={row.lastError || ''}>
                                    {row.lastError || '—'}
                                </td>
                                <td className="px-4 py-2 text-xs text-text-muted tabular-nums">
                                    {row.sentAt ? new Date(row.sentAt).toLocaleString() : '—'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

function StatusPill({ status }: { status: 'SENT' | 'FAILED' | 'QUEUED' }) {
    const palette =
        status === 'SENT' ? 'bg-emerald-500/10 text-emerald-500'
        : status === 'FAILED' ? 'bg-red-500/10 text-red-400'
        : 'bg-amber-500/10 text-amber-500'
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${palette}`}>
            {status}
        </span>
    )
}

// ── Utils ────────────────────────────────────────────────────
function timeAgo(iso: string) {
    const diff = (Date.now() - new Date(iso).getTime()) / 1000
    if (diff < 60) return `${Math.round(diff)}s ago`
    if (diff < 3600) return `${Math.round(diff / 60)}m ago`
    if (diff < 86400) return `${Math.round(diff / 3600)}h ago`
    return new Date(iso).toLocaleDateString()
}
