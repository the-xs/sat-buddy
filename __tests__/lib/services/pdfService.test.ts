import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockGenerateWithFallback, mockUploadFile, mockDeleteFile } = vi.hoisted(() => ({
  mockGenerateWithFallback: vi.fn(),
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
      update: vi.fn().mockResolvedValue({ id: 1, name: 'Test' }),
      findUnique: vi.fn().mockResolvedValue({ id: 1, name: 'Test', modules: [] }),
    },
    module: {
      create: vi.fn().mockResolvedValue({ id: 1, section: 'Math', moduleNumber: 1, questionSets: [] }),
    },
    question: {
      update: vi.fn().mockResolvedValue({ id: 1 }),
    },
    answerVerificationLog: {
      create: vi.fn().mockResolvedValue({ id: 1 }),
    },
  },
}))

vi.mock('@/lib/gemini/client', () => ({
  generateWithFallback: mockGenerateWithFallback,
  uploadFile: mockUploadFile,
  deleteFile: mockDeleteFile,
  createPartFromUri: vi.fn((uri: string, mimeType: string) => ({ fileData: { fileUri: uri, mimeType } })),
  createUserContent: vi.fn((parts: unknown[]) => parts),
}))

vi.mock('@/lib/gemini/config', () => ({
  getVerificationBatchSize: vi.fn(() => 5),
  isVerificationEnabled: vi.fn(() => false),
}))

import { pdfService } from '@/lib/services/pdfService'

interface ParsedQuestionSet {
  passage?: string | null
  passageIntro?: string | null
  hasFigure?: boolean
  figureDescription?: string | null
  pageNumber?: number | null
  boundingBox?: number[] | null
  figureData?: string
  questions: {
    questionNumber: number
    questionType: string
    questionText: string
    correctAnswer: string
    optionA?: string
    optionB?: string
    optionC?: string
    optionD?: string
  }[]
}

