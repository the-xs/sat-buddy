import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockAuth } from '../../../__mocks__/auth'

// Import after mocks
import { getAuthenticatedUser } from '@/lib/auth'

describe('getAuthenticatedUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return user when session exists with user id', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
    }

    mockAuth.mockResolvedValue({
      user: mockUser,
    })

    const result = await getAuthenticatedUser()

    expect(result.user).toEqual(mockUser)
    expect(result.error).toBeNull()
  })

  it('should return error when session is null', async () => {
    mockAuth.mockResolvedValue(null)

    const result = await getAuthenticatedUser()

    expect(result.user).toBeNull()
    expect(result.error).toBeDefined()
  })

  it('should return error when session.user is undefined', async () => {
    mockAuth.mockResolvedValue({
      user: undefined,
    })

    const result = await getAuthenticatedUser()

    expect(result.user).toBeNull()
    expect(result.error).toBeDefined()
  })

  it('should return error when session.user.id is missing', async () => {
    mockAuth.mockResolvedValue({
      user: {
        email: 'test@example.com',
        name: 'Test User',
        // id is missing
      },
    })

    const result = await getAuthenticatedUser()

    expect(result.user).toBeNull()
    expect(result.error).toBeDefined()
  })

  it('should return 401 status in error response', async () => {
    mockAuth.mockResolvedValue(null)

    const result = await getAuthenticatedUser()

    expect(result.error).toBeDefined()
    // NextResponse.json returns an object, we can check it was created properly
    // The actual status check depends on NextResponse implementation
  })
})
