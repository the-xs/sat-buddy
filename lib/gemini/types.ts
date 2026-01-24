import { ThinkingLevel } from '@google/genai';

export type ModelTier = 'premium' | 'standard' | 'budget';

export type UseCase =
  | 'pdfParsing'
  | 'answerVerification'
  | 'practiceGeneration'
  | 'explanations'
  | 'testGeneration';

export interface LocalThinkingConfig {
  thinkingBudget?: number;
  thinkingLevel?: ThinkingLevel;
}

export interface ModelPreset {
  model: string;
  thinking?: LocalThinkingConfig;
}

export interface VerificationResult {
  questionNumber: number;
  originalAnswer: string;
  verifiedAnswer: string;
  wasCorrect: boolean;
  explanation: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface BatchVerificationResponse {
  verifications: Array<{
    questionNumber: number;
    wasCorrect: boolean;
    verifiedAnswer: string;
    explanation: string;
    confidence: 'high' | 'medium' | 'low';
  }>;
}

export interface GenerationResult {
  text: string;
  modelUsed: string;
  tierUsed: ModelTier;
}

export interface FileUploadResult {
  name: string;
  uri: string;
  mimeType: string;
  state: 'PROCESSING' | 'ACTIVE' | 'FAILED';
}

export interface QuestionForVerification {
  questionId: number;
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
  hasFigure?: boolean;
  figureCaption?: string | null;
  figureData?: string | null;
}
