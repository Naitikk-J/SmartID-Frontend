import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from '../api/axios'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { ScrollText } from 'lucide-react'

export default function AuditLogPage() {
    const [page, setPage] = useState(1)

    const { data, isLoading } = useQuery({
        queryKey: ['audit-log', page],
        queryFn: () => api.get('/admin/audit-log', { params: { page, limit: 50 } }).then((r) => r.data.data),
    })

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold flex items-center gap-2"><ScrollText size={28} /> Audit Log</h2>

            {isLoading ? <LoadingSpinner /> : (
                <div className="bg-bg-card rounded-xl border border-border overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-border">
                                <th className="text-left text-xs text-text-secondary px-4 py-3">Time</th>
                                <th className="text-left text-xs text-text-secondary px-4 py-3">Actor</th>
                                <th className="text-left text-xs text-text-secondary px-4 py-3">Action</th>
                                <th className="text-left text-xs text-text-secondary px-4 py-3">Entity</th>
                                <th className="text-left text-xs text-text-secondary px-4 py-3">IP</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data?.logs?.length === 0 ? (
                                <tr><td colSpan={5} className="text-center text-text-secondary py-8">No audit logs</td></tr>
                            ) : data?.logs?.map((log: any) => (
                                <tr key={log.id} className="border-b border-border/50 hover:bg-bg-hover">
                                    <td className="px-4 py-3 text-sm">{new Date(log.loggedAt).toLocaleString()}</td>
                                    <td className="px-4 py-3 text-sm font-medium">{log.actor?.name}</td>
                                    <td className="px-4 py-3"><span className="px-2 py-0.5 bg-accent/20 text-accent rounded-full text-xs">{log.action}</span></td>
                                    <td className="px-4 py-3 text-sm text-text-secondary">{log.entity} #{log.entityId}</td>
                                    <td className="px-4 py-3 text-sm text-text-secondary font-mono">{log.ipAddress || '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {data && (
                        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                            <span className="text-sm text-text-secondary">Page {data.page} of {data.pages}</span>
                            <div className="flex gap-2">
                                <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1 bg-bg-dark rounded text-sm disabled:opacity-50">Prev</button>
                                <button disabled={page >= data.pages} onClick={() => setPage(page + 1)} className="px-3 py-1 bg-bg-dark rounded text-sm disabled:opacity-50">Next</button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
