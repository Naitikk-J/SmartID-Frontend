import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../api/axios'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import toast from 'react-hot-toast'
import { DoorOpen } from 'lucide-react'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const TYPES = ['DAY_SCHOLAR', 'HOSTELLER_BOYS', 'HOSTELLER_GIRLS']

export default function ExitRulesPage() {
    const qc = useQueryClient()
    const { data, isLoading } = useQuery({
        queryKey: ['exit-rules'],
        queryFn: () => api.get('/gates/exit-rules').then((r) => r.data.data.rules),
    })

    const mutation = useMutation({
        mutationFn: (body: { studentType: string; dayOfWeek: number; maxExits: number }) =>
            api.patch('/gates/exit-rules', body),
        onSuccess: () => { toast.success('Rule updated'); qc.invalidateQueries({ queryKey: ['exit-rules'] }) },
        onError: () => toast.error('Failed to update'),
    })

    if (isLoading) return <LoadingSpinner />

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold flex items-center gap-2"><DoorOpen size={28} /> Exit Rules</h2>
            <p className="text-sm text-text-secondary">-1 = unlimited, 0 = no exits allowed</p>

            <div className="bg-bg-card rounded-xl border border-border overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-border">
                            <th className="text-left text-xs text-text-secondary px-4 py-3">Student Type</th>
                            {DAYS.map((d) => <th key={d} className="text-center text-xs text-text-secondary px-4 py-3">{d}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        {TYPES.map((type) => (
                            <tr key={type} className="border-b border-border/50">
                                <td className="px-4 py-3 text-sm font-medium">{type.replace(/_/g, ' ')}</td>
                                {DAYS.map((_, i) => {
                                    const day = i + 1
                                    const maxExits = data?.[type]?.[day] ?? ''
                                    return (
                                        <td key={day} className="px-4 py-3 text-center">
                                            <input
                                                type="number"
                                                defaultValue={maxExits}
                                                min={-1}
                                                className="w-16 bg-bg-dark border border-border rounded px-2 py-1 text-sm text-center focus:border-accent focus:outline-none"
                                                onBlur={(e) => {
                                                    const val = parseInt(e.target.value)
                                                    if (!isNaN(val) && val !== maxExits) {
                                                        mutation.mutate({ studentType: type, dayOfWeek: day, maxExits: val })
                                                    }
                                                }}
                                            />
                                        </td>
                                    )
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
