import { X } from 'lucide-react'
import { useEffect } from 'react'
import { createPortal } from 'react-dom'

interface ModalProps {
    isOpen: boolean
    onClose: () => void
    title: string
    description?: string
    children: React.ReactNode
    size?: 'sm' | 'md' | 'lg' | 'xl'
}

export default function Modal({ isOpen, onClose, title, description, children, size = 'md' }: ModalProps) {
    // ESC-to-close + scroll lock. Tiny additions but they're what
    // separates a "fancy div" from an actual modal.
    useEffect(() => {
        if (!isOpen) return
        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', onKey)
        return () => {
            document.body.style.overflow = previousOverflow
            window.removeEventListener('keydown', onKey)
        }
    }, [isOpen, onClose])

    if (!isOpen) return null

    const width = {
        sm: 'max-w-md',
        md: 'max-w-xl',
        lg: 'max-w-3xl',
        xl: 'max-w-5xl',
    }[size]

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 sm:p-6">
            <div
                className="absolute inset-0 bg-bg-overlay backdrop-blur-sm animate-fade-in"
                onClick={onClose}
                aria-hidden
            />
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="modal-title"
                className={[
                    'relative w-full',
                    width,
                    'bg-bg-card border border-border rounded-2xl',
                    'shadow-elevated',
                    'animate-fade-in-up',
                    'max-h-[90vh] flex flex-col',
                ].join(' ')}
            >
                <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-border">
                    <div className="min-w-0">
                        <h3 id="modal-title" className="text-lg font-semibold text-text-primary truncate">
                            {title}
                        </h3>
                        {description && (
                            <p className="text-sm text-text-secondary mt-0.5">{description}</p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Close dialog"
                        className="-mr-2 inline-flex items-center justify-center w-9 h-9 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-subtle transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>
                <div className="px-6 py-5 overflow-y-auto custom-scrollbar">{children}</div>
            </div>
        </div>,
        document.body
    )
}
