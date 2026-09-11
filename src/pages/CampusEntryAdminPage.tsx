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
    UserPlus, FileSpreadsheet, UserCheck, Sunrise,
} from 'lucide-react'
import {
    enrollCampusParticipants,
    enrollExistingStudents,
    listExistingStudents,
    listCampusScans,
    listCampusParticipants,
    revokeCampusEntry,
    revokeCampusEntriesBulk,
    resetCampusEntryDay,
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
// Multi-select revoke + one-shot "Reset for next day".
// Defaults to "Entered" filter — that's the list a gate admin wants
// staring at during rush; it's also the list you'd bulk-revoke.
// ═════════════════════════════════════════════════════════════
function ParticipantsTab() {
    const qc = useQueryClient()
    const [filter, setFilter] = useState<'entered' | 'not_entered' | 'revoked' | null>('entered')
    const [search, setSearch] = useState('')
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [busy, setBusy] = useState<null | 'bulk' | 'reset'>(null)

    const participants = useQuery({
        queryKey: ['campus-entry', 'participants', filter, search],
        queryFn: () => listCampusParticipants({ limit: 200, filter, search: search || null }),
        // Refresh the entered list every 3s so multi-select stays in
        // sync while guards are scanning at the gate.
        refetchInterval: filter === 'entered' ? 3000 : false,
    })

    const rows: any[] = participants.data?.participants || []
    const enteredRows = rows.filter((p) => p.entryUsedAt)
    // Only entered rows are actually revocable — that's what the
    // checkbox lets you pick from.
    const selectableIds = enteredRows.map((p) => p.id)
    const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id))

    function toggle(id: string) {
        setSelected((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id); else next.add(id)
            return next
        })
    }

    function toggleAll() {
        setSelected((prev) => {
            if (allSelected) {
                const next = new Set(prev)
                for (const id of selectableIds) next.delete(id)
                return next
            }
            const next = new Set(prev)
            for (const id of selectableIds) next.add(id)
            return next
        })
    }

    async function handleBulkRevoke() {
        if (selected.size === 0) return
        if (!confirm(`Revoke entry for ${selected.size} student${selected.size === 1 ? '' : 's'}? They will be able to enter again.`)) return
        try {
            setBusy('bulk')
            const r = await revokeCampusEntriesBulk(Array.from(selected), 'Admin bulk revoke')
            toast.success(`Revoked ${r.revoked} entr${r.revoked === 1 ? 'y' : 'ies'}`)
            setSelected(new Set())
            qc.invalidateQueries({ queryKey: ['campus-entry'] })
        } catch (err: any) {
            toast.error(err?.response?.data?.error || err.message || 'Bulk revoke failed')
        } finally { setBusy(null) }
    }

    async function handleResetDay() {
        // Two-step confirm — this is the "nuke the entire day's
        // entries" button, so we double-gate it.
        if (!confirm('Reset campus entry for the next day?\n\nThis clears the entry lock for EVERY student who has entered today, so tomorrow morning they can enter again with the same credentials.\n\nProceed?')) return
        if (!confirm('Are you sure? This cannot be undone.')) return
        try {
            setBusy('reset')
            const r = await resetCampusEntryDay('Reset for next day')
            toast.success(`Reset complete — ${r.revoked} student${r.revoked === 1 ? '' : 's'} cleared for tomorrow`)
            setSelected(new Set())
            qc.invalidateQueries({ queryKey: ['campus-entry'] })
        } catch (err: any) {
            toast.error(err?.response?.data?.error || err.message || 'Reset failed')
        } finally { setBusy(null) }
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
                <select
                    value={filter || ''}
                    onChange={(e) => {
                        setFilter((e.target.value || null) as any)
                        setSelected(new Set())
                    }}
                    className="text-xs px-3 py-1.5 rounded-lg bg-bg-card border border-border"
                >
                    <option value="entered">Entered</option>
                    <option value="not_entered">Not entered</option>
                    <option value="revoked">Ever revoked</option>
                    <option value="">All</option>
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
                <button
                    onClick={handleResetDay}
                    disabled={busy !== null}
                    title="Revoke every entered student — tomorrow morning they can enter again with the same credentials."
                    className="text-xs px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 flex items-center gap-1.5 disabled:opacity-50"
                >
                    {busy === 'reset' ? <Loader2 size={12} className="animate-spin" /> : <Sunrise size={12} />}
                    Reset for next day
                </button>
            </div>

            {/* Bulk action bar — only visible when at least one row is
                selected. Stays sticky-ish on top of the table for the
                gate-side admin. */}
            {selected.size > 0 && (
                <div className="glass-card rounded-xl px-4 py-2.5 flex items-center gap-3 flex-wrap border-emerald-500/30">
                    <span className="text-xs">
                        <b className="text-emerald-400 tabular-nums">{selected.size}</b> selected
                    </span>
                    <button
                        onClick={handleBulkRevoke}
                        disabled={busy !== null}
                        className="text-xs px-3 py-1.5 rounded-lg bg-primary text-white flex items-center gap-1.5 disabled:opacity-50"
                    >
                        {busy === 'bulk' ? <Loader2 size={12} className="animate-spin" /> : <Undo2 size={12} />}
                        Revoke selected
                    </button>
                    <button
                        onClick={() => setSelected(new Set())}
                        className="text-xs px-3 py-1.5 rounded-lg bg-bg-card border border-border hover:bg-white/5"
                    >
                        Clear
                    </button>
                </div>
            )}

            <div className="glass-card rounded-xl overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-[11px] uppercase tracking-wider text-text-muted border-b border-border">
                            <th className="px-4 py-2 w-10">
                                {selectableIds.length > 0 && (
                                    <input
                                        type="checkbox"
                                        checked={allSelected}
                                        onChange={toggleAll}
                                        title={allSelected ? 'Deselect all entered' : 'Select all entered'}
                                    />
                                )}
                            </th>
                            <th className="px-4 py-2">Student</th>
                            <th className="px-4 py-2">Enrollment</th>
                            <th className="px-4 py-2">Branch</th>
                            <th className="px-4 py-2">Status</th>
                            <th className="px-4 py-2">Revokes</th>
                            <th className="px-4 py-2 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 && (
                            <tr>
                                <td colSpan={7} className="px-4 py-8 text-center text-text-muted text-xs">
                                    {participants.isLoading ? 'Loading…' : 'No participants match.'}
                                </td>
                            </tr>
                        )}
                        {rows.map((p) => (
                            <ParticipantRow
                                key={p.id}
                                p={p}
                                selectable={Boolean(p.entryUsedAt)}
                                isSelected={selected.has(p.id)}
                                onToggle={() => toggle(p.id)}
                            />
                        ))}
                    </tbody>
                </table>
            </div>

            {enteredRows.length > 0 && (
                <div className="text-[11px] text-text-muted">
                    Showing {rows.length} rows · {enteredRows.length} currently entered · {selected.size} selected
                </div>
            )}
        </div>
    )
}

