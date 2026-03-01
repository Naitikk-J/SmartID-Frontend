import { useState } from 'react'
import { useSocketStore, type ScanEvent } from '../store/socketStore'
import Badge from '../components/ui/Badge'
import { Radio, Calendar, ChevronLeft, ChevronRight, History, Search, Download } from 'lucide-react'
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

    const displayEvents = (isToday && page === 1) ? (realTimeFeed.length > 0 ? realTimeFeed : (historyData?.events || [])) : (historyData?.events || [])
    const totalPages = historyData?.pages || 1

    return (
        <div className="space-y-8 animate-fade-in-up">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-2xl ${isToday ? (connected ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger') : 'bg-primary/10 text-primary shadow-xl shadow-primary/5'}`}>
                        {isToday ? (
                            <Radio size={28} className={connected ? 'animate-pulse' : ''} />
                        ) : (
                            <History size={28} />
                        )}
                    </div>
                    <div>
                        <h2 className="text-3xl font-black tracking-tight text-text-primary">
                            {isToday ? 'Live Scan Feed' : 'Scan History'}
                        </h2>
                        <p className="text-text-secondary font-medium text-sm flex items-center gap-2">
                            {isToday ? (
                                <>
                                    <span className={`w-2 h-2 rounded-full ${connected ? 'bg-success animate-pulse' : 'bg-danger'}`} />
                                    {connected ? 'Streaming live data' : 'Connection lost'}
                                </>
                            ) : (
                                `Viewing records for ${new Date(selectedDate).toLocaleDateString(undefined, { dateStyle: 'long' })}`
                            )}
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-3 bg-white/5 border border-white/10 p-2 pl-4 rounded-2xl focus-within:border-accent/50 transition-all">
                        <Calendar size={18} className="text-text-secondary" />
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => {
                                setSelectedDate(e.target.value)
                                setPage(1)
                            }}
                            className="bg-transparent text-sm font-bold text-text-primary focus:outline-none w-32"
                        />
                    </div>
                    <button className="p-3 bg-white/5 hover:bg-white/10 text-text-secondary hover:text-text-primary border border-white/10 rounded-2xl transition-all">
                        <Download size={20} />
                    </button>
                </div>
            </header>

            <div className="glass-card overflow-hidden">
                <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/5 bg-white/[0.02]">
                                <th className="text-[10px] font-black uppercase tracking-widest text-text-secondary px-6 py-4">Time</th>
                                <th className="text-[10px] font-black uppercase tracking-widest text-text-secondary px-6 py-4">Student</th>
                                <th className="text-[10px] font-black uppercase tracking-widest text-text-secondary px-6 py-4">Details</th>
                                <th className="text-[10px] font-black uppercase tracking-widest text-text-secondary px-6 py-4">Type / Gate</th>
                                <th className="text-[10px] font-black uppercase tracking-widest text-text-secondary px-6 py-4 text-center">Direction</th>
                                <th className="text-[10px] font-black uppercase tracking-widest text-text-secondary px-6 py-4 text-right">Verification</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-24 text-center">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-12 h-12 border-4 border-accent/20 border-t-accent rounded-full animate-spin" />
                                            <p className="text-text-secondary font-bold text-sm">Syncing with database...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : displayEvents.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-24 text-center">
                                        <div className="flex flex-col items-center gap-3 text-text-secondary">
                                            <Search size={48} className="opacity-20" />
                                            <p className="font-bold">No activity recorded for this period</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                displayEvents.map((event: ScanEvent, i: number) => (
                                    <tr key={event.id || i} className="group hover:bg-white/[0.03] transition-colors">
                                        <td className="px-6 py-4">
                                            <span className="text-xs font-black text-text-primary tracking-tighter">
                                                {new Date(event.time).toLocaleTimeString([], { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-sm font-black text-text-primary group-hover:text-accent transition-colors">
                                                {event.studentName}
                                            </p>
                                            <p className="text-[10px] font-bold text-text-secondary uppercase">
                                                {event.enrollmentNo}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-[10px] font-black text-text-secondary uppercase tracking-wider">
                                                {event.department}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4">
                                            <p className="text-[10px] font-black text-text-primary uppercase tracking-tighter">
                                                {event.scanType?.replace(/_/g, ' ')}
                                            </p>
                                            <p className="text-[9px] font-bold text-text-secondary uppercase">
                                                Gate {event.gateId?.toString().slice(-1) || '1'}
                                            </p>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {event.direction ? (
                                                <span className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-black tracking-widest ${event.direction === 'ENTRY' ? 'bg-success/10 text-success border border-success/20' : 'bg-primary/10 text-primary border border-primary/20'
                                                    }`}>
                                                    {event.direction}
                                                </span>
                                            ) : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <Badge result={event.result} badge={event.badge} size="sm" />
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Modern Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-between px-6 py-4 bg-white/[0.02] border-t border-white/5">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Page</span>
                            <span className="px-2 py-1 bg-white/5 rounded-lg text-xs font-black text-text-primary">{page}</span>
                            <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">of {totalPages}</span>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="p-2 border border-white/5 rounded-xl hover:bg-white/10 disabled:opacity-20 disabled:hover:bg-transparent transition-all"
                            >
                                <ChevronLeft size={18} />
                            </button>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="p-2 border border-white/5 rounded-xl hover:bg-white/10 disabled:opacity-20 disabled:hover:bg-transparent transition-all"
                            >
                                <ChevronRight size={18} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
