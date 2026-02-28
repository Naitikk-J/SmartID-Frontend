import { useSocketStore } from '../store/socketStore'
import Badge from '../components/ui/Badge'
import { Radio } from 'lucide-react'

export default function LiveFeedPage() {
    const { liveFeed, connected } = useSocketStore()

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-3">
                <Radio size={24} className={connected ? 'text-success animate-pulse-badge' : 'text-danger'} />
                <h2 className="text-2xl font-bold">Live Scan Feed</h2>
                <span className={`text-xs px-2 py-1 rounded-full ${connected ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}`}>
                    {connected ? 'Connected' : 'Disconnected'}
                </span>
            </div>

            <div className="bg-bg-card rounded-xl border border-border overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-border">
                            <th className="text-left text-xs text-text-secondary font-medium px-4 py-3">Time</th>
                            <th className="text-left text-xs text-text-secondary font-medium px-4 py-3">Student</th>
                            <th className="text-left text-xs text-text-secondary font-medium px-4 py-3">Enrollment</th>
                            <th className="text-left text-xs text-text-secondary font-medium px-4 py-3">Department</th>
                            <th className="text-left text-xs text-text-secondary font-medium px-4 py-3">Scan Type</th>
                            <th className="text-left text-xs text-text-secondary font-medium px-4 py-3">Result</th>
                        </tr>
                    </thead>
                    <tbody>
                        {liveFeed.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="text-center text-text-secondary py-16">
                                    Waiting for scan events...
                                </td>
                            </tr>
                        ) : (
                            liveFeed.map((event, i) => (
                                <tr key={event.id || i} className="border-b border-border/50 hover:bg-bg-hover transition-colors animate-slide-in">
                                    <td className="px-4 py-3 text-sm">{new Date(event.time).toLocaleTimeString()}</td>
                                    <td className="px-4 py-3 text-sm font-medium">{event.studentName}</td>
                                    <td className="px-4 py-3 text-sm text-text-secondary">{event.enrollmentNo}</td>
                                    <td className="px-4 py-3 text-sm text-text-secondary">{event.department}</td>
                                    <td className="px-4 py-3 text-sm">{event.scanType?.replace(/_/g, ' ')}</td>
                                    <td className="px-4 py-3"><Badge result={event.result} badge={event.badge} /></td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
