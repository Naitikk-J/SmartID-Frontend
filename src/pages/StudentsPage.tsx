import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'
import toast from 'react-hot-toast'
import { Search, Plus, Upload, Users, QrCode, Download, Filter, ChevronLeft, ChevronRight, Pencil, Trash2 } from 'lucide-react'
import Modal from '../components/ui/Modal'
import { QRCodeCanvas } from 'qrcode.react'
import { useForm } from 'react-hook-form'

export default function StudentsPage() {
    const [search, setSearch] = useState('')
    const [deptFilter, setDeptFilter] = useState('')
    const [page, setPage] = useState(1)
    const [showImport, setShowImport] = useState(false)
    const [showAdd, setShowAdd] = useState(false)
    const [showEdit, setShowEdit] = useState(false)
    const [selectedStudent, setSelectedStudent] = useState<any>(null)
    const [editingStudent, setEditingStudent] = useState<any>(null)
    const [importFile, setImportFile] = useState<File | null>(null)

    const navigate = useNavigate()
    const qc = useQueryClient()
    const { register: addRegister, handleSubmit: handleAddSubmit, reset: resetAdd } = useForm()
    const { register: editRegister, handleSubmit: handleEditSubmit, reset: resetEdit } = useForm()

    const { data, isLoading } = useQuery({
        queryKey: ['students', search, deptFilter, page],
        queryFn: () => api.get('/students', { params: { search, dept: deptFilter || undefined, page, limit: 50 } }).then((r) => r.data.data),
    })

    const createMutation = useMutation({
        mutationFn: (body: any) => api.post('/students', body),
        onSuccess: () => {
            toast.success('Student added successfully')
            setShowAdd(false)
            resetAdd()
            qc.invalidateQueries({ queryKey: ['students'] })
        },
        onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to add student'),
    })

    const updateMutation = useMutation({
        mutationFn: ({ id, body }: { id: string; body: any }) => api.patch(`/students/${id}`, body),
        onSuccess: () => {
            toast.success('Student updated successfully')
            setShowEdit(false)
            setEditingStudent(null)
            resetEdit()
            qc.invalidateQueries({ queryKey: ['students'] })
        },
        onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to update student'),
    })

    const deleteMutation = useMutation({
        mutationFn: (id: string) => api.delete(`/students/${id}`),
        onSuccess: () => {
            toast.success('Student deleted successfully')
            qc.invalidateQueries({ queryKey: ['students'] })
        },
        onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to delete student'),
    })

    const importMutation = useMutation({
        mutationFn: (file: File) => {
            const formData = new FormData()
            formData.append('file', file)
            return api.post('/students/bulk-import', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            })
        },
        onSuccess: (res) => {
            const { created, skipped, errors } = res.data.data
            toast.success(`Import complete: ${created} created, ${skipped} skipped`)
            if (errors.length > 0) toast.error(`${errors.length} rows had errors`)
            setShowImport(false)
            setImportFile(null)
            qc.invalidateQueries({ queryKey: ['students'] })
        },
        onError: (err: any) => toast.error(err.response?.data?.error || 'Import failed'),
    })

    const downloadQR = () => {
        const canvas = document.getElementById('student-qr-table') as HTMLCanvasElement
        if (!canvas) return
        const url = canvas.toDataURL('image/png')
        const link = document.createElement('a')
        link.download = `QR_${selectedStudent.enrollmentNo}.png`
        link.href = url
        link.click()
    }

    const openEditModal = (student: any) => {
        setEditingStudent(student)
        resetEdit({
            fullName: student.fullName || '',
            enrollmentNo: student.enrollmentNo || '',
            email: student.email || '',
            phone: student.phone || '',
            fatherName: student.fatherName || '',
            fatherMobile: student.fatherMobile || '',
            allottedNo: student.allottedNo || '',
            roomNo: student.roomNo || '',
            category: student.category || '',
            permanentAddress: student.permanentAddress || '',
            department: student.department || 'CSE',
            year: String(student.year || 1),
            studentType: student.studentType || 'DAY_SCHOLAR',
        })
        setShowEdit(true)
    }

    const onDeleteStudent = (student: any) => {
        if (!window.confirm(`Delete student ${student.fullName}?`)) return
        deleteMutation.mutate(student.id)
    }

    return (
        <div className="space-y-8 animate-fade-in-up">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 rounded-2xl bg-primary/10 text-primary shadow-xl shadow-primary/5">
                        <Users size={28} />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black tracking-tight text-text-primary">Student Registry</h2>
                        <p className="text-text-secondary font-medium text-sm">Manage and monitor student credentials</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setShowImport(true)}
                        className="flex items-center gap-2 bg-white/5 border border-white/10 px-5 py-2.5 rounded-2xl text-sm font-bold text-text-secondary hover:text-text-primary hover:bg-white/10 transition-all"
                    >
                        <Upload size={18} /> Bulk Import
                    </button>
                    <button
                        onClick={() => setShowAdd(true)}
                        className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-2xl text-sm font-black shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all active:scale-95"
                    >
                        <Plus size={18} strokeWidth={3} /> Add Student
                    </button>
                </div>
            </header>

            {/* Filters Section */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1 group">
                    <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary group-focus-within:text-accent transition-colors" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                        placeholder="Search by name, enrollment, or email..."
                        className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-3.5 text-sm font-bold text-text-primary focus:border-accent/40 focus:bg-white/[0.08] focus:outline-none transition-all placeholder:text-text-secondary/50 shadow-inner"
                    />
                </div>
                <div className="flex items-center gap-3 bg-white/5 border border-white/10 p-1.5 rounded-2xl">
                    <div className="flex items-center gap-2 px-3 text-text-secondary">
                        <Filter size={18} />
                        <span className="text-[10px] font-black uppercase tracking-widest hidden lg:inline">Dept</span>
                    </div>
                    <select
                        value={deptFilter}
                        onChange={(e) => { setDeptFilter(e.target.value); setPage(1) }}
                        className="bg-bg-dark border border-white/5 rounded-xl px-4 py-2 text-xs font-black text-text-primary focus:outline-none appearance-none cursor-pointer hover:bg-white/5 transition-all"
                    >
                        <option value="">All Departments</option>
                        <option value="CSE">CSE</option>
                        <option value="ECE">ECE</option>
                        <option value="ME">ME</option>
                        <option value="IT">IT</option>
                        <option value="EE">EE</option>
                        <option value="CE">CE</option>
                    </select>
                </div>
            </div>

            {/* Main Content Area */}
            {isLoading ? (
                <div className="glass-card flex flex-col items-center justify-center py-32 gap-4">
                    <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                    <p className="text-text-secondary font-black text-sm uppercase tracking-widest">Loading Records...</p>
                </div>
            ) : (
                <div className="glass-card overflow-hidden">
                    <div className="overflow-x-auto custom-scrollbar">
                        <table className="w-full border-collapse">
                            <thead>
                                <tr className="border-b border-white/5 bg-white/[0.02]">
                                    <th className="text-[10px] font-black uppercase tracking-widest text-text-secondary px-6 py-4">Student</th>
                                    <th className="text-[10px] font-black uppercase tracking-widest text-text-secondary px-6 py-4">Enrollment</th>
                                    <th className="text-[10px] font-black uppercase tracking-widest text-text-secondary px-6 py-4">Department</th>
                                    <th className="text-[10px] font-black uppercase tracking-widest text-text-secondary px-6 py-4 text-center">Year</th>
                                    <th className="text-[10px] font-black uppercase tracking-widest text-text-secondary px-6 py-4 text-center">Status</th>
                                    <th className="text-[10px] font-black uppercase tracking-widest text-text-secondary px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {data?.students?.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-24 text-center">
                                            <p className="text-text-secondary font-bold">No students found matching your criteria</p>
                                        </td>
                                    </tr>
                                ) : data?.students?.map((s: any, idx: number) => (
                                    <tr
                                        key={s.id}
                                        className="group hover:bg-white/[0.03] transition-all cursor-pointer animate-fade-in-up"
                                        style={{ animationDelay: `${idx * 20}ms` }}
                                        onClick={() => navigate(`/students/${s.id}`)}
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 bg-gradient-to-br from-primary to-primary-light rounded-xl flex items-center justify-center text-xs font-black text-white shadow-lg shadow-primary/10">
                                                    {s.fullName?.charAt(0)}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-black text-text-primary group-hover:text-accent transition-colors truncate">
                                                        {s.fullName}
                                                    </p>
                                                    <p className="text-[10px] font-bold text-text-secondary uppercase">
                                                        {s.studentType?.replace(/_/g, ' ')}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-xs font-black text-text-primary tracking-tighter">{s.enrollmentNo}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="text-[10px] font-black text-text-secondary uppercase tracking-widest">{s.department}</span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className="text-xs font-black text-text-primary">{s.year}</span>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-black tracking-widest ${s.isActive !== false && s.cards?.[0]?.status === 'ACTIVE'
                                                ? 'bg-success/10 text-success border border-success/20'
                                                : 'bg-danger/10 text-danger border border-danger/20'
                                                }`}>
                                                {s.isActive === false ? 'DELETED' : (s.cards?.[0]?.status || 'NO CARD')}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all translate-x-2 group-hover:translate-x-0">
                                                <button
                                                    className="p-2 text-text-secondary hover:text-warning hover:bg-white/5 rounded-xl transition-all"
                                                    title="Edit Student"
                                                    onClick={(e) => { e.stopPropagation(); openEditModal(s) }}
                                                >
                                                    <Pencil size={16} />
                                                </button>
                                                <button
                                                    className="p-2 text-text-secondary hover:text-danger hover:bg-white/5 rounded-xl transition-all"
                                                    title="Delete Student"
                                                    onClick={(e) => { e.stopPropagation(); onDeleteStudent(s) }}
                                                    disabled={deleteMutation.isPending || s.isActive === false}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                                <button
                                                    className="p-2 text-text-secondary hover:text-accent hover:bg-white/5 rounded-xl transition-all"
                                                    title="View QR Code"
                                                    onClick={(e) => { e.stopPropagation(); setSelectedStudent(s) }}
                                                >
                                                    <QrCode size={18} />
                                                </button>
                                                <button
                                                    className="p-2 text-text-secondary hover:text-primary hover:bg-white/5 rounded-xl transition-all"
                                                    onClick={(e) => { e.stopPropagation(); navigate(`/students/${s.id}`) }}
                                                >
                                                    <ChevronRight size={18} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Modern Pagination Section */}
                    {data && (
                        <div className="flex items-center justify-between px-6 py-4 bg-white/[0.02] border-t border-white/5">
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">Showing</span>
                                <span className="text-xs font-black text-text-primary">{((page - 1) * 50) + 1}–{Math.min(page * 50, data.total)}</span>
                                <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest">of {data.total}</span>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    disabled={page <= 1}
                                    onClick={() => setPage(page - 1)}
                                    className="p-2 border border-white/5 rounded-xl hover:bg-white/10 disabled:opacity-20 transition-all font-bold text-xs"
                                >
                                    <ChevronLeft size={18} />
                                </button>
                                <button
                                    disabled={page >= data.pages}
                                    onClick={() => setPage(page + 1)}
                                    className="p-2 border border-white/5 rounded-xl hover:bg-white/10 disabled:opacity-20 transition-all font-bold text-xs"
                                >
                                    <ChevronRight size={18} />
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Add Student Modal Content */}
            <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Register New Student">
                <form onSubmit={handleAddSubmit((d) => createMutation.mutate({ ...d, year: parseInt(d.year) }))} className="grid grid-cols-2 gap-6">
                    <div className="col-span-2">
                        <label className="block text-[10px] font-black uppercase tracking-widest text-text-secondary mb-2">Full Name</label>
                        <input {...addRegister('fullName')} required className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-text-primary focus:border-accent/40 focus:outline-none transition-all" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-text-secondary mb-2">Enrollment No</label>
                        <input {...addRegister('enrollmentNo')} required className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-text-primary focus:border-accent/40 focus:outline-none transition-all" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-text-secondary mb-2">Email Identity</label>
                        <input {...addRegister('email')} type="email" required className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-text-primary focus:border-accent/40 focus:outline-none transition-all" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-text-secondary mb-2">Student Mobile</label>
                        <input {...addRegister('phone')} className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-text-primary focus:border-accent/40 focus:outline-none transition-all" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-text-secondary mb-2">Father Name</label>
                        <input {...addRegister('fatherName')} className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-text-primary focus:border-accent/40 focus:outline-none transition-all" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-text-secondary mb-2">Father Mobile</label>
                        <input {...addRegister('fatherMobile')} className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-text-primary focus:border-accent/40 focus:outline-none transition-all" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-text-secondary mb-2">Allotted No.</label>
                        <input {...addRegister('allottedNo')} className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-text-primary focus:border-accent/40 focus:outline-none transition-all" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-text-secondary mb-2">Room No.</label>
                        <input {...addRegister('roomNo')} className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-text-primary focus:border-accent/40 focus:outline-none transition-all" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-text-secondary mb-2">Category</label>
                        <input {...addRegister('category')} className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-text-primary focus:border-accent/40 focus:outline-none transition-all" />
                    </div>
                    <div className="col-span-2">
                        <label className="block text-[10px] font-black uppercase tracking-widest text-text-secondary mb-2">Permanent Address</label>
                        <textarea {...addRegister('permanentAddress')} rows={2} className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-text-primary focus:border-accent/40 focus:outline-none transition-all" />
                    </div>
                    <div className="col-span-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-xs font-bold text-text-secondary">
                        Initial password will be auto-set to student mobile number.
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-text-secondary mb-2">Department</label>
                        <select {...addRegister('department')} required className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-text-primary focus:border-accent/40 focus:outline-none transition-all">
                            <option value="CSE">CSE</option>
                            <option value="ECE">ECE</option>
                            <option value="IT">IT</option>
                            <option value="ME">ME</option>
                            <option value="EE">EE</option>
                            <option value="CE">CE</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-text-secondary mb-2">Academic Year</label>
                        <select {...addRegister('year')} required className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-text-primary focus:border-accent/40 focus:outline-none transition-all">
                            <option value="1">1st Year</option>
                            <option value="2">2nd Year</option>
                            <option value="3">3rd Year</option>
                            <option value="4">4th Year</option>
                        </select>
                    </div>
                    <div className="col-span-2">
                        <label className="block text-[10px] font-black uppercase tracking-widest text-text-secondary mb-2">Residential Type</label>
                        <select {...addRegister('studentType')} required className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-text-primary focus:border-accent/40 focus:outline-none transition-all">
                            <option value="DAY_SCHOLAR">Day Scholar</option>
                            <option value="HOSTELLER_BOYS">Hosteller (Boys)</option>
                            <option value="HOSTELLER_GIRLS">Hosteller (Girls)</option>
                        </select>
                    </div>
                    <button
                        type="submit"
                        disabled={createMutation.isPending}
                        className="col-span-2 bg-primary py-4 rounded-2xl text-sm font-black text-white shadow-lg shadow-primary/20 hover:scale-[1.01] active:scale-95 disabled:opacity-50 transition-all mt-4"
                    >
                        {createMutation.isPending ? 'Processing Registration...' : 'Complete Registration'}
                    </button>
                </form>
            </Modal>

            {/* Edit Student Modal Content */}
            <Modal isOpen={showEdit} onClose={() => { setShowEdit(false); setEditingStudent(null) }} title="Edit Student">
                <form
                    onSubmit={handleEditSubmit((d) => {
                        if (!editingStudent?.id) return
                        updateMutation.mutate({
                            id: editingStudent.id,
                            body: { ...d, year: parseInt(d.year) },
                        })
                    })}
                    className="grid grid-cols-2 gap-6"
                >
                    <div className="col-span-2">
                        <label className="block text-[10px] font-black uppercase tracking-widest text-text-secondary mb-2">Full Name</label>
                        <input {...editRegister('fullName')} required className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-text-primary focus:border-accent/40 focus:outline-none transition-all" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-text-secondary mb-2">Enrollment No</label>
                        <input {...editRegister('enrollmentNo')} required className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-text-primary focus:border-accent/40 focus:outline-none transition-all" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-text-secondary mb-2">Email Identity</label>
                        <input {...editRegister('email')} type="email" required className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-text-primary focus:border-accent/40 focus:outline-none transition-all" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-text-secondary mb-2">Student Mobile</label>
                        <input {...editRegister('phone')} className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-text-primary focus:border-accent/40 focus:outline-none transition-all" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-text-secondary mb-2">Father Name</label>
                        <input {...editRegister('fatherName')} className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-text-primary focus:border-accent/40 focus:outline-none transition-all" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-text-secondary mb-2">Father Mobile</label>
                        <input {...editRegister('fatherMobile')} className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-text-primary focus:border-accent/40 focus:outline-none transition-all" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-text-secondary mb-2">Allotted No.</label>
                        <input {...editRegister('allottedNo')} className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-text-primary focus:border-accent/40 focus:outline-none transition-all" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-text-secondary mb-2">Room No.</label>
                        <input {...editRegister('roomNo')} className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-text-primary focus:border-accent/40 focus:outline-none transition-all" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-text-secondary mb-2">Category</label>
                        <input {...editRegister('category')} className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-text-primary focus:border-accent/40 focus:outline-none transition-all" />
                    </div>
                    <div className="col-span-2">
                        <label className="block text-[10px] font-black uppercase tracking-widest text-text-secondary mb-2">Permanent Address</label>
                        <textarea {...editRegister('permanentAddress')} rows={2} className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-text-primary focus:border-accent/40 focus:outline-none transition-all" />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-text-secondary mb-2">Department</label>
                        <select {...editRegister('department')} required className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-text-primary focus:border-accent/40 focus:outline-none transition-all">
                            <option value="CSE">CSE</option>
                            <option value="ECE">ECE</option>
                            <option value="IT">IT</option>
                            <option value="ME">ME</option>
                            <option value="EE">EE</option>
                            <option value="CE">CE</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black uppercase tracking-widest text-text-secondary mb-2">Academic Year</label>
                        <select {...editRegister('year')} required className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-text-primary focus:border-accent/40 focus:outline-none transition-all">
                            <option value="1">1st Year</option>
                            <option value="2">2nd Year</option>
                            <option value="3">3rd Year</option>
                            <option value="4">4th Year</option>
                        </select>
                    </div>
                    <div className="col-span-2">
                        <label className="block text-[10px] font-black uppercase tracking-widest text-text-secondary mb-2">Residential Type</label>
                        <select {...editRegister('studentType')} required className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3 text-sm font-bold text-text-primary focus:border-accent/40 focus:outline-none transition-all">
                            <option value="DAY_SCHOLAR">Day Scholar</option>
                            <option value="HOSTELLER_BOYS">Hosteller (Boys)</option>
                            <option value="HOSTELLER_GIRLS">Hosteller (Girls)</option>
                        </select>
                    </div>
                    <button
                        type="submit"
                        disabled={updateMutation.isPending}
                        className="col-span-2 bg-primary py-4 rounded-2xl text-sm font-black text-white shadow-lg shadow-primary/20 hover:scale-[1.01] active:scale-95 disabled:opacity-50 transition-all mt-4"
                    >
                        {updateMutation.isPending ? 'Saving Changes...' : 'Update Student'}
                    </button>
                </form>
            </Modal>

            {/* QR Modal Content */}
            <Modal isOpen={!!selectedStudent} onClose={() => setSelectedStudent(null)} title="Security Identity Token">
                {selectedStudent && (
                    <div className="flex flex-col items-center gap-8 py-4">
                        <div className="p-6 bg-white rounded-3xl shadow-2xl relative">
                            <div className="absolute inset-0 bg-primary/5 rounded-3xl animate-pulse" />
                            <QRCodeCanvas
                                id="student-qr-table"
                                value={selectedStudent.cards?.find((c: any) => c.status === 'ACTIVE')?.qrToken || ''}
                                size={220}
                                level="L"
                                boostLevel={false}
                                marginSize={2}
                                className="relative z-10 rounded-lg"
                            />
                        </div>
                        <div className="text-center space-y-1">
                            <p className="text-2xl font-black tracking-tight text-text-primary">{selectedStudent.fullName}</p>
                            <p className="text-text-secondary font-bold uppercase tracking-widest text-xs">Credential ID: {selectedStudent.enrollmentNo}</p>
                        </div>
                        <button
                            onClick={downloadQR}
                            className="flex items-center gap-3 bg-success text-white px-8 py-3.5 rounded-2xl font-black text-sm shadow-lg shadow-success/20 hover:scale-[1.02] active:scale-95 transition-all"
                        >
                            <Download size={20} strokeWidth={3} /> Save Digital QR
                        </button>
                    </div>
                )}
            </Modal>

            {/* Import Modal Content */}
            <Modal isOpen={showImport} onClose={() => setShowImport(false)} title="System Bulk Onboarding">
                <div className="space-y-6">
                    <p className="text-sm text-text-secondary font-medium leading-relaxed bg-white/5 p-4 rounded-2xl border border-white/10">
                        Upload <code className="text-accent font-black">CSV</code> or <code className="text-accent font-black">PDF</code> with student list fields like: <code className="text-accent font-black">Enrollment</code>, <code className="text-accent font-black">Student Name</code>, <code className="text-accent font-black">Father Name</code>, <code className="text-accent font-black">Student Room/Alloted</code>, <code className="text-accent font-black">Father Mobile</code>, <code className="text-accent font-black">Student Email_ID</code>, <code className="text-accent font-black">Category</code>, <code className="text-accent font-black">Permanent Address</code>, <code className="text-accent font-black">Mobile</code>.
                    </p>
                    <div className="relative group">
                        <input
                            type="file"
                            accept=".csv,.pdf"
                            onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                            className="block w-full text-xs text-text-secondary file:mr-6 file:py-3 file:px-6 file:rounded-2xl file:border-0 file:text-[10px] file:font-black file:uppercase file:tracking-widest file:bg-primary file:text-white file:cursor-pointer p-2 bg-white/5 border border-dashed border-white/20 rounded-2xl hover:bg-white/10 transition-all"
                        />
                    </div>
                    <button
                        onClick={() => importFile && importMutation.mutate(importFile)}
                        disabled={!importFile || importMutation.isPending}
                        className="w-full bg-primary py-4 rounded-2xl text-sm font-black text-white shadow-lg shadow-primary/20 hover:scale-[1.01] active:scale-95 disabled:opacity-50 transition-all font-black"
                    >
                        {importMutation.isPending ? 'Extracting Records...' : 'Execute Onboarding'}
                    </button>
                </div>
            </Modal>
        </div>
    )
}
