import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import api from '../api/axios'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import toast from 'react-hot-toast'
import { Search, Plus, Upload, Users, QrCode, Download } from 'lucide-react'
import Modal from '../components/ui/Modal'
import { QRCodeCanvas } from 'qrcode.react'
import { useForm } from 'react-hook-form'

export default function StudentsPage() {
    const [search, setSearch] = useState('')
    const [deptFilter, setDeptFilter] = useState('')
    const [page, setPage] = useState(1)
    const [showImport, setShowImport] = useState(false)
    const [showAdd, setShowAdd] = useState(false)
    const [selectedStudent, setSelectedStudent] = useState<any>(null)
    const [importFile, setImportFile] = useState<File | null>(null)

    const navigate = useNavigate()
    const qc = useQueryClient()
    const { register, handleSubmit, reset } = useForm()

    const { data, isLoading } = useQuery({
        queryKey: ['students', search, deptFilter, page],
        queryFn: () => api.get('/students', { params: { search, dept: deptFilter || undefined, page, limit: 50 } }).then((r) => r.data.data),
    })

    const createMutation = useMutation({
        mutationFn: (body: any) => api.post('/students', body),
        onSuccess: () => {
            toast.success('Student added successfully')
            setShowAdd(false)
            reset()
            qc.invalidateQueries({ queryKey: ['students'] })
        },
        onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to add student'),
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

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold flex items-center gap-2"><Users size={28} /> Students</h2>
                <div className="flex gap-2">
                    <button onClick={() => setShowImport(true)} className="flex items-center gap-2 bg-bg-card border border-border px-4 py-2 rounded-lg text-sm hover:bg-bg-hover transition-colors">
                        <Upload size={16} /> Import CSV
                    </button>
                    <button onClick={() => setShowAdd(true)} className="flex items-center gap-2 bg-accent px-4 py-2 rounded-lg text-sm font-medium hover:bg-accent/90 transition-colors">
                        <Plus size={16} /> Add Student
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-3">
                <div className="relative flex-1">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                        placeholder="Search by name, enrollment, or email..."
                        className="w-full bg-bg-card border border-border rounded-lg pl-10 pr-4 py-2.5 text-sm focus:border-accent focus:outline-none"
                    />
                </div>
                <select
                    value={deptFilter}
                    onChange={(e) => { setDeptFilter(e.target.value); setPage(1) }}
                    className="bg-bg-card border border-border rounded-lg px-4 py-2.5 text-sm focus:border-accent focus:outline-none"
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

            {/* Table */}
            {isLoading ? <LoadingSpinner /> : (
                <div className="bg-bg-card rounded-xl border border-border overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-border">
                                <th className="text-left text-xs text-text-secondary font-medium px-4 py-3">Name</th>
                                <th className="text-left text-xs text-text-secondary font-medium px-4 py-3">Enrollment</th>
                                <th className="text-left text-xs text-text-secondary font-medium px-4 py-3">Department</th>
                                <th className="text-left text-xs text-text-secondary font-medium px-4 py-3">Year</th>
                                <th className="text-left text-xs text-text-secondary font-medium px-4 py-3">Type</th>
                                <th className="text-left text-xs text-text-secondary font-medium px-4 py-3">Card</th>
                                <th className="text-left text-xs text-text-secondary font-medium px-4 py-3">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data?.students?.map((s: any) => (
                                <tr key={s.id} className="border-b border-border/50 hover:bg-bg-hover transition-colors cursor-pointer" onClick={() => navigate(`/students/${s.id}`)}>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-accent/20 rounded-full flex items-center justify-center text-xs font-bold text-accent">
                                                {s.fullName?.charAt(0)}
                                            </div>
                                            <span className="text-sm font-medium">{s.fullName}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-sm text-text-secondary">{s.enrollmentNo}</td>
                                    <td className="px-4 py-3 text-sm">{s.department}</td>
                                    <td className="px-4 py-3 text-sm">{s.year}</td>
                                    <td className="px-4 py-3 text-sm">
                                        <span className="px-2 py-0.5 bg-primary/20 text-accent rounded-full text-xs">{s.studentType?.replace(/_/g, ' ')}</span>
                                    </td>
                                    <td className="px-4 py-3 text-sm">
                                        <span className={`px-2 py-0.5 rounded-full text-xs ${s.cards?.[0]?.status === 'ACTIVE' ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'}`}>
                                            {s.cards?.[0]?.status || 'No Card'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <button
                                                className="text-text-secondary hover:text-accent transition-colors"
                                                title="View QR Code"
                                                onClick={(e) => { e.stopPropagation(); setSelectedStudent(s) }}
                                            >
                                                <QrCode size={18} />
                                            </button>
                                            <button className="text-xs text-accent hover:underline font-medium" onClick={(e) => { e.stopPropagation(); navigate(`/students/${s.id}`) }}>
                                                View
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {/* Pagination */}
                    {data && (
                        <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                            <span className="text-sm text-text-secondary">
                                Showing {((page - 1) * 50) + 1}–{Math.min(page * 50, data.total)} of {data.total}
                            </span>
                            <div className="flex gap-2">
                                <button disabled={page <= 1} onClick={() => setPage(page - 1)} className="px-3 py-1 bg-bg-dark rounded text-sm disabled:opacity-50">Prev</button>
                                <button disabled={page >= data.pages} onClick={() => setPage(page + 1)} className="px-3 py-1 bg-bg-dark rounded text-sm disabled:opacity-50">Next</button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Add Student Modal */}
            <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Add Student">
                <form onSubmit={handleSubmit((d) => createMutation.mutate({ ...d, year: parseInt(d.year) }))} className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                        <label className="block text-xs text-text-secondary mb-1">Full Name</label>
                        <input {...register('fullName')} required className="w-full bg-bg-dark border border-border rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                        <label className="block text-xs text-text-secondary mb-1">Enrollment No</label>
                        <input {...register('enrollmentNo')} required className="w-full bg-bg-dark border border-border rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                        <label className="block text-xs text-text-secondary mb-1">Email</label>
                        <input {...register('email')} type="email" required className="w-full bg-bg-dark border border-border rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                        <label className="block text-xs text-text-secondary mb-1">Department</label>
                        <select {...register('department')} required className="w-full bg-bg-dark border border-border rounded-lg px-3 py-2 text-sm">
                            <option value="CSE">CSE</option>
                            <option value="ECE">ECE</option>
                            <option value="IT">IT</option>
                            <option value="ME">ME</option>
                            <option value="EE">EE</option>
                            <option value="CE">CE</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs text-text-secondary mb-1">Year</label>
                        <select {...register('year')} required className="w-full bg-bg-dark border border-border rounded-lg px-3 py-2 text-sm">
                            <option value="1">1st Year</option>
                            <option value="2">2nd Year</option>
                            <option value="3">3rd Year</option>
                            <option value="4">4th Year</option>
                        </select>
                    </div>
                    <div className="col-span-2">
                        <label className="block text-xs text-text-secondary mb-1">Student Type</label>
                        <select {...register('studentType')} required className="w-full bg-bg-dark border border-border rounded-lg px-3 py-2 text-sm">
                            <option value="DAY_SCHOLAR">Day Scholar</option>
                            <option value="HOSTELLER_BOYS">Hosteller (Boys)</option>
                            <option value="HOSTELLER_GIRLS">Hosteller (Girls)</option>
                        </select>
                    </div>
                    <button type="submit" disabled={createMutation.isPending} className="col-span-2 bg-accent py-2.5 rounded-lg text-sm font-medium hover:bg-accent/90 disabled:opacity-50 mt-2">
                        {createMutation.isPending ? 'Adding...' : 'Add Student'}
                    </button>
                </form>
            </Modal>

            {/* QR Modal */}
            <Modal isOpen={!!selectedStudent} onClose={() => setSelectedStudent(null)} title="Student ID QR Code">
                {selectedStudent && (
                    <div className="flex flex-col items-center gap-6 py-4">
                        <div className="p-4 bg-white rounded-xl shadow-lg">
                            <QRCodeCanvas
                                id="student-qr-table"
                                value={selectedStudent.cards?.find((c: any) => c.status === 'ACTIVE')?.qrToken || ''}
                                size={200}
                                level="H"
                                includeMargin={true}
                            />
                        </div>
                        <div className="text-center">
                            <p className="font-bold text-lg">{selectedStudent.fullName}</p>
                            <p className="text-text-secondary text-sm">{selectedStudent.enrollmentNo}</p>
                        </div>
                        <button
                            onClick={downloadQR}
                            className="flex items-center gap-2 bg-success text-white px-6 py-2.5 rounded-lg font-medium hover:bg-success/90 transition-colors"
                        >
                            <Download size={18} /> Download PNG
                        </button>
                    </div>
                )}
            </Modal>

            {/* Import Modal */}
            <Modal isOpen={showImport} onClose={() => setShowImport(false)} title="Bulk Import Students">
                <div className="space-y-4">
                    <p className="text-sm text-text-secondary">Upload a CSV file with columns: enrollmentNo, fullName, email, phone, department, year, section, studentType</p>
                    <input
                        type="file"
                        accept=".csv"
                        onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                        className="block w-full text-sm text-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:bg-accent file:text-white"
                    />
                    <button
                        onClick={() => importFile && importMutation.mutate(importFile)}
                        disabled={!importFile || importMutation.isPending}
                        className="w-full bg-accent py-2.5 rounded-lg text-sm font-medium hover:bg-accent/90 disabled:opacity-50"
                    >
                        {importMutation.isPending ? 'Importing...' : 'Import All'}
                    </button>
                </div>
            </Modal>
        </div>
    )
}
