import { useQuery } from '@tanstack/react-query'
import api from '../api/axios'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { ClipboardCheck } from 'lucide-react'

export default function AttendancePage() {
    const { data: defaulters, isLoading } = useQuery({
        queryKey: ['defaulters'],
        queryFn: () => api.get('/attendance/defaulters', { params: { threshold: 75 } }).then((r) => r.data.data.defaulters),
    })

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold flex items-center gap-2"><ClipboardCheck size={28} /> Attendance</h2>
            <div className="bg-bg-card rounded-xl border border-border p-6">
                <h3 className="text-lg font-semibold mb-4">Defaulters (&lt; 75%)</h3>
                {isLoading ? <LoadingSpinner /> : (
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-border">
                                <th className="text-left text-xs text-text-secondary px-4 py-3">Student</th>
                                <th className="text-left text-xs text-text-secondary px-4 py-3">Subject</th>
                                <th className="text-left text-xs text-text-secondary px-4 py-3">Present/Total</th>
                                <th className="text-left text-xs text-text-secondary px-4 py-3">%</th>
                            </tr>
                        </thead>
                        <tbody>
                            {defaulters?.length === 0 ? (
                                <tr><td colSpan={4} className="text-center text-text-secondary py-8">No defaulters found</td></tr>
                            ) : defaulters?.map((d: any, i: number) => (
                                <tr key={i} className="border-b border-border/50 hover:bg-bg-hover">
                                    <td className="px-4 py-3"><p className="text-sm font-medium">{d.student?.fullName}</p><p className="text-xs text-text-secondary">{d.student?.enrollmentNo}</p></td>
                                    <td className="px-4 py-3 text-sm">{d.subjectCode} — {d.subjectName}</td>
                                    <td className="px-4 py-3 text-sm">{d.present}/{d.total}</td>
                                    <td className="px-4 py-3"><span className={`text-sm font-bold ${d.percentage < 50 ? 'text-danger' : 'text-warning'}`}>{d.percentage}%</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    )
}
