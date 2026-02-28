import { Wallet as WalletIcon } from 'lucide-react'

export default function WalletPage() {
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold flex items-center gap-2"><WalletIcon size={28} /> Wallet & Canteen</h2>
            <div className="bg-bg-card rounded-xl border border-border p-8 text-center">
                <WalletIcon size={48} className="mx-auto text-warning mb-4" />
                <h3 className="text-lg font-semibold">Wallet Management</h3>
                <p className="text-text-secondary text-sm mt-2 max-w-md mx-auto">
                    Top-up student wallets, view transaction history, and manage canteen payment deductions.
                    Use the student detail page to manage individual wallets, or the scan endpoint for canteen deductions.
                </p>
            </div>
        </div>
    )
}
