import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ShieldAlert } from 'lucide-react'
import api from '../api/axios'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import toast from 'react-hot-toast'

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

type RebindRequest = {
    id: string
    status: 'PENDING' | 'APPROVED' | 'REJECTED'
    currentDeviceId: string | null
    requestedDeviceId: string
    requestedLabel: string | null
    requestedPlatform: string | null
    reason: string | null
    requestedAt: string
    processedAt: string | null
    adminNote: string | null
    student: {
        id: string
        fullName: string
        enrollmentNo: string
        email: string
        linkedDeviceId: string | null
    }
    processedBy?: {
        id: string
        name: string
        email: string
    } | null
}

type RebindRequestResponse = {
    requests: RebindRequest[]
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
    const queryClient = useQueryClient()

    const [page, setPage] = useState(1)
    const [appliedSearch, setAppliedSearch] = useState('')
    const [searchInput, setSearchInput] = useState('')
    const [action, setAction] = useState('')
    const [status, setStatus] = useState('')
    const [fromDate, setFromDate] = useState('')
    const [toDate, setToDate] = useState('')
    const [blockedOnly, setBlockedOnly] = useState(false)

    const [requestPage, setRequestPage] = useState(1)
    const [requestStatus, setRequestStatus] = useState('PENDING')
    const [requestSearch, setRequestSearch] = useState('')

    const queryParams = useMemo(
        () => ({
            page,
            limit: 50,
            search: appliedSearch || undefined,
            action: action || undefined,
            status: status || undefined,
            fromDate: fromDate || undefined,
            toDate: toDate || undefined,
            blockedOnly: blockedOnly || undefined,
        }),
        [page, appliedSearch, action, status, fromDate, toDate, blockedOnly],
    )

    const requestQueryParams = useMemo(
        () => ({
            page: requestPage,
            limit: 20,
            status: requestStatus || undefined,
            search: requestSearch.trim() || undefined,
        }),
        [requestPage, requestStatus, requestSearch],
    )

    const { data, isLoading, isFetching } = useQuery<StudentAuthLogResponse>({
        queryKey: ['student-auth-logs', queryParams],
        queryFn: () =>
            api
                .get('/admin/student-auth-logs', { params: queryParams })
                .then((response) => response.data.data as StudentAuthLogResponse),
    })

    const {
        data: requestData,
        isLoading: isRequestLoading,
        isFetching: isRequestFetching,
    } = useQuery<RebindRequestResponse>({
        queryKey: ['device-rebind-requests', requestQueryParams],
        queryFn: () =>
            api
                .get('/admin/device-rebind-requests', { params: requestQueryParams })
                .then((response) => response.data.data as RebindRequestResponse),
    })

    const resolveRequestMutation = useMutation({
        mutationFn: async ({
            requestId,
            decision,
            adminNote,
        }: {
            requestId: string
            decision: 'APPROVE' | 'REJECT'
            adminNote?: string
        }) => {
            const response = await api.patch(`/admin/device-rebind-requests/${requestId}/decision`, {
                decision,
                adminNote: adminNote?.trim() || undefined,
            })
            return response.data
        },
        onSuccess: () => {
            toast.success('Request updated successfully')
            queryClient.invalidateQueries({ queryKey: ['student-auth-logs'] })
            queryClient.invalidateQueries({ queryKey: ['device-rebind-requests'] })
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.error || 'Failed to update request')
        },
    })

    const applyFilters = (event: FormEvent) => {
        event.preventDefault()
        setPage(1)
        setAppliedSearch(searchInput.trim())
    }

    const handleResolveRequest = (requestId: string, decision: 'APPROVE' | 'REJECT') => {
        const notePrompt = decision === 'REJECT'
            ? 'Enter rejection note (required for clarity):'
            : 'Optional admin note for approval:'

        const adminNote = window.prompt(notePrompt, '')
        if (adminNote === null) return
        if (decision === 'REJECT' && !adminNote.trim()) {
            toast.error('Rejection note is required')
            return
        }

        resolveRequestMutation.mutate({ requestId, decision, adminNote })
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
                className="bg-bg-card rounded-xl border border-border p-4 grid grid-cols-1 md:grid-cols-7 gap-3"
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
                <input
                    type="date"
                    value={fromDate}
                    onChange={(event) => {
                        setFromDate(event.target.value)
                        setPage(1)
                    }}
                    className="bg-bg-dark border border-border rounded-lg px-3 py-2 text-sm"
                />
                <input
                    type="date"
                    value={toDate}
                    onChange={(event) => {
                        setToDate(event.target.value)
                        setPage(1)
                    }}
                    className="bg-bg-dark border border-border rounded-lg px-3 py-2 text-sm"
                />
                <label className="flex items-center gap-2 px-2 text-sm text-text-secondary">
                    <input
                        type="checkbox"
                        checked={blockedOnly}
                        onChange={(event) => {
                            setBlockedOnly(event.target.checked)
                            setPage(1)
                        }}
                    />
                    Blocked only
                </label>
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

            <div className="bg-bg-card rounded-xl border border-border overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <div>
                        <h3 className="text-lg font-semibold">Device Rebind Requests</h3>
                        <p className="text-xs text-text-secondary">Approve or reject student device rebind requests</p>
                    </div>
                    <div className="text-xs text-text-secondary">{isRequestFetching ? 'Refreshing...' : ''}</div>
                </div>

                <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3 border-b border-border">
                    <input
                        value={requestSearch}
                        onChange={(event) => {
                            setRequestSearch(event.target.value)
                            setRequestPage(1)
                        }}
                        placeholder="Search by student/device"
                        className="md:col-span-2 bg-bg-dark border border-border rounded-lg px-3 py-2 text-sm"
                    />
                    <select
                        value={requestStatus}
                        onChange={(event) => {
                            setRequestStatus(event.target.value)
                            setRequestPage(1)
                        }}
                        className="bg-bg-dark border border-border rounded-lg px-3 py-2 text-sm"
                    >
                        <option value="PENDING">PENDING</option>
                        <option value="APPROVED">APPROVED</option>
                        <option value="REJECTED">REJECTED</option>
                    </select>
                    <button
                        onClick={() => queryClient.invalidateQueries({ queryKey: ['device-rebind-requests'] })}
                        className="bg-bg-dark border border-border rounded-lg px-4 py-2 text-sm"
                    >
                        Refresh
                    </button>
                </div>

                {isRequestLoading ? (
                    <div className="p-6">
                        <LoadingSpinner />
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[1000px]">
                            <thead>
                                <tr className="border-b border-border">
                                    <th className="text-left text-xs text-text-secondary px-4 py-3">Requested At</th>
                                    <th className="text-left text-xs text-text-secondary px-4 py-3">Student</th>
                                    <th className="text-left text-xs text-text-secondary px-4 py-3">Current Device</th>
                                    <th className="text-left text-xs text-text-secondary px-4 py-3">Requested Device</th>
                                    <th className="text-left text-xs text-text-secondary px-4 py-3">Status</th>
                                    <th className="text-left text-xs text-text-secondary px-4 py-3">Reason / Note</th>
                                    <th className="text-left text-xs text-text-secondary px-4 py-3">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(requestData?.requests?.length || 0) === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="text-center text-text-secondary py-8">
                                            No device rebind requests found
                                        </td>
                                    </tr>
                                ) : (
                                    requestData?.requests.map((request) => (
                                        <tr key={request.id} className="border-b border-border/50 hover:bg-bg-hover align-top">
                                            <td className="px-4 py-3 text-sm whitespace-nowrap">
                                                {new Date(request.requestedAt).toLocaleString()}
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                <p className="font-medium">{request.student.fullName}</p>
                                                <p className="text-xs text-text-secondary">{request.student.enrollmentNo}</p>
                                                <p className="text-xs text-text-secondary">{request.student.email}</p>
                                            </td>
                                            <td className="px-4 py-3 text-xs font-mono">{request.currentDeviceId || '—'}</td>
                                            <td className="px-4 py-3 text-xs">
                                                <p className="font-mono">{request.requestedDeviceId}</p>
                                                <p className="text-text-secondary">{request.requestedLabel || '—'}</p>
                                                <p className="text-text-secondary">{request.requestedPlatform || '—'}</p>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className={`text-xs px-2 py-0.5 rounded-full ${statusClass(request.status)}`}>
                                                    {request.status}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-text-secondary">
                                                <p>{request.reason || '—'}</p>
                                                <p>{request.adminNote || '—'}</p>
                                            </td>
                                            <td className="px-4 py-3 text-xs">
                                                {request.status === 'PENDING' ? (
                                                    <div className="flex gap-2">
                                                        <button
                                                            disabled={resolveRequestMutation.isPending}
                                                            onClick={() => handleResolveRequest(request.id, 'APPROVE')}
                                                            className="px-2 py-1 rounded bg-emerald-600/20 text-emerald-300 disabled:opacity-50"
                                                        >
                                                            Approve
                                                        </button>
                                                        <button
                                                            disabled={resolveRequestMutation.isPending}
                                                            onClick={() => handleResolveRequest(request.id, 'REJECT')}
                                                            className="px-2 py-1 rounded bg-red-600/20 text-red-300 disabled:opacity-50"
                                                        >
                                                            Reject
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span className="text-text-secondary">Processed</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {requestData && requestData.pages > 0 && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                        <span className="text-sm text-text-secondary">
                            Page {requestData.page} of {requestData.pages} ({requestData.total} requests)
                        </span>
                        <div className="flex gap-2">
                            <button
                                disabled={requestPage <= 1}
                                onClick={() => setRequestPage((prev) => prev - 1)}
                                className="px-3 py-1 bg-bg-dark rounded text-sm disabled:opacity-50"
                            >
                                Prev
                            </button>
                            <button
                                disabled={requestPage >= requestData.pages}
                                onClick={() => setRequestPage((prev) => prev + 1)}
                                className="px-3 py-1 bg-bg-dark rounded text-sm disabled:opacity-50"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
