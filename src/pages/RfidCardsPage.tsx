import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../api/axios'
import {
    Search, Plus, RotateCw, Ban, PauseCircle, PlayCircle,
    Filter, AlertTriangle, ChevronLeft, ChevronRight
} from 'lucide-react'
import Badge from '../components/ui/Badge'
import toast from 'react-hot-toast'

export default function RfidCardsPage() {
    const queryClient = useQueryClient()
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [page, setPage] = useState(1)

    // Assign modal state
    const [showAssignModal, setShowAssignModal] = useState(false)
    const [studentSearch, setStudentSearch] = useState('')
    const [selectedStudent, setSelectedStudent] = useState<any>(null)
    const [cardUid, setCardUid] = useState('')
    const [cardLabel, setCardLabel] = useState('')
    const [expiresAt, setExpiresAt] = useState('')

    // Replace modal state
    const [replaceModalCard, setReplaceModalCard] = useState<any>(null)
    const [newCardUid, setNewCardUid] = useState('')
    const [replaceReason, setReplaceReason] = useState('')

    // Revoke modal state
    const [revokeModalCard, setRevokeModalCard] = useState<any>(null)
    const [revokeReason, setRevokeReason] = useState('')

    // Fetch cards list
    const { data: cardsData, isLoading } = useQuery({
        queryKey: ['rfid-cards', search, statusFilter, page],
        queryFn: () => api.get('/rfid/credentials', {
            params: { search: search || undefined, status: statusFilter || undefined, page, limit: 15 },
        }).then(res => res.data),
    })

    // Search students for assignment
    const { data: searchedStudents } = useQuery({
        queryKey: ['search-students-assign', studentSearch],
        queryFn: () => api.get('/students', { params: { search: studentSearch, limit: 5 } }).then(res => res.data.data?.students || res.data.students || []),
        enabled: studentSearch.length >= 2,
    })

    // Assign mutation
    const assignMutation = useMutation({
        mutationFn: (payload: any) => api.post('/rfid/credentials', payload),
        onSuccess: () => {
            toast.success('RFID Card assigned successfully')
            setShowAssignModal(false)
            setSelectedStudent(null)
            setCardUid('')
            setCardLabel('')
            setExpiresAt('')
            queryClient.invalidateQueries({ queryKey: ['rfid-cards'] })
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.error || 'Failed to assign card')
        },
    })

    // Revoke mutation
    const revokeMutation = useMutation({
        mutationFn: ({ id, reason }: { id: string; reason: string }) =>
            api.post(`/rfid/credentials/${id}/revoke`, { reason }),
        onSuccess: () => {
            toast.success('Card revoked')
            setRevokeModalCard(null)
            setRevokeReason('')
            queryClient.invalidateQueries({ queryKey: ['rfid-cards'] })
        },
        onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to revoke card'),
    })

    // Suspend mutation
    const suspendMutation = useMutation({
        mutationFn: (id: string) => api.post(`/rfid/credentials/${id}/suspend`),
        onSuccess: () => {
            toast.success('Card suspended')
            queryClient.invalidateQueries({ queryKey: ['rfid-cards'] })
        },
        onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to suspend card'),
    })

    // Activate mutation
    const activateMutation = useMutation({
        mutationFn: (id: string) => api.post(`/rfid/credentials/${id}/activate`),
        onSuccess: () => {
            toast.success('Card activated')
            queryClient.invalidateQueries({ queryKey: ['rfid-cards'] })
        },
        onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to activate card'),
    })

    // Replace mutation
    const replaceMutation = useMutation({
        mutationFn: ({ id, newCardUid, reason }: { id: string; newCardUid: string; reason: string }) =>
            api.post(`/rfid/credentials/${id}/replace`, { newCardUid, reason }),
        onSuccess: () => {
            toast.success('Card replaced with new UID')
            setReplaceModalCard(null)
            setNewCardUid('')
            setReplaceReason('')
            queryClient.invalidateQueries({ queryKey: ['rfid-cards'] })
        },
        onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to replace card'),
    })

    const cards = cardsData?.data || []
    const totalPages = cardsData?.totalPages || 1

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-text-primary tracking-tight">RFID Card Management</h1>
                    <p className="text-xs text-text-muted">Issue, revoke, suspend and replace contactless smart credentials</p>
                </div>
                <button
                    onClick={() => setShowAssignModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-white hover:bg-primary-hover shadow-sm transition-colors"
                >
                    <Plus size={16} /> Assign RFID Card
                </button>
            </div>

            {/* Filter Bar */}
            <div className="p-4 rounded-2xl bg-bg-card border border-border flex flex-col md:flex-row gap-3 items-center justify-between">
                <div className="relative w-full md:w-80">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                        placeholder="Search by Card UID, Name, Roll No..."
                        className="w-full pl-9 pr-4 py-2 rounded-xl bg-bg-subtle border border-border text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary"
                    />
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto">
                    <Filter size={14} className="text-text-muted" />
                    <select
                        value={statusFilter}
                        onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
                        className="px-3 py-2 rounded-xl bg-bg-subtle border border-border text-xs text-text-primary focus:outline-none focus:border-primary"
                    >
                        <option value="">All Statuses</option>
                        <option value="ACTIVE">Active</option>
                        <option value="SUSPENDED">Suspended</option>
                        <option value="REVOKED">Revoked</option>
                        <option value="EXPIRED">Expired</option>
                        <option value="LOST">Lost</option>
                    </select>
                </div>
            </div>

            {/* Cards Table */}
            <div className="rounded-2xl bg-bg-card border border-border overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-border bg-bg-subtle/50 text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                                <th className="py-3 px-4">Card UID</th>
                                <th className="py-3 px-4">Student</th>
                                <th className="py-3 px-4">Department</th>
                                <th className="py-3 px-4">Status</th>
                                <th className="py-3 px-4">Taps</th>
                                <th className="py-3 px-4">Last Used</th>
                                <th className="py-3 px-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50 text-xs">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={7} className="py-12 text-center text-text-muted">Loading cards...</td>
                                </tr>
                            ) : cards.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-12 text-center text-text-muted">No RFID credentials found matching filter.</td>
                                </tr>
                            ) : (
                                cards.map((card: any) => (
                                    <tr key={card.id} className="hover:bg-bg-subtle/30 transition-colors">
                                        <td className="py-3.5 px-4 font-mono font-bold text-primary">
                                            {card.cardUid}
                                            {card.label && <span className="block text-[10px] font-sans font-normal text-text-muted">{card.label}</span>}
                                        </td>
                                        <td className="py-3.5 px-4">
                                            <p className="font-semibold text-text-primary">{card.user?.fullName || 'Unassigned'}</p>
                                            <p className="text-[11px] text-text-muted">{card.user?.enrollmentNo || '-'}</p>
                                        </td>
                                        <td className="py-3.5 px-4 text-text-muted">
                                            {card.user?.department || '-'}
                                        </td>
                                        <td className="py-3.5 px-4">
                                            <Badge
                                                variant={
                                                    card.status === 'ACTIVE' ? 'success' :
                                                    card.status === 'SUSPENDED' ? 'warning' :
                                                    card.status === 'REVOKED' ? 'danger' : 'neutral'
                                                }
                                            >
                                                {card.status}
                                            </Badge>
                                        </td>
                                        <td className="py-3.5 px-4 text-text-secondary font-medium">
                                            {card.tapCount}
                                        </td>
                                        <td className="py-3.5 px-4 text-text-muted">
                                            {card.lastUsedAt ? new Date(card.lastUsedAt).toLocaleString() : 'Never'}
                                        </td>
                                        <td className="py-3.5 px-4 text-right">
                                            <div className="inline-flex items-center gap-1.5">
                                                {card.status === 'ACTIVE' && (
                                                    <button
                                                        onClick={() => suspendMutation.mutate(card.id)}
                                                        title="Suspend Card"
                                                        className="p-1.5 rounded-lg text-text-muted hover:text-warning hover:bg-warning/10 transition-colors"
                                                    >
                                                        <PauseCircle size={15} />
                                                    </button>
                                                )}
                                                {card.status === 'SUSPENDED' && (
                                                    <button
                                                        onClick={() => activateMutation.mutate(card.id)}
                                                        title="Re-activate Card"
                                                        className="p-1.5 rounded-lg text-text-muted hover:text-success hover:bg-success/10 transition-colors"
                                                    >
                                                        <PlayCircle size={15} />
                                                    </button>
                                                )}
                                                {card.status !== 'REVOKED' && (
                                                    <button
                                                        onClick={() => setReplaceModalCard(card)}
                                                        title="Replace with New Card"
                                                        className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary/10 transition-colors"
                                                    >
                                                        <RotateCw size={15} />
                                                    </button>
                                                )}
                                                {card.status !== 'REVOKED' && (
                                                    <button
                                                        onClick={() => setRevokeModalCard(card)}
                                                        title="Revoke Card"
                                                        className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                                                    >
                                                        <Ban size={15} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="p-4 border-t border-border flex items-center justify-between">
                        <span className="text-xs text-text-muted">Page {page} of {totalPages}</span>
                        <div className="flex items-center gap-2">
                            <button
                                disabled={page <= 1}
                                onClick={() => setPage(p => p - 1)}
                                className="p-1.5 rounded-lg border border-border text-text-secondary disabled:opacity-40"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <button
                                disabled={page >= totalPages}
                                onClick={() => setPage(p => p + 1)}
                                className="p-1.5 rounded-lg border border-border text-text-secondary disabled:opacity-40"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Assign Modal */}
            {showAssignModal && (
                <div className="fixed inset-0 bg-bg-overlay backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-bg-card border border-border rounded-2xl p-6 w-full max-w-md space-y-4 shadow-xl">
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-bold text-text-primary">Assign RFID Card</h3>
                            <button onClick={() => setShowAssignModal(false)} className="text-text-muted hover:text-text-primary">✕</button>
                        </div>

                        {/* Search Student */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-text-muted">1. Select Student</label>
                            {selectedStudent ? (
                                <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-bold text-text-primary">{selectedStudent.fullName}</p>
                                        <p className="text-[11px] text-text-muted">{selectedStudent.enrollmentNo} • {selectedStudent.department}</p>
                                    </div>
                                    <button onClick={() => setSelectedStudent(null)} className="text-xs text-danger font-medium hover:underline">Change</button>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <input
                                        type="text"
                                        value={studentSearch}
                                        onChange={(e) => setStudentSearch(e.target.value)}
                                        placeholder="Type student name or enrollment no..."
                                        className="w-full px-3 py-2 rounded-xl bg-bg-subtle border border-border text-xs text-text-primary focus:outline-none focus:border-primary"
                                    />
                                    {searchedStudents && searchedStudents.length > 0 && (
                                        <div className="max-h-36 overflow-y-auto border border-border rounded-xl divide-y divide-border bg-bg-subtle">
                                            {searchedStudents.map((s: any) => (
                                                <div
                                                    key={s.id}
                                                    onClick={() => setSelectedStudent(s)}
                                                    className="p-2.5 hover:bg-primary/10 cursor-pointer transition-colors text-xs"
                                                >
                                                    <p className="font-semibold text-text-primary">{s.fullName}</p>
                                                    <p className="text-[10px] text-text-muted">{s.enrollmentNo} - {s.department}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Card UID */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-text-muted">2. Card UID (Hex)</label>
                            <input
                                type="text"
                                value={cardUid}
                                onChange={(e) => setCardUid(e.target.value.toUpperCase())}
                                placeholder="e.g. A1B2C3D4"
                                className="w-full px-3 py-2 font-mono uppercase rounded-xl bg-bg-subtle border border-border text-xs text-text-primary focus:outline-none focus:border-primary"
                            />
                        </div>

                        {/* Label */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-text-muted">Card Label (Optional)</label>
                            <input
                                type="text"
                                value={cardLabel}
                                onChange={(e) => setCardLabel(e.target.value)}
                                placeholder="e.g. Primary Student Card"
                                className="w-full px-3 py-2 rounded-xl bg-bg-subtle border border-border text-xs text-text-primary focus:outline-none focus:border-primary"
                            />
                        </div>

                        {/* Expiry */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-text-muted">Expires At (Optional)</label>
                            <input
                                type="date"
                                value={expiresAt}
                                onChange={(e) => setExpiresAt(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl bg-bg-subtle border border-border text-xs text-text-primary focus:outline-none focus:border-primary"
                            />
                        </div>

                        <div className="flex gap-2 pt-2">
                            <button
                                onClick={() => setShowAssignModal(false)}
                                className="flex-1 py-2 rounded-xl border border-border text-xs font-semibold text-text-secondary hover:bg-bg-subtle"
                            >
                                Cancel
                            </button>
                            <button
                                disabled={!selectedStudent || !cardUid.trim() || assignMutation.isPending}
                                onClick={() => assignMutation.mutate({
                                    userId: selectedStudent.id,
                                    cardUid: cardUid.trim(),
                                    label: cardLabel || undefined,
                                    expiresAt: expiresAt ? new Date(expiresAt).toISOString() : undefined,
                                })}
                                className="flex-1 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-hover disabled:opacity-50"
                            >
                                {assignMutation.isPending ? 'Assigning...' : 'Confirm Assign'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Replace Modal */}
            {replaceModalCard && (
                <div className="fixed inset-0 bg-bg-overlay backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-bg-card border border-border rounded-2xl p-6 w-full max-w-md space-y-4 shadow-xl">
                        <h3 className="text-base font-bold text-text-primary">Replace RFID Card</h3>
                        <p className="text-xs text-text-muted">
                            Replacing card for <span className="font-bold text-text-primary">{replaceModalCard.user?.fullName}</span>. The existing card <span className="font-mono text-danger font-bold">{replaceModalCard.cardUid}</span> will be permanently revoked.
                        </p>
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-text-muted">New Card UID</label>
                            <input
                                type="text"
                                value={newCardUid}
                                onChange={(e) => setNewCardUid(e.target.value.toUpperCase())}
                                placeholder="e.g. F0E1D2C3"
                                className="w-full px-3 py-2 font-mono uppercase rounded-xl bg-bg-subtle border border-border text-xs text-text-primary focus:outline-none focus:border-primary"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-text-muted">Reason</label>
                            <input
                                type="text"
                                value={replaceReason}
                                onChange={(e) => setReplaceReason(e.target.value)}
                                placeholder="e.g. Lost original card"
                                className="w-full px-3 py-2 rounded-xl bg-bg-subtle border border-border text-xs text-text-primary focus:outline-none focus:border-primary"
                            />
                        </div>
                        <div className="flex gap-2 pt-2">
                            <button onClick={() => setReplaceModalCard(null)} className="flex-1 py-2 rounded-xl border border-border text-xs font-semibold text-text-secondary">Cancel</button>
                            <button
                                disabled={!newCardUid.trim() || replaceMutation.isPending}
                                onClick={() => replaceMutation.mutate({ id: replaceModalCard.id, newCardUid: newCardUid.trim(), reason: replaceReason })}
                                className="flex-1 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-hover disabled:opacity-50"
                            >
                                Confirm Replace
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Revoke Modal */}
            {revokeModalCard && (
                <div className="fixed inset-0 bg-bg-overlay backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-bg-card border border-border rounded-2xl p-6 w-full max-w-md space-y-4 shadow-xl">
                        <h3 className="text-base font-bold text-danger flex items-center gap-2">
                            <AlertTriangle size={18} /> Revoke RFID Card
                        </h3>
                        <p className="text-xs text-text-muted">
                            Are you sure you want to permanently revoke card <span className="font-mono font-bold text-text-primary">{revokeModalCard.cardUid}</span> assigned to <span className="font-bold text-text-primary">{revokeModalCard.user?.fullName}</span>?
                        </p>
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-text-muted">Revocation Reason</label>
                            <input
                                type="text"
                                value={revokeReason}
                                onChange={(e) => setRevokeReason(e.target.value)}
                                placeholder="e.g. Student graduated / reported lost"
                                className="w-full px-3 py-2 rounded-xl bg-bg-subtle border border-border text-xs text-text-primary focus:outline-none focus:border-primary"
                            />
                        </div>
                        <div className="flex gap-2 pt-2">
                            <button onClick={() => setRevokeModalCard(null)} className="flex-1 py-2 rounded-xl border border-border text-xs font-semibold text-text-secondary">Cancel</button>
                            <button
                                disabled={revokeMutation.isPending}
                                onClick={() => revokeMutation.mutate({ id: revokeModalCard.id, reason: revokeReason })}
                                className="flex-1 py-2 rounded-xl bg-danger text-white text-xs font-semibold hover:bg-danger/90 disabled:opacity-50"
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
