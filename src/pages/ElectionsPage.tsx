import { Vote } from 'lucide-react'

export default function ElectionsPage() {
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold flex items-center gap-2"><Vote size={28} /> Elections</h2>
            <div className="bg-bg-card rounded-xl border border-border p-8 text-center">
                <Vote size={48} className="mx-auto text-accent mb-4" />
                <h3 className="text-lg font-semibold">Student Elections</h3>
                <p className="text-text-secondary text-sm mt-2 max-w-md mx-auto">
                    Create and manage student elections. Votes are cast via QR scan to prevent duplicates.
                    Results can be published after the election closes.
                </p>
            </div>
        </div>
    )
}
