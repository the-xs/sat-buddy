/**
 * Gemini AI Configuration
 * Model presets, tiers, and fallback logic
 */

import { ModelTier, UseCase, ModelPreset } from './types';

/**
 * Model presets for each use case and tier
 * 
 * Premium: Gemini 3 Pro Preview (best reasoning, thinkingLevel: high)
 * Standard: Gemini 2.5 Pro (stable, thinkingBudget: 8192)
 * Budget: Gemini 2.5 Flash (cost-effective, thinkingBudget: 4096)
 */
export const MODEL_PRESETS: Record<UseCase, Record<ModelTier, ModelPreset>> = {
  // PDF Parsing - needs deep reasoning for extracting questions correctly
  pdfParsing: {
    premium: { model: 'gemini-3-pro-preview', thinking: { thinkingLevel: 'high' } },
    standard: { model: 'gemini-2.5-pro', thinking: { thinkingBudget: 8192 } },
    budget: { model: 'gemini-2.5-flash', thinking: { thinkingBudget: 4096 } },
  },

  // Answer Verification - critical for correct solutions
  answerVerification: {
    premium: { model: 'gemini-3-pro-preview', thinking: { thinkingLevel: 'high' } },
    standard: { model: 'gemini-2.5-pro', thinking: { thinkingBudget: 8192 } },
    budget: { model: 'gemini-2.5-flash', thinking: { thinkingBudget: 4096 } },
  },

  // Practice Question Generation
  practiceGeneration: {
    premium: { model: 'gemini-3-pro-preview', thinking: { thinkingLevel: 'high' } },
    standard: { model: 'gemini-2.5-flash', thinking: { thinkingBudget: 4096 } },
    budget: { model: 'gemini-2.5-flash', thinking: { thinkingBudget: 2048 } },
  },

  // Explanations - good reasoning for teaching
  explanations: {
    premium: { model: 'gemini-3-pro-preview', thinking: { thinkingLevel: 'high' } },
    standard: { model: 'gemini-2.5-flash', thinking: { thinkingBudget: 4096 } },
    budget: { model: 'gemini-2.5-flash', thinking: { thinkingBudget: 2048 } },
  },

  // Test Generation - can be faster, less critical
  testGeneration: {
    premium: { model: 'gemini-2.5-flash', thinking: { thinkingBudget: 4096 } },
    standard: { model: 'gemini-2.5-flash', thinking: { thinkingBudget: 2048 } },
    budget: { model: 'gemini-2.0-flash' }, // No thinking config
  },
};

// Fallback chain: premium -> standard -> budget
export const FALLBACK_CHAIN: ModelTier[] = ['premium', 'standard', 'budget'];

/**
 * Get the current model tier from environment variable
 * Defaults to 'standard' if not set or invalid
 */
export function getModelTier(): ModelTier {
  const tier = process.env.GEMINI_MODEL_TIER?.toLowerCase();
  if (tier === 'premium' || tier === 'standard' || tier === 'budget') {
    return tier;
  }
  return 'standard';
}

/**
 * Get the model preset for a specific use case and tier
 */
export function getPreset(useCase: UseCase, tier?: ModelTier): ModelPreset {
  const effectiveTier = tier ?? getModelTier();
  return MODEL_PRESETS[useCase][effectiveTier];
}

/**
 * Get the next fallback tier after the current one
 * Returns null if no more fallbacks available
 */
export function getNextFallbackTier(currentTier: ModelTier): ModelTier | null {
  const currentIndex = FALLBACK_CHAIN.indexOf(currentTier);
  if (currentIndex >= 0 && currentIndex < FALLBACK_CHAIN.length - 1) {
    return FALLBACK_CHAIN[currentIndex + 1];
  }
  return null;
}

/**
 * Get verification batch size from environment variable
 * Defaults to 5, clamped between 1 and 10
 */
export function getVerificationBatchSize(): number {
  const size = parseInt(process.env.GEMINI_VERIFICATION_BATCH_SIZE || '5', 10);
  if (isNaN(size)) return 5;
  return Math.max(1, Math.min(10, size));
}

/**
 * Check if verification is enabled
 * Can be disabled via environment variable for testing/debugging
 */
export function isVerificationEnabled(): boolean {
  return process.env.GEMINI_SKIP_VERIFICATION !== 'true';
}
