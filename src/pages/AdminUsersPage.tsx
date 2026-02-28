import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import api from '../api/axios'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import Modal from '../components/ui/Modal'
import toast from 'react-hot-toast'
import { Shield, Plus } from 'lucide-react'

export default function AdminUsersPage() {
    const [showCreate, setShowCreate] = useState(false)
    const [form, setForm] = useState({ name: '', email: '', password: '', role: 'FACULTY', department: '', module: '' })
    const qc = useQueryClient()

    const { data, isLoading } = useQuery({
        queryKey: ['admin-users'],
        queryFn: () => api.get('/admin/users').then((r) => r.data.data.users),
    })

    const createMutation = useMutation({
        mutationFn: (body: any) => api.post('/admin/users', body),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); setShowCreate(false); toast.success('User created') },
        onError: (err: any) => toast.error(err.response?.data?.error || 'Failed'),
    })

    const toggleMutation = useMutation({
        mutationFn: (id: number) => api.patch(`/admin/users/${id}/toggle`),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); toast.success('User toggled') },
    })

    if (isLoading) return <LoadingSpinner />

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold flex items-center gap-2"><Shield size={28} /> Admin Users</h2>
                <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-accent px-4 py-2 rounded-lg text-sm font-medium hover:bg-accent/90">
                    <Plus size={16} /> Add User
                </button>
            </div>

            <div className="bg-bg-card rounded-xl border border-border overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-border">
                            <th className="text-left text-xs text-text-secondary px-4 py-3">Name</th>
                            <th className="text-left text-xs text-text-secondary px-4 py-3">Email</th>
                            <th className="text-left text-xs text-text-secondary px-4 py-3">Role</th>
                            <th className="text-left text-xs text-text-secondary px-4 py-3">Department</th>
                            <th className="text-left text-xs text-text-secondary px-4 py-3">Module</th>
                            <th className="text-left text-xs text-text-secondary px-4 py-3">Status</th>
                            <th className="text-left text-xs text-text-secondary px-4 py-3">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data?.map((user: any) => (
                            <tr key={user.id} className="border-b border-border/50 hover:bg-bg-hover">
                                <td className="px-4 py-3 text-sm font-medium">{user.name}</td>
                                <td className="px-4 py-3 text-sm text-text-secondary">{user.email}</td>
                                <td className="px-4 py-3"><span className="px-2 py-0.5 bg-accent/20 text-accent rounded-full text-xs">{user.role}</span></td>
                                <td className="px-4 py-3 text-sm">{user.department || '—'}</td>
                                <td className="px-4 py-3 text-sm">{user.module || '—'}</td>
                                <td className="px-4 py-3">
                                    <span className={`px-2 py-0.5 rounded-full text-xs ${user.isActive ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}`}>
                                        {user.isActive ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <button onClick={() => toggleMutation.mutate(user.id)} className="text-xs text-accent hover:underline">
                                        {user.isActive ? 'Deactivate' : 'Activate'}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title="Create Admin User">
                <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form) }} className="space-y-4">
                    {['name', 'email', 'password'].map((field) => (
                        <div key={field}>
                            <label className="block text-sm text-text-secondary mb-1 capitalize">{field}</label>
                            <input
                                type={field === 'password' ? 'password' : field === 'email' ? 'email' : 'text'}
                                value={(form as any)[field]}
                                onChange={(e) => setForm((p) => ({ ...p, [field]: e.target.value }))}
                                className="w-full bg-bg-dark border border-border rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none"
                                required
                            />
                        </div>
                    ))}
                    <div>
                        <label className="block text-sm text-text-secondary mb-1">Role</label>
                        <select value={form.role} onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}
                            className="w-full bg-bg-dark border border-border rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none">
                            <option>FACULTY</option>
                            <option>WARDEN</option>
                            <option>SECURITY_GUARD</option>
                            <option>HOD</option>
                            <option>SUPER_ADMIN</option>
                        </select>
                    </div>
                    <button type="submit" disabled={createMutation.isPending} className="w-full bg-accent py-2.5 rounded-lg text-sm font-medium hover:bg-accent/90 disabled:opacity-50">
                        {createMutation.isPending ? 'Creating...' : 'Create User'}
                    </button>
                </form>
            </Modal>
        </div>
    )
}
