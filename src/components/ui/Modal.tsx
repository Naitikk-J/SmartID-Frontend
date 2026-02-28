import { X } from 'lucide-react'

interface ModalProps {
    isOpen: boolean
    onClose: () => void
    title: string
    children: React.ReactNode
    size?: 'sm' | 'md' | 'lg'
}

export default function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
    if (!isOpen) return null
    const w = size === 'lg' ? 'max-w-3xl' : size === 'md' ? 'max-w-lg' : 'max-w-sm'

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
            <div className={`relative bg-bg-card rounded-xl border border-border p-6 w-full ${w} mx-4 animate-slide-in`}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold">{title}</h3>
                    <button onClick={onClose} className="p-1 text-text-secondary hover:text-text-primary transition-colors">
                        <X size={20} />
                    </button>
                </div>
                {children}
            </div>
        </div>
    )
}
