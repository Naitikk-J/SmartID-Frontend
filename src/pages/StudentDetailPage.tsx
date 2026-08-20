import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '../api/axios'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import Badge from '../components/ui/Badge'
import Modal from '../components/ui/Modal'
import toast from 'react-hot-toast'
import { ArrowLeft, CreditCard, ShieldAlert, RefreshCcw, QrCode, Download } from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'

export default function StudentDetailPage() {
    const { id } = useParams()
    const navigate = useNavigate()
    const qc = useQueryClient()
    const [showQR, setShowQR] = useState(false)

    const { data, isLoading } = useQuery({
        queryKey: ['student', id],
        queryFn: () => api.get(`/students/${id}`).then((r) => r.data.data.student),
    })

    const { data: scanHistory } = useQuery({
        queryKey: ['student-scans', id],
        queryFn: () => api.get(`/students/${id}/scan-history`).then((r) => r.data.data),
    })

    const deactivateCard = useMutation({
        mutationFn: () => api.post(`/students/${id}/card/deactivate`, { status: 'LOST' }),
        onSuccess: () => { toast.success('Card deactivated'); qc.invalidateQueries({ queryKey: ['student', id] }) },
        onError: () => toast.error('Failed to deactivate card'),
    })

    const replaceCard = useMutation({
        mutationFn: () => api.post(`/students/${id}/card/replace`),
        onSuccess: () => { toast.success('New card issued'); qc.invalidateQueries({ queryKey: ['student', id] }) },
        onError: () => toast.error('Failed to replace card'),
    })

    const downloadQR = () => {
        const canvas = document.getElementById('student-qr') as HTMLCanvasElement
        if (!canvas) return
        const url = canvas.toDataURL('image/png')
        const link = document.createElement('a')
        link.download = `QR_${data.enrollmentNo}.png`
        link.href = url
        link.click()
    }

    if (isLoading) return <LoadingSpinner />
    if (!data) return <p className="text-text-secondary">Student not found</p>

    const activeCard = data.cards?.find((c: any) => c.status === 'ACTIVE')

    return (
        <div className="space-y-6">
            <button onClick={() => navigate('/students')} className="flex items-center gap-2 text-text-secondary hover:text-text-primary text-sm">
                <ArrowLeft size={16} /> Back to Students
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Student Info */}
                <div className="lg:col-span-2 bg-bg-card rounded-xl border border-border p-6">
                    <div className="flex items-start gap-4">
                        <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center text-2xl font-bold text-accent shrink-0">
                            {data.fullName?.charAt(0)}
                        </div>
                        <div className="flex-1">
                            <h2 className="text-2xl font-bold">{data.fullName}</h2>
                            <p className="text-text-secondary">{data.enrollmentNo}</p>
                            <div className="flex flex-wrap gap-2 mt-2">
                                <span className="px-2 py-0.5 bg-accent/20 text-accent rounded-full text-xs">{data.department}</span>
                                <span className="px-2 py-0.5 bg-primary/20 text-text-secondary rounded-full text-xs">Year {data.year}</span>
                                <span className="px-2 py-0.5 bg-warning/20 text-warning rounded-full text-xs">{data.studentType?.replace(/_/g, ' ')}</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-6">
                        <div><span className="text-xs text-text-secondary">Email</span><p className="text-sm">{data.email}</p></div>
                        <div><span className="text-xs text-text-secondary">Phone</span><p className="text-sm">{data.phone || '—'}</p></div>
                        <div><span className="text-xs text-text-secondary">Father Name</span><p className="text-sm">{data.fatherName || data.emergencyName || '—'}</p></div>
                        <div><span className="text-xs text-text-secondary">Father Mobile</span><p className="text-sm">{data.fatherMobile || data.emergencyPhone || '—'}</p></div>
                        <div><span className="text-xs text-text-secondary">Allotted No.</span><p className="text-sm">{data.allottedNo || '—'}</p></div>
                        <div><span className="text-xs text-text-secondary">Room No.</span><p className="text-sm">{data.roomNo || data.section || '—'}</p></div>
                        <div><span className="text-xs text-text-secondary">Category</span><p className="text-sm">{data.category || '—'}</p></div>
                        <div><span className="text-xs text-text-secondary">Section</span><p className="text-sm">{data.section || '—'}</p></div>
                        <div><span className="text-xs text-text-secondary">Blood Group</span><p className="text-sm">{data.bloodGroup || '—'}</p></div>
                        <div><span className="text-xs text-text-secondary">Emergency Contact</span><p className="text-sm">{data.emergencyName} — {data.emergencyPhone || '—'}</p></div>
                        <div className="col-span-2"><span className="text-xs text-text-secondary">Permanent Address</span><p className="text-sm">{data.permanentAddress || '—'}</p></div>
                    </div>
                </div>

                {/* Card Management */}
                <div className="bg-bg-card rounded-xl border border-border p-6">
                    <h3 className="text-lg font-semibold flex items-center gap-2 mb-4"><CreditCard size={20} /> Card</h3>
                    {activeCard ? (
                        <div className="space-y-3">
                            <div className="p-4 bg-bg-dark rounded-lg">
                                <p className="text-xs text-text-secondary">Card UID</p>
                                <p className="text-sm font-mono">{activeCard.cardUid}</p>
                                <p className="text-xs text-text-secondary mt-2">Status</p>
                                <span className="text-xs px-2 py-0.5 bg-success/20 text-success rounded-full">ACTIVE</span>
                            </div>
                            <button onClick={() => setShowQR(true)} className="w-full flex items-center justify-center gap-2 bg-accent py-2 rounded-lg text-sm font-medium hover:bg-accent/90">
                                <QrCode size={16} /> View/Generate QR
                            </button>
                            <div className="flex gap-2">
                                <button onClick={() => deactivateCard.mutate()} className="flex-1 flex items-center justify-center gap-1 bg-danger/20 text-danger py-2 rounded-lg text-xs hover:bg-danger/30">
                                    <ShieldAlert size={14} /> Mark Lost
                                </button>
                                <button onClick={() => replaceCard.mutate()} className="flex-1 flex items-center justify-center gap-1 bg-accent/20 text-accent py-2 rounded-lg text-xs hover:bg-accent/30">
                                    <RefreshCcw size={14} /> Replace
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <p className="text-text-secondary text-sm mb-3">No active card</p>
                            <button onClick={() => replaceCard.mutate()} className="bg-accent px-4 py-2 rounded-lg text-sm hover:bg-accent/90">Issue New Card</button>
                        </div>
                    )}

                    {/* All cards history */}
                    <div className="mt-4">
                        <h4 className="text-sm font-medium mb-2">Card History</h4>
                        {data.cards?.map((c: any) => (
                            <div key={c.id} className="flex items-center justify-between py-1.5 text-xs text-text-secondary border-b border-border/50">
                                <span className="font-mono">{c.cardUid}</span>
                                <span className={c.status === 'ACTIVE' ? 'text-success' : 'text-danger'}>{c.status}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Scan History */}
            <div className="bg-bg-card rounded-xl border border-border p-6">
                <h3 className="text-lg font-semibold mb-4">Recent Scans</h3>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-border">
                                <th className="text-left text-xs text-text-secondary px-4 py-2">Time</th>
                                <th className="text-left text-xs text-text-secondary px-4 py-2">Type</th>
                                <th className="text-left text-xs text-text-secondary px-4 py-2">Result</th>
                            </tr>
                        </thead>
                        <tbody>
                            {scanHistory?.events?.slice(0, 20).map((e: any) => (
                                <tr key={e.id} className="border-b border-border/50">
                                    <td className="px-4 py-2 text-sm">{new Date(e.scannedAt).toLocaleString()}</td>
                                    <td className="px-4 py-2 text-sm">{e.scanType?.replace(/_/g, ' ')}</td>
                                    <td className="px-4 py-2"><Badge result={e.result} badge={e.result === 'VERIFIED' ? 'GREEN' : 'RED'} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* QR Modal */}
            <Modal isOpen={showQR} onClose={() => setShowQR(false)} title="Student ID QR Code">
                <div className="flex flex-col items-center gap-6 py-4">
                    <div className="p-4 bg-white rounded-xl shadow-lg">
                        <QRCodeCanvas
                            id="student-qr"
                            value={activeCard?.qrToken || ''}
                            size={220}
                            level="L"
                            boostLevel={false}
                            marginSize={2}
                        />
                    </div>
                    <div className="text-center">
                        <p className="font-bold text-lg">{data.fullName}</p>
                        <p className="text-text-secondary text-sm">{data.enrollmentNo}</p>
                    </div>
                    <button
                        onClick={downloadQR}
                        className="flex items-center gap-2 bg-success text-white px-6 py-2.5 rounded-lg font-medium hover:bg-success/90 transition-colors"
                    >
                        <Download size={18} /> Download PNG
                    </button>
                </div>
            </Modal>
        </div>
    )
}
