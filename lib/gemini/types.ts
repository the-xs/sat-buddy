/**
 * Gemini AI Type Definitions
 * Centralized types for model configuration, thinking modes, and verification
 */

// Model tier for budget-based switching
export type ModelTier = 'premium' | 'standard' | 'budget';

// Use cases that require different model configurations
export type UseCase =
  | 'pdfParsing'
  | 'answerVerification'
  | 'practiceGeneration'
  | 'explanations'
  | 'testGeneration';

// Thinking configuration - supports both Gemini 2.5 and 3 styles
export interface ThinkingConfig {
  // For Gemini 2.5 models - fine-grained token budget
  thinkingBudget?: number;
  // For Gemini 3 models - level-based control
  thinkingLevel?: 'low' | 'high' | 'minimal' | 'medium';
}

// Model preset with optional thinking configuration
export interface ModelPreset {
  model: string;
  thinking?: ThinkingConfig;
}

// Result of a single question verification
export interface VerificationResult {
  questionNumber: number;
  originalAnswer: string;
  verifiedAnswer: string;
  wasCorrect: boolean;
  explanation: string;
  confidence: 'high' | 'medium' | 'low';
}

// Batch verification response from Gemini
export interface BatchVerificationResponse {
  verifications: Array<{
    questionNumber: number;
    wasCorrect: boolean;
    verifiedAnswer: string;
    explanation: string;
    confidence: 'high' | 'medium' | 'low';
  }>;
}

// Result of generateWithFallback
export interface GenerationResult {
  text: string;
  modelUsed: string;
  tierUsed: ModelTier;
}

// File upload result from Gemini Files API
export interface FileUploadResult {
  name: string;
  uri: string;
  mimeType: string;
  state: 'PROCESSING' | 'ACTIVE' | 'FAILED';
}

// Question data for verification batch
export interface QuestionForVerification {
  questionId: number; // Database ID for updating
  setIndex: number;
  qIndex: number;
  questionNumber: number;
  questionText: string;
  questionType: string;
  optionA?: string | null;
  optionB?: string | null;
  optionC?: string | null;
  optionD?: string | null;
  correctAnswer: string;
  passage?: string | null;
}
