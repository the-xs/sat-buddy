import { describe, it, expect, vi } from 'vitest'

describe('prisma singleton', () => {
  it('should be importable', async () => {
    // Simply verify the module structure
    const prismaModule = await import('@/lib/prisma')
    expect(prismaModule).toBeDefined()
    expect(prismaModule.default).toBeDefined()
    expect(prismaModule.prisma).toBeDefined()
  })

  it('should export both named and default export', async () => {
    const { default: defaultPrisma, prisma } = await import('@/lib/prisma')
    expect(defaultPrisma).toBe(prisma)
  })

  it('should have PrismaClient methods', async () => {
    const { prisma } = await import('@/lib/prisma')
    // Check for common Prisma client properties
    expect(typeof prisma.$connect).toBe('function')
    expect(typeof prisma.$disconnect).toBe('function')
  })
})