interface ParsedModule {
  section: string
  moduleNumber: number
  timeLimit?: number | null
  questionSets: ParsedQuestionSet[]
}

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
      if ('timestamp' in progress) {
        expect(progress.timestamp).toBeGreaterThanOrEqual(before)
        expect(progress.timestamp).toBeLessThanOrEqual(after)
      }
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

      vi.setSystemTime(now + 11 * 60 * 1000)

      pdfService.updateProgress('new-file.pdf', 'Starting', 0)

      const oldProgress = pdfService.getProgress('old-file.pdf')

      expect(oldProgress.status).toBe('starting')
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
      if ('timestamp' in progress) {
        expect(progress.timestamp).toBeGreaterThanOrEqual(before)
      }
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
            questions: [{ questionNumber: 1, questionText: 'Test Q', questionType: 'MultipleChoice', correctAnswer: 'A' }],
          },
        ],
      }

      mockGenerateWithFallback.mockResolvedValue({
        text: JSON.stringify(responseData),
        modelUsed: 'gemini-2.5-pro',
        tierUsed: 'standard',
      })

      const result = await pdfService.extractModuleWithGemini(mockFile, mockConfig)

      expect(result.questionSets).toHaveLength(1)
      expect(result.moduleTimeLimit).toBe(35)
    })

    it('should handle JSON wrapped in code fences', async () => {
      const responseData = { questionSets: [{ questions: [{ questionNumber: 1, questionText: 'Q', questionType: 'MC', correctAnswer: 'A' }] }] }

      mockGenerateWithFallback.mockResolvedValue({
        text: '```json\n' + JSON.stringify(responseData) + '\n```',
        modelUsed: 'gemini-2.5-pro',
        tierUsed: 'standard',
      })

      const result = await pdfService.extractModuleWithGemini(mockFile, mockConfig)

      expect(result.questionSets).toHaveLength(1)
    })

    it('should handle plain code fences', async () => {
      const responseData = { questionSets: [] }

      mockGenerateWithFallback.mockResolvedValue({
        text: '```\n' + JSON.stringify(responseData) + '\n```',
        modelUsed: 'gemini-2.5-pro',
        tierUsed: 'standard',
      })

      const result = await pdfService.extractModuleWithGemini(mockFile, mockConfig)

      expect(result.questionSets).toEqual([])
    })

    it('should return empty questionSets on parse error', async () => {
      mockGenerateWithFallback.mockResolvedValue({
        text: 'invalid json {{{',
        modelUsed: 'gemini-2.5-pro',
        tierUsed: 'standard',
      })

      const result = await pdfService.extractModuleWithGemini(mockFile, mockConfig)

      expect(result.questionSets).toEqual([])
    })

    it('should return empty questionSets on empty response', async () => {
      mockGenerateWithFallback.mockResolvedValue({
        text: '',
        modelUsed: 'gemini-2.5-pro',
        tierUsed: 'standard',
      })

      const result = await pdfService.extractModuleWithGemini(mockFile, mockConfig)

      expect(result.questionSets).toEqual([])
    })

    it('should handle Gemini API error', async () => {
      mockGenerateWithFallback.mockRejectedValue(new Error('API Error'))

      const result = await pdfService.extractModuleWithGemini(mockFile, mockConfig)

      expect(result.questionSets).toEqual([])
    })
  })

  describe('extractFiguresFromPdf', () => {
    const createMockQuestion = (num: number) => ({
      questionNumber: num,
      questionType: 'MultipleChoice' as const,
      questionText: `Question ${num}`,
      correctAnswer: 'A',
    })

    it('should skip when no figures to extract', async () => {
      const modules: ParsedModule[] = [
        {
          section: 'Math',
          moduleNumber: 1,
          questionSets: [{ hasFigure: false, questions: [createMockQuestion(1)] }],
        },
      ]

      await pdfService.extractFiguresFromPdf('test', '/tmp/test.pdf', modules as never)

      expect(true).toBe(true)
    })

    it('should skip figures without page number', async () => {
      const modules: ParsedModule[] = [
        {
          section: 'Math',
          moduleNumber: 1,
          questionSets: [
            {
              hasFigure: true,
              pageNumber: null,
              boundingBox: [100, 100, 500, 500],
              questions: [createMockQuestion(1)],
            },
          ],
        },
      ]

      await pdfService.extractFiguresFromPdf('test', '/tmp/test.pdf', modules as never)

      expect(modules[0].questionSets[0].figureData).toBeUndefined()
    })

    it('should skip figures without complete bounding box', async () => {
      const modules: ParsedModule[] = [
        {
          section: 'Math',
          moduleNumber: 1,
          questionSets: [
            {
              hasFigure: true,
              pageNumber: 1,
              boundingBox: [100, 100],
              questions: [createMockQuestion(1)],
            },
          ],
        },
      ]

      await pdfService.extractFiguresFromPdf('test', '/tmp/test.pdf', modules as never)

      expect(modules[0].questionSets[0].figureData).toBeUndefined()
    })

    it('should extract figures when valid figure data exists', async () => {
      const modules: ParsedModule[] = [
        {
          section: 'Math',
          moduleNumber: 1,
          questionSets: [
            {
              hasFigure: true,
              pageNumber: 1,
              boundingBox: [100, 100, 500, 500],
              questions: [createMockQuestion(1)],
            },
          ],
        },
      ]

      await pdfService.extractFiguresFromPdf('test', '/tmp/test.pdf', modules as never)

      expect(modules[0].questionSets[0].figureData).toBe(Buffer.from('mock-image').toString('base64'))
    })

    it('should extract figures from multiple pages', async () => {
      const modules: ParsedModule[] = [
        {
          section: 'Math',
          moduleNumber: 1,
          questionSets: [
            {
              hasFigure: true,
              pageNumber: 1,
              boundingBox: [100, 100, 500, 500],
              questions: [createMockQuestion(1)],
            },
            {
              hasFigure: true,
              pageNumber: 2,
              boundingBox: [200, 200, 600, 600],
              questions: [createMockQuestion(2)],
            },
          ],
        },
      ]

      await pdfService.extractFiguresFromPdf('test', '/tmp/test.pdf', modules as never)

      expect(modules[0].questionSets[0].figureData).toBeDefined()
      expect(modules[0].questionSets[1].figureData).toBeDefined()
    })

    it('should handle figures across multiple modules', async () => {
      const modules: ParsedModule[] = [
        {
          section: 'Math',
          moduleNumber: 1,
          questionSets: [
            {
              hasFigure: true,
              pageNumber: 1,
              boundingBox: [100, 100, 500, 500],
              questions: [createMockQuestion(1)],
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
              questions: [createMockQuestion(1)],
            },
          ],
        },
      ]

      await pdfService.extractFiguresFromPdf('test', '/tmp/test.pdf', modules as never)

      expect(modules[0].questionSets[0].figureData).toBeDefined()
      expect(modules[1].questionSets[0].figureData).toBeDefined()
    })

    it('should handle PDF read errors gracefully', async () => {
      const fs = (await import('fs/promises')).default
      ;(fs.readFile as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('File read error'))

      const modules: ParsedModule[] = [
        {
          section: 'Math',
          moduleNumber: 1,
          questionSets: [
            {
              hasFigure: true,
              pageNumber: 1,
              boundingBox: [100, 100, 500, 500],
              questions: [createMockQuestion(1)],
            },
          ],
        },
      ]

      await pdfService.extractFiguresFromPdf('test', '/tmp/test.pdf', modules as never)
    })
  })

  describe('ensureDirectories', () => {
    it('should create PDF and figures directories', async () => {
      const fs = await import('fs/promises')

      await pdfService.ensureDirectories()

      expect(fs.default.mkdir).toHaveBeenCalledTimes(2)
    })
  })

  describe('saveModule', () => {
    it('should save module data to database', async () => {
      const prisma = (await import('@/lib/prisma')).default
      ;(prisma.module.create as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: 1,
        section: 'Math',
        moduleNumber: 1,
        questionSets: []
      })

      const moduleData = {
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
      }

      const result = await pdfService.saveModule(1, moduleData as never)

      expect(prisma.module.create).toHaveBeenCalled()
      expect(result).toEqual({ id: 1, section: 'Math', moduleNumber: 1, questionSets: [] })
    })
  })

  describe('verifyModule', () => {
    it('should call generateWithFallback for each batch when enabled', async () => {
      mockGenerateWithFallback.mockResolvedValue({
        text: JSON.stringify({
          verifications: [{
            questionNumber: 1,
            wasCorrect: true,
            verifiedAnswer: 'A',
            explanation: 'Correct',
            confidence: 'high',
          }],
        }),
        modelUsed: 'gemini-2.5-pro',
        tierUsed: 'standard',
      })

      const dbModule = {
        section: 'Math',
        moduleNumber: 1,
        questionSets: [{
          passage: null,
          hasFigure: false,
          figureCaption: null,
          questions: [{
            id: 100,
            questionNumber: 1,
            questionType: 'MultipleChoice',
            questionText: 'Test',
            optionA: 'A',
            optionB: 'B',
            optionC: 'C',
            optionD: 'D',
            correctAnswer: 'A',
          }],
        }],
      }

      await pdfService.verifyModule('test', 1, 'Test', dbModule)

      expect(mockGenerateWithFallback).toHaveBeenCalledWith(
        'answerVerification',
        expect.any(String),
        expect.objectContaining({ startTier: 'premium' })
      )
    })
  })

  describe('verifyBatch multimodal content', () => {
    beforeEach(() => {
      mockGenerateWithFallback.mockReset();
      // Return non-empty verifications to avoid triggering retry logic
      mockGenerateWithFallback.mockResolvedValue({
        text: JSON.stringify({ verifications: [
          { questionNumber: 1, wasCorrect: true, verifiedAnswer: 'A', explanation: 'Correct', confidence: 'high' },
          { questionNumber: 2, wasCorrect: true, verifiedAnswer: 'B', explanation: 'Correct', confidence: 'high' },
          { questionNumber: 3, wasCorrect: true, verifiedAnswer: 'C', explanation: 'Correct', confidence: 'high' },
        ] }),
        modelUsed: 'gemini-2.5-flash',
        tierUsed: 'standard'
      });
    });

    it('should send multimodal content with deduped images when batch has figures', async () => {
      // Call verifyBatch directly with test data
      // Using dummy fileId, testId, etc. since DB operations are mocked
      await pdfService.verifyBatch(
        'test-file-id',
        1,  // testId
        'Test',  // testName
        'ReadingWriting',  // section
        1,  // moduleNumber
        [
          {
            questionId: 1, setIndex: 0, qIndex: 0, questionNumber: 1,
            questionText: 'Q1', questionType: 'MultipleChoice',
            optionA: 'A', optionB: 'B', optionC: 'C', optionD: 'D',
            correctAnswer: 'A', passage: null,
            hasFigure: true, figureCaption: 'Graph 1', figureData: 'base64img1'
          },
          {
            questionId: 2, setIndex: 0, qIndex: 1, questionNumber: 2,
            questionText: 'Q2', questionType: 'MultipleChoice',
            optionA: 'A', optionB: 'B', optionC: 'C', optionD: 'D',
            correctAnswer: 'B', passage: null,
            hasFigure: true, figureCaption: 'Graph 1', figureData: 'base64img1' // Same set
          },
          {
            questionId: 3, setIndex: 1, qIndex: 0, questionNumber: 3,
            questionText: 'Q3', questionType: 'MultipleChoice',
            optionA: 'A', optionB: 'B', optionC: 'C', optionD: 'D',
            correctAnswer: 'C', passage: null,
            hasFigure: true, figureCaption: 'Graph 2', figureData: 'base64img2' // Different set
          }
        ]
      );

      // Assert generateWithFallback was called
      expect(mockGenerateWithFallback).toHaveBeenCalledTimes(1);
      
      // Get the contents argument (2nd arg)
      const contents = mockGenerateWithFallback.mock.calls[0][1];
      
      // Should be an array (multimodal) with 2 images + 1 text (deduped from 3 questions to 2 sets)
      expect(Array.isArray(contents)).toBe(true);
      expect(contents).toHaveLength(3); // 2 images + 1 text
      
      // First two should be inlineData (images)
      expect(contents[0]).toHaveProperty('inlineData');
      expect(contents[0].inlineData.mimeType).toBe('image/png');
      expect(contents[1]).toHaveProperty('inlineData');
      
      // Last should be text
      expect(contents[2]).toHaveProperty('text');
    });

    it('should use plain string content when batch has no figures', async () => {
      await pdfService.verifyBatch(
        'test-file-id', 1, 'Test', 'Math', 1,
        [{
          questionId: 1, setIndex: 0, qIndex: 0, questionNumber: 1,
          questionText: 'Q1', questionType: 'MultipleChoice',
          optionA: 'A', optionB: 'B', optionC: 'C', optionD: 'D',
          correctAnswer: 'A', passage: null,
          hasFigure: false, figureCaption: null, figureData: null
        }]
      );

      const contents = mockGenerateWithFallback.mock.calls[0][1];
      
      // Should be a plain string for text-only batches
      expect(typeof contents).toBe('string');
    });

    it('should sort images by minimum question number in set', async () => {
      await pdfService.verifyBatch(
        'test-file-id', 1, 'Test', 'ReadingWriting', 1,
        [
          // Set 1 has Q5 (higher number)
          { questionId: 1, setIndex: 1, qIndex: 0, questionNumber: 5, questionText: 'Q5', questionType: 'MultipleChoice', optionA: 'A', optionB: 'B', optionC: 'C', optionD: 'D', correctAnswer: 'A', passage: null, hasFigure: true, figureCaption: null, figureData: 'imgB' },
          // Set 0 has Q1 (lower number) - should be first image
          { questionId: 2, setIndex: 0, qIndex: 0, questionNumber: 1, questionText: 'Q1', questionType: 'MultipleChoice', optionA: 'A', optionB: 'B', optionC: 'C', optionD: 'D', correctAnswer: 'B', passage: null, hasFigure: true, figureCaption: null, figureData: 'imgA' },
        ]
      );

      const contents = mockGenerateWithFallback.mock.calls[0][1];
      
      // imgA (Q1, set 0) should be first, imgB (Q5, set 1) should be second
      expect(contents[0].inlineData.data).toBe('imgA');
      expect(contents[1].inlineData.data).toBe('imgB');
    });
  });

  describe('buildVerificationPrompt with imageIndex', () => {
    it('should include imageIndex in questionsJson when mapping provided', () => {
      const batch = [{
        questionId: 1, setIndex: 0, qIndex: 0, questionNumber: 1,
        questionText: 'Test question', questionType: 'MultipleChoice',
        optionA: 'A', optionB: 'B', optionC: 'C', optionD: 'D',
        correctAnswer: 'A', passage: null,
        hasFigure: true, figureCaption: 'A bar graph', figureData: 'base64data'
      }];
      const mapping = new Map([[0, 1]]);
      
      const prompt = pdfService.buildVerificationPrompt(batch, 'ReadingWriting', mapping);
      
      expect(prompt).toContain('"imageIndex": 1');
      expect(prompt).toContain('"hasFigure": true');
      expect(prompt).toContain('READ THE LEGEND FIRST');
    });

    it('should set imageIndex to null when setIndex not in mapping', () => {
      const batch = [{
        questionId: 1, setIndex: 0, qIndex: 0, questionNumber: 1,
        questionText: 'Test question', questionType: 'MultipleChoice',
        optionA: 'A', optionB: 'B', optionC: 'C', optionD: 'D',
        correctAnswer: 'A', passage: null,
        hasFigure: true, figureCaption: 'A bar graph', figureData: null  // No image data
      }];
      const mapping = new Map<number, number>();  // Empty mapping
      
      const prompt = pdfService.buildVerificationPrompt(batch, 'ReadingWriting', mapping);
      
      expect(prompt).toContain('"imageIndex": null');
      expect(prompt).toContain('"hasFigure": true');
    });

    it('should include graph instructions in prompt', () => {
      const batch = [{
        questionId: 1, setIndex: 0, qIndex: 0, questionNumber: 1,
        questionText: 'Test', questionType: 'MultipleChoice',
        optionA: 'A', optionB: 'B', optionC: 'C', optionD: 'D',
        correctAnswer: 'A', passage: null,
        hasFigure: false, figureCaption: null, figureData: null
      }];
      
      const prompt = pdfService.buildVerificationPrompt(batch, 'Math', undefined);
      
      expect(prompt).toContain('FOR QUESTIONS WITH FIGURES');
      expect(prompt).toContain('READ THE LEGEND FIRST');
    });
  });
})
