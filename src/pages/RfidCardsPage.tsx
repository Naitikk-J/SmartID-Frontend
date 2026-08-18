import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../api/axios'
import {
    Search, Plus, RotateCw, Ban, PauseCircle, PlayCircle,
    Filter, AlertTriangle, ChevronLeft, ChevronRight, Upload, Download,
    FileSpreadsheet, CheckCircle2, XCircle, CheckSquare, Square, Printer, CreditCard
} from 'lucide-react'
import Badge from '../components/ui/Badge'
import toast from 'react-hot-toast'

export default function RfidCardsPage() {
    const queryClient = useQueryClient()
    const fileInputRef = useRef<HTMLInputElement>(null)

    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [batchFilter, setBatchFilter] = useState('')
    const [page, setPage] = useState(1)

    // Selection for bulk actions
    const [selectedCardIds, setSelectedCardIds] = useState<string[]>([])

    // Specific Assign modal state
    const [showAssignModal, setShowAssignModal] = useState(false)
    const [studentSearch, setStudentSearch] = useState('')
    const [selectedStudent, setSelectedStudent] = useState<any>(null)
    const [cardUid, setCardUid] = useState('')
    const [printedCardNumber, setPrintedCardNumber] = useState('')
    const [batchNumber, setBatchNumber] = useState('')
    const [cardLabel, setCardLabel] = useState('')
    const [expiresAt, setExpiresAt] = useState('')

    // Bulk Import modal state
    const [showBulkModal, setShowBulkModal] = useState(false)
    const [bulkBatchNumber, setBulkBatchNumber] = useState('')
    const [bulkParsedItems, setBulkParsedItems] = useState<any[]>([])
    const [bulkResults, setBulkResults] = useState<any>(null)

    // Replace modal state
    const [replaceModalCard, setReplaceModalCard] = useState<any>(null)
    const [newCardUid, setNewCardUid] = useState('')
    const [replaceReason, setReplaceReason] = useState('')

    // Revoke modal state
    const [revokeModalCard, setRevokeModalCard] = useState<any>(null)
    const [revokeReason, setRevokeReason] = useState('')

    // Fetch cards list
    const { data: cardsData, isLoading } = useQuery({
        queryKey: ['rfid-cards', search, statusFilter, batchFilter, page],
        queryFn: () => api.get('/rfid/credentials', {
            params: {
                search: search || undefined,
                status: statusFilter || undefined,
                batchNumber: batchFilter || undefined,
                page,
                limit: 15,
            },
        }).then(res => res.data),
    })

    // Search students for individual assignment
    const { data: searchedStudents } = useQuery({
        queryKey: ['search-students-assign', studentSearch],
        queryFn: () => api.get('/students', { params: { search: studentSearch, limit: 5 } }).then(res => res.data.data?.students || res.data.students || []),
        enabled: studentSearch.length >= 2,
    })

    // Specific Assign mutation
    const assignMutation = useMutation({
        mutationFn: (payload: any) => api.post('/rfid/credentials', payload),
        onSuccess: () => {
            toast.success('Printed RFID Card assigned successfully')
            setShowAssignModal(false)
            setSelectedStudent(null)
            setCardUid('')
            setPrintedCardNumber('')
            setBatchNumber('')
            setCardLabel('')
            setExpiresAt('')
            queryClient.invalidateQueries({ queryKey: ['rfid-cards'] })
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.error || 'Failed to assign card')
        },
    })

    // Bulk Assign mutation
    const bulkAssignMutation = useMutation({
        mutationFn: (payload: any) => api.post('/rfid/credentials/bulk-assign', payload),
        onSuccess: (res: any) => {
            const data = res.data.results
            setBulkResults(data)
            toast.success(`Bulk assignment complete: ${data.totalSuccess} assigned, ${data.totalFailed} failed`)
            queryClient.invalidateQueries({ queryKey: ['rfid-cards'] })
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.error || 'Failed to execute bulk assignment')
        },
    })

    // Bulk Action mutation (Bulk Revoke / Suspend / Activate)
    const bulkActionMutation = useMutation({
        mutationFn: ({ action, reason }: { action: string; reason?: string }) =>
            api.post('/rfid/credentials/bulk-action', { credentialIds: selectedCardIds, action, reason }),
        onSuccess: (res: any) => {
            toast.success(`Bulk action completed for ${res.data.count} cards`)
            setSelectedCardIds([])
            queryClient.invalidateQueries({ queryKey: ['rfid-cards'] })
        },
        onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to execute bulk action'),
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

    // Handle CSV File Parsing for Bulk Import
    const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (event) => {
            const text = event.target?.result as string
            if (!text) return

            const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
            if (lines.length <= 1) {
                toast.error('CSV file contains no data rows')
                return
            }

            const header = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/^["']|["']$/g, ''))
            const rollIdx = header.findIndex(h => h.includes('enroll') || h.includes('roll') || h.includes('student'))
            const uidIdx = header.findIndex(h => h.includes('uid') || h.includes('rfid') || h.includes('card'))
            const cardNumIdx = header.findIndex(h => h.includes('serial') || h.includes('number') || h.includes('printed'))
            const batchIdx = header.findIndex(h => h.includes('batch'))

            if (rollIdx === -1 || uidIdx === -1) {
                toast.error('CSV must have columns for EnrollmentNo and CardUID')
                return
            }

            const parsed: any[] = []
            for (let i = 1; i < lines.length; i++) {
                const cols = lines[i].split(',').map(c => c.trim().replace(/^["']|["']$/g, ''))
                if (cols.length <= Math.max(rollIdx, uidIdx)) continue

                parsed.push({
                    enrollmentNo: cols[rollIdx],
                    cardUid: cols[uidIdx].toUpperCase(),
                    printedCardNumber: cardNumIdx !== -1 ? cols[cardNumIdx] : undefined,
                    batchNumber: batchIdx !== -1 ? cols[batchIdx] : undefined,
                })
            }

            setBulkParsedItems(parsed)
            setBulkResults(null)
            toast.success(`Loaded ${parsed.length} student card records from CSV`)
        }
        reader.readAsText(file)
    }

    // Download Sample CSV Template
    const downloadSampleCsv = () => {
        const sample = `enrollmentNo,cardUid,printedCardNumber,batchNumber\r\n0901CS211001,A1B2C3D4,MITS-2026-001,BATCH-2026-CSE\r\n0901CS211002,E5F6A7B8,MITS-2026-002,BATCH-2026-CSE\r\n0901IT211015,9C8D7E6F,MITS-2026-003,BATCH-2026-IT`
        const blob = new Blob([sample], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'sample_rfid_card_assignment.csv'
        a.click()
        URL.revokeObjectURL(url)
    }

    // Export Assigned Cards for PVC Printing Vendor
    const handleExportPrinting = async () => {
        try {
            const res = await api.get('/rfid/credentials/export', {
                params: { batchNumber: batchFilter || undefined, status: statusFilter || undefined },
                responseType: 'blob',
            })
            const blob = new Blob([res.data], { type: 'text/csv' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `pvc_print_export_${batchFilter || 'all'}_${new Date().toISOString().split('T')[0]}.csv`
            a.click()
            URL.revokeObjectURL(url)
            toast.success('PVC Card Printing Export downloaded')
        } catch {
            toast.error('Failed to export cards for printing')
        }
    }

    // Select/Deselect All Checkbox
    const handleSelectAll = () => {
        if (selectedCardIds.length === cards.length) {
            setSelectedCardIds([])
        } else {
            setSelectedCardIds(cards.map((c: any) => c.id))
        }
    }

    const toggleSelectCard = (id: string) => {
        setSelectedCardIds(prev =>
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        )
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-text-primary tracking-tight">RFID Card Management</h1>
                    <p className="text-xs text-text-muted">Issue, bulk import, print & manage physical contactless student ID cards</p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                    <button
                        onClick={handleExportPrinting}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-bg-card border border-border text-text-primary hover:bg-bg-subtle shadow-xs transition-colors"
                        title="Export CSV formatted for PVC card printing vendors"
                    >
                        <Printer size={15} className="text-primary" /> Export for Printing
                    </button>
                    <button
                        onClick={() => { setShowBulkModal(true); setBulkParsedItems([]); setBulkResults(null) }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-accent/10 border border-accent/20 text-accent hover:bg-accent/20 transition-colors"
                    >
                        <Upload size={15} /> Bulk CSV Import
                    </button>
                    <button
                        onClick={() => setShowAssignModal(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-white hover:bg-primary-hover shadow-sm transition-colors"
                    >
                        <Plus size={16} /> Assign Single Card
                    </button>
                </div>
            </div>

            {/* Bulk Actions Bar (Shown when cards are selected) */}
            {selectedCardIds.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-primary/10 border border-primary/30 flex flex-wrap items-center justify-between gap-3 animate-fade-in">
                    <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                        <CheckSquare size={16} />
                        <span>{selectedCardIds.length} cards selected</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => bulkActionMutation.mutate({ action: 'ACTIVATE' })}
                            disabled={bulkActionMutation.isPending}
                            className="px-3 py-1.5 rounded-xl bg-success text-white text-xs font-semibold hover:bg-success/90 transition-colors"
                        >
                            Activate Selected
                        </button>
                        <button
                            onClick={() => bulkActionMutation.mutate({ action: 'SUSPEND' })}
                            disabled={bulkActionMutation.isPending}
                            className="px-3 py-1.5 rounded-xl bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 transition-colors"
                        >
                            Suspend Selected
                        </button>
                        <button
                            onClick={() => {
                                const reason = prompt('Enter revocation reason for selected cards:')
                                if (reason !== null) {
                                    bulkActionMutation.mutate({ action: 'REVOKE', reason })
                                }
                            }}
                            disabled={bulkActionMutation.isPending}
                            className="px-3 py-1.5 rounded-xl bg-danger text-white text-xs font-semibold hover:bg-danger/90 transition-colors"
                        >
                            Revoke Selected
                        </button>
                        <button
                            onClick={() => setSelectedCardIds([])}
                            className="px-2.5 py-1.5 text-xs text-text-muted hover:text-text-primary"
                        >
                            Clear Selection
                        </button>
                    </div>
                </div>
            )}

            {/* Filter Bar */}
            <div className="p-4 rounded-2xl bg-bg-card border border-border flex flex-col md:flex-row gap-3 items-center justify-between shadow-xs">
                <div className="relative w-full md:w-80">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                        placeholder="Search by UID, Card No, Roll No, Batch..."
                        className="w-full pl-9 pr-4 py-2 rounded-xl bg-bg-subtle border border-border text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
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

                    <input
                        type="text"
                        placeholder="Filter by Batch..."
                        value={batchFilter}
                        onChange={(e) => { setBatchFilter(e.target.value); setPage(1) }}
                        className="px-3 py-2 rounded-xl bg-bg-subtle border border-border text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary w-36"
                    />
                </div>
            </div>

            {/* Cards Table */}
            <div className="rounded-2xl bg-bg-card border border-border overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-border bg-bg-subtle/50 text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                                <th className="py-3 px-4 w-10">
                                    <button onClick={handleSelectAll} className="text-text-muted hover:text-text-primary">
                                        {cards.length > 0 && selectedCardIds.length === cards.length ? (
                                            <CheckSquare size={16} className="text-primary" />
                                        ) : (
                                            <Square size={16} />
                                        )}
                                    </button>
                                </th>
                                <th className="py-3 px-4">Card UID & Physical Serial</th>
                                <th className="py-3 px-4">Student</th>
                                <th className="py-3 px-4">Department & Batch</th>
                                <th className="py-3 px-4">Status</th>
                                <th className="py-3 px-4">Taps</th>
                                <th className="py-3 px-4">Last Used</th>
                                <th className="py-3 px-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50 text-xs">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={8} className="py-12 text-center text-text-muted">Loading cards...</td>
                                </tr>
                            ) : cards.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="py-12 text-center text-text-muted">No RFID credentials found matching filter.</td>
                                </tr>
                            ) : (
                                cards.map((card: any) => {
                                    const isSelected = selectedCardIds.includes(card.id)
                                    return (
                                        <tr key={card.id} className={`hover:bg-bg-subtle/30 transition-colors ${isSelected ? 'bg-primary/5' : ''}`}>
                                            <td className="py-3.5 px-4">
                                                <button onClick={() => toggleSelectCard(card.id)}>
                                                    {isSelected ? (
                                                        <CheckSquare size={16} className="text-primary" />
                                                    ) : (
                                                        <Square size={16} className="text-text-muted" />
                                                    )}
                                                </button>
                                            </td>
                                            <td className="py-3.5 px-4">
                                                <div className="flex items-center gap-2">
                                                    <CreditCard size={15} className="text-primary shrink-0" />
                                                    <div>
                                                        <span className="font-mono font-bold text-primary block">{card.cardUid}</span>
                                                        {card.printedCardNumber && (
                                                            <span className="text-[10px] text-text-muted block">ID: {card.printedCardNumber}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-3.5 px-4">
                                                <p className="font-semibold text-text-primary">{card.user?.fullName || 'Unassigned'}</p>
                                                <p className="text-[11px] text-text-muted">{card.user?.enrollmentNo || '-'}</p>
                                            </td>
                                            <td className="py-3.5 px-4">
                                                <p className="text-text-primary font-medium">{card.user?.department || '-'}</p>
                                                {card.batchNumber ? (
                                                    <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono bg-bg-subtle border border-border text-text-muted mt-0.5">
                                                        {card.batchNumber}
                                                    </span>
                                                ) : (
                                                    <span className="text-[10px] text-text-muted">-</span>
                                                )}
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
                                            <td className="py-3.5 px-4 font-mono font-medium">
                                                {card.tapCount || 0}
                                            </td>
                                            <td className="py-3.5 px-4 text-text-muted">
                                                {card.lastUsedAt ? new Date(card.lastUsedAt).toLocaleDateString() : 'Never'}
                                            </td>
                                            <td className="py-3.5 px-4 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    {card.status === 'ACTIVE' && (
                                                        <button
                                                            onClick={() => suspendMutation.mutate(card.id)}
                                                            title="Suspend (Freeze Access)"
                                                            className="p-1.5 rounded-lg text-text-muted hover:text-amber-500 hover:bg-amber-500/10 transition-colors"
                                                        >
                                                            <PauseCircle size={15} />
                                                        </button>
                                                    )}
                                                    {card.status === 'SUSPENDED' && (
                                                        <button
                                                            onClick={() => activateMutation.mutate(card.id)}
                                                            title="Activate Card"
                                                            className="p-1.5 rounded-lg text-text-muted hover:text-success hover:bg-success/10 transition-colors"
                                                        >
                                                            <PlayCircle size={15} />
                                                        </button>
                                                    )}
                                                    {card.status !== 'REVOKED' && (
                                                        <>
                                                            <button
                                                                onClick={() => setReplaceModalCard(card)}
                                                                title="Replace with new UID"
                                                                className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary/10 transition-colors"
                                                            >
                                                                <RotateCw size={15} />
                                                            </button>
                                                            <button
                                                                onClick={() => setRevokeModalCard(card)}
                                                                title="Revoke Permanently"
                                                                className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                                                            >
                                                                <Ban size={15} />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="p-4 border-t border-border flex items-center justify-between text-xs text-text-muted">
                    <span>Page {page} of {totalPages}</span>
                    <div className="flex items-center gap-2">
                        <button
                            disabled={page <= 1}
                            onClick={() => setPage(p => p - 1)}
                            className="p-1.5 rounded-lg border border-border hover:bg-bg-subtle disabled:opacity-50"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        <button
                            disabled={page >= totalPages}
                            onClick={() => setPage(p => p + 1)}
                            className="p-1.5 rounded-lg border border-border hover:bg-bg-subtle disabled:opacity-50"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Single Card Assign Modal */}
            {showAssignModal && (
                <div className="fixed inset-0 bg-bg-overlay backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-bg-card border border-border rounded-2xl p-6 w-full max-w-md space-y-4 shadow-xl">
                        <div className="flex items-center justify-between border-b border-border pb-3">
                            <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                                <CreditCard size={18} className="text-primary" /> Assign Printed RFID Card
                            </h3>
                            <button onClick={() => setShowAssignModal(false)} className="text-text-muted hover:text-text-primary text-xs">Close</button>
                        </div>

                        {/* Student Search */}
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

                        {/* Card UID & Printed Serial Number */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-text-muted">2. Card UID (Hex) *</label>
                                <input
                                    type="text"
                                    value={cardUid}
                                    onChange={(e) => setCardUid(e.target.value.toUpperCase())}
                                    placeholder="e.g. A1B2C3D4"
                                    className="w-full px-3 py-2 font-mono uppercase rounded-xl bg-bg-subtle border border-border text-xs text-text-primary focus:outline-none focus:border-primary"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-text-muted">Printed Serial No</label>
                                <input
                                    type="text"
                                    value={printedCardNumber}
                                    onChange={(e) => setPrintedCardNumber(e.target.value)}
                                    placeholder="e.g. MITS-2026-001"
                                    className="w-full px-3 py-2 rounded-xl bg-bg-subtle border border-border text-xs text-text-primary focus:outline-none focus:border-primary"
                                />
                            </div>
                        </div>

                        {/* Batch Number & Label */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-text-muted">Batch Number</label>
                                <input
                                    type="text"
                                    value={batchNumber}
                                    onChange={(e) => setBatchNumber(e.target.value)}
                                    placeholder="e.g. BATCH-2026-CSE"
                                    className="w-full px-3 py-2 rounded-xl bg-bg-subtle border border-border text-xs text-text-primary focus:outline-none focus:border-primary"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-text-muted">Card Label</label>
                                <input
                                    type="text"
                                    value={cardLabel}
                                    onChange={(e) => setCardLabel(e.target.value)}
                                    placeholder="e.g. Student Smart ID"
                                    className="w-full px-3 py-2 rounded-xl bg-bg-subtle border border-border text-xs text-text-primary focus:outline-none focus:border-primary"
                                />
                            </div>
                        </div>

                        {/* Expiry */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-text-muted">Expiry Date (Optional)</label>
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
                                    printedCardNumber: printedCardNumber.trim() || undefined,
                                    batchNumber: batchNumber.trim() || undefined,
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

            {/* Bulk CSV Import Modal */}
            {showBulkModal && (
                <div className="fixed inset-0 bg-bg-overlay backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-bg-card border border-border rounded-2xl p-6 w-full max-w-2xl space-y-4 shadow-xl max-h-[90vh] overflow-y-auto custom-scrollbar">
                        <div className="flex items-center justify-between border-b border-border pb-3">
                            <div className="flex items-center gap-2">
                                <FileSpreadsheet size={20} className="text-accent" />
                                <div>
                                    <h3 className="text-base font-bold text-text-primary">Bulk Assign Printed RFID Cards</h3>
                                    <p className="text-xs text-text-muted">Import a CSV mapping student enrollment numbers to card UIDs</p>
                                </div>
                            </div>
                            <button onClick={() => setShowBulkModal(false)} className="text-text-muted hover:text-text-primary text-xs">Close</button>
                        </div>

                        {/* Template Download & File Upload */}
                        <div className="p-4 rounded-xl bg-bg-subtle border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                            <div>
                                <p className="text-xs font-bold text-text-primary">Need the CSV Template?</p>
                                <p className="text-[11px] text-text-muted">Download sample format with enrollmentNo, cardUid, printedCardNumber, batchNumber</p>
                            </div>
                            <button
                                onClick={downloadSampleCsv}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-bg-card border border-border text-text-primary hover:bg-bg-subtle"
                            >
                                <Download size={14} /> Download Sample CSV
                            </button>
                        </div>

                        {/* File Select & Default Batch */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-text-muted">Upload CSV File</label>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".csv,.txt"
                                    onChange={handleCsvUpload}
                                    className="w-full text-xs text-text-muted file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border file:border-border file:text-xs file:font-semibold file:bg-bg-card file:text-text-primary hover:file:bg-bg-subtle cursor-pointer"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-text-muted">Default Batch Tag (Optional)</label>
                                <input
                                    type="text"
                                    placeholder="e.g. BATCH-2026-CSE-A"
                                    value={bulkBatchNumber}
                                    onChange={(e) => setBulkBatchNumber(e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl bg-bg-subtle border border-border text-xs text-text-primary focus:outline-none focus:border-primary"
                                />
                            </div>
                        </div>

                        {/* Parsed Rows Preview */}
                        {bulkParsedItems.length > 0 && !bulkResults && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="font-semibold text-text-primary">Ready to Import: {bulkParsedItems.length} Cards</span>
                                    <span className="text-text-muted">Previewing first 5 rows</span>
                                </div>
                                <div className="border border-border rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-bg-subtle text-[11px] font-semibold text-text-muted uppercase">
                                            <tr>
                                                <th className="py-2 px-3">Roll No</th>
                                                <th className="py-2 px-3">Card UID</th>
                                                <th className="py-2 px-3">Printed Serial</th>
                                                <th className="py-2 px-3">Batch</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-border">
                                            {bulkParsedItems.slice(0, 5).map((item, idx) => (
                                                <tr key={idx}>
                                                    <td className="py-2 px-3 font-semibold text-text-primary">{item.enrollmentNo}</td>
                                                    <td className="py-2 px-3 font-mono text-primary">{item.cardUid}</td>
                                                    <td className="py-2 px-3 text-text-muted">{item.printedCardNumber || '-'}</td>
                                                    <td className="py-2 px-3 text-text-muted">{item.batchNumber || bulkBatchNumber || '-'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Results Summary if completed */}
                        {bulkResults && (
                            <div className="p-4 rounded-xl bg-bg-subtle border border-border space-y-3">
                                <div className="flex items-center gap-4 text-xs font-semibold">
                                    <span className="text-success flex items-center gap-1">
                                        <CheckCircle2 size={16} /> {bulkResults.totalSuccess} Successfully Assigned
                                    </span>
                                    {bulkResults.totalFailed > 0 && (
                                        <span className="text-danger flex items-center gap-1">
                                            <XCircle size={16} /> {bulkResults.totalFailed} Failed
                                        </span>
                                    )}
                                </div>
                                {bulkResults.failed?.length > 0 && (
                                    <div className="max-h-36 overflow-y-auto border border-danger/30 rounded-xl p-2 bg-danger/5 text-[11px] space-y-1 text-danger">
                                        {bulkResults.failed.map((f: any, idx: number) => (
                                            <p key={idx}>Row #{f.index} ({f.enrollmentNo || f.cardUid}): {f.error}</p>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="flex gap-2 pt-2 border-t border-border">
                            <button
                                onClick={() => setShowBulkModal(false)}
                                className="flex-1 py-2 rounded-xl border border-border text-xs font-semibold text-text-secondary hover:bg-bg-subtle"
                            >
                                {bulkResults ? 'Done' : 'Cancel'}
                            </button>
                            {!bulkResults && (
                                <button
                                    disabled={bulkParsedItems.length === 0 || bulkAssignMutation.isPending}
                                    onClick={() => bulkAssignMutation.mutate({
                                        items: bulkParsedItems,
                                        batchNumber: bulkBatchNumber || undefined,
                                    })}
                                    className="flex-1 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-hover disabled:opacity-50"
                                >
                                    {bulkAssignMutation.isPending ? 'Processing Bulk Assignment...' : `Import ${bulkParsedItems.length} Cards`}
                                </button>
                            )}
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
