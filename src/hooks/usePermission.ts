import { useAuthStore } from '../store/authStore'

export const ROLE_PERMISSIONS: Record<string, string[]> = {
    Dashboard: ['SUPER_ADMIN', 'HOD', 'FACULTY'],
    'Live Feed': ['SUPER_ADMIN', 'HOD'],
    Students: ['SUPER_ADMIN', 'HOD', 'FACULTY'],
    Hostellers: ['SUPER_ADMIN', 'HOD', 'FACULTY'],
    'QR Projector': ['SUPER_ADMIN', 'HOD', 'FACULTY', 'WARDEN', 'SECURITY_GUARD'],
    'QR Manage': ['SUPER_ADMIN', 'HOD', 'FACULTY', 'WARDEN', 'SECURITY_GUARD'],
    Attendance: ['SUPER_ADMIN', 'HOD', 'FACULTY'],
    'Exit Rules': ['SUPER_ADMIN', 'HOD'],
    Events: ['SUPER_ADMIN', 'HOD', 'FACULTY'],
    Library: ['SUPER_ADMIN', 'HOD'],
    Wallet: ['SUPER_ADMIN', 'HOD'],
    Elections: ['SUPER_ADMIN', 'HOD'],
    Reports: ['SUPER_ADMIN', 'HOD'],
    Health: ['SUPER_ADMIN', 'HOD'],
    Geofencing: ['SUPER_ADMIN', 'HOD', 'WARDEN'],
    'Admin Users': ['SUPER_ADMIN'],
    'Audit Log': ['SUPER_ADMIN'],
    'Student Auth Logs': ['SUPER_ADMIN'],
    'RFID Dashboard': ['SUPER_ADMIN', 'HOD', 'FACULTY'],
    'RFID Cards': ['SUPER_ADMIN', 'HOD', 'WARDEN'],
    'RFID Readers': ['SUPER_ADMIN', 'HOD'],
    'RFID Transactions': ['SUPER_ADMIN', 'HOD', 'WARDEN', 'SECURITY_GUARD', 'FACULTY'],
    'RFID Live Monitor': ['SUPER_ADMIN', 'HOD', 'WARDEN', 'SECURITY_GUARD', 'FACULTY'],
    'Campus Entry': ['SUPER_ADMIN', 'HOD', 'FACULTY'],
}

export function canRoleView(role: string, item: string): boolean {
    const allowed = ROLE_PERMISSIONS[item]
    if (!allowed) return role === 'SUPER_ADMIN'
    return allowed.includes(role)
}

export function usePermission() {
    const user = useAuthStore((s) => s.user)
    const role = user?.role || 'SECURITY_GUARD'

    return {
        isSuperAdmin: role === 'SUPER_ADMIN',
        isHOD: role === 'HOD' || role === 'SUPER_ADMIN',
        isStaff: ['FACULTY', 'WARDEN', 'HOD', 'SUPER_ADMIN'].includes(role),
        canView: (item: string): boolean => canRoleView(role, item),
    }
}
