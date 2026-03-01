import { X } from 'lucide-react'
import { createPortal } from 'react-dom'

interface ModalProps {
    isOpen: boolean
    onClose: () => void
    title: string
    children: React.ReactNode
    size?: 'sm' | 'md' | 'lg'
}

export default function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
    if (!isOpen) return null
    const w = size === 'lg' ? 'max-w-3xl' : size === 'md' ? 'max-w-xl' : 'max-w-md'

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div
                className="absolute inset-0 bg-bg-dark/80 backdrop-blur-md animate-fade-in"
                onClick={onClose}
            />
            <div className={`relative glass-card bg-bg-card/90 border border-white/10 p-6 md:p-8 w-full ${w} shadow-2xl animate-fade-in-up`}>
                <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-black tracking-tight text-text-primary">{title}</h3>
                    <button
                        onClick={onClose}
                        className="p-2 text-text-secondary hover:text-text-primary hover:bg-white/5 rounded-xl transition-all"
                    >
                        <X size={20} />
                    </button>
                </div>
                <div className="relative">
                    {children}
                </div>
            </div>
        </div>,
        document.body
    )
}
