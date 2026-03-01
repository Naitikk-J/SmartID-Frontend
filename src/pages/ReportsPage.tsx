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
                            <XAxis
                                dataKey="hour"
                                stroke="#94A3B8"
                                fontSize={10}
                                fontWeight={700}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(h: number) => {
                                    const period = h < 12 ? 'AM' : 'PM';
                                    const displayHour = h % 12 === 0 ? 12 : h % 12;
                                    return `${displayHour} ${period}`;
                                }}
                            />
                            <YAxis stroke="#94A3B8" fontSize={10} fontWeight={700} axisLine={false} tickLine={false} />
                            <Tooltip
                                contentStyle={{
                                    background: '#0F172A',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: '12px',
                                    padding: '8px'
                                }}
                                labelStyle={{ color: '#F8FAFC', fontWeight: '900', marginBottom: '4px' }}
                                labelFormatter={(label: any) => {
                                    const h = Number(label);
                                    const period = h < 12 ? 'AM' : 'PM';
                                    const displayHour = h % 12 === 0 ? 12 : h % 12;
                                    return `Time: ${displayHour} ${period}`;
                                }}
                            />
                            <Line type="monotone" dataKey="entries" stroke="#10B981" strokeWidth={3} dot={false} />
                            <Line type="monotone" dataKey="exits" stroke="#F43F5E" strokeWidth={3} dot={false} />
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
