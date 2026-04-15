import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ShieldAlert } from 'lucide-react'
import api from '../api/axios'
import LoadingSpinner from '../components/ui/LoadingSpinner'

type StudentSummary = {
    id: string
    fullName: string
    enrollmentNo: string
    email: string
}

type StudentAuthLog = {
    id: string
    action: string
    status: string
    reason: string | null
    studentEmail: string | null
    enrollmentNo: string | null
    deviceId: string | null
    deviceLabel: string | null
    devicePlatform: string | null
    ipAddress: string | null
    createdAt: string
    student: StudentSummary | null
}

type StudentAuthLogResponse = {
    logs: StudentAuthLog[]
    total: number
    page: number
    pages: number
    limit: number
}

const ACTION_OPTIONS = [
    'LOGIN_SUCCESS',
    'LOGIN_FAILURE',
    'LOGIN_BLOCKED_MISSING_DEVICE_ID',
    'LOGIN_BLOCKED_STUDENT_LINKED_TO_OTHER_DEVICE',
    'LOGIN_BLOCKED_DEVICE_LINKED_TO_OTHER_STUDENT',
    'LOGOUT_SUCCESS',
    'DEVICE_REBOUND',
    'DEVICE_METADATA_UPDATED',
    'DEVICE_REBIND_BLOCKED_DEVICE_LINKED_TO_OTHER_STUDENT',
]

function statusClass(status: string) {
    const normalized = status.toUpperCase()
    if (normalized === 'SUCCESS') return 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
    if (normalized === 'BLOCKED') return 'bg-red-500/20 text-red-300 border border-red-500/30'
    return 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
}

export default function StudentAuthLogsPage() {
    const [page, setPage] = useState(1)
    const [appliedSearch, setAppliedSearch] = useState('')
    const [searchInput, setSearchInput] = useState('')
    const [action, setAction] = useState('')
    const [status, setStatus] = useState('')

    const queryParams = useMemo(
        () => ({
            page,
            limit: 50,
            search: appliedSearch || undefined,
            action: action || undefined,
            status: status || undefined,
        }),
        [page, appliedSearch, action, status],
    )

    const { data, isLoading, isFetching } = useQuery<StudentAuthLogResponse>({
        queryKey: ['student-auth-logs', queryParams],
        queryFn: () =>
            api
                .get('/admin/student-auth-logs', { params: queryParams })
                .then((response) => response.data.data as StudentAuthLogResponse),
    })

    const applyFilters = (event: FormEvent) => {
        event.preventDefault()
        setPage(1)
        setAppliedSearch(searchInput.trim())
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <ShieldAlert size={28} /> Student Auth Logs
                </h2>
                {isFetching && <span className="text-xs text-text-secondary">Refreshing...</span>}
            </div>

            <form
                onSubmit={applyFilters}
                className="bg-bg-card rounded-xl border border-border p-4 grid grid-cols-1 md:grid-cols-5 gap-3"
            >
                <input
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    placeholder="Search by enrollment, email, device"
                    className="md:col-span-2 bg-bg-dark border border-border rounded-lg px-3 py-2 text-sm"
                />
                <select
                    value={action}
                    onChange={(event) => {
                        setAction(event.target.value)
                        setPage(1)
                    }}
                    className="bg-bg-dark border border-border rounded-lg px-3 py-2 text-sm"
                >
                    <option value="">All actions</option>
                    {ACTION_OPTIONS.map((item) => (
                        <option key={item} value={item}>
                            {item}
                        </option>
                    ))}
                </select>
                <select
                    value={status}
                    onChange={(event) => {
                        setStatus(event.target.value)
                        setPage(1)
                    }}
                    className="bg-bg-dark border border-border rounded-lg px-3 py-2 text-sm"
                >
                    <option value="">All status</option>
                    <option value="SUCCESS">SUCCESS</option>
                    <option value="FAILED">FAILED</option>
                    <option value="BLOCKED">BLOCKED</option>
                </select>
                <button
                    type="submit"
                    className="bg-primary hover:bg-primary-light text-white rounded-lg px-4 py-2 text-sm font-semibold"
                >
                    Apply
                </button>
            </form>

            {isLoading ? (
                <LoadingSpinner />
            ) : (
                <div className="bg-bg-card rounded-xl border border-border overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[1100px]">
                            <thead>
                                <tr className="border-b border-border">
                                    <th className="text-left text-xs text-text-secondary px-4 py-3">Time</th>
                                    <th className="text-left text-xs text-text-secondary px-4 py-3">Student</th>
                                    <th className="text-left text-xs text-text-secondary px-4 py-3">Action</th>
                                    <th className="text-left text-xs text-text-secondary px-4 py-3">Status</th>
                                    <th className="text-left text-xs text-text-secondary px-4 py-3">Reason</th>
                                    <th className="text-left text-xs text-text-secondary px-4 py-3">Device</th>
                                    <th className="text-left text-xs text-text-secondary px-4 py-3">IP</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(data?.logs?.length || 0) === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="text-center text-text-secondary py-8">
                                            No student auth logs found
                                        </td>
                                    </tr>
                                ) : (
                                    data?.logs.map((log) => (
                                        <tr key={log.id} className="border-b border-border/50 hover:bg-bg-hover align-top">
                                            <td className="px-4 py-3 text-sm whitespace-nowrap">
                                                {new Date(log.createdAt).toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                <p className="font-medium">{log.student?.fullName || 'Unknown'}</p>
                                                <p className="text-text-secondary text-xs">
                                                    {log.enrollmentNo || log.student?.enrollmentNo || 'N/A'}
                                                </p>
                                                <p className="text-text-secondary text-xs">{log.studentEmail || log.student?.email || 'N/A'}</p>
                                            </td>
                                            <td className="px-4 py-3 text-xs font-semibold">{log.action}</td>
                                            <td className="px-4 py-3">
                                                <span className={`text-xs px-2 py-0.5 rounded-full ${statusClass(log.status)}`}>
                                                    {log.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-text-secondary">{log.reason || '—'}</td>
                                            <td className="px-4 py-3 text-xs">
                                                <p className="font-mono text-text-primary">{log.deviceId || '—'}</p>
                                                <p className="text-text-secondary">{log.deviceLabel || '—'}</p>
                                                <p className="text-text-secondary">{log.devicePlatform || '—'}</p>
                                            </td>
                                            <td className="px-4 py-3 text-xs font-mono text-text-secondary">{log.ipAddress || '—'}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    {data && data.pages > 0 && (
                        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                            <span className="text-sm text-text-secondary">
                                Page {data.page} of {data.pages} ({data.total} records)
                            </span>
                            <div className="flex gap-2">
                                <button
                                    disabled={page <= 1}
                                    onClick={() => setPage((prev) => prev - 1)}
                                    className="px-3 py-1 bg-bg-dark rounded text-sm disabled:opacity-50"
                                >
                                    Prev
                                </button>
                                <button
                                    disabled={page >= data.pages}
                                    onClick={() => setPage((prev) => prev + 1)}
                                    className="px-3 py-1 bg-bg-dark rounded text-sm disabled:opacity-50"
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
