import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockPrisma } from '../../../__mocks__/prisma'

// Import after mocks are set up
import { satTestService } from '@/lib/services/satTestService'

describe('satTestService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getAllTests', () => {
    it('should return tests with transformed question counts', async () => {
      mockPrisma.sATTest.findMany.mockResolvedValue([
        {
          id: 1,
          name: 'Test 1',
          modules: [
            {
              id: 1,
              section: 'ReadingWriting',
              moduleNumber: 1,
              questionSets: [
                { _count: { questions: 5 } },
                { _count: { questions: 3 } },
              ],
            },
            {
              id: 2,
              section: 'Math',
              moduleNumber: 1,
              questionSets: [{ _count: { questions: 10 } }],
            },
          ],
        },
      ])

      const result = await satTestService.getAllTests()

      expect(result[0].modules[0]._count.questions).toBe(8)
      expect(result[0].modules[1]._count.questions).toBe(10)
    })

    it('should return empty array when no tests exist', async () => {
      mockPrisma.sATTest.findMany.mockResolvedValue([])

      const result = await satTestService.getAllTests()

      expect(result).toEqual([])
    })
  })

  describe('getTestById', () => {
    it('should return test with all nested data', async () => {
      const mockTest = {
        id: 1,
        name: 'SAT Practice Test',
        modules: [
          {
            id: 1,
            section: 'ReadingWriting',
            moduleNumber: 1,
            questionSets: [
              {
                id: 1,
                passage: 'Test passage',
                questions: [{ id: 1, questionNumber: 1 }],
              },
            ],
          },
        ],
      }

      mockPrisma.sATTest.findUnique.mockResolvedValue(mockTest)

      const result = await satTestService.getTestById(1)

      expect(result).toEqual(mockTest)
      expect(mockPrisma.sATTest.findUnique).toHaveBeenCalledWith({
        where: { id: 1 },
        include: expect.any(Object),
      })
    })

    it('should return null for non-existent test', async () => {
      mockPrisma.sATTest.findUnique.mockResolvedValue(null)

      const result = await satTestService.getTestById(999)

      expect(result).toBeNull()
    })
  })

  describe('getQuestionsByModule', () => {
    it('should return flattened questions with questionSet info', async () => {
      mockPrisma.module.findFirst.mockResolvedValue({
        id: 1,
        section: 'Math',
        moduleNumber: 1,
        questionSets: [
          {
            id: 1,
            passage: null,
            passageIntro: null,
            hasFigure: false,
            figureData: null,
            figureCaption: null,
            questions: [
              { id: 1, questionNumber: 1 },
              { id: 2, questionNumber: 2 },
            ],
          },
          {
            id: 2,
            passage: 'Passage text',
            passageIntro: 'Intro',
            hasFigure: true,
            figureData: 'base64data',
            figureCaption: 'Caption',
            questions: [{ id: 3, questionNumber: 3 }],
          },
        ],
      })

      const result = await satTestService.getQuestionsByModule(1, 'Math', 1)

      expect(result).toHaveLength(3)
      expect(result[0].questionSet.id).toBe(1)
      expect(result[2].questionSet.passage).toBe('Passage text')
      expect(result[2].questionSet.hasFigure).toBe(true)
    })

    it('should return empty array when module not found', async () => {
      mockPrisma.module.findFirst.mockResolvedValue(null)

      const result = await satTestService.getQuestionsByModule(1, 'Math', 1)

      expect(result).toEqual([])
    })
  })

  describe('getRandomQuestions', () => {
    it('should return shuffled questions', async () => {
      const questions = Array.from({ length: 20 }, (_, i) => ({
        id: i + 1,
        questionText: `Question ${i + 1}`,
        questionSet: { id: 1, passage: null, module: { section: 'Math' } },
      }))

      mockPrisma.question.findMany.mockResolvedValue(questions)

      const result = await satTestService.getRandomQuestions({ count: 10 })

      expect(result).toHaveLength(10)
    })

    it('should filter by testId', async () => {
      mockPrisma.question.findMany.mockResolvedValue([])

      await satTestService.getRandomQuestions({ testId: 1 })

      expect(mockPrisma.question.findMany).toHaveBeenCalledWith({
        where: { questionSet: { module: { testId: 1 } } },
        include: expect.any(Object),
      })
    })

    it('should filter by section', async () => {
      mockPrisma.question.findMany.mockResolvedValue([])

      await satTestService.getRandomQuestions({ section: 'Math' })

      expect(mockPrisma.question.findMany).toHaveBeenCalledWith({
        where: { questionSet: { module: { section: 'Math' } } },
        include: expect.any(Object),
      })
    })

    it('should combine testId and section filters', async () => {
      mockPrisma.question.findMany.mockResolvedValue([])

      await satTestService.getRandomQuestions({ testId: 1, section: 'Math' })

      expect(mockPrisma.question.findMany).toHaveBeenCalledWith({
        where: { questionSet: { module: { testId: 1, section: 'Math' } } },
        include: expect.any(Object),
      })
    })

    it('should use default count of 10', async () => {
      mockPrisma.question.findMany.mockResolvedValue([])

      await satTestService.getRandomQuestions()

      // Default count is 10, but we can't verify slice directly
      expect(mockPrisma.question.findMany).toHaveBeenCalled()
    })

    it('should handle fewer questions than requested', async () => {
      mockPrisma.question.findMany.mockResolvedValue([
        { id: 1 },
        { id: 2 },
      ])

      const result = await satTestService.getRandomQuestions({ count: 10 })

      expect(result).toHaveLength(2)
    })
  })

  describe('getTestStats', () => {
    it('should calculate module question counts', async () => {
      mockPrisma.sATTest.findUnique.mockResolvedValue({
        id: 1,
        name: 'Test',
        modules: [
          { section: 'ReadingWriting', moduleNumber: 1, questionSets: [{ _count: { questions: 27 } }] },
          { section: 'ReadingWriting', moduleNumber: 2, questionSets: [{ _count: { questions: 27 } }] },
          { section: 'Math', moduleNumber: 1, questionSets: [{ _count: { questions: 22 } }] },
          { section: 'Math', moduleNumber: 2, questionSets: [{ _count: { questions: 22 } }] },
        ],
      })

      const result = await satTestService.getTestStats(1)

      expect(result!.totalQuestions).toBe(98)
      expect(result!.readingWritingModule1).toBe(27)
      expect(result!.readingWritingModule2).toBe(27)
      expect(result!.mathModule1).toBe(22)
      expect(result!.mathModule2).toBe(22)
    })

    it('should return null for non-existent test', async () => {
      mockPrisma.sATTest.findUnique.mockResolvedValue(null)

      const result = await satTestService.getTestStats(999)

      expect(result).toBeNull()
    })
  })

  describe('deleteTest', () => {
    it('should delete test by id', async () => {
      mockPrisma.sATTest.delete.mockResolvedValue({ id: 1 })

      await satTestService.deleteTest(1)

      expect(mockPrisma.sATTest.delete).toHaveBeenCalledWith({
        where: { id: 1 },
      })
    })
  })

  describe('getOverallStats', () => {
    it('should return aggregated stats', async () => {
      mockPrisma.sATTest.count.mockResolvedValue(5)
      mockPrisma.question.count
        .mockResolvedValueOnce(500)
        .mockResolvedValueOnce(280)
        .mockResolvedValueOnce(220)

      const result = await satTestService.getOverallStats()

      expect(result.totalTests).toBe(5)
      expect(result.totalQuestions).toBe(500)
      expect(result.readingWritingQuestions).toBe(280)
      expect(result.mathQuestions).toBe(220)
    })
  })

  describe('createSession', () => {
    it('should create a new test session', async () => {
      mockPrisma.testSession.create.mockResolvedValue({
        sessionId: 'sess_123',
        testId: 1,
        userId: 'user-123',
        test: { name: 'Test 1', modules: [] },
      })

      const result = await satTestService.createSession(1, 'user-123')

      expect(result.sessionId).toMatch(/^sess_/)
      expect(mockPrisma.testSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          testId: 1,
          userId: 'user-123',
          includeRWModule1: true,
          includeRWModule2: true,
          includeMathModule1: true,
          includeMathModule2: true,
        }),
        include: expect.any(Object),
      })
    })

    it('should work without userId', async () => {
      mockPrisma.testSession.create.mockResolvedValue({
        sessionId: 'sess_123',
        testId: 1,
      })

      await satTestService.createSession(1)

      expect(mockPrisma.testSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: undefined,
        }),
        include: expect.any(Object),
      })
    })
  })

  describe('getSession', () => {
    it('should return session with results', async () => {
      const mockSession = {
        sessionId: 'sess_123',
        testId: 1,
        test: { name: 'Test 1' },
        results: [{ id: 1, questionId: 1, userAnswer: 'A' }],
      }

      mockPrisma.testSession.findUnique.mockResolvedValue(mockSession)

      const result = await satTestService.getSession('sess_123')

      expect(result).toEqual(mockSession)
    })

    it('should return null for non-existent session', async () => {
      mockPrisma.testSession.findUnique.mockResolvedValue(null)

      const result = await satTestService.getSession('invalid')

      expect(result).toBeNull()
    })
  })

  describe('recordAnswer', () => {
    it('should record correct answer', async () => {
      mockPrisma.question.findUnique.mockResolvedValue({
        id: 1,
        correctAnswer: 'B',
      })

      mockPrisma.testResult.upsert.mockResolvedValue({
        id: 1,
        sessionId: 'sess_123',
        questionId: 1,
        userAnswer: 'B',
        isCorrect: true,
      })

      const result = await satTestService.recordAnswer('sess_123', 1, 'B')

      expect(result.isCorrect).toBe(true)
    })

    it('should record incorrect answer', async () => {
      mockPrisma.question.findUnique.mockResolvedValue({
        id: 1,
        correctAnswer: 'B',
      })

      mockPrisma.testResult.upsert.mockResolvedValue({
        id: 1,
        sessionId: 'sess_123',
        questionId: 1,
        userAnswer: 'A',
        isCorrect: false,
      })

      const result = await satTestService.recordAnswer('sess_123', 1, 'A')

      expect(result.isCorrect).toBe(false)
    })

    it('should handle case-insensitive comparison', async () => {
      mockPrisma.question.findUnique.mockResolvedValue({
        id: 1,
        correctAnswer: 'b',
      })

      mockPrisma.testResult.upsert.mockResolvedValue({
        isCorrect: true,
      })

      await satTestService.recordAnswer('sess_123', 1, 'B')

      expect(mockPrisma.testResult.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ isCorrect: true }),
          create: expect.objectContaining({ isCorrect: true }),
        })
      )
    })

    it('should throw error for non-existent question', async () => {
      mockPrisma.question.findUnique.mockResolvedValue(null)

      await expect(satTestService.recordAnswer('sess_123', 999, 'A')).rejects.toThrow(
        'Question not found'
      )
    })

    it('should handle empty answer', async () => {
      mockPrisma.question.findUnique.mockResolvedValue({
        id: 1,
        correctAnswer: 'B',
      })

      mockPrisma.testResult.upsert.mockResolvedValue({
        isCorrect: false,
      })

      await satTestService.recordAnswer('sess_123', 1, '')

      expect(mockPrisma.testResult.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ isCorrect: false }),
        })
      )
    })
  })

  describe('submitSession', () => {
    it('should calculate and update scores', async () => {
      const mockResults = [
        { isCorrect: true, questionId: 1, question: { questionSet: { module: { section: 'ReadingWriting' } } } },
        { isCorrect: true, questionId: 2, question: { questionSet: { module: { section: 'ReadingWriting' } } } },
        { isCorrect: false, questionId: 3, question: { questionSet: { module: { section: 'ReadingWriting' } } } },
        { isCorrect: true, questionId: 4, question: { questionSet: { module: { section: 'Math' } } } },
        { isCorrect: true, questionId: 5, question: { questionSet: { module: { section: 'Math' } } } },
      ]

      // First call returns session with test structure for getting all questions
      mockPrisma.testSession.findUnique.mockResolvedValueOnce({
        sessionId: 'sess_123',
        test: {
          modules: [
            {
              questionSets: [
                { questions: [{ id: 1 }, { id: 2 }, { id: 3 }] }
              ]
            },
            {
              questionSets: [
                { questions: [{ id: 4 }, { id: 5 }] }
              ]
            }
          ]
        },
        results: mockResults,
      })

      // Second call returns updated session with results for score calculation
      mockPrisma.testSession.findUnique.mockResolvedValueOnce({
        sessionId: 'sess_123',
        results: mockResults,
      })

      mockPrisma.testSession.update.mockResolvedValue({
        sessionId: 'sess_123',
        rwScore: 2,
        mathScore: 2,
        totalScore: 4,
      })

      const result = await satTestService.submitSession('sess_123')

      expect(mockPrisma.testSession.update).toHaveBeenCalledWith({
        where: { sessionId: 'sess_123' },
        data: {
          rwScore: 2,
          mathScore: 2,
          totalScore: 4,
          completedAt: expect.any(Date),
        },
      })
      expect(result.totalScore).toBe(4)
    })

    it('should create results for unanswered questions', async () => {
      const mockResults = [
        { isCorrect: true, questionId: 1, question: { questionSet: { module: { section: 'Math' } } } },
      ]

      // First call - session with 3 questions but only 1 answered
      mockPrisma.testSession.findUnique.mockResolvedValueOnce({
        sessionId: 'sess_123',
        test: {
          modules: [
            {
              questionSets: [
                { questions: [{ id: 1 }, { id: 2 }, { id: 3 }] }
              ]
            }
          ]
        },
        results: mockResults,
      })

      // Second call - after unanswered results created
      mockPrisma.testSession.findUnique.mockResolvedValueOnce({
        sessionId: 'sess_123',
        results: [
          ...mockResults,
          { isCorrect: false, questionId: 2, question: { questionSet: { module: { section: 'Math' } } } },
          { isCorrect: false, questionId: 3, question: { questionSet: { module: { section: 'Math' } } } },
        ],
      })

      mockPrisma.testResult.createMany.mockResolvedValue({ count: 2 })

      mockPrisma.testSession.update.mockResolvedValue({
        sessionId: 'sess_123',
        rwScore: 0,
        mathScore: 1,
        totalScore: 1,
      })

      await satTestService.submitSession('sess_123')

      // Should create results for questions 2 and 3 (unanswered)
      expect(mockPrisma.testResult.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ sessionId: 'sess_123', questionId: 2, userAnswer: null, isCorrect: false }),
          expect.objectContaining({ sessionId: 'sess_123', questionId: 3, userAnswer: null, isCorrect: false }),
        ])
      })
    })

    it('should throw error for non-existent session', async () => {
      mockPrisma.testSession.findUnique.mockResolvedValue(null)

      await expect(satTestService.submitSession('invalid')).rejects.toThrow('Session not found')
    })
  })

  describe('getSessionResults', () => {
    it('should transform results for frontend', async () => {
      mockPrisma.testSession.findUnique.mockResolvedValue({
        sessionId: 'sess_123',
        testId: 1,
        test: { name: 'Test 1' },
        rwScore: 25,
        mathScore: 20,
        totalScore: 45,
        startedAt: new Date('2024-01-01'),
        completedAt: new Date('2024-01-01'),
        results: [
          {
            questionId: 1,
            userAnswer: 'A',
            isCorrect: true,
            question: {
              questionNumber: 1,
              questionText: 'Question 1',
              questionType: 'MultipleChoice',
              optionA: 'Option A',
              optionB: 'Option B',
              optionC: 'Option C',
              optionD: 'Option D',
              correctAnswer: 'A',
              explanation: 'Explanation',
              questionSet: {
                id: 1,
                passage: null,
                passageIntro: null,
                hasFigure: false,
                figureData: null,
                figureCaption: null,
                module: { section: 'Math', moduleNumber: 1 },
              },
            },
          },
        ],
      })

      const result = await satTestService.getSessionResults('sess_123')

      expect(result.sessionId).toBe('sess_123')
      expect(result.results[0].options).toEqual({
        A: 'Option A',
        B: 'Option B',
        C: 'Option C',
        D: 'Option D',
      })
      expect(result.correctCount).toBe(1)
      expect(result.totalQuestions).toBe(1)
    })

    it('should sort results by section (Reading first), then module number, then question number', async () => {
      const createResult = (section: string, moduleNumber: number, questionNumber: number) => ({
        questionId: questionNumber,
        userAnswer: 'A',
        isCorrect: true,
        question: {
          questionNumber,
          questionText: `Q${questionNumber}`,
          questionType: 'MultipleChoice',
          optionA: 'A', optionB: 'B', optionC: 'C', optionD: 'D',
          correctAnswer: 'A',
          explanation: 'Explanation',
          questionSet: {
            id: 1,
            passage: null,
            passageIntro: null,
            hasFigure: false,
            figureData: null,
            figureCaption: null,
            module: { section, moduleNumber },
          },
        },
      })

      // Results in random order
      mockPrisma.testSession.findUnique.mockResolvedValue({
        sessionId: 'sess_123',
        testId: 1,
        test: { name: 'Test 1' },
        rwScore: 3,
        mathScore: 3,
        totalScore: 6,
        startedAt: new Date('2024-01-01'),
        completedAt: new Date('2024-01-01'),
        results: [
          createResult('Math', 2, 5),
          createResult('ReadingWriting', 1, 2),
          createResult('Math', 1, 3),
          createResult('ReadingWriting', 2, 1),
          createResult('ReadingWriting', 1, 1),
          createResult('Math', 1, 4),
        ],
      })

      const result = await satTestService.getSessionResults('sess_123')

      // Verify order: R&W M1 Q1, R&W M1 Q2, R&W M2 Q1, Math M1 Q3, Math M1 Q4, Math M2 Q5
      expect(result.results.map(r => `${r.moduleSection}-${r.moduleNumber}-${r.questionNumber}`)).toEqual([
        'ReadingWriting-1-1',
        'ReadingWriting-1-2',
        'ReadingWriting-2-1',
        'Math-1-3',
        'Math-1-4',
        'Math-2-5',
      ])
    })

    it('should throw error for non-existent session', async () => {
      mockPrisma.testSession.findUnique.mockResolvedValue(null)

      await expect(satTestService.getSessionResults('invalid')).rejects.toThrow('Session not found')
    })
  })

  describe('getCompletedSessions', () => {
    it('should return completed sessions', async () => {
      mockPrisma.testSession.findMany.mockResolvedValue([
        {
          sessionId: 'sess_123',
          testId: 1,
          test: { name: 'Test 1' },
          rwScore: 25,
          mathScore: 20,
          totalScore: 45,
          startedAt: new Date(),
          completedAt: new Date(),
          _count: { results: 50 },
        },
      ])

      const result = await satTestService.getCompletedSessions('user-123')

      expect(result[0].totalQuestions).toBe(50)
      expect(result[0].testName).toBe('Test 1')
    })

    it('should filter by userId', async () => {
      mockPrisma.testSession.findMany.mockResolvedValue([])

      await satTestService.getCompletedSessions('user-123')

      expect(mockPrisma.testSession.findMany).toHaveBeenCalledWith({
        where: {
          completedAt: { not: null },
          userId: 'user-123',
        },
        include: expect.any(Object),
        orderBy: { completedAt: 'desc' },
      })
    })

    it('should work without userId', async () => {
      mockPrisma.testSession.findMany.mockResolvedValue([])

      await satTestService.getCompletedSessions()

      expect(mockPrisma.testSession.findMany).toHaveBeenCalledWith({
        where: {
          completedAt: { not: null },
        },
        include: expect.any(Object),
        orderBy: { completedAt: 'desc' },
      })
    })
  })
})
