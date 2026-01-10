import { vi } from 'vitest'

// Mock Prisma client
export const mockPrisma = {
  sATTest: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  module: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  question: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
  },
  questionSet: {
    findUnique: vi.fn(),
  },
  testSession: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  testResult: {
    findMany: vi.fn(),
    upsert: vi.fn(),
  },
  practiceQuestion: {
    create: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
  },
}

vi.mock('@/lib/prisma', () => ({
  default: mockPrisma,
  prisma: mockPrisma,
}))

export default mockPrisma
