import { useState } from 'react'
import { useSocketStore, type ScanEvent } from '../store/socketStore'
import Badge from '../components/ui/Badge'
import { Radio, Calendar, ChevronLeft, ChevronRight, History } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import api from '../api/axios'

export default function LiveFeedPage() {
    const { liveFeed: realTimeFeed, connected } = useSocketStore()
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
    const [page, setPage] = useState(1)

    const isToday = selectedDate === new Date().toISOString().split('T')[0]

    const { data: historyData, isLoading } = useQuery({
        queryKey: ['scan-history', selectedDate, page],
        queryFn: () => api.get('/scan/recent', {
            params: { date: selectedDate, page, limit: 50 }
        }).then(r => r.data.data),
    })

    // If it's today and first page, use live feed from store + initial fetch
    // But for simplicity in this view, let's just use the polled/live data for today 
    // and the fetched data for history.
    const displayEvents = (isToday && page === 1) ? (realTimeFeed.length > 0 ? realTimeFeed : (historyData?.events || [])) : (historyData?.events || [])
    const totalPages = historyData?.pages || 1

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    {isToday ? (
                        <Radio size={24} className={connected ? 'text-success animate-pulse-badge' : 'text-danger'} />
                    ) : (
                        <History size={24} className="text-accent" />
                    )}
                    <h2 className="text-2xl font-bold">{isToday ? 'Live Scan Feed' : 'Scan History'}</h2>
                    {isToday && (
                        <span className={`text-xs px-2 py-1 rounded-full ${connected ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}`}>
                            {connected ? 'Connected' : 'Disconnected'}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2 bg-bg-card p-2 rounded-lg border border-border">
                    <Calendar size={18} className="text-text-secondary" />
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => {
                            setSelectedDate(e.target.value)
                            setPage(1)
                        }}
                        className="bg-transparent text-sm focus:outline-none"
                    />
                </div>
            </div>

            <div className="bg-bg-card rounded-xl border border-border overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-border bg-bg-dark/50">
                                <th className="text-left text-xs text-text-secondary font-medium px-4 py-3">Time</th>
                                <th className="text-left text-xs text-text-secondary font-medium px-4 py-3">Student</th>
                                <th className="text-left text-xs text-text-secondary font-medium px-4 py-3">Enrollment</th>
                                <th className="text-left text-xs text-text-secondary font-medium px-4 py-3">Department</th>
                                <th className="text-left text-xs text-text-secondary font-medium px-4 py-3">Scan Type</th>
                                <th className="text-left text-xs text-text-secondary font-medium px-4 py-3">Direction</th>
                                <th className="text-left text-xs text-text-secondary font-medium px-4 py-3">Result</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={7} className="text-center text-text-secondary py-16">
                                        Loading records...
                                    </td>
                                </tr>
                            ) : displayEvents.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="text-center text-text-secondary py-16">
                                        No scan events found for this date.
                                    </td>
                                </tr>
                            ) : (
                                displayEvents.map((event: ScanEvent, i: number) => (
                                    <tr key={event.id || i} className="hover:bg-bg-hover transition-colors animate-slide-in">
                                        <td className="px-4 py-3 text-sm">{new Date(event.time).toLocaleTimeString()}</td>
                                        <td className="px-4 py-3 text-sm font-medium">{event.studentName}</td>
                                        <td className="px-4 py-3 text-sm text-text-secondary">{event.enrollmentNo}</td>
                                        <td className="px-4 py-3 text-sm text-text-secondary">{event.department}</td>
                                        <td className="px-4 py-3 text-sm capitalize">{event.scanType?.replace(/_/g, ' ').toLowerCase()}</td>
                                        <td className="px-4 py-3 text-sm">
                                            {event.direction ? (
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${event.direction === 'ENTRY' ? 'bg-success/20 text-success' : 'bg-accent/20 text-accent'
                                                    }`}>
                                                    {event.direction}
                                                </span>
                                            ) : '-'}
                                        </td>
                                        <td className="px-4 py-3"><Badge result={event.result} badge={event.badge} /></td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-4 py-3 bg-bg-dark/30 border-t border-border">
                        <p className="text-xs text-text-secondary">
                            Page {page} of {totalPages}
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="p-1 rounded hover:bg-bg-hover disabled:opacity-30"
                            >
                                <ChevronLeft size={20} />
                            </button>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="p-1 rounded hover:bg-bg-hover disabled:opacity-30"
                            >
                                <ChevronRight size={20} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
