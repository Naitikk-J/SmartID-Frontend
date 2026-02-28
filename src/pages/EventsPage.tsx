import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import api from '../api/axios'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import Modal from '../components/ui/Modal'
import toast from 'react-hot-toast'
import { Calendar, Plus } from 'lucide-react'

export default function EventsPage() {
    const [showCreate, setShowCreate] = useState(false)
    const qc = useQueryClient()

    const { data, isLoading } = useQuery({
        queryKey: ['events'],
        queryFn: () => api.get('/events').then((r) => r.data.data.events),
    })

    const toggleMutation = useMutation({
        mutationFn: (id: number) => api.patch(`/events/${id}/toggle`),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['events'] }); toast.success('Event toggled') },
    })

    if (isLoading) return <LoadingSpinner />

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold flex items-center gap-2"><Calendar size={28} /> Campus Events</h2>
                <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-accent px-4 py-2 rounded-lg text-sm font-medium hover:bg-accent/90">
                    <Plus size={16} /> New Event
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data?.map((event: any) => (
                    <div key={event.id} className="bg-bg-card rounded-xl border border-border p-5 hover:border-accent/30 transition-colors">
                        <div className="flex items-start justify-between">
                            <div>
                                <h3 className="font-semibold text-lg">{event.name}</h3>
                                <p className="text-sm text-text-secondary mt-1">{event.description || 'No description'}</p>
                            </div>
                            <span className={`px-2 py-0.5 rounded-full text-xs ${event.isActive ? 'bg-success/20 text-success' : 'bg-neutral/20 text-neutral'}`}>
                                {event.isActive ? 'Active' : 'Inactive'}
                            </span>
                        </div>
                        <div className="flex gap-4 mt-4 text-xs text-text-secondary">
                            <span>Mode: <span className="text-accent font-medium">{event.exitMode}</span></span>
                            <span>Date: {new Date(event.eventDate).toLocaleDateString()}</span>
                        </div>
                        <div className="flex gap-2 mt-4">
                            <button onClick={() => toggleMutation.mutate(event.id)} className="px-3 py-1 bg-bg-hover rounded text-xs hover:bg-border transition-colors">
                                {event.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Campus Event">
                <p className="text-sm text-text-secondary">Event creation form — coming soon.</p>
            </Modal>
        </div>
    )
}
