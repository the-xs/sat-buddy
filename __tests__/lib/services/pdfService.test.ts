import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Use vi.hoisted for all mocks that need to be available during vi.mock hoisting
const { mockGenerateContent, mockUploadFile, mockDeleteFile } = vi.hoisted(() => ({
  mockGenerateContent: vi.fn(),
  mockUploadFile: vi.fn(),
  mockDeleteFile: vi.fn(),
}))

vi.mock('fs/promises', () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    copyFile: vi.fn().mockResolvedValue(undefined),
    unlink: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue(Buffer.from('mock-pdf-content')),
  },
}))

vi.mock('sharp', () => ({
  default: vi.fn(() => ({
    metadata: vi.fn().mockResolvedValue({ width: 1000, height: 1000 }),
    extract: vi.fn().mockReturnThis(),
    png: vi.fn().mockReturnThis(),
    toBuffer: vi.fn().mockResolvedValue(Buffer.from('mock-image')),
  })),
}))

vi.mock('pdf-to-img', () => ({
  pdf: vi.fn().mockResolvedValue({
    [Symbol.asyncIterator]: async function* () {
      yield Buffer.from('page1-image')
      yield Buffer.from('page2-image')
    },
  }),
}))

vi.mock('@/lib/prisma', () => ({
  default: {
    sATTest: {
      create: vi.fn().mockResolvedValue({ id: 1, name: 'Test', modules: [] }),
    },
  },
}))

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return {
        generateContent: mockGenerateContent,
      }
    }
  },
}))

vi.mock('@google/generative-ai/server', () => ({
  GoogleAIFileManager: class {
    uploadFile = mockUploadFile
    deleteFile = mockDeleteFile
  },
}))

// Import after all mocks are set up
import { pdfService } from '@/lib/services/pdfService'

