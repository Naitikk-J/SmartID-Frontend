
import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../api/axios';
import { Shield, X, Clock } from 'lucide-react';
import LoadingSpinner from './ui/LoadingSpinner';

interface CurfewRule {
    id: string;
    startTime: string;
    endTime: string;
    studentType: string;
    isActive?: boolean;
}

interface CurfewManagerProps {
    onClose: () => void;
}

export default function CurfewManager({ onClose }: CurfewManagerProps) {
    const queryClient = useQueryClient();
    const [rules, setRules] = useState<CurfewRule[]>([]);

    const { data: curfewData, isLoading: isLoadingCurfew, error: curfewError } = useQuery<CurfewRule[]>({
        queryKey: ['curfewRules'],
        queryFn: async () => {
            const response = await api.get('/rules/curfew');
            return response.data.data;
        },
    });

    useEffect(() => {
        if (curfewData) {
            setRules(curfewData);
        }
    }, [curfewData]);

    const updateRuleMutation = useMutation({
        mutationFn: async (rule: CurfewRule) => {
            const { id, ...data } = rule;
            const response = await api.put(`/rules/curfew/${id}`, data);
            return response.data.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['curfewRules'] });
        },
    });

    const handleTimeChange = (id: string, field: 'startTime' | 'endTime', value: string) => {
        setRules(rules.map(rule => rule.id === id ? { ...rule, [field]: value } : rule));
    };

    const handleSaveChanges = async () => {
        await Promise.all(
            rules.map((rule) => updateRuleMutation.mutateAsync(rule))
        );
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 animate-fade-in">
            <div className="bg-gray-800 border border-primary/20 rounded-2xl shadow-2xl w-full max-w-2xl m-4">
                <div className="p-6 border-b border-white/10 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/20 rounded-lg text-primary">
                            <Shield size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-text-primary">Configure Curfew Timings</h2>
                            <p className="text-xs text-text-secondary">Set automated exit/entry restriction windows.</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
                    {isLoadingCurfew ? (
                        <div className="flex justify-center items-center h-48">
                            <LoadingSpinner />
                        </div>
                    ) : curfewError ? (
                        <div className="text-center text-error">
                            <p>Failed to load curfew rules.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {rules.map((rule) => (
                                <div key={rule.id} className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
                                    <p className="font-bold text-text-primary w-32">{rule.studentType.replace('_', ' ')}</p>
                                    <div className="flex items-center gap-3">
                                        <div className="relative">
                                            <input
                                                type="time"
                                                value={rule.startTime}
                                                onChange={(e) => handleTimeChange(rule.id, 'startTime', e.target.value)}
                                                className="bg-white/5 border border-white/10 rounded-lg pl-10 pr-3 py-2 text-sm font-bold text-text-primary focus:outline-none"
                                            />
                                            <Clock size={16} className="absolute left-3 top-2.5 text-text-secondary" />
                                        </div>
                                        <span className="text-text-secondary">-</span>
                                        <div className="relative">
                                            <input
                                                type="time"
                                                value={rule.endTime}
                                                onChange={(e) => handleTimeChange(rule.id, 'endTime', e.target.value)}
                                                className="bg-white/5 border border-white/10 rounded-lg pl-10 pr-3 py-2 text-sm font-bold text-text-primary focus:outline-none"
                                            />
                                            <Clock size={16} className="absolute left-3 top-2.5 text-text-secondary" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="p-6 bg-gray-900/50 border-t border-white/10 flex justify-end gap-4">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-xl text-sm font-bold bg-white/10 hover:bg-white/20 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => { void handleSaveChanges(); }}
                        disabled={isLoadingCurfew || updateRuleMutation.isPending}
                        className="px-6 py-2.5 rounded-xl text-sm font-bold bg-primary text-white hover:bg-primary/90 transition-all disabled:opacity-50"
                    >
                        {updateRuleMutation.isPending ? <LoadingSpinner size="sm" /> : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
}
