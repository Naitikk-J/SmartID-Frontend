import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../api/axios'
import toast from 'react-hot-toast'
import { Users, Search, CheckSquare, Square, ChevronDown, ChevronUp, UserPlus, UserMinus } from 'lucide-react'

export default function HostellerImportPanel() {
    const queryClient = useQueryClient()
    const [isExpanded, setIsExpanded] = useState(false)
    const [search, setSearch] = useState('')
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

    // Fetch 1st Year Students
    const { data: studentsData, isLoading } = useQuery({
        queryKey: ['firstYearStudents', search],
        enabled: isExpanded,
        queryFn: async () => {
            const response = await api.get('/students', {
                params: {
                    year: 1,
                    limit: 1000, // Fetch enough to avoid pagination for this specific task
                    search: search || undefined
                }
            })
            return response.data?.data?.students || []
        }
    })

    const bulkUpdateMutation = useMutation({
        mutationFn: async (studentType: 'HOSTELLER_BOYS' | 'HOSTELLER_GIRLS' | 'DAY_SCHOLAR') => {
            if (selectedIds.size === 0) throw new Error('No students selected')
            
            const response = await api.patch('/students/bulk-hosteller', {
                studentIds: Array.from(selectedIds),
                studentType
            })
            return response.data
        },
        onSuccess: (_, studentType) => {
            const typeStr = studentType.replace('_', ' ').toLowerCase()
            toast.success(`Successfully updated ${selectedIds.size} students to ${typeStr}`)
            setSelectedIds(new Set())
            queryClient.invalidateQueries({ queryKey: ['firstYearStudents'] })
            queryClient.invalidateQueries({ queryKey: ['hosteller-logs'] })
        },
        onError: (err: any) => {
            const errorMsg = err.response?.data?.error || err.message || 'Failed to update students'
            toast.error(errorMsg)
        }
    })

    const toggleSelection = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    const toggleAll = () => {
        if (studentsData?.length === selectedIds.size) {
            setSelectedIds(new Set())
        } else {
            setSelectedIds(new Set(studentsData?.map((s: any) => s.id) || []))
        }
    }

    if (!isExpanded) {
        return (
            <div 
                className="glass-card p-5 border border-primary/20 bg-primary/5 cursor-pointer hover:bg-primary/10 transition-colors"
                onClick={() => setIsExpanded(true)}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/20 rounded-lg text-primary">
                            <Users size={20} />
                        </div>
                        <div>
                            <h3 className="font-bold text-text-primary leading-tight text-lg">1st Year Hosteller Setup</h3>
                            <p className="text-xs text-text-secondary">Import or remove 1st-year students from the hosteller list</p>
                        </div>
                    </div>
                    <ChevronDown size={20} className="text-text-secondary" />
                </div>
            </div>
        )
    }

    return (
        <div className="glass-card p-6 border border-primary/40 bg-primary/10 space-y-4">
            <div className="flex items-center justify-between cursor-pointer" onClick={() => setIsExpanded(false)}>
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/20 rounded-lg text-primary">
                        <Users size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-text-primary leading-tight text-lg">1st Year Hosteller Setup</h3>
                        <p className="text-xs text-text-secondary">Select students and update their hosteller status</p>
                    </div>
                </div>
                <ChevronUp size={20} className="text-text-secondary" />
            </div>

            <div className="pt-2 border-t border-white/10">
                <div className="flex flex-col md:flex-row gap-3 mb-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" size={18} />
                        <input
                            type="text"
                            placeholder="Search by name or enrollment no..."
                            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-primary/50"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => bulkUpdateMutation.mutate('HOSTELLER_BOYS')}
                            disabled={selectedIds.size === 0 || bulkUpdateMutation.isPending}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 text-xs font-black transition-colors disabled:opacity-50"
                        >
                            <UserPlus size={16} />
                            Set as Boys
                        </button>
                        <button
                            onClick={() => bulkUpdateMutation.mutate('HOSTELLER_GIRLS')}
                            disabled={selectedIds.size === 0 || bulkUpdateMutation.isPending}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-pink-500/20 text-pink-400 hover:bg-pink-500/30 text-xs font-black transition-colors disabled:opacity-50"
                        >
                            <UserPlus size={16} />
                            Set as Girls
                        </button>
                        <button
                            onClick={() => bulkUpdateMutation.mutate('DAY_SCHOLAR')}
                            disabled={selectedIds.size === 0 || bulkUpdateMutation.isPending}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gray-500/20 text-gray-400 hover:bg-gray-500/30 text-xs font-black transition-colors disabled:opacity-50"
                        >
                            <UserMinus size={16} />
                            Remove (Day Scholar)
                        </button>
                    </div>
                </div>

                <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden max-h-[400px] overflow-y-auto">
                    {isLoading ? (
                        <div className="p-8 text-center text-text-secondary text-sm">Loading students...</div>
                    ) : studentsData?.length === 0 ? (
                        <div className="p-8 text-center text-text-secondary text-sm">No 1st-year students found.</div>
                    ) : (
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-white/5 sticky top-0 backdrop-blur-md z-10 border-b border-white/10">
                                <tr>
                                    <th className="p-3 w-12 text-center">
                                        <button onClick={toggleAll} className="text-text-secondary hover:text-primary transition-colors">
                                            {studentsData?.length > 0 && selectedIds.size === studentsData?.length ? (
                                                <CheckSquare size={18} className="text-primary" />
                                            ) : (
                                                <Square size={18} />
                                            )}
                                        </button>
                                    </th>
                                    <th className="p-3 text-xs font-black text-text-secondary uppercase tracking-wider">Enrollment No</th>
                                    <th className="p-3 text-xs font-black text-text-secondary uppercase tracking-wider">Name</th>
                                    <th className="p-3 text-xs font-black text-text-secondary uppercase tracking-wider">Current Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {studentsData?.map((student: any) => (
                                    <tr 
                                        key={student.id} 
                                        className={`border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer ${selectedIds.has(student.id) ? 'bg-primary/5' : ''}`}
                                        onClick={() => toggleSelection(student.id)}
                                    >
                                        <td className="p-3 text-center">
                                            <div className="text-text-secondary flex justify-center">
                                                {selectedIds.has(student.id) ? (
                                                    <CheckSquare size={18} className="text-primary" />
                                                ) : (
                                                    <Square size={18} />
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-3 text-sm font-bold text-text-primary">{student.enrollmentNo}</td>
                                        <td className="p-3 text-sm text-text-primary">{student.fullName}</td>
                                        <td className="p-3 text-sm">
                                            <span className={`px-2 py-1 rounded-md text-[10px] font-black ${
                                                student.studentType?.includes('HOSTELLER') 
                                                    ? 'bg-success/20 text-success' 
                                                    : 'bg-white/10 text-text-secondary'
                                            }`}>
                                                {student.studentType?.replace('_', ' ') || 'DAY SCHOLAR'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
                
                <div className="mt-3 flex justify-between items-center text-xs font-bold text-text-secondary">
                    <span>{studentsData?.length || 0} students total</span>
                    {selectedIds.size > 0 && <span className="text-primary">{selectedIds.size} selected</span>}
                </div>
            </div>
        </div>
    )
}
