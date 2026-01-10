import { vi } from 'vitest'

export const mockAuth = vi.fn()

vi.mock('@/auth', () => ({
  auth: mockAuth,
}))
