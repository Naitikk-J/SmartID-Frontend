import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import api from '../api/axios'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import Modal from '../components/ui/Modal'
import toast from 'react-hot-toast'
import { Shield, Plus, Users } from 'lucide-react'

export default function AdminUsersPage() {
    const [showCreate, setShowCreate] = useState(false)
    const [showCreateStudent, setShowCreateStudent] = useState(false)
    const [form, setForm] = useState({ name: '', email: '', password: '', role: 'FACULTY', department: '', module: '' })
    const [studentForm, setStudentForm] = useState({
        fullName: '',
        enrollmentNo: '',
        email: '',
        department: 'CSE',
        year: '1',
        studentType: 'DAY_SCHOLAR',
    })
    const [studentUserTypeFilter, setStudentUserTypeFilter] = useState<'ALL' | 'COLLEGE_STUDENT' | 'EVENT_PARTICIPANT' | 'EXTERNAL_USER'>('ALL')
    const qc = useQueryClient()

    const { data: adminUsers, isLoading: isLoadingAdminUsers } = useQuery({
        queryKey: ['admin-users'],
        queryFn: () => api.get('/admin/users').then((r) => r.data.data.users),
    })

    const { data: studentsData, isLoading: isLoadingStudents } = useQuery({
        queryKey: ['students-for-admin-users-page', studentUserTypeFilter],
        queryFn: () => api.get('/students', {
            params: {
                page: 1,
                limit: 20,
                ...(studentUserTypeFilter === 'ALL' ? {} : { userType: studentUserTypeFilter }),
            },
        }).then((r) => r.data.data),
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

    const roleUpdateMutation = useMutation({
        mutationFn: ({ id, role, module, department }: { id: string; role: string; module?: string; department?: string }) =>
            api.patch(`/admin/users/${id}`, { role, module, department }),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); toast.success('Role updated') },
        onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to update role'),
    })

    const [roleEditUserId, setRoleEditUserId] = useState<string | null>(null)
    const [roleEditForm, setRoleEditForm] = useState({ role: 'FACULTY', module: '', department: '' })
    const [showAssignByEmail, setShowAssignByEmail] = useState(false)
    const [assignEmailForm, setAssignEmailForm] = useState({ email: '', role: 'FACULTY', module: '', department: '' })

    const assignByEmailMutation = useMutation({
        mutationFn: (body: any) => api.post('/admin/users/assign-role', body),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); setShowAssignByEmail(false); toast.success('Role assigned') },
        onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to assign role'),
    })

    const createStudentMutation = useMutation({
        mutationFn: (body: any) => api.post('/students', body),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['students-for-admin-users-page'] })
            setShowCreateStudent(false)
            setStudentForm({
                fullName: '',
                enrollmentNo: '',
                email: '',
                department: 'CSE',
                year: '1',
                studentType: 'DAY_SCHOLAR',
            })
            toast.success('Student created')
        },
        onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to create student'),
    })

    if (isLoadingAdminUsers || isLoadingStudents) return <LoadingSpinner />

    const students = studentsData?.students || []

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-bg-card rounded-xl border border-border p-5">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold flex items-center gap-2"><Shield size={28} /> Admin Users</h2>
                        <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-accent px-4 py-2 rounded-lg text-sm font-medium hover:bg-accent/90">
                            <Plus size={16} /> Add User
                        </button>
                    </div>
                    <p className="text-sm text-text-secondary mt-2">Create dashboard and operations users.</p>
                </div>

                <div className="bg-bg-card rounded-xl border border-border p-5">
                    <div className="flex items-center justify-between">
                        <h2 className="text-2xl font-bold flex items-center gap-2"><Users size={28} /> Students</h2>
                        <button onClick={() => setShowCreateStudent(true)} className="flex items-center gap-2 bg-primary px-4 py-2 rounded-lg text-sm font-medium text-white hover:bg-primary/90">
                            <Plus size={16} /> Add Student
                        </button>
                    </div>
                    <p className="text-sm text-text-secondary mt-2">Add students here so they can be used in app flows and student records.</p>
                </div>
            </div>

            <div className="bg-bg-card rounded-xl border border-border overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Admin User Accounts</h3>
                    <button
                        onClick={() => setShowAssignByEmail(true)}
                        className="text-xs text-accent hover:underline"
                    >
                        Assign Role by Email
                    </button>
                </div>
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
                        {adminUsers?.map((user: any) => (
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
                                <td className="px-4 py-3 space-x-2">
                                    <button
                                        onClick={() => {
                                            setRoleEditUserId(user.id)
                                            setRoleEditForm({
                                                role: user.role || 'FACULTY',
                                                module: user.module || '',
                                                department: user.department || '',
                                            })
                                        }}
                                        className="text-xs text-accent hover:underline"
                                    >
                                        Edit Role
                                    </button>
                                    <button onClick={() => toggleMutation.mutate(user.id)} className="text-xs text-accent hover:underline">
                                        {user.isActive ? 'Deactivate' : 'Activate'}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="bg-bg-card rounded-xl border border-border overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Recent Students</h3>
                    <div className="flex items-center gap-3">
                        <select
                            value={studentUserTypeFilter}
                            onChange={(e) => setStudentUserTypeFilter(e.target.value as any)}
                            className="bg-bg-dark border border-border rounded-lg px-2 py-1 text-xs text-text-primary"
                        >
                            <option value="ALL">All Students</option>
                            <option value="COLLEGE_STUDENT">College Students</option>
                            <option value="EVENT_PARTICIPANT">Event Participants</option>
                            <option value="EXTERNAL_USER">External Users</option>
                        </select>
                        <span className="text-xs text-text-secondary">Showing {students.length} records</span>
                    </div>
                </div>
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-border">
                            <th className="text-left text-xs text-text-secondary px-4 py-3">Name</th>
                            <th className="text-left text-xs text-text-secondary px-4 py-3">Enrollment</th>
                            <th className="text-left text-xs text-text-secondary px-4 py-3">Email</th>
                            <th className="text-left text-xs text-text-secondary px-4 py-3">Department</th>
                            <th className="text-left text-xs text-text-secondary px-4 py-3">Year</th>
                            <th className="text-left text-xs text-text-secondary px-4 py-3">Type</th>
                            <th className="text-left text-xs text-text-secondary px-4 py-3">User Segment</th>
                        </tr>
                    </thead>
                    <tbody>
                        {students.length === 0 ? (
                            <tr>
                                <td colSpan={7} className="px-4 py-6 text-sm text-text-secondary">No students found.</td>
                            </tr>
                        ) : students.map((student: any) => (
                            <tr key={student.id} className="border-b border-border/50 hover:bg-bg-hover">
                                <td className="px-4 py-3 text-sm font-medium">{student.fullName}</td>
                                <td className="px-4 py-3 text-sm text-text-secondary">{student.enrollmentNo}</td>
                                <td className="px-4 py-3 text-sm text-text-secondary">{student.email}</td>
                                <td className="px-4 py-3 text-sm">{student.department}</td>
                                <td className="px-4 py-3 text-sm">{student.year}</td>
                                <td className="px-4 py-3 text-xs">{String(student.studentType || '').replace(/_/g, ' ')}</td>
                                <td className="px-4 py-3 text-xs">{String(student.userType || 'COLLEGE_STUDENT').replace(/_/g, ' ')}</td>
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

            <Modal isOpen={!!roleEditUserId} onClose={() => setRoleEditUserId(null)} title="Edit Role">
                <form
                    onSubmit={(e) => {
                        e.preventDefault()
                        if (!roleEditUserId) return
                        roleUpdateMutation.mutate({
                            id: roleEditUserId,
                            role: roleEditForm.role,
                            module: roleEditForm.module || undefined,
                            department: roleEditForm.department || undefined,
                        })
                        setRoleEditUserId(null)
                    }}
                    className="space-y-4"
                >
                    <div>
                        <label className="block text-sm text-text-secondary mb-1">Role</label>
                        <select
                            value={roleEditForm.role}
                            onChange={(e) => setRoleEditForm((p) => ({ ...p, role: e.target.value }))}
                            className="w-full bg-bg-dark border border-border rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none"
                        >
                            <option>FACULTY</option>
                            <option>WARDEN</option>
                            <option>SECURITY_GUARD</option>
                            <option>HOD</option>
                            <option>SUPER_ADMIN</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm text-text-secondary mb-1">Department (optional)</label>
                        <input
                            type="text"
                            value={roleEditForm.department}
                            onChange={(e) => setRoleEditForm((p) => ({ ...p, department: e.target.value }))}
                            className="w-full bg-bg-dark border border-border rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-text-secondary mb-1">Module (optional)</label>
                        <select
                            value={roleEditForm.module}
                            onChange={(e) => setRoleEditForm((p) => ({ ...p, module: e.target.value }))}
                            className="w-full bg-bg-dark border border-border rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none"
                        >
                            <option value="">None</option>
                            <option>LIBRARY</option>
                            <option>MESS</option>
                            <option>CANTEEN</option>
                            <option>HEALTH</option>
                            <option>FINANCE</option>
                            <option>EVENTS</option>
                        </select>
                    </div>
                    <button type="submit" disabled={roleUpdateMutation.isPending} className="w-full bg-accent py-2.5 rounded-lg text-sm font-medium hover:bg-accent/90 disabled:opacity-50">
                        {roleUpdateMutation.isPending ? 'Updating...' : 'Update Role'}
                    </button>
                </form>
            </Modal>

            <Modal isOpen={showAssignByEmail} onClose={() => setShowAssignByEmail(false)} title="Assign Role by Email">
                <form
                    onSubmit={(e) => {
                        e.preventDefault()
                        assignByEmailMutation.mutate(assignEmailForm)
                    }}
                    className="space-y-4"
                >
                    <div>
                        <label className="block text-sm text-text-secondary mb-1">Email</label>
                        <input
                            type="email"
                            value={assignEmailForm.email}
                            onChange={(e) => setAssignEmailForm((p) => ({ ...p, email: e.target.value }))}
                            className="w-full bg-bg-dark border border-border rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-text-secondary mb-1">Role</label>
                        <select
                            value={assignEmailForm.role}
                            onChange={(e) => setAssignEmailForm((p) => ({ ...p, role: e.target.value }))}
                            className="w-full bg-bg-dark border border-border rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none"
                        >
                            <option>FACULTY</option>
                            <option>WARDEN</option>
                            <option>SECURITY_GUARD</option>
                            <option>HOD</option>
                            <option>SUPER_ADMIN</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm text-text-secondary mb-1">Department (optional)</label>
                        <input
                            type="text"
                            value={assignEmailForm.department}
                            onChange={(e) => setAssignEmailForm((p) => ({ ...p, department: e.target.value }))}
                            className="w-full bg-bg-dark border border-border rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-text-secondary mb-1">Module (optional)</label>
                        <select
                            value={assignEmailForm.module}
                            onChange={(e) => setAssignEmailForm((p) => ({ ...p, module: e.target.value }))}
                            className="w-full bg-bg-dark border border-border rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none"
                        >
                            <option value="">None</option>
                            <option>LIBRARY</option>
                            <option>MESS</option>
                            <option>CANTEEN</option>
                            <option>HEALTH</option>
                            <option>FINANCE</option>
                            <option>EVENTS</option>
                        </select>
                    </div>
                    <button type="submit" disabled={assignByEmailMutation.isPending} className="w-full bg-primary py-2.5 rounded-lg text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">
                        {assignByEmailMutation.isPending ? 'Assigning...' : 'Assign Role'}
                    </button>
                </form>
            </Modal>

            <Modal isOpen={showCreateStudent} onClose={() => setShowCreateStudent(false)} title="Create Student">
                <form
                    onSubmit={(e) => {
                        e.preventDefault()
                        createStudentMutation.mutate({
                            ...studentForm,
                            year: parseInt(studentForm.year, 10),
                        })
                    }}
                    className="space-y-4"
                >
                    <div>
                        <label className="block text-sm text-text-secondary mb-1">Full Name</label>
                        <input
                            type="text"
                            value={studentForm.fullName}
                            onChange={(e) => setStudentForm((p) => ({ ...p, fullName: e.target.value }))}
                            className="w-full bg-bg-dark border border-border rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-text-secondary mb-1">Enrollment Number</label>
                        <input
                            type="text"
                            value={studentForm.enrollmentNo}
                            onChange={(e) => setStudentForm((p) => ({ ...p, enrollmentNo: e.target.value }))}
                            className="w-full bg-bg-dark border border-border rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-text-secondary mb-1">Email</label>
                        <input
                            type="email"
                            value={studentForm.email}
                            onChange={(e) => setStudentForm((p) => ({ ...p, email: e.target.value }))}
                            className="w-full bg-bg-dark border border-border rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none"
                            required
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm text-text-secondary mb-1">Department</label>
                            <select
                                value={studentForm.department}
                                onChange={(e) => setStudentForm((p) => ({ ...p, department: e.target.value }))}
                                className="w-full bg-bg-dark border border-border rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none"
                            >
                                <option value="CSE">CSE</option>
                                <option value="ECE">ECE</option>
                                <option value="IT">IT</option>
                                <option value="ME">ME</option>
                                <option value="EE">EE</option>
                                <option value="CE">CE</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm text-text-secondary mb-1">Year</label>
                            <select
                                value={studentForm.year}
                                onChange={(e) => setStudentForm((p) => ({ ...p, year: e.target.value }))}
                                className="w-full bg-bg-dark border border-border rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none"
                            >
                                <option value="1">1</option>
                                <option value="2">2</option>
                                <option value="3">3</option>
                                <option value="4">4</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm text-text-secondary mb-1">Student Type</label>
                        <select
                            value={studentForm.studentType}
                            onChange={(e) => setStudentForm((p) => ({ ...p, studentType: e.target.value }))}
                            className="w-full bg-bg-dark border border-border rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none"
                        >
                            <option value="DAY_SCHOLAR">DAY SCHOLAR</option>
                            <option value="HOSTELLER_BOYS">HOSTELLER BOYS</option>
                            <option value="HOSTELLER_GIRLS">HOSTELLER GIRLS</option>
                        </select>
                    </div>
                    <button type="submit" disabled={createStudentMutation.isPending} className="w-full bg-primary py-2.5 rounded-lg text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50">
                        {createStudentMutation.isPending ? 'Creating...' : 'Create Student'}
                    </button>
                </form>
            </Modal>
        </div>
    )
}
