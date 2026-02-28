import { useQuery } from '@tanstack/react-query'
import api from '../api/axios'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import StatCard from '../components/ui/StatCard'
import { BarChart3, Users, DoorOpen } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

export default function ReportsPage() {
    const { data: occupancy, isLoading } = useQuery({
        queryKey: ['reports-occupancy'],
        queryFn: () => api.get('/reports/campus-occupancy').then((r) => r.data.data),
    })

    const { data: gateActivity } = useQuery({
        queryKey: ['reports-gates'],
        queryFn: () => api.get('/reports/gate-activity').then((r) => r.data.data.activity),
    })

    if (isLoading) return <LoadingSpinner />

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold flex items-center gap-2"><BarChart3 size={28} /> Reports</h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard title="Students on Campus" value={occupancy?.studentsOnCampus ?? 0} icon={Users} color="text-success" />
                <StatCard title="Entries Today" value={occupancy?.entries ?? 0} icon={DoorOpen} color="text-accent" />
                <StatCard title="Exits Today" value={occupancy?.exits ?? 0} icon={DoorOpen} color="text-warning" />
            </div>

            {/* Hourly traffic chart */}
            <div className="bg-bg-card rounded-xl border border-border p-6">
                <h3 className="text-lg font-semibold mb-4">Hourly Campus Traffic</h3>
                {occupancy?.hourly?.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={occupancy.hourly}>
                            <XAxis dataKey="hour" stroke="#94A3B8" fontSize={12} tickFormatter={(h: number) => `${h}:00`} />
                            <YAxis stroke="#94A3B8" fontSize={12} />
                            <Tooltip contentStyle={{ background: '#1E293B', border: '1px solid #334155', borderRadius: '8px' }} />
                            <Line type="monotone" dataKey="entries" stroke="#16A34A" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="exits" stroke="#DC2626" strokeWidth={2} dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                ) : (
                    <p className="text-text-secondary text-center py-8">No data available</p>
                )}
            </div>

            {/* Gate Activity */}
            <div className="bg-bg-card rounded-xl border border-border p-6">
                <h3 className="text-lg font-semibold mb-4">Gate Activity Today</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {gateActivity?.map((gate: any) => (
                        <div key={gate.gateId} className="bg-bg-dark p-4 rounded-lg">
                            <h4 className="font-medium">{gate.gateName}</h4>
                            <div className="flex gap-4 mt-2 text-sm">
                                <span className="text-success">{gate.verified} ✓</span>
                                <span className="text-danger">{gate.denied} ✗</span>
                                <span className="text-text-secondary">{gate.totalScans} total</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
