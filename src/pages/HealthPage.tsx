import { Heart } from 'lucide-react'

export default function HealthPage() {
    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold flex items-center gap-2"><Heart size={28} /> Health Module</h2>
            <div className="bg-bg-card rounded-xl border border-border p-8 text-center">
                <Heart size={48} className="mx-auto text-danger mb-4" />
                <h3 className="text-lg font-semibold">Medical Information Portal</h3>
                <p className="text-text-secondary text-sm mt-2 max-w-md mx-auto">
                    View and manage student health profiles including blood group, allergies, medical conditions, and emergency contacts.
                    Health data is accessible via the student detail page and the health scan type.
                </p>
            </div>
        </div>
    )
}
