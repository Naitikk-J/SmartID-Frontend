import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../api/axios'
import {
    Activity, Search, Filter, Calendar, CheckCircle2, XCircle,
    Download, ChevronLeft, ChevronRight, Eye, Clock, Wifi, CreditCard
} from 'lucide-react'
import Badge from '../components/ui/Badge'
import toast from 'react-hot-toast'

export default function RfidTransactionsPage() {
    const [cardUid, setCardUid] = useState('')
    const [eventType, setEventType] = useState('')
    const [accessResult, setAccessResult] = useState('')
    const [startDate, setStartDate] = useState('')
    const [endDate, setEndDate] = useState('')
    const [page, setPage] = useState(1)
    const [selectedTxn, setSelectedTxn] = useState<any>(null)

    const { data: txnsData, isLoading } = useQuery({
        queryKey: ['rfid-transactions', cardUid, eventType, accessResult, startDate, endDate, page],
        queryFn: () => api.get('/rfid/transactions', {
            params: {
                cardUid: cardUid || undefined,
                eventType: eventType || undefined,
                accessResult: accessResult || undefined,
                startDate: startDate || undefined,
                endDate: endDate || undefined,
                page,
                limit: 20,
            },
        }).then(res => res.data),
    })

    const transactions = txnsData?.data || []
    const totalPages = txnsData?.totalPages || 1

    const exportCsv = () => {
        if (transactions.length === 0) {
            toast.error('No transactions to export')
            return
        }

        const headers = ['Transaction ID', 'Time', 'Card UID', 'Student Name', 'Roll No', 'Department', 'Event Type', 'Result', 'Denial Reason', 'Reader ID', 'Offline Sync']
        const rows = transactions.map((t: any) => [
            t.id,
            new Date(t.serverTimestamp).toISOString(),
            t.cardUid,
            t.user?.fullName || 'Unknown',
            t.user?.enrollmentNo || 'N/A',
            t.user?.department || 'N/A',
            t.eventType,
            t.accessResult,
            t.denialReason || '',
            t.reader?.readerId || '',
            t.isOfflineSync ? 'YES' : 'NO',
        ])

        const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e: any) => e.map((val: any) => `"${val}"`).join(','))].join('\n')
        const encodedUri = encodeURI(csvContent)
        const link = document.createElement('a')
        link.setAttribute('href', encodedUri)
        link.setAttribute('download', `rfid_transactions_${new Date().toISOString().slice(0, 10)}.csv`)
        document.body.appendChild(link)
        link.click()
        link.remove()
        toast.success('Exported transactions to CSV')
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-text-primary tracking-tight">RFID Transactions Log</h1>
                    <p className="text-xs text-text-muted">Complete audit trail of all contactless access, entry/exit and attendance events</p>
                </div>
                <button
                    onClick={exportCsv}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-bg-card border border-border text-text-primary hover:bg-bg-subtle shadow-xs transition-colors"
                >
                    <Download size={15} /> Export CSV
                </button>
            </div>

            {/* Filter Bar */}
            <div className="p-4 rounded-2xl bg-bg-card border border-border grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
                <div>
                    <label className="text-[10px] uppercase font-bold text-text-muted mb-1 block">Card UID</label>
                    <input
                        type="text"
                        value={cardUid}
                        onChange={(e) => { setCardUid(e.target.value.toUpperCase()); setPage(1) }}
                        placeholder="e.g. A1B2C3D4"
                        className="w-full px-3 py-1.5 font-mono uppercase rounded-xl bg-bg-subtle border border-border text-xs text-text-primary focus:outline-none focus:border-primary"
                    />
                </div>

                <div>
                    <label className="text-[10px] uppercase font-bold text-text-muted mb-1 block">Event Type</label>
                    <select
                        value={eventType}
                        onChange={(e) => { setEventType(e.target.value); setPage(1) }}
                        className="w-full px-3 py-1.5 rounded-xl bg-bg-subtle border border-border text-xs text-text-primary focus:outline-none focus:border-primary"
                    >
                        <option value="">All Types</option>
                        <option value="ENTRY">ENTRY</option>
                        <option value="EXIT">EXIT</option>
                        <option value="ATTENDANCE">ATTENDANCE</option>
                        <option value="EVENT_CHECK_IN">EVENT_CHECK_IN</option>
                        <option value="LIBRARY_CHECK_IN">LIBRARY_CHECK_IN</option>
                        <option value="GENERIC_TAP">GENERIC_TAP</option>
                    </select>
                </div>

                <div>
                    <label className="text-[10px] uppercase font-bold text-text-muted mb-1 block">Result</label>
                    <select
                        value={accessResult}
                        onChange={(e) => { setAccessResult(e.target.value); setPage(1) }}
                        className="w-full px-3 py-1.5 rounded-xl bg-bg-subtle border border-border text-xs text-text-primary focus:outline-none focus:border-primary"
                    >
                        <option value="">All Results</option>
                        <option value="GRANTED">GRANTED</option>
                        <option value="DENIED">DENIED</option>
                    </select>
                </div>

                <div>
                    <label className="text-[10px] uppercase font-bold text-text-muted mb-1 block">From Date</label>
                    <input
                        type="date"
                        value={startDate}
                        onChange={(e) => { setStartDate(e.target.value); setPage(1) }}
                        className="w-full px-3 py-1.5 rounded-xl bg-bg-subtle border border-border text-xs text-text-primary focus:outline-none focus:border-primary"
                    />
                </div>

                <div>
                    <label className="text-[10px] uppercase font-bold text-text-muted mb-1 block">To Date</label>
                    <input
                        type="date"
                        value={endDate}
                        onChange={(e) => { setEndDate(e.target.value); setPage(1) }}
                        className="w-full px-3 py-1.5 rounded-xl bg-bg-subtle border border-border text-xs text-text-primary focus:outline-none focus:border-primary"
                    />
                </div>
            </div>

            {/* Transactions Table */}
            <div className="rounded-2xl bg-bg-card border border-border overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-border bg-bg-subtle/50 text-[11px] font-semibold text-text-muted uppercase tracking-wider">
                                <th className="py-3 px-4">Time</th>
                                <th className="py-3 px-4">Student</th>
                                <th className="py-3 px-4">Card UID</th>
                                <th className="py-3 px-4">Reader / Zone</th>
                                <th className="py-3 px-4">Event Type</th>
                                <th className="py-3 px-4">Result</th>
                                <th className="py-3 px-4 text-right">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50 text-xs">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={7} className="py-12 text-center text-text-muted">Loading transactions...</td>
                                </tr>
                            ) : transactions.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-12 text-center text-text-muted">No transactions found matching criteria.</td>
                                </tr>
                            ) : (
                                transactions.map((t: any) => (
                                    <tr key={t.id} className="hover:bg-bg-subtle/30 transition-colors">
                                        <td className="py-3.5 px-4 text-text-muted whitespace-nowrap">
                                            <p className="font-semibold text-text-primary">{new Date(t.serverTimestamp).toLocaleTimeString()}</p>
                                            <p className="text-[10px]">{new Date(t.serverTimestamp).toLocaleDateString()}</p>
                                        </td>
                                        <td className="py-3.5 px-4">
                                            <p className="font-semibold text-text-primary">{t.user?.fullName || 'Unknown Student'}</p>
                                            <p className="text-[11px] text-text-muted">{t.user?.enrollmentNo || '-'}</p>
                                        </td>
                                        <td className="py-3.5 px-4 font-mono font-bold text-primary">
                                            {t.cardUid}
                                        </td>
                                        <td className="py-3.5 px-4">
                                            <p className="font-medium text-text-primary">{t.reader?.deviceName || t.reader?.readerId || 'Reader'}</p>
                                            <p className="text-[10px] text-text-muted">{t.reader?.zone || 'NO ZONE'}</p>
                                        </td>
                                        <td className="py-3.5 px-4">
                                            <span className="font-semibold text-text-secondary">{t.eventType}</span>
                                            {t.isOfflineSync && (
                                                <span className="ml-1.5 px-1.5 py-0.5 rounded bg-warning/10 text-warning text-[9px] font-bold">
                                                    OFFLINE SYNC
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-3.5 px-4">
                                            <div className="flex items-center gap-1.5">
                                                {t.accessResult === 'GRANTED' ? (
                                                    <CheckCircle2 size={14} className="text-success" />
                                                ) : (
                                                    <XCircle size={14} className="text-danger" />
                                                )}
                                                <span className={t.accessResult === 'GRANTED' ? 'text-success font-bold' : 'text-danger font-bold'}>
                                                    {t.accessResult}
                                                </span>
                                            </div>
                                            {t.denialReason && (
                                                <p className="text-[10px] text-danger font-mono mt-0.5">{t.denialReason}</p>
                                            )}
                                        </td>
                                        <td className="py-3.5 px-4 text-right">
                                            <button
                                                onClick={() => setSelectedTxn(t)}
                                                className="p-1.5 rounded-lg text-text-muted hover:text-primary hover:bg-primary/10 transition-colors"
                                                title="View details"
                                            >
                                                <Eye size={15} />
                                            </button>
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

            {/* Detail Modal */}
            {selectedTxn && (
                <div className="fixed inset-0 bg-bg-overlay backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-bg-card border border-border rounded-2xl p-6 w-full max-w-md space-y-4 shadow-xl">
                        <div className="flex items-center justify-between">
                            <h3 className="text-base font-bold text-text-primary">Transaction Audit Record</h3>
                            <button onClick={() => setSelectedTxn(null)} className="text-text-muted hover:text-text-primary">✕</button>
                        </div>

                        <div className="p-4 rounded-xl bg-bg-subtle border border-border space-y-2 text-xs">
                            <div className="flex justify-between">
                                <span className="text-text-muted">Transaction ID:</span>
                                <span className="font-mono text-text-primary font-bold">{selectedTxn.id}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-text-muted">Card UID:</span>
                                <span className="font-mono text-primary font-bold">{selectedTxn.cardUid}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-text-muted">Student:</span>
                                <span className="font-bold text-text-primary">{selectedTxn.user?.fullName || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-text-muted">Enrollment No:</span>
                                <span className="text-text-primary">{selectedTxn.user?.enrollmentNo || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-text-muted">Event Type:</span>
                                <span className="font-semibold text-text-primary">{selectedTxn.eventType}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-text-muted">Access Result:</span>
                                <span className={selectedTxn.accessResult === 'GRANTED' ? 'text-success font-bold' : 'text-danger font-bold'}>
                                    {selectedTxn.accessResult}
                                </span>
                            </div>
                            {selectedTxn.denialReason && (
                                <div className="flex justify-between">
                                    <span className="text-text-muted">Denial Reason:</span>
                                    <span className="font-mono text-danger">{selectedTxn.denialReason}</span>
                                </div>
                            )}
                            <div className="flex justify-between">
                                <span className="text-text-muted">Reader:</span>
                                <span className="text-text-primary">{selectedTxn.reader?.deviceName || selectedTxn.reader?.readerId}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-text-muted">Zone:</span>
                                <span className="text-text-primary">{selectedTxn.reader?.zone || 'N/A'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-text-muted">Processing Time:</span>
                                <span className="text-text-primary">{selectedTxn.processingMs ? `${selectedTxn.processingMs} ms` : 'N/A'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-text-muted">Offline Sync:</span>
                                <span>{selectedTxn.isOfflineSync ? 'Yes (Queued on ESP32)' : 'No (Live)'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-text-muted">Server Timestamp:</span>
                                <span className="text-text-muted">{new Date(selectedTxn.serverTimestamp).toLocaleString()}</span>
                            </div>
                        </div>

                        <button
                            onClick={() => setSelectedTxn(null)}
                            className="w-full py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-hover"
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}
