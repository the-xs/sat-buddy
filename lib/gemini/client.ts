/**
 * Gemini AI Client
 * Singleton client with fallback support and helper functions
 */

import { GoogleGenAI, createPartFromUri, createUserContent } from '@google/genai';
import { ModelPreset, ModelTier, UseCase, GenerationResult, LocalThinkingConfig, FileUploadResult } from './types';
import { getPreset, getNextFallbackTier, getModelTier, FALLBACK_CHAIN } from './config';

export { createPartFromUri, createUserContent };

let clientInstance: GoogleGenAI | null = null;

/**
 * Get the singleton Gemini client instance
 */
export function getGeminiClient(): GoogleGenAI {
  if (!clientInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }
    clientInstance = new GoogleGenAI({ apiKey });
  }
  return clientInstance;
}

/**
 * Reset the client instance (useful for testing)
 */
export function resetGeminiClient(): void {
  clientInstance = null;
}

/**
 * Build the generation config object for the API call
 */
export function buildGenerationConfig(preset: ModelPreset, responseMimeType?: string): object | undefined {
  const config: Record<string, unknown> = {};
  
  if (preset.thinking) {
    config.thinkingConfig = preset.thinking;
  }
  
  if (responseMimeType) {
    config.responseMimeType = responseMimeType;
  }
  
  return Object.keys(config).length > 0 ? config : undefined;
}

/**
 * Delay helper for retries
 */
function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if an error is retryable (rate limit, temporary failure)
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('rate limit') ||
      message.includes('quota') ||
      message.includes('503') ||
      message.includes('500') ||
      message.includes('timeout') ||
      message.includes('temporarily')
    );
  }
  return false;
}

interface GenerateOptions {
  startTier?: ModelTier;
  maxRetries?: number;
  retryDelayMs?: number;
  responseMimeType?: string;
}

/**
 * Generate content with automatic fallback on failure
 * Falls back through tiers: premium -> standard -> budget
 */
export async function generateWithFallback(
  useCase: UseCase,
  contents: string | unknown[] | any,
  options?: GenerateOptions
): Promise<GenerationResult> {
  const ai = getGeminiClient();
  let currentTier = options?.startTier ?? getModelTier();
  const maxRetries = options?.maxRetries ?? 2;
  const baseRetryDelay = options?.retryDelayMs ?? 1000;

  // Start from current tier's position in fallback chain
  const startIndex = FALLBACK_CHAIN.indexOf(currentTier);
  const tiersToTry = FALLBACK_CHAIN.slice(startIndex >= 0 ? startIndex : 0);

  for (const tier of tiersToTry) {
    const preset = getPreset(useCase, tier);

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        console.log(
          `[Gemini] Calling ${preset.model} (tier: ${tier}, attempt: ${attempt + 1}/${maxRetries + 1})`
        );

         const response = await ai.models.generateContent({
           model: preset.model,
           contents: contents,
           config: buildGenerationConfig(preset, options?.responseMimeType),
         });

        const text = response.text ?? '';
        
        if (!text) {
          throw new Error('Empty response from Gemini');
        }

        console.log(`[Gemini] Success with ${preset.model} (tier: ${tier})`);
        
        return {
          text,
          modelUsed: preset.model,
          tierUsed: tier,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(
          `[Gemini] ${preset.model} failed (tier: ${tier}, attempt: ${attempt + 1}):`,
          errorMessage
        );

        // If retryable and not last attempt for this tier, retry with delay
        if (isRetryableError(error) && attempt < maxRetries) {
          const delayMs = baseRetryDelay * Math.pow(2, attempt); // Exponential backoff
          console.log(`[Gemini] Retrying in ${delayMs}ms...`);
          await delay(delayMs);
          continue;
        }

        // If last attempt for this tier, break to try next tier
        if (attempt >= maxRetries) {
          console.log(`[Gemini] Max retries reached for ${tier} tier`);
          break;
        }
      }
    }

    // Log fallback if not the last tier
    const nextTier = getNextFallbackTier(tier);
    if (nextTier) {
      console.log(`[Gemini] Falling back from ${tier} to ${nextTier}`);
    }
  }

  throw new Error(`All Gemini API attempts failed for use case: ${useCase}`);
}

export async function generateSimple(
  model: string,
  contents: string | unknown[] | any,
  thinkingConfig?: LocalThinkingConfig
): Promise<string> {
  const ai = getGeminiClient();
  
  const config = thinkingConfig ? { thinkingConfig } : undefined;
  
  const response = await ai.models.generateContent({
    model,
    contents: contents as any,
    config,
  });

  return response.text ?? '';
}

export async function uploadFile(filePath: string, mimeType: string): Promise<FileUploadResult> {
  const ai = getGeminiClient();
  const file = await ai.files.upload({
    file: filePath,
    config: { mimeType }
  });
  
  return {
    name: file.name!,
    uri: file.uri!,
    mimeType: file.mimeType!,
    state: (file.state as 'PROCESSING' | 'ACTIVE' | 'FAILED') || 'ACTIVE'
  };
}

export async function deleteFile(fileName: string): Promise<void> {
  const ai = getGeminiClient();
  await ai.files.delete({ name: fileName });
}

export async function waitForFileProcessing(fileName: string, maxWaitMs = 60000): Promise<void> {
  const ai = getGeminiClient();
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWaitMs) {
    const file = await ai.files.get({ name: fileName });
    
    if (file.state === 'ACTIVE') {
      return;
    }
    
    if (file.state === 'FAILED') {
      throw new Error(`File processing failed: ${fileName}`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
  
  throw new Error(`File processing timeout: ${fileName}`);
}
