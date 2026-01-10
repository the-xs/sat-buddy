import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock auth first
vi.mock('@/lib/auth', () => ({
  getAuthenticatedUser: vi.fn(),
}))

// Mock services
vi.mock('@/lib/services/satTestService', () => ({
  satTestService: {
    createSession: vi.fn(),
    getCompletedSessions: vi.fn(),
    getSessionResults: vi.fn(),
    recordAnswer: vi.fn(),
    submitSession: vi.fn(),
  },
}))

import { getAuthenticatedUser } from '@/lib/auth'
import { satTestService } from '@/lib/services/satTestService'
import { GET, POST } from '@/app/api/sessions/route'
import { GET as GETById, POST as POSTById } from '@/app/api/sessions/[id]/route'

describe('API /api/sessions', () => {
  const mockUser = { id: 'user-123', email: 'test@example.com' }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getAuthenticatedUser).mockResolvedValue({ user: mockUser, error: null })
  })

  describe('POST /api/sessions', () => {
    it('should create a new session', async () => {
      vi.mocked(satTestService.createSession).mockResolvedValue({
        sessionId: 'sess_123',
        testId: 1,
      })

      const request = new NextRequest('http://localhost/api/sessions', {
        method: 'POST',
        body: JSON.stringify({ testId: 1 }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.data.sessionId).toBe('sess_123')
      expect(satTestService.createSession).toHaveBeenCalledWith(1, 'user-123')
    })

    it('should return error when testId is missing', async () => {
      const request = new NextRequest('http://localhost/api/sessions', {
        method: 'POST',
        body: JSON.stringify({}),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(data.success).toBe(false)
      expect(data.error).toBe('testId is required')
      expect(response.status).toBe(400)
    })

    it('should return error for unauthenticated user', async () => {
      const errorResponse = new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401 }
      )
      vi.mocked(getAuthenticatedUser).mockResolvedValue({ user: null, error: errorResponse })

      const request = new NextRequest('http://localhost/api/sessions', {
        method: 'POST',
        body: JSON.stringify({ testId: 1 }),
      })
      const response = await POST(request)

      expect(response.status).toBe(401)
    })

    it('should handle errors gracefully', async () => {
      vi.mocked(satTestService.createSession).mockRejectedValue(new Error('DB Error'))

      const request = new NextRequest('http://localhost/api/sessions', {
        method: 'POST',
        body: JSON.stringify({ testId: 1 }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(data.success).toBe(false)
      expect(response.status).toBe(500)
    })
  })

  describe('GET /api/sessions', () => {
    it('should return completed sessions', async () => {
      const mockSessions = [
        { sessionId: 'sess_1', testName: 'Test 1', totalScore: 80 },
        { sessionId: 'sess_2', testName: 'Test 2', totalScore: 90 },
      ]
      vi.mocked(satTestService.getCompletedSessions).mockResolvedValue(mockSessions)

      const response = await GET()
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockSessions)
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

    it('should handle errors gracefully', async () => {
      vi.mocked(satTestService.getCompletedSessions).mockRejectedValue(new Error('DB Error'))

      const response = await GET()
      const data = await response.json()

      expect(data.success).toBe(false)
      expect(response.status).toBe(500)
    })
  })

  describe('GET /api/sessions/[id]', () => {
    it('should return session results', async () => {
      const mockResults = {
        sessionId: 'sess_123',
        totalScore: 85,
        results: [],
      }
      vi.mocked(satTestService.getSessionResults).mockResolvedValue(mockResults)

      const request = new NextRequest('http://localhost/api/sessions/sess_123')
      const response = await GETById(request, { params: { id: 'sess_123' } })
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockResults)
    })

    it('should handle errors gracefully', async () => {
      vi.mocked(satTestService.getSessionResults).mockRejectedValue(new Error('Not found'))

      const request = new NextRequest('http://localhost/api/sessions/invalid')
      const response = await GETById(request, { params: { id: 'invalid' } })
      const data = await response.json()

      expect(data.success).toBe(false)
      expect(response.status).toBe(500)
    })
  })

  describe('POST /api/sessions/[id]', () => {
    it('should record answer', async () => {
      const mockResult = { id: 1, isCorrect: true }
      vi.mocked(satTestService.recordAnswer).mockResolvedValue(mockResult)

      const request = new NextRequest('http://localhost/api/sessions/sess_123', {
        method: 'POST',
        body: JSON.stringify({ action: 'answer', questionId: 1, answer: 'B' }),
      })
      const response = await POSTById(request, { params: { id: 'sess_123' } })
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockResult)
      expect(satTestService.recordAnswer).toHaveBeenCalledWith('sess_123', 1, 'B')
    })

    it('should submit session', async () => {
      const mockResult = { sessionId: 'sess_123', totalScore: 85 }
      vi.mocked(satTestService.submitSession).mockResolvedValue(mockResult)

      const request = new NextRequest('http://localhost/api/sessions/sess_123', {
        method: 'POST',
        body: JSON.stringify({ action: 'submit' }),
      })
      const response = await POSTById(request, { params: { id: 'sess_123' } })
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockResult)
      expect(satTestService.submitSession).toHaveBeenCalledWith('sess_123')
    })

    it('should return error for invalid action', async () => {
      const request = new NextRequest('http://localhost/api/sessions/sess_123', {
        method: 'POST',
        body: JSON.stringify({ action: 'invalid' }),
      })
      const response = await POSTById(request, { params: { id: 'sess_123' } })
      const data = await response.json()

      expect(data.success).toBe(false)
      expect(data.error).toBe('Invalid action')
      expect(response.status).toBe(400)
    })

    it('should handle errors gracefully', async () => {
      vi.mocked(satTestService.recordAnswer).mockRejectedValue(new Error('DB Error'))

      const request = new NextRequest('http://localhost/api/sessions/sess_123', {
        method: 'POST',
        body: JSON.stringify({ action: 'answer', questionId: 1, answer: 'B' }),
      })
      const response = await POSTById(request, { params: { id: 'sess_123' } })
      const data = await response.json()

      expect(data.success).toBe(false)
      expect(response.status).toBe(500)
    })
  })
})
