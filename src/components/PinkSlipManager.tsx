import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../api/axios'
import { Check, X, Clock, User, Calendar, MessageSquare } from 'lucide-react'
import { useState } from 'react'

export default function PinkSlipManager() {
    const queryClient = useQueryClient()
    const [remarks, setRemarks] = useState<Record<string, string>>({})

    const { data, isLoading } = useQuery({
        queryKey: ['pending-pink-slips'],
        queryFn: async () => {
            const res = await api.get('/pink-slips', { params: { status: 'PENDING' } })
            // Be resilient to different response structures
            const responseData = res.data.data
            if (Array.isArray(responseData)) return responseData
            if (responseData && Array.isArray(responseData.pinkSlips)) return responseData.pinkSlips
            return []
        }
    })

    const mutation = useMutation({
        mutationFn: async ({ id, status, remarks }: { id: string, status: string, remarks?: string }) => {
            await api.patch(`/pink-slips/${id}`, { status, remarks })
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pending-pink-slips'] })
        }
    })

    if (isLoading) return (
        <section className="rounded-2xl border border-primary/20 bg-primary/5 p-6 animate-pulse">
            <div className="h-24 bg-white/5 rounded-xl flex items-center justify-center">
                <p className="text-text-secondary text-sm">Loading pending requests...</p>
            </div>
        </section>
    )

    if (!data || data.length === 0) {
        return (
            <section className="rounded-2xl border border-primary/20 bg-primary/5 p-6">
                <div className="flex items-center gap-3 mb-6 opacity-50">
                    <div className="p-2 bg-primary/20 rounded-xl text-primary">
                        <Clock size={20} />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-text-primary leading-tight">Pending Pink Slips</h3>
                        <p className="text-xs text-text-secondary">No leave requests awaiting approval</p>
                    </div>
                </div>
                <div className="h-32 border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center text-text-secondary gap-2 grayscale brightness-75">
                    <MessageSquare size={32} className="opacity-20" />
                    <p className="text-xs font-bold uppercase tracking-widest opacity-40">Clean Slate</p>
                </div>
            </section>
        )
    }

    return (
        <section className="rounded-2xl border border-primary/20 bg-primary/5 p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/20 rounded-xl text-primary">
                        <Clock size={20} />
                    </div>
                    <div>
                        <h3 className="text-xl font-black text-text-primary leading-tight">Pending Pink Slips</h3>
                        <p className="text-xs text-text-secondary">Student leave requests awaiting approval</p>
                    </div>
                </div>
                <div className="px-3 py-1 bg-primary text-white text-xs font-black rounded-full">
                    {data.length} NEW
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {data.map((slip: any) => (
                    <div key={slip.id} className="bg-bg-card border border-white/10 rounded-2xl p-5 shadow-sm hover:shadow-lg transition-all border-l-4 border-l-primary">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <div className="flex items-center gap-2 text-text-primary font-bold text-base">
                                    <User size={16} className="text-accent" />
                                    {slip.student?.fullName}
                                </div>
                                <div className="text-[10px] text-text-secondary mt-0.5 font-bold uppercase tracking-wider">
                                    {slip.student?.enrollmentNo} • {slip.student?.studentType.split('_').join(' ')}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3 text-xs text-text-secondary mb-5">
                            <div className="flex items-center gap-3 bg-white/5 p-2 rounded-lg">
                                <Calendar size={14} className="text-primary" />
                                <div className="font-bold">
                                    {new Date(slip.fromDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} — {new Date(slip.toDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                                </div>
                            </div>
                            <div className="flex items-start gap-3 bg-white/5 p-2 rounded-lg min-h-[50px]">
                                <MessageSquare size={14} className="mt-0.5 text-accent" />
                                <span className="italic leading-relaxed text-text-primary/80">"{slip.reason}"</span>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <input 
                                type="text"
                                placeholder="Add approval remarks..."
                                value={remarks[slip.id] || ''}
                                onChange={(e) => setRemarks(prev => ({ ...prev, [slip.id]: e.target.value }))}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-text-primary focus:outline-none focus:border-primary/50 transition-colors"
                            />
                            
                            <div className="grid grid-cols-2 gap-3 pt-1">
                                <button
                                    onClick={() => mutation.mutate({ id: slip.id, status: 'REJECTED', remarks: remarks[slip.id] })}
                                    disabled={mutation.isPending}
                                    className="flex items-center justify-center gap-2 py-3 rounded-xl bg-error/10 text-error text-[10px] font-black uppercase tracking-widest hover:bg-error/20 active:scale-95 transition-all"
                                >
                                    <X size={14} /> Deny
                                </button>
                                <button
                                    onClick={() => mutation.mutate({ id: slip.id, status: 'APPROVED', remarks: remarks[slip.id] })}
                                    disabled={mutation.isPending}
                                    className="flex items-center justify-center gap-2 py-3 rounded-xl bg-success/10 text-success text-[10px] font-black uppercase tracking-widest hover:bg-success/20 active:scale-95 transition-all border border-success/20"
                                >
                                    <Check size={14} /> Approve
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    )
}