describe('pdfService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('getProgress', () => {
    it('should return default progress for unknown file', () => {
      const progress = pdfService.getProgress('unknown-file.pdf')

      expect(progress).toEqual({
        status: 'starting',
        progress: 0,
        logs: [],
        result: null,
      })
    })

    it('should return stored progress for known file', () => {
      pdfService.updateProgress('test-file.pdf', 'Processing', 50)

      const progress = pdfService.getProgress('test-file.pdf')

      expect(progress.status).toBe('Processing')
      expect(progress.progress).toBe(50)
    })
  })

  describe('updateProgress', () => {
    it('should store progress with timestamp', () => {
      const before = Date.now()
      pdfService.updateProgress('test.pdf', 'Processing', 25)
      const after = Date.now()

      const progress = pdfService.getProgress('test.pdf')

      expect(progress.status).toBe('Processing')
      expect(progress.progress).toBe(25)
      expect(progress.timestamp).toBeGreaterThanOrEqual(before)
      expect(progress.timestamp).toBeLessThanOrEqual(after)
    })

    it('should store result when provided', () => {
      const result = { id: 1, name: 'Test' }
      pdfService.updateProgress('test.pdf', 'Complete', 100, result)

      const progress = pdfService.getProgress('test.pdf')

      expect(progress.result).toEqual(result)
    })

    it('should preserve existing logs', () => {
      pdfService.updateProgress('test.pdf', 'Starting', 0)
      pdfService.addLog('test.pdf', 'Log message 1')
      pdfService.updateProgress('test.pdf', 'Processing', 50)

      const progress = pdfService.getProgress('test.pdf')

      expect(progress.logs).toHaveLength(1)
      expect(progress.logs[0]).toContain('Log message 1')
    })

    it('should clean up old entries (older than 10 minutes)', () => {
      vi.useFakeTimers()
      const now = Date.now()
      vi.setSystemTime(now)

      pdfService.updateProgress('old-file.pdf', 'Complete', 100)

      // Advance time by 11 minutes
      vi.setSystemTime(now + 11 * 60 * 1000)

      // Trigger cleanup by updating another file
      pdfService.updateProgress('new-file.pdf', 'Starting', 0)

      const oldProgress = pdfService.getProgress('old-file.pdf')

      expect(oldProgress.status).toBe('starting') // Default, meaning it was cleaned up
    })
  })

  describe('addLog', () => {
    it('should add timestamped log message', () => {
      pdfService.updateProgress('test.pdf', 'Processing', 50)
      pdfService.addLog('test.pdf', 'Processing module 1')

      const progress = pdfService.getProgress('test.pdf')

      expect(progress.logs).toHaveLength(1)
      expect(progress.logs[0]).toMatch(/\[\d{1,2}:\d{2}:\d{2}.*\] Processing module 1/)
    })

    it('should do nothing for unknown file', () => {
      pdfService.addLog('unknown.pdf', 'Test message')

      const progress = pdfService.getProgress('unknown.pdf')

      expect(progress.logs).toHaveLength(0)
    })

    it('should update timestamp when adding log', () => {
      pdfService.updateProgress('test.pdf', 'Processing', 50)
      const before = Date.now()

      pdfService.addLog('test.pdf', 'New log')

      const progress = pdfService.getProgress('test.pdf')
      expect(progress.timestamp).toBeGreaterThanOrEqual(before)
    })
  })

  describe('extractModuleWithGemini', () => {
    const mockFile = {
      uri: 'gemini://test',
      mimeType: 'application/pdf',
      name: 'files/test',
    }

    const mockConfig = {
      section: 'Math',
      moduleNumber: 1,
      promptSuffix: 'Math Module 1',
    }

    it('should extract module data from Gemini response', async () => {
      const responseData = {
        testName: 'Test',
        moduleTimeLimit: 35,
        questionSets: [
          {
            passage: null,
            hasFigure: false,
            questions: [{ questionNumber: 1, questionText: 'Test Q' }],
          },
        ],
      }

      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(responseData),
        },
      })

      const result = await pdfService.extractModuleWithGemini(mockFile, mockConfig)

      expect(result.questionSets).toHaveLength(1)
      expect(result.moduleTimeLimit).toBe(35)
    })

    it('should handle JSON wrapped in code fences', async () => {
      const responseData = { questionSets: [{ questions: [{ questionNumber: 1 }] }] }

      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => '```json\n' + JSON.stringify(responseData) + '\n```',
        },
      })

      const result = await pdfService.extractModuleWithGemini(mockFile, mockConfig)

      expect(result.questionSets).toHaveLength(1)
    })

    it('should handle plain code fences', async () => {
      const responseData = { questionSets: [] }

      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => '```\n' + JSON.stringify(responseData) + '\n```',
        },
      })

      const result = await pdfService.extractModuleWithGemini(mockFile, mockConfig)

      expect(result.questionSets).toEqual([])
    })

    it('should return empty questionSets on parse error', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => 'invalid json {{{',
        },
      })

      const result = await pdfService.extractModuleWithGemini(mockFile, mockConfig)

      expect(result.questionSets).toEqual([])
    })

    it('should return empty on no response', async () => {
      mockGenerateContent.mockResolvedValue({
        response: null,
      })

      const result = await pdfService.extractModuleWithGemini(mockFile, mockConfig)

      expect(result.questions).toEqual([])
    })

    it('should return empty on empty response text', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => '',
        },
      })

      const result = await pdfService.extractModuleWithGemini(mockFile, mockConfig)

      expect(result.questions).toEqual([])
    })

    it('should handle Gemini API error', async () => {
      mockGenerateContent.mockRejectedValue(new Error('API Error'))

      const result = await pdfService.extractModuleWithGemini(mockFile, mockConfig)

      expect(result.questionSets).toEqual([])
    })
  })

  describe('extractFiguresFromPdf', () => {
    it('should skip when no figures to extract', async () => {
      const modules = [
        {
          section: 'Math',
          moduleNumber: 1,
          questionSets: [{ hasFigure: false, questions: [] }],
        },
      ]

      await pdfService.extractFiguresFromPdf('test', '/tmp/test.pdf', modules)

      // No error thrown, function completes successfully
      expect(true).toBe(true)
    })

    it('should skip figures without page number', async () => {
      const modules = [
        {
          section: 'Math',
          moduleNumber: 1,
          questionSets: [
            {
              hasFigure: true,
              pageNumber: null,
              boundingBox: [100, 100, 500, 500],
              questions: [{ questionNumber: 1 }],
            },
          ],
        },
      ]

      await pdfService.extractFiguresFromPdf('test', '/tmp/test.pdf', modules)

      expect(modules[0].questionSets[0].figureData).toBeUndefined()
    })

    it('should skip figures without complete bounding box', async () => {
      const modules = [
        {
          section: 'Math',
          moduleNumber: 1,
          questionSets: [
            {
              hasFigure: true,
              pageNumber: 1,
              boundingBox: [100, 100], // Incomplete
              questions: [{ questionNumber: 1 }],
            },
          ],
        },
      ]

      await pdfService.extractFiguresFromPdf('test', '/tmp/test.pdf', modules)

      expect(modules[0].questionSets[0].figureData).toBeUndefined()
    })

    it('should extract figures when valid figure data exists', async () => {
      const modules = [
        {
          section: 'Math',
          moduleNumber: 1,
          questionSets: [
            {
              hasFigure: true,
              pageNumber: 1,
              boundingBox: [100, 100, 500, 500],
              questions: [{ questionNumber: 1 }],
            },
          ],
        },
      ]

      await pdfService.extractFiguresFromPdf('test', '/tmp/test.pdf', modules)

      // The mock sharp returns 'mock-image' as buffer, which gets base64 encoded
      expect(modules[0].questionSets[0].figureData).toBe(Buffer.from('mock-image').toString('base64'))
    })

    it('should extract figures from multiple pages', async () => {
      const modules = [
        {
          section: 'Math',
          moduleNumber: 1,
          questionSets: [
            {
              hasFigure: true,
              pageNumber: 1,
              boundingBox: [100, 100, 500, 500],
              questions: [{ questionNumber: 1 }],
            },
            {
              hasFigure: true,
              pageNumber: 2,
              boundingBox: [200, 200, 600, 600],
              questions: [{ questionNumber: 2 }],
            },
          ],
        },
      ]

      await pdfService.extractFiguresFromPdf('test', '/tmp/test.pdf', modules)

      expect(modules[0].questionSets[0].figureData).toBeDefined()
      expect(modules[0].questionSets[1].figureData).toBeDefined()
    })

    it('should handle figures across multiple modules', async () => {
      const modules = [
        {
          section: 'Math',
          moduleNumber: 1,
          questionSets: [
            {
              hasFigure: true,
              pageNumber: 1,
              boundingBox: [100, 100, 500, 500],
              questions: [{ questionNumber: 1 }],
            },
          ],
        },
        {
          section: 'Math',
          moduleNumber: 2,
          questionSets: [
            {
              hasFigure: true,
              pageNumber: 2,
              boundingBox: [150, 150, 550, 550],
              questions: [{ questionNumber: 1 }],
            },
          ],
        },
      ]

      await pdfService.extractFiguresFromPdf('test', '/tmp/test.pdf', modules)

      expect(modules[0].questionSets[0].figureData).toBeDefined()
      expect(modules[1].questionSets[0].figureData).toBeDefined()
    })

    it('should handle errors during figure extraction gracefully', async () => {
      // Mock sharp to throw an error
      const sharp = (await import('sharp')).default as ReturnType<typeof vi.fn>
      sharp.mockImplementationOnce(() => {
        throw new Error('Sharp error')
      })

      const modules = [
        {
          section: 'Math',
          moduleNumber: 1,
          questionSets: [
            {
              hasFigure: true,
              pageNumber: 1,
              boundingBox: [100, 100, 500, 500],
              questions: [{ questionNumber: 1 }],
            },
          ],
        },
      ]

      // Should not throw, just log error
      await pdfService.extractFiguresFromPdf('test', '/tmp/test.pdf', modules)

      // figureData should be undefined since extraction failed
      expect(modules[0].questionSets[0].figureData).toBeUndefined()
    })

    it('should handle PDF read errors gracefully', async () => {
      // Mock fs.readFile to throw an error
      const fs = (await import('fs/promises')).default
      ;(fs.readFile as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('File read error'))

      const modules = [
        {
          section: 'Math',
          moduleNumber: 1,
          questionSets: [
            {
              hasFigure: true,
              pageNumber: 1,
              boundingBox: [100, 100, 500, 500],
              questions: [{ questionNumber: 1 }],
            },
          ],
        },
      ]

      // Should not throw, just log error
      await pdfService.extractFiguresFromPdf('test', '/tmp/test.pdf', modules)
    })
  })

  describe('ensureDirectories', () => {
    it('should create PDF and figures directories', async () => {
      const fs = await import('fs/promises')

      await pdfService.ensureDirectories()

      expect(fs.default.mkdir).toHaveBeenCalledTimes(2)
    })
  })

  describe('storeInDatabase', () => {
    it('should store parsed data in database', async () => {
      const prisma = (await import('@/lib/prisma')).default

      const parsedData = {
        testName: 'SAT Practice Test 1',
        modules: [
          {
            section: 'Math',
            moduleNumber: 1,
            timeLimit: 35,
            questionSets: [
              {
                passage: null,
                passageIntro: null,
                hasFigure: false,
                pageNumber: null,
                boundingBox: null,
                figureDescription: null,
                questions: [
                  {
                    questionNumber: 1,
                    questionType: 'MultipleChoice',
                    questionText: 'What is 2+2?',
                    optionA: '3',
                    optionB: '4',
                    optionC: '5',
                    optionD: '6',
                    correctAnswer: 'B',
                    topic: 'Algebra',
                    difficulty: 'Easy',
                    explanation: 'Basic addition',
                  },
                ],
              },
            ],
          },
        ],
      }

      const result = await pdfService.storeInDatabase(parsedData, 'test.pdf', 'original.pdf')

      expect(prisma.sATTest.create).toHaveBeenCalled()
      expect(result).toEqual({ id: 1, name: 'Test', modules: [] })
    })

    it('should use default test name if not provided', async () => {
      const prisma = (await import('@/lib/prisma')).default

      const parsedData = {
        testName: '',
        modules: [],
      }

      await pdfService.storeInDatabase(parsedData, 'test.pdf', 'original.pdf')

      const createCall = (prisma.sATTest.create as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(createCall.data.name).toContain('SAT Practice Test')
    })
  })
})
