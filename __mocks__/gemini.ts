import { vi } from 'vitest'

// Mock Gemini AI response
export const mockGenerateContent = vi.fn()
export const mockGetGenerativeModel = vi.fn(() => ({
  generateContent: mockGenerateContent,
}))

export const mockUploadFile = vi.fn()
export const mockDeleteFile = vi.fn()

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn(() => ({
    getGenerativeModel: mockGetGenerativeModel,
  })),
}))

vi.mock('@google/generative-ai/server', () => ({
  GoogleAIFileManager: vi.fn(() => ({
    uploadFile: mockUploadFile,
    deleteFile: mockDeleteFile,
  })),
}))
