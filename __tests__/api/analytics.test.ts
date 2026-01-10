import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock auth first
vi.mock('@/lib/auth', () => ({
  getAuthenticatedUser: vi.fn(),
}))

// Mock services
vi.mock('@/lib/services/analyticsService', () => ({
  analyticsService: {
    getAnalytics: vi.fn(),
  },
}))

import { getAuthenticatedUser } from '@/lib/auth'
import { analyticsService } from '@/lib/services/analyticsService'
import { GET } from '@/app/api/analytics/route'

describe('API /api/analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/analytics', () => {
    it('should return analytics for authenticated user', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' }
      const mockAnalytics = {
        skillData: [{ subject: 'Math', target: 100, you: 75 }],
        topicMastery: [{ topic: 'Algebra', progress: 80, status: 'Improving' }],
      }

      vi.mocked(getAuthenticatedUser).mockResolvedValue({ user: mockUser, error: null })
      vi.mocked(analyticsService.getAnalytics).mockResolvedValue(mockAnalytics)

      const response = await GET()
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockAnalytics)
      expect(analyticsService.getAnalytics).toHaveBeenCalledWith('user-123')
    })

    it('should return error for unauthenticated user', async () => {
      const errorResponse = new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401 }
      )

      vi.mocked(getAuthenticatedUser).mockResolvedValue({ user: null, error: errorResponse })

      const response = await GET()

      expect(response.status).toBe(401)
    })

    it('should handle service errors gracefully', async () => {
      const mockUser = { id: 'user-123', email: 'test@example.com' }

      vi.mocked(getAuthenticatedUser).mockResolvedValue({ user: mockUser, error: null })
      vi.mocked(analyticsService.getAnalytics).mockRejectedValue(new Error('Service Error'))

      const response = await GET()
      const data = await response.json()

      expect(data.success).toBe(false)
      expect(data.error).toBe('Failed to fetch analytics')
      expect(response.status).toBe(500)
    })
  })
})
