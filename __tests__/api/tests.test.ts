import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Mock the services
vi.mock('@/lib/services/satTestService', () => ({
  satTestService: {
    getAllTests: vi.fn(),
    getTestById: vi.fn(),
    deleteTest: vi.fn(),
  },
}))

import { satTestService } from '@/lib/services/satTestService'
import { GET } from '@/app/api/tests/route'
import { GET as GETById, DELETE } from '@/app/api/tests/[id]/route'

describe('API /api/tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/tests', () => {
    it('should return all tests successfully', async () => {
      const mockTests = [
        { id: 1, name: 'Test 1', modules: [] },
        { id: 2, name: 'Test 2', modules: [] },
      ]

      vi.mocked(satTestService.getAllTests).mockResolvedValue(mockTests)

      const response = await GET()
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockTests)
    })

    it('should handle errors gracefully', async () => {
      vi.mocked(satTestService.getAllTests).mockRejectedValue(new Error('DB Error'))

      const response = await GET()
      const data = await response.json()

      expect(data.success).toBe(false)
      expect(data.error).toBe('Failed to fetch tests')
      expect(response.status).toBe(500)
    })
  })

  describe('GET /api/tests/[id]', () => {
    it('should return single test successfully', async () => {
      const mockTest = { id: 1, name: 'Test 1', modules: [] }

      vi.mocked(satTestService.getTestById).mockResolvedValue(mockTest)

      const request = new NextRequest('http://localhost/api/tests/1')
      const response = await GETById(request, { params: { id: '1' } })
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockTest)
    })

    it('should return 404 for non-existent test', async () => {
      vi.mocked(satTestService.getTestById).mockResolvedValue(null)

      const request = new NextRequest('http://localhost/api/tests/999')
      const response = await GETById(request, { params: { id: '999' } })
      const data = await response.json()

      expect(data.success).toBe(false)
      expect(data.error).toBe('Test not found')
      expect(response.status).toBe(404)
    })

    it('should handle errors gracefully', async () => {
      vi.mocked(satTestService.getTestById).mockRejectedValue(new Error('DB Error'))

      const request = new NextRequest('http://localhost/api/tests/1')
      const response = await GETById(request, { params: { id: '1' } })
      const data = await response.json()

      expect(data.success).toBe(false)
      expect(response.status).toBe(500)
    })
  })

  describe('DELETE /api/tests/[id]', () => {
    it('should delete test successfully', async () => {
      vi.mocked(satTestService.deleteTest).mockResolvedValue({ id: 1 })

      const request = new NextRequest('http://localhost/api/tests/1', { method: 'DELETE' })
      const response = await DELETE(request, { params: { id: '1' } })
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.message).toBe('Test deleted')
      expect(satTestService.deleteTest).toHaveBeenCalledWith(1)
    })

    it('should handle errors gracefully', async () => {
      vi.mocked(satTestService.deleteTest).mockRejectedValue(new Error('DB Error'))

      const request = new NextRequest('http://localhost/api/tests/1', { method: 'DELETE' })
      const response = await DELETE(request, { params: { id: '1' } })
      const data = await response.json()

      expect(data.success).toBe(false)
      expect(response.status).toBe(500)
    })
  })
})