function ParticipantRow({
    p, selectable, isSelected, onToggle,
}: {
    p: any
    selectable: boolean
    isSelected: boolean
    onToggle: () => void
}) {
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
        <tr className={`border-b border-border/50 transition ${isSelected ? 'bg-primary/10' : 'hover:bg-white/[0.02]'}`}>
            <td className="px-4 py-2">
                {selectable ? (
                    <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={onToggle}
                        title="Select for bulk revoke"
                    />
                ) : (
                    <span className="text-text-muted text-[10px]">—</span>
                )}
            </td>
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

type ImportMode = 'single' | 'file' | 'existing'

function ImportTab() {
    const [mode, setMode] = useState<ImportMode>('single')

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-1 rounded-lg border border-border bg-bg-card p-1 w-fit">
                {(
                    [
                        { id: 'single', label: 'Single student', icon: UserPlus },
                        { id: 'file', label: 'Upload file', icon: FileSpreadsheet },
                        { id: 'existing', label: 'From existing students', icon: UserCheck },
                    ] as Array<{ id: ImportMode; label: string; icon: any }>
                ).map(({ id, label, icon: Icon }) => (
                    <button
                        key={id}
                        onClick={() => setMode(id)}
                        className={`px-3 py-1.5 text-xs rounded-md flex items-center gap-1.5 transition ${
                            mode === id
                                ? 'bg-primary/15 text-text-primary'
                                : 'text-text-muted hover:text-text-secondary'
                        }`}
                    >
                        <Icon size={13} /> {label}
                    </button>
                ))}
            </div>

            {mode === 'single' && <SingleImport />}
            {mode === 'file' && <FileImport />}
            {mode === 'existing' && <ExistingStudentsImport />}
        </div>
    )
}

