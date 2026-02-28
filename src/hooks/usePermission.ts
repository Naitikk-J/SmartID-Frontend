import { useAuthStore } from '../store/authStore'

export function usePermission() {
    const user = useAuthStore((s) => s.user)
    const role = user?.role || 'SECURITY_GUARD'

    return {
        isSuperAdmin: role === 'SUPER_ADMIN',
        isHOD: role === 'HOD' || role === 'SUPER_ADMIN',
        isStaff: ['FACULTY', 'WARDEN', 'HOD', 'SUPER_ADMIN'].includes(role),
        canView: (item: string): boolean => {
            const permissions: Record<string, string[]> = {
                Dashboard: ['SUPER_ADMIN', 'HOD', 'FACULTY', 'WARDEN'],
                'Live Feed': ['SUPER_ADMIN', 'HOD'],
                Students: ['SUPER_ADMIN', 'HOD', 'FACULTY', 'WARDEN'],
                Attendance: ['SUPER_ADMIN', 'HOD', 'FACULTY'],
                'Exit Rules': ['SUPER_ADMIN', 'HOD', 'WARDEN'],
                Events: ['SUPER_ADMIN', 'HOD', 'FACULTY', 'WARDEN'],
                Library: ['SUPER_ADMIN', 'HOD'],
                Wallet: ['SUPER_ADMIN', 'HOD'],
                Elections: ['SUPER_ADMIN', 'HOD'],
                Reports: ['SUPER_ADMIN', 'HOD'],
                Health: ['SUPER_ADMIN', 'HOD'],
                'Admin Users': ['SUPER_ADMIN'],
                'Audit Log': ['SUPER_ADMIN'],
            }
            const allowed = permissions[item]
            if (!allowed) return role === 'SUPER_ADMIN'
            return allowed.includes(role)
        },
    }
}
