import { renderHook } from '@testing-library/react'
import { usePermissions } from '../usePermissions'

// Mock the auth provider with proper jest mock
const mockUseAuth = jest.fn()
jest.mock('@/components/auth-provider', () => ({
  useAuth: () => mockUseAuth(),
}))

describe('usePermissions', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      session: {
        user: {
          id: 1,
          username: 'testuser',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          isSuperuser: false,
        },
        organizations: [],
        activeOrganizationId: null,
        modules: [],
        roles: [],
        permissions: [],
      },
    })
  })

  it('should return default permissions for regular user', () => {
    const { result } = renderHook(() => usePermissions())
    
    expect(result.current.isSuperAdmin).toBe(false)
    expect(result.current.isFieldStaff).toBe(false)
    expect(result.current.canViewTeamMatrix).toBe(false)
    expect(result.current.canViewPerformance).toBe(false)
    expect(result.current.canViewStaff).toBe(false)
    expect(result.current.canViewAuditEvents).toBe(false)
    expect(result.current.canManageTasks).toBe(false)
    expect(result.current.canAssignTasks).toBe(false)
    expect(result.current.canViewHrRequests).toBe(true)
    expect(result.current.canViewLeaveRequests).toBe(true)
    expect(result.current.canViewFeedback).toBe(true)
    expect(result.current.canUseCompanion).toBe(true)
  })

  it('should return super admin permissions for superuser', () => {
    mockUseAuth.mockReturnValue({
      session: {
        user: {
          id: 1,
          username: 'admin',
          email: 'admin@example.com',
          firstName: 'Admin',
          lastName: 'User',
          isSuperuser: true,
        },
        organizations: [],
        activeOrganizationId: null,
        modules: [],
        roles: [],
        permissions: [],
      },
    })

    const { result } = renderHook(() => usePermissions())
    
    expect(result.current.isSuperAdmin).toBe(true)
    expect(result.current.canViewTeamMatrix).toBe(true)
    expect(result.current.canViewPerformance).toBe(true)
    expect(result.current.canViewStaff).toBe(true)
    expect(result.current.canViewAuditEvents).toBe(true)
    expect(result.current.canAssignTasks).toBe(true)
  })

  it('should return field staff permissions for caretaker role', () => {
    mockUseAuth.mockReturnValue({
      session: {
        user: {
          id: 1,
          username: 'caretaker',
          email: 'caretaker@example.com',
          firstName: 'Care',
          lastName: 'Taker',
          isSuperuser: false,
        },
        organizations: [],
        activeOrganizationId: null,
        modules: [],
        roles: ['caretaker'],
        permissions: [],
      },
    })

    const { result } = renderHook(() => usePermissions())
    
    expect(result.current.isSuperAdmin).toBe(false)
    expect(result.current.isFieldStaff).toBe(true)
    expect(result.current.canManageTasks).toBe(true)
    expect(result.current.canAssignTasks).toBe(false)
  })
})