// ── SINGLE STUDENT FORM ────────────────────────────────────
function SingleImport() {
    const qc = useQueryClient()
    const [form, setForm] = useState<ImportRow>({ fullName: '', email: '' })
    const [sendEmail, setSendEmail] = useState(true)
    const [busy, setBusy] = useState(false)
    const [result, setResult] = useState<any>(null)

    function updateField<K extends keyof ImportRow>(key: K, value: ImportRow[K]) {
        setForm((prev) => ({ ...prev, [key]: value }))
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!form.fullName.trim() || !form.email.trim()) {
            toast.error('Full name and email are required')
            return
        }
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) {
            toast.error('Enter a valid email address')
            return
        }
        try {
            setBusy(true)
            const payload: ImportRow = {
                fullName: form.fullName.trim(),
                email: form.email.trim().toLowerCase(),
                phone: form.phone?.trim() || undefined,
                enrollmentNo: form.enrollmentNo?.trim() || undefined,
                department: form.department?.trim() || undefined,
                year: form.year || undefined,
                section: form.section?.trim() || undefined,
            }
            const data = await enrollCampusParticipants([payload], sendEmail)
            setResult(data)
            if (data.summary?.imported > 0) toast.success('Student enrolled')
            else if (data.summary?.updated > 0) toast.success('Student updated + credentials rotated')
            else if (data.summary?.failed > 0) toast.error(`Failed: ${data.summary.errors?.[0]?.reason || 'unknown'}`)
            qc.invalidateQueries({ queryKey: ['campus-entry'] })
            // Reset only on success
            if ((data.summary?.imported || 0) + (data.summary?.updated || 0) > 0) {
                setForm({ fullName: '', email: '' })
            }
        } catch (err: any) {
            toast.error(err?.response?.data?.error || err.message || 'Enrolment failed')
        } finally {
            setBusy(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} className="glass-card rounded-xl p-6 space-y-4">
            <div>
                <h3 className="text-sm font-semibold">Add one student</h3>
                <p className="text-xs text-text-muted mt-1">
                    Only <b>Full name</b> and <b>Email</b> are required. A random password is generated,
                    the Student record is created if missing, and (optionally) an email is sent with the credentials.
                </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Full name *" value={form.fullName} onChange={(v) => updateField('fullName', v)} disabled={busy} placeholder="Naitik Jain" />
                <Field label="Email *" type="email" value={form.email} onChange={(v) => updateField('email', v)} disabled={busy} placeholder="you@mitsgwl.ac.in" />
                <Field label="Phone" value={form.phone || ''} onChange={(v) => updateField('phone', v)} disabled={busy} placeholder="9999999999" />
                <Field label="Enrollment No." value={form.enrollmentNo || ''} onChange={(v) => updateField('enrollmentNo', v)} disabled={busy} placeholder="0901CS221001" />
                <Field label="Department / Branch" value={form.department || ''} onChange={(v) => updateField('department', v)} disabled={busy} placeholder="CSE" />
                <div className="grid grid-cols-2 gap-3">
                    <label className="text-xs">
                        <span className="text-text-muted">Year</span>
                        <select
                            className="mt-1 w-full rounded-lg bg-bg-card border border-border px-2 py-1.5 text-sm outline-none focus:border-primary"
                            value={form.year || ''}
                            onChange={(e) => updateField('year', e.target.value ? Number(e.target.value) : undefined)}
                            disabled={busy}
                        >
                            <option value="">—</option>
                            {[1, 2, 3, 4].map((y) => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </label>
                    <Field label="Section" value={form.section || ''} onChange={(v) => updateField('section', v)} disabled={busy} placeholder="A" />
                </div>
            </div>

            <label className="flex items-center gap-2 text-xs cursor-pointer">
                <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} disabled={busy} />
                Email the login credentials
            </label>

            <div className="flex items-center gap-3">
                <button
                    type="submit"
                    disabled={busy}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50"
                >
                    {busy ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                    Enrol student
                </button>
                {result?.summary && (
                    <span className="text-xs text-text-muted">
                        {result.summary.imported > 0 && `${result.summary.imported} added`}
                        {result.summary.updated > 0 && `${result.summary.updated} updated (password rotated)`}
                        {result.summary.failed > 0 && ` · ${result.summary.failed} failed`}
                    </span>
                )}
            </div>
        </form>
    )
}

function Field({
    label, value, onChange, disabled, placeholder, type = 'text',
}: {
    label: string
    value: string
    onChange: (v: string) => void
    disabled?: boolean
    placeholder?: string
    type?: string
}) {
    return (
        <label className="text-xs block">
            <span className="text-text-muted">{label}</span>
            <input
                type={type}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                placeholder={placeholder}
                className="mt-1 w-full rounded-lg bg-bg-card border border-border px-3 py-1.5 text-sm outline-none focus:border-primary disabled:opacity-60"
            />
        </label>
    )
}

// ── PICK FROM EXISTING STUDENTS ─────────────────────────────
function ExistingStudentsImport() {
    const qc = useQueryClient()
    const [search, setSearch] = useState('')
    const [dept, setDept] = useState('')
    const [selected, setSelected] = useState<Set<string>>(new Set())
    const [sendEmails, setSendEmails] = useState(true)
    const [busy, setBusy] = useState(false)
    const [result, setResult] = useState<any>(null)

    const students = useQuery({
        queryKey: ['existing-students', search, dept],
        queryFn: () => listExistingStudents({
            search: search || undefined,
            dept: dept || undefined,
            limit: 100,
        }),
    })

    function toggle(id: string) {
        setSelected((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id); else next.add(id)
            return next
        })
    }

    function selectAll() {
        const ids = students.data?.students.map((s) => s.id) || []
        setSelected((prev) => {
            const next = new Set(prev)
            for (const id of ids) next.add(id)
            return next
        })
    }

    function clearSelection() { setSelected(new Set()) }

    async function handleEnrol() {
        if (selected.size === 0) return
        try {
            setBusy(true)
            const data = await enrollExistingStudents(Array.from(selected), sendEmails)
            setResult(data)
            if (data.queued) {
                toast.success(`Queued ${data.rows} students for background enrolment`)
            } else {
                toast.success(
                    `Enrolled ${data.summary.imported}, refreshed ${data.summary.updated}${data.summary.failed ? `, ${data.summary.failed} failed` : ''}`,
                )
            }
            clearSelection()
            qc.invalidateQueries({ queryKey: ['campus-entry'] })
        } catch (err: any) {
            toast.error(err?.response?.data?.error || err.message || 'Enrolment failed')
        } finally {
            setBusy(false)
        }
    }

    const rows = students.data?.students || []

    return (
        <div className="space-y-3">
            <div className="glass-card rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative flex-1 min-w-[220px]">
                        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search by name / enrollment / email"
                            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-bg-card border border-border text-sm outline-none focus:border-primary"
                        />
                    </div>
                    <input
                        value={dept}
                        onChange={(e) => setDept(e.target.value)}
                        placeholder="Department"
                        className="px-3 py-1.5 rounded-lg bg-bg-card border border-border text-sm w-32 outline-none focus:border-primary"
                    />
                    <button
                        onClick={selectAll}
                        className="text-xs px-3 py-1.5 rounded-lg bg-bg-card border border-border hover:bg-white/5"
                    >
                        Select all visible
                    </button>
                    {selected.size > 0 && (
                        <button
                            onClick={clearSelection}
                            className="text-xs px-3 py-1.5 rounded-lg bg-bg-card border border-border hover:bg-white/5"
                        >
                            Clear ({selected.size})
                        </button>
                    )}
                </div>

                <div className="max-h-[420px] overflow-auto border border-border rounded-lg">
                    <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-bg-card">
                            <tr className="text-left text-[11px] uppercase tracking-wider text-text-muted border-b border-border">
                                <th className="px-3 py-2 w-8"></th>
                                <th className="px-3 py-2">Student</th>
                                <th className="px-3 py-2">Enrollment</th>
                                <th className="px-3 py-2">Branch</th>
                                <th className="px-3 py-2">Year</th>
                            </tr>
                        </thead>
                        <tbody>
                            {students.isLoading && (
                                <tr><td colSpan={5} className="px-3 py-6 text-center text-text-muted text-xs">Loading…</td></tr>
                            )}
                            {!students.isLoading && rows.length === 0 && (
                                <tr><td colSpan={5} className="px-3 py-6 text-center text-text-muted text-xs">No students match.</td></tr>
                            )}
                            {rows.map((s) => {
                                const isSelected = selected.has(s.id)
                                return (
                                    <tr
                                        key={s.id}
                                        onClick={() => toggle(s.id)}
                                        className={`border-t border-border/40 cursor-pointer transition ${
                                            isSelected ? 'bg-primary/10' : 'hover:bg-white/[0.02]'
                                        }`}
                                    >
                                        <td className="px-3 py-1.5">
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => toggle(s.id)}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </td>
                                        <td className="px-3 py-1.5">
                                            <div className="font-medium text-xs">{s.fullName}</div>
                                            <div className="text-[10px] text-text-muted">{s.email}</div>
                                        </td>
                                        <td className="px-3 py-1.5 text-xs tabular-nums">{s.enrollmentNo}</td>
                                        <td className="px-3 py-1.5 text-xs">{s.department}</td>
                                        <td className="px-3 py-1.5 text-xs">Y{s.year}</td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="text-[11px] text-text-muted">
                    Showing {rows.length}{students.data?.total !== undefined ? ` of ${students.data.total}` : ''} students · {selected.size} selected
                </div>
            </div>

            <div className="glass-card rounded-xl p-4 flex items-center gap-4 flex-wrap">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input type="checkbox" checked={sendEmails} onChange={(e) => setSendEmails(e.target.checked)} />
                    Send credential emails (rotates password)
                </label>
                <button
                    onClick={handleEnrol}
                    disabled={busy || selected.size === 0}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50"
                >
                    {busy ? <Loader2 size={14} className="animate-spin" /> : <UserCheck size={14} />}
                    Enrol {selected.size} selected
                </button>
                {result && (
                    <span className="text-xs text-text-muted">
                        {result.queued
                            ? `Queued ${result.rows} rows in background.`
                            : `${result.summary?.imported || 0} added · ${result.summary?.updated || 0} refreshed · ${result.summary?.failed || 0} failed`}
                    </span>
                )}
            </div>
        </div>
    )
}

// ── BULK FILE (CSV / XLSX) ──────────────────────────────────
function FileImport() {
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
