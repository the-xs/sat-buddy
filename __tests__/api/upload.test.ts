import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// Use vi.hoisted for mocks that need to be available during vi.mock hoisting
const { mockUpdateProgress, mockGetProgress, mockParsePDF } = vi.hoisted(() => ({
  mockUpdateProgress: vi.fn(),
  mockGetProgress: vi.fn(),
  mockParsePDF: vi.fn(),
}))

vi.mock('@/lib/services/pdfService', () => ({
  pdfService: {
    updateProgress: mockUpdateProgress,
    getProgress: mockGetProgress,
    parsePDF: mockParsePDF,
  },
}))

vi.mock('fs/promises', () => ({
  default: {
    writeFile: vi.fn().mockResolvedValue(undefined),
    mkdir: vi.fn().mockResolvedValue(undefined),
  },
  writeFile: vi.fn().mockResolvedValue(undefined),
  mkdir: vi.fn().mockResolvedValue(undefined),
}))

import { GET, POST } from '@/app/api/upload/route'

describe('API /api/upload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST /api/upload', () => {
    it('should return error when no file provided', async () => {
      const formData = new FormData()

      const request = new NextRequest('http://localhost/api/upload', {
        method: 'POST',
        body: formData,
      })

      const response = await POST(request)
      const data = await response.json()

      expect(data.success).toBe(false)
      expect(data.error).toBe('No file provided')
      expect(response.status).toBe(400)
    })

    it('should upload PDF and return fileId', async () => {
      mockParsePDF.mockResolvedValue({ id: 1 })

      // Create a mock File object with arrayBuffer method
      const mockFile = {
        name: 'test.pdf',
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
      }

      // Create a mock FormData that returns the mock file
      const mockFormData = {
        get: vi.fn().mockReturnValue(mockFile),
      }

      const request = {
        formData: vi.fn().mockResolvedValue(mockFormData),
      } as unknown as NextRequest

      const response = await POST(request)
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.fileId).toBeDefined()
      expect(data.fileId).toContain('test.pdf')
      expect(data.message).toBe('Upload started, poll for progress')
      expect(mockUpdateProgress).toHaveBeenCalled()
    })

    it('should handle POST errors gracefully', async () => {
      // Create a request that will fail when trying to get formData
      const request = {
        formData: vi.fn().mockRejectedValue(new Error('FormData error')),
      } as unknown as NextRequest

      const response = await POST(request)
      const data = await response.json()

      expect(data.success).toBe(false)
      expect(data.error).toBe('Failed to upload PDF')
      expect(response.status).toBe(500)
    })
  })

  describe('GET /api/upload', () => {
    it('should return progress for valid filename', async () => {
      const mockProgress = {
        status: 'Processing',
        progress: 50,
        logs: ['Step 1 complete'],
        result: null,
      }
      mockGetProgress.mockReturnValue(mockProgress)

      const request = new NextRequest('http://localhost/api/upload?file=test.pdf')
      const response = await GET(request)
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.data.status).toBe('Processing')
      expect(data.data.progress).toBe(50)
      expect(data.data.logs).toEqual(['Step 1 complete'])
    })

    it('should return error when filename is missing', async () => {
      const request = new NextRequest('http://localhost/api/upload')
      const response = await GET(request)
      const data = await response.json()

      expect(data.success).toBe(false)
      expect(data.error).toBe('Filename required')
      expect(response.status).toBe(400)
    })

    it('should return default progress for unknown file', async () => {
      mockGetProgress.mockReturnValue({
        status: 'starting',
        progress: 0,
        logs: [],
        result: null,
      })

      const request = new NextRequest('http://localhost/api/upload?file=unknown.pdf')
      const response = await GET(request)
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.data.status).toBe('starting')
      expect(data.data.progress).toBe(0)
    })

    it('should include result when processing is complete', async () => {
      const mockResult = { id: 1, name: 'Test SAT' }
      mockGetProgress.mockReturnValue({
        status: 'Complete',
        progress: 100,
        logs: ['Done'],
        result: mockResult,
      })

      const request = new NextRequest('http://localhost/api/upload?file=test.pdf')
      const response = await GET(request)
      const data = await response.json()

      expect(data.success).toBe(true)
      expect(data.data.result).toEqual(mockResult)
    })

    it('should handle errors gracefully', async () => {
      mockGetProgress.mockImplementation(() => {
        throw new Error('Service error')
      })

      const request = new NextRequest('http://localhost/api/upload?file=test.pdf')
      const response = await GET(request)
      const data = await response.json()

      expect(data.success).toBe(false)
      expect(data.error).toBe('Failed to get progress')
      expect(response.status).toBe(500)
    })
  })
})
