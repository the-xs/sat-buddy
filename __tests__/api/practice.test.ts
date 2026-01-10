import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock auth first
vi.mock('@/lib/auth', () => ({
  getAuthenticatedUser: vi.fn(),
}))

// Mock services
vi.mock('@/lib/services/practiceService', () => ({
  practiceService: {
    generateQuestion: vi.fn(),
    checkAnswer: vi.fn(),
    explainAnswer: vi.fn(),
    getPracticeStats: vi.fn(),
    getPracticeHistory: vi.fn(),
  },
}))

import { getAuthenticatedUser } from '@/lib/auth'
import { practiceService } from '@/lib/services/practiceService'
import { GET, POST } from '@/app/api/practice/route'

describe('API /api/practice', () => {
  const mockUser = { id: 'user-123', email: 'test@example.com' }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAuthenticatedUser).mockResolvedValue({ user: mockUser, error: null })
  })

  describe('GET /api/practice', () => {
    it('should return stats by default', async () => {
      const mockStats = { total: 10, correct: 8, accuracy: 80 }
      vi.mocked(practiceService.getPracticeStats).mockResolvedValue(mockStats)

      const request = new NextRequest('http://localhost/api/practice')
      const response = await GET(request)
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockStats)
    })

    it('should return stats when action=stats', async () => {
      const mockStats = { total: 10, correct: 8, accuracy: 80 }
      vi.mocked(practiceService.getPracticeStats).mockResolvedValue(mockStats)

      const request = new NextRequest('http://localhost/api/practice?action=stats')
      const response = await GET(request)
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockStats)
    })

    it('should return history when action=history', async () => {
      const mockHistory = [{ id: 1, questionText: 'Q1' }]
      vi.mocked(practiceService.getPracticeHistory).mockResolvedValue(mockHistory)

      const request = new NextRequest('http://localhost/api/practice?action=history')
      const response = await GET(request)
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockHistory)
    })

    it('should return error for unauthenticated user', async () => {
      const errorResponse = new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401 }
      )
      vi.mocked(getAuthenticatedUser).mockResolvedValue({ user: null, error: errorResponse })

      const request = new NextRequest('http://localhost/api/practice')
      const response = await GET(request)

      expect(response.status).toBe(401)
    })

    it('should handle errors gracefully', async () => {
      vi.mocked(practiceService.getPracticeStats).mockRejectedValue(new Error('Service Error'))

      const request = new NextRequest('http://localhost/api/practice')
      const response = await GET(request)
      const data = await response.json()

      expect(data.success).toBe(false)
      expect(response.status).toBe(500)
    })
  })

  describe('POST /api/practice', () => {
    it('should generate question', async () => {
      const mockQuestion = { id: 1, question: 'What is 2+2?' }
      vi.mocked(practiceService.generateQuestion).mockResolvedValue(mockQuestion)

      const request = new NextRequest('http://localhost/api/practice', {
        method: 'POST',
        body: JSON.stringify({ action: 'generate', category: 'math' }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockQuestion)
      expect(practiceService.generateQuestion).toHaveBeenCalledWith('math', 'user-123')
    })

    it('should use random category when not specified', async () => {
      const mockQuestion = { id: 1, question: 'What is 2+2?' }
      vi.mocked(practiceService.generateQuestion).mockResolvedValue(mockQuestion)

      const request = new NextRequest('http://localhost/api/practice', {
        method: 'POST',
        body: JSON.stringify({ action: 'generate' }),
      })
      await POST(request)

      expect(practiceService.generateQuestion).toHaveBeenCalledWith('random', 'user-123')
    })

    it('should check answer', async () => {
      const mockResult = { isCorrect: true, correctAnswer: 'B' }
      vi.mocked(practiceService.checkAnswer).mockResolvedValue(mockResult)

      const questionData = { question: 'Test', options: ['A', 'B'], correctAnswer: 'B' }
      const request = new NextRequest('http://localhost/api/practice', {
        method: 'POST',
        body: JSON.stringify({
          action: 'check',
          questionId: 1,
          questionData,
          userAnswer: 'B',
        }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockResult)
    })

    it('should explain answer', async () => {
      const mockResult = { explanation: 'Because...' }
      vi.mocked(practiceService.explainAnswer).mockResolvedValue(mockResult)

      const questionData = { question: 'Test', options: ['A', 'B'], correctAnswer: 'B' }
      const request = new NextRequest('http://localhost/api/practice', {
        method: 'POST',
        body: JSON.stringify({
          action: 'explain',
          questionId: 1,
          questionData,
          userAnswer: 'A',
        }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockResult)
    })

    it('should return error for invalid action', async () => {
      const request = new NextRequest('http://localhost/api/practice', {
        method: 'POST',
        body: JSON.stringify({ action: 'invalid' }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(data.success).toBe(false)
      expect(data.error).toBe('Invalid action')
      expect(response.status).toBe(400)
    })

    it('should return error for unauthenticated user', async () => {
      const errorResponse = new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401 }
      )
      vi.mocked(getAuthenticatedUser).mockResolvedValue({ user: null, error: errorResponse })

      const request = new NextRequest('http://localhost/api/practice', {
        method: 'POST',
        body: JSON.stringify({ action: 'generate' }),
      })
      const response = await POST(request)

      expect(response.status).toBe(401)
    })

    it('should handle errors gracefully', async () => {
      vi.mocked(practiceService.generateQuestion).mockRejectedValue(new Error('Service Error'))

      const request = new NextRequest('http://localhost/api/practice', {
        method: 'POST',
        body: JSON.stringify({ action: 'generate' }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(data.success).toBe(false)
      expect(response.status).toBe(500)
    })
  })
})
