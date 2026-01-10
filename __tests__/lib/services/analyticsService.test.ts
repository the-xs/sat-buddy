import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mockPrisma } from '../../../__mocks__/prisma'

// Import after mocks are set up
import { analyticsService } from '@/lib/services/analyticsService'

describe('analyticsService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getAnalytics', () => {
    it('should return empty data when no results exist', async () => {
      mockPrisma.testResult.findMany.mockResolvedValue([])
      mockPrisma.practiceQuestion.findMany.mockResolvedValue([])

      const result = await analyticsService.getAnalytics('user-123')

      expect(result.skillData).toHaveLength(6)
      expect(result.skillData.every(s => s.you === 0)).toBe(true)
      expect(result.topicMastery).toHaveLength(0)
    })

    it('should aggregate test results correctly', async () => {
      mockPrisma.testResult.findMany.mockResolvedValue([
        { question: { topic: 'Heart of Algebra' }, isCorrect: true },
        { question: { topic: 'Heart of Algebra' }, isCorrect: true },
        { question: { topic: 'Heart of Algebra' }, isCorrect: false },
        { question: { topic: 'Geometry' }, isCorrect: true },
      ])
      mockPrisma.practiceQuestion.findMany.mockResolvedValue([])

      const result = await analyticsService.getAnalytics('user-123')

      // Heart of Algebra maps to Algebra
      const algebra = result.skillData.find(s => s.subject === 'Algebra')
      expect(algebra).toBeDefined()
      expect(algebra!.you).toBe(67) // 2/3 = 67%

      const geometry = result.skillData.find(s => s.subject === 'Geometry')
      expect(geometry).toBeDefined()
      expect(geometry!.you).toBe(100) // 1/1 = 100%
    })

    it('should aggregate practice questions correctly', async () => {
      mockPrisma.testResult.findMany.mockResolvedValue([])
      mockPrisma.practiceQuestion.findMany.mockResolvedValue([
        { topic: 'Standard English Conventions', isCorrect: true },
        { topic: 'Standard English Conventions', isCorrect: false },
        { topic: 'Grammar', isCorrect: true },
      ])

      const result = await analyticsService.getAnalytics('user-123')

      // Both map to Grammar
      const grammar = result.skillData.find(s => s.subject === 'Grammar')
      expect(grammar).toBeDefined()
      expect(grammar!.you).toBe(67) // 2/3 = 67%
    })

    it('should combine test results and practice questions', async () => {
      mockPrisma.testResult.findMany.mockResolvedValue([
        { question: { topic: 'Reading Comprehension' }, isCorrect: true },
      ])
      mockPrisma.practiceQuestion.findMany.mockResolvedValue([
        { topic: 'Information and Ideas', isCorrect: true },
        { topic: 'Information and Ideas', isCorrect: false },
      ])

      const result = await analyticsService.getAnalytics('user-123')

      // Both map to Reading
      const reading = result.skillData.find(s => s.subject === 'Reading')
      expect(reading).toBeDefined()
      expect(reading!.you).toBe(67) // 2/3 = 67%
    })

    it('should calculate topic mastery status correctly', async () => {
      mockPrisma.testResult.findMany.mockResolvedValue([
        // Mastered topic (>= 85% with >= 5 questions)
        ...Array(6).fill({ question: { topic: 'Heart of Algebra' }, isCorrect: true }),
        { question: { topic: 'Heart of Algebra' }, isCorrect: false },
        // Improving topic (>= 60% with >= 5 questions) - 4/6 = 67%
        ...Array(4).fill({ question: { topic: 'Geometry' }, isCorrect: true }),
        ...Array(2).fill({ question: { topic: 'Geometry' }, isCorrect: false }),
        // Needs Focus topic (< 60% with >= 5 questions) - 2/7 = 29%
        ...Array(2).fill({ question: { topic: 'Grammar' }, isCorrect: true }),
        ...Array(5).fill({ question: { topic: 'Grammar' }, isCorrect: false }),
        // New topic (< 5 questions)
        { question: { topic: 'Vocabulary' }, isCorrect: true },
      ])
      mockPrisma.practiceQuestion.findMany.mockResolvedValue([])

      const result = await analyticsService.getAnalytics('user-123')

      const mastery = result.topicMastery
      const algebra = mastery.find(m => m.topic === 'Heart of Algebra')
      expect(algebra?.status).toBe('Mastered')
      expect(algebra?.progress).toBe(86) // 6/7 = 86%

      const geometry = mastery.find(m => m.topic === 'Geometry')
      expect(geometry?.status).toBe('Improving')
      expect(geometry?.progress).toBe(67) // 4/6 = 67%

      const grammar = mastery.find(m => m.topic === 'Grammar')
      expect(grammar?.status).toBe('Needs Focus')

      const vocabulary = mastery.find(m => m.topic === 'Vocabulary')
      expect(vocabulary?.status).toBe('Improving') // < 5 questions but > 0
    })

    it('should map unknown topics to Reading or Algebra based on name', async () => {
      mockPrisma.testResult.findMany.mockResolvedValue([
        { question: { topic: 'Some Math Topic' }, isCorrect: true },
        { question: { topic: 'Unknown Reading' }, isCorrect: true },
      ])
      mockPrisma.practiceQuestion.findMany.mockResolvedValue([])

      const result = await analyticsService.getAnalytics('user-123')

      // 'Some Math Topic' contains 'math' so maps to Algebra
      const algebra = result.skillData.find(s => s.subject === 'Algebra')
      expect(algebra!.you).toBe(100)

      // 'Unknown Reading' doesn't contain 'math' so maps to Reading
      const reading = result.skillData.find(s => s.subject === 'Reading')
      expect(reading!.you).toBe(100)
    })

    it('should handle Uncategorized topics', async () => {
      mockPrisma.testResult.findMany.mockResolvedValue([
        { question: { topic: null }, isCorrect: true },
        { question: { topic: undefined }, isCorrect: false },
      ])
      mockPrisma.practiceQuestion.findMany.mockResolvedValue([])

      const result = await analyticsService.getAnalytics('user-123')

      // Should have topic mastery entry for Uncategorized
      const uncategorized = result.topicMastery.find(m => m.topic === 'Uncategorized')
      expect(uncategorized).toBeDefined()
      expect(uncategorized!.progress).toBe(50) // 1/2 = 50%
    })

    it('should limit topicMastery to top 6 topics', async () => {
      const topics = ['Topic1', 'Topic2', 'Topic3', 'Topic4', 'Topic5', 'Topic6', 'Topic7', 'Topic8']
      mockPrisma.testResult.findMany.mockResolvedValue(
        topics.flatMap((topic, i) => [
          { question: { topic }, isCorrect: true },
          ...(i < 7 ? [{ question: { topic }, isCorrect: false }] : []),
        ])
      )
      mockPrisma.practiceQuestion.findMany.mockResolvedValue([])

      const result = await analyticsService.getAnalytics('user-123')

      expect(result.topicMastery.length).toBeLessThanOrEqual(6)
    })

    it('should sort topicMastery by progress descending', async () => {
      mockPrisma.testResult.findMany.mockResolvedValue([
        { question: { topic: 'Low' }, isCorrect: false },
        { question: { topic: 'Low' }, isCorrect: false },
        { question: { topic: 'Medium' }, isCorrect: true },
        { question: { topic: 'Medium' }, isCorrect: false },
        { question: { topic: 'High' }, isCorrect: true },
        { question: { topic: 'High' }, isCorrect: true },
      ])
      mockPrisma.practiceQuestion.findMany.mockResolvedValue([])

      const result = await analyticsService.getAnalytics('user-123')

      expect(result.topicMastery[0].topic).toBe('High')
      expect(result.topicMastery[1].topic).toBe('Medium')
      expect(result.topicMastery[2].topic).toBe('Low')
    })

    it('should work without userId filter', async () => {
      mockPrisma.testResult.findMany.mockResolvedValue([
        { question: { topic: 'Algebra' }, isCorrect: true },
      ])
      mockPrisma.practiceQuestion.findMany.mockResolvedValue([])

      await analyticsService.getAnalytics()

      expect(mockPrisma.testResult.findMany).toHaveBeenCalledWith({
        where: {},
        include: { question: true },
      })
    })

    it('should set target to 100 for all skills', async () => {
      mockPrisma.testResult.findMany.mockResolvedValue([])
      mockPrisma.practiceQuestion.findMany.mockResolvedValue([])

      const result = await analyticsService.getAnalytics('user-123')

      expect(result.skillData.every(s => s.target === 100)).toBe(true)
    })

    it('should rename General topic to Uncategorized in topicMastery', async () => {
      mockPrisma.testResult.findMany.mockResolvedValue([
        { question: { topic: 'General' }, isCorrect: true },
      ])
      mockPrisma.practiceQuestion.findMany.mockResolvedValue([])

      const result = await analyticsService.getAnalytics('user-123')

      const general = result.topicMastery.find(m => m.topic === 'General')
      expect(general).toBeUndefined()

      const uncategorized = result.topicMastery.find(m => m.topic === 'Uncategorized')
      expect(uncategorized).toBeDefined()
    })

    it('should map all SAT topic categories correctly', async () => {
      const topicMappings = [
        { topic: 'Heart of Algebra', expected: 'Algebra' },
        { topic: 'Passport to Advanced Math', expected: 'Algebra' },
        { topic: 'Geometry and Trigonometry', expected: 'Geometry' },
        { topic: 'Standard English Conventions', expected: 'Grammar' },
        { topic: 'Information and Ideas', expected: 'Reading' },
        { topic: 'Rhetoric', expected: 'Reading' },
        { topic: 'Problem Solving and Data Analysis', expected: 'Problem Solving' },
        { topic: 'Words in Context', expected: 'Vocabulary' },
      ]

      for (const { topic, expected } of topicMappings) {
        vi.clearAllMocks()
        mockPrisma.testResult.findMany.mockResolvedValue([
          { question: { topic }, isCorrect: true },
        ])
        mockPrisma.practiceQuestion.findMany.mockResolvedValue([])

        const result = await analyticsService.getAnalytics('user-123')
        const skill = result.skillData.find(s => s.subject === expected)
        expect(skill!.you).toBe(100)
      }
    })
  })
})
