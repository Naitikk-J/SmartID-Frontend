import { useQuery } from '@tanstack/react-query'
import api from '../api/axios'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { BookOpen } from 'lucide-react'

export default function LibraryPage() {
    const { data: overdue, isLoading: loadingOverdue } = useQuery({
        queryKey: ['library-overdue'],
        queryFn: () => api.get('/library/overdue').then((r) => r.data.data.overdue),
    })

    const { data: stats } = useQuery({
        queryKey: ['library-stats'],
        queryFn: () => api.get('/reports/library-stats').then((r) => r.data.data),
    })

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold flex items-center gap-2"><BookOpen size={28} /> Library</h2>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-bg-card rounded-xl border border-border p-5">
                    <p className="text-sm text-text-secondary">Total Books</p>
                    <p className="text-3xl font-bold mt-1">{stats?.totalBooks ?? '—'}</p>
                </div>
                <div className="bg-bg-card rounded-xl border border-border p-5">
                    <p className="text-sm text-text-secondary">Currently Lent Out</p>
                    <p className="text-3xl font-bold mt-1 text-warning">{stats?.booksOut ?? '—'}</p>
                </div>
                <div className="bg-bg-card rounded-xl border border-border p-5">
                    <p className="text-sm text-text-secondary">Overdue</p>
                    <p className="text-3xl font-bold mt-1 text-danger">{stats?.overdueCount ?? '—'}</p>
                </div>
            </div>

            {/* Overdue list */}
            <div className="bg-bg-card rounded-xl border border-border p-6">
                <h3 className="text-lg font-semibold mb-4">Overdue Books</h3>
                {loadingOverdue ? <LoadingSpinner /> : (
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-border">
                                <th className="text-left text-xs text-text-secondary px-4 py-3">Student</th>
                                <th className="text-left text-xs text-text-secondary px-4 py-3">Book</th>
                                <th className="text-left text-xs text-text-secondary px-4 py-3">Due Date</th>
                                <th className="text-left text-xs text-text-secondary px-4 py-3">Days Overdue</th>
                            </tr>
                        </thead>
                        <tbody>
                            {overdue?.length === 0 ? (
                                <tr><td colSpan={4} className="text-center text-text-secondary py-8">No overdue books</td></tr>
                            ) : overdue?.map((t: any) => {
                                const daysOverdue = Math.ceil((Date.now() - new Date(t.dueAt).getTime()) / (1000 * 60 * 60 * 24))
                                return (
                                    <tr key={t.id} className="border-b border-border/50 hover:bg-bg-hover">
                                        <td className="px-4 py-3"><p className="text-sm font-medium">{t.student?.fullName}</p><p className="text-xs text-text-secondary">{t.student?.enrollmentNo}</p></td>
                                        <td className="px-4 py-3 text-sm">{t.book?.title}</td>
                                        <td className="px-4 py-3 text-sm text-text-secondary">{new Date(t.dueAt).toLocaleDateString()}</td>
                                        <td className="px-4 py-3"><span className="text-sm font-bold text-danger">{daysOverdue} days</span></td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    )
}
