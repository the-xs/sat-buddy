import { vi } from 'vitest'

export const mockGenerateContent = vi.fn()
export const mockFilesUpload = vi.fn()
export const mockFilesDelete = vi.fn()
export const mockFilesGet = vi.fn()

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn(() => ({
    models: {
      generateContent: mockGenerateContent,
    },
    files: {
      upload: mockFilesUpload,
      delete: mockFilesDelete,
      get: mockFilesGet,
    },
  })),
  createPartFromUri: vi.fn((uri: string, mimeType: string) => ({ 
    fileData: { fileUri: uri, mimeType } 
  })),
  createUserContent: vi.fn((parts: unknown[]) => parts),
}))

export const mockGenerateWithFallback = vi.fn()
export const mockUploadFile = vi.fn()
export const mockDeleteFile = vi.fn()
export const mockWaitForFileProcessing = vi.fn()

vi.mock('@/lib/gemini/client', () => ({
  generateWithFallback: mockGenerateWithFallback,
  uploadFile: mockUploadFile,
  deleteFile: mockDeleteFile,
  waitForFileProcessing: mockWaitForFileProcessing,
  getGeminiClient: vi.fn(),
  resetGeminiClient: vi.fn(),
  createPartFromUri: vi.fn((uri: string, mimeType: string) => ({ 
    fileData: { fileUri: uri, mimeType } 
  })),
  createUserContent: vi.fn((parts: unknown[]) => parts),
}))

vi.mock('@/lib/gemini/config', () => ({
  getModelTier: vi.fn(() => 'standard'),
  getVerificationBatchSize: vi.fn(() => 5),
  isVerificationEnabled: vi.fn(() => true),
  getPreset: vi.fn(() => ({ model: 'gemini-2.5-pro', thinking: { thinkingBudget: 8192 } })),
  getNextFallbackTier: vi.fn(() => null),
  MODEL_PRESETS: {},
  FALLBACK_CHAIN: ['premium', 'standard', 'budget'],
}))
