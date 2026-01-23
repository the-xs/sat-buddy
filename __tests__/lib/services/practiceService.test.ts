import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockPrisma, mockGenerateWithFallback } = vi.hoisted(() => ({
  mockPrisma: {
    practiceQuestion: {
      create: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
  },
  mockGenerateWithFallback: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  default: mockPrisma,
}))

vi.mock('@/lib/gemini/client', () => ({
  generateWithFallback: mockGenerateWithFallback,
}))

// Import after mocks are set up
import { practiceService } from '@/lib/services/practiceService'

describe('practiceService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('generateQuestion', () => {
    it('should generate a question and save to database', async () => {
      const mockQuestionData = {
        category: 'Math',
        topic: 'Heart of Algebra',
        difficulty: 'Medium',
        passage: null,
        question: 'If $2x + 3 = 11$, what is $x$?',
        options: ['2', '3', '4', '5'],
        correctAnswer: '4',
        correctLetter: 'C',
        explanation: 'Solve: $2x = 8$, so $x = 4$',
      }

      mockGenerateWithFallback.mockResolvedValue({
        text: JSON.stringify(mockQuestionData),
        modelUsed: 'gemini-2.5-pro',
        tierUsed: 'standard',
      })

      mockPrisma.practiceQuestion.create.mockResolvedValue({
        id: 1,
        ...mockQuestionData,
        questionText: mockQuestionData.question,
        options: JSON.stringify(mockQuestionData.options),
      })

      const result = await practiceService.generateQuestion('math', 'user-123')

      expect(result.id).toBe(1)
      expect(result.category).toBe('Math')
      expect(result.question).toBe('If $2x + 3 = 11$, what is $x$?')
      expect(mockPrisma.practiceQuestion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          category: 'Math',
          topic: 'Heart of Algebra',
        }),
      })
    })

    it('should handle JSON wrapped in code fences', async () => {
      const mockQuestionData = {
        category: 'Reading',
        topic: 'Information and Ideas',
        difficulty: 'Easy',
        passage: 'Some text',
        question: 'What is the main idea?',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 'A',
        correctLetter: 'A',
        explanation: 'The main idea is...',
      }

      mockGenerateWithFallback.mockResolvedValue({
        text: JSON.stringify(mockQuestionData),
        modelUsed: 'gemini-2.5-pro',
        tierUsed: 'standard',
      })

      mockPrisma.practiceQuestion.create.mockResolvedValue({
        id: 2,
        ...mockQuestionData,
        questionText: mockQuestionData.question,
        options: JSON.stringify(mockQuestionData.options),
      })

      const result = await practiceService.generateQuestion('reading')

      expect(result.category).toBe('Reading')
    })

    it('should handle plain code fences', async () => {
      const mockQuestionData = {
        category: 'Writing',
        topic: 'Standard English Conventions',
        difficulty: 'Hard',
        passage: null,
        question: 'Which correction is needed?',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 'B',
        correctLetter: 'B',
        explanation: 'Grammar rule...',
      }

      mockGenerateWithFallback.mockResolvedValue({
        text: '```json\n' + JSON.stringify(mockQuestionData) + '\n```',
        modelUsed: 'gemini-2.5-pro',
        tierUsed: 'standard',
      })

      mockPrisma.practiceQuestion.create.mockResolvedValue({
        id: 3,
        ...mockQuestionData,
        questionText: mockQuestionData.question,
        options: JSON.stringify(mockQuestionData.options),
      })

      const result = await practiceService.generateQuestion('writing')

      expect(result.category).toBe('Writing')
    })

    it('should handle missing optional fields with defaults', async () => {
      const mockQuestionData = {
        category: 'Math',
        question: 'Solve for x',
        options: ['1', '2', '3', '4'],
        correctAnswer: '1',
        correctLetter: 'A',
        explanation: 'Explanation',
      }

      mockGenerateWithFallback.mockResolvedValue({
        text: JSON.stringify(mockQuestionData),
        modelUsed: 'gemini-2.5-pro',
        tierUsed: 'standard',
      })

      mockPrisma.practiceQuestion.create.mockResolvedValue({
        id: 5,
        ...mockQuestionData,
        topic: 'General',
        difficulty: 'Medium',
        passage: null,
        questionText: mockQuestionData.question,
        options: JSON.stringify(mockQuestionData.options),
      })

      await practiceService.generateQuestion()

      expect(mockPrisma.practiceQuestion.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          topic: 'General',
          difficulty: 'Medium',
          passage: null,
        }),
      })
    })
  })

  describe('checkAnswer', () => {
    it('should return correct when answer matches correctAnswer', async () => {
      const questionData = {
        category: 'Math',
        topic: 'Algebra',
        difficulty: 'Medium',
        passage: null,
        question: 'What is 2+2?',
        options: ['3', '4', '5', '6'],
        correctAnswer: '4',
        correctLetter: 'B',
        explanation: '2+2=4',
      }

      mockPrisma.practiceQuestion.update.mockResolvedValue({})

      const result = await practiceService.checkAnswer(1, questionData, '4')

      expect(result.isCorrect).toBe(true)
      expect(result.correctAnswer).toBe('4')
    })

    it('should return correct when answer matches correctLetter', async () => {
      const questionData = {
        category: 'Math',
        topic: 'Algebra',
        difficulty: 'Medium',
        passage: null,
        question: 'What is 2+2?',
        options: ['3', '4', '5', '6'],
        correctAnswer: '4',
        correctLetter: 'B',
        explanation: '2+2=4',
      }

      mockPrisma.practiceQuestion.update.mockResolvedValue({})

      const result = await practiceService.checkAnswer(1, questionData, 'B')

      expect(result.isCorrect).toBe(true)
    })

    it('should return incorrect for wrong answer', async () => {
      const questionData = {
        category: 'Math',
        topic: 'Algebra',
        difficulty: 'Medium',
        passage: null,
        question: 'What is 2+2?',
        options: ['3', '4', '5', '6'],
        correctAnswer: '4',
        correctLetter: 'B',
        explanation: '2+2=4',
      }

      mockPrisma.practiceQuestion.update.mockResolvedValue({})

      const result = await practiceService.checkAnswer(1, questionData, '3')

      expect(result.isCorrect).toBe(false)
    })

    it('should update database when questionId is provided', async () => {
      const questionData = {
        category: 'Math',
        topic: 'Algebra',
        difficulty: 'Medium',
        passage: null,
        question: 'What is 2+2?',
        options: ['3', '4', '5', '6'],
        correctAnswer: '4',
        correctLetter: 'B',
        explanation: '2+2=4',
      }

      mockPrisma.practiceQuestion.update.mockResolvedValue({})

      await practiceService.checkAnswer(1, questionData, '4')

      expect(mockPrisma.practiceQuestion.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: {
          userAnswer: '4',
          isCorrect: true,
          answeredAt: expect.any(Date),
        },
      })
    })

    it('should not update database when questionId is null', async () => {
      const questionData = {
        category: 'Math',
        topic: 'Algebra',
        difficulty: 'Medium',
        passage: null,
        question: 'What is 2+2?',
        options: ['3', '4', '5', '6'],
        correctAnswer: '4',
        correctLetter: 'B',
        explanation: '2+2=4',
      }

      const result = await practiceService.checkAnswer(null, questionData, '4')

      expect(result.isCorrect).toBe(true)
      expect(mockPrisma.practiceQuestion.update).not.toHaveBeenCalled()
    })
  })

  describe('explainAnswer', () => {
    it('should generate explanation from Gemini', async () => {
      const questionData = {
        category: 'Math',
        topic: 'Algebra',
        difficulty: 'Medium',
        passage: null,
        question: 'What is 2+2?',
        options: ['3', '4', '5', '6'],
        correctAnswer: '4',
        correctLetter: 'B',
        explanation: '2+2=4',
      }

      mockGenerateWithFallback.mockResolvedValue({
        text: 'Detailed explanation of why B is correct...',
        modelUsed: 'gemini-2.5-pro',
        tierUsed: 'standard',
      })

      mockPrisma.practiceQuestion.update.mockResolvedValue({})

      const result = await practiceService.explainAnswer(1, questionData, 'A')

      expect(result.explanation).toBe('Detailed explanation of why B is correct...')
    })

    it('should save explanation to database when questionId provided', async () => {
      const questionData = {
        category: 'Math',
        topic: 'Algebra',
        difficulty: 'Medium',
        passage: null,
        question: 'What is 2+2?',
        options: ['3', '4', '5', '6'],
        correctAnswer: '4',
        correctLetter: 'B',
        explanation: '2+2=4',
      }

      mockGenerateWithFallback.mockResolvedValue({
        text: 'Explanation text',
        modelUsed: 'gemini-2.5-pro',
        tierUsed: 'standard',
      })

      mockPrisma.practiceQuestion.update.mockResolvedValue({})

      await practiceService.explainAnswer(1, questionData, 'A')

      expect(mockPrisma.practiceQuestion.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { explanation: 'Explanation text' },
      })
    })

    it('should not update database when questionId is null', async () => {
      const questionData = {
        category: 'Math',
        topic: 'Algebra',
        difficulty: 'Medium',
        passage: null,
        question: 'What is 2+2?',
        options: ['3', '4', '5', '6'],
        correctAnswer: '4',
        correctLetter: 'B',
        explanation: '2+2=4',
      }

      mockGenerateWithFallback.mockResolvedValue({
        text: 'Explanation text',
        modelUsed: 'gemini-2.5-pro',
        tierUsed: 'standard',
      })

      await practiceService.explainAnswer(null, questionData, 'A')

      expect(mockPrisma.practiceQuestion.update).not.toHaveBeenCalled()
    })
  })

  describe('getPracticeHistory', () => {
    it('should return parsed practice history', async () => {
      mockPrisma.practiceQuestion.findMany.mockResolvedValue([
        {
          id: 1,
          category: 'Math',
          topic: 'Algebra',
          options: '["A", "B", "C", "D"]',
          questionText: 'What is x?',
          isCorrect: true,
        },
        {
          id: 2,
          category: 'Reading',
          topic: 'Comprehension',
          options: '["1", "2", "3", "4"]',
          questionText: 'Main idea?',
          isCorrect: false,
        },
      ])

      const result = await practiceService.getPracticeHistory('user-123')

      expect(result).toHaveLength(2)
      expect(result[0].options).toEqual(['A', 'B', 'C', 'D'])
      expect(result[1].options).toEqual(['1', '2', '3', '4'])
    })

    it('should filter by userId', async () => {
      mockPrisma.practiceQuestion.findMany.mockResolvedValue([])

      await practiceService.getPracticeHistory('user-123', 25)

      expect(mockPrisma.practiceQuestion.findMany).toHaveBeenCalledWith({
        where: {
          answeredAt: { not: null },
          userId: 'user-123',
        },
        orderBy: { createdAt: 'desc' },
        take: 25,
      })
    })

    it('should use default limit of 50', async () => {
      mockPrisma.practiceQuestion.findMany.mockResolvedValue([])

      await practiceService.getPracticeHistory('user-123')

      expect(mockPrisma.practiceQuestion.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
        })
      )
    })

    it('should work without userId', async () => {
      mockPrisma.practiceQuestion.findMany.mockResolvedValue([])

      await practiceService.getPracticeHistory()

      expect(mockPrisma.practiceQuestion.findMany).toHaveBeenCalledWith({
        where: {
          answeredAt: { not: null },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      })
    })
  })

  describe('getPracticeStats', () => {
    it('should calculate stats correctly', async () => {
      mockPrisma.practiceQuestion.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(7) // correct

      mockPrisma.practiceQuestion.groupBy
        .mockResolvedValueOnce([
          { category: 'Math', _count: { id: 5 } },
          { category: 'Reading', _count: { id: 5 } },
        ])
        .mockResolvedValueOnce([
          { category: 'Math', _count: { id: 4 } },
          { category: 'Reading', _count: { id: 3 } },
        ])

      const result = await practiceService.getPracticeStats('user-123')

      expect(result.total).toBe(10)
      expect(result.correct).toBe(7)
      expect(result.wrong).toBe(3)
      expect(result.accuracy).toBe(70)
      expect(result.byCategory).toEqual([
        { category: 'Math', total: 5, correct: 4 },
        { category: 'Reading', total: 5, correct: 3 },
      ])
    })

    it('should handle zero total questions', async () => {
      mockPrisma.practiceQuestion.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)

      mockPrisma.practiceQuestion.groupBy
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])

      const result = await practiceService.getPracticeStats('user-123')

      expect(result.accuracy).toBe(0)
      expect(result.byCategory).toEqual([])
    })

    it('should handle category with no correct answers', async () => {
      mockPrisma.practiceQuestion.count
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(0)

      mockPrisma.practiceQuestion.groupBy
        .mockResolvedValueOnce([{ category: 'Math', _count: { id: 5 } }])
        .mockResolvedValueOnce([])

      const result = await practiceService.getPracticeStats('user-123')

      expect(result.byCategory).toEqual([{ category: 'Math', total: 5, correct: 0 }])
    })

    it('should work without userId', async () => {
      mockPrisma.practiceQuestion.count
        .mockResolvedValueOnce(0)
        .mockResolvedValueOnce(0)
      mockPrisma.practiceQuestion.groupBy
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])

      await practiceService.getPracticeStats()

      expect(mockPrisma.practiceQuestion.count).toHaveBeenCalledWith({
        where: { answeredAt: { not: null } },
      })
    })
  })
})
