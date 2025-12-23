import fs from 'fs/promises';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { GoogleAIFileManager } from '@google/generative-ai/server';
import prisma from '../config/database.js';

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const fileManager = new GoogleAIFileManager(process.env.GEMINI_API_KEY);

// Upload directories
const UPLOADS_DIR = path.join(process.cwd(), 'uploads');
const PDF_DIR = path.join(UPLOADS_DIR, 'pdfs');

export const pdfService = {
    // Parse PDF and store in database
    async parsePDF(filePath, originalName) {
        try {
            console.log('📄 Starting PDF parsing with Gemini 3 Flash (Module-by-Module)...');

            // Move PDF to permanent storage
            const pdfFilename = `${Date.now()}-${originalName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
            const permanentPath = path.join(PDF_DIR, pdfFilename);
            await fs.copyFile(filePath, permanentPath);
            await fs.unlink(filePath);

            console.log(`📁 Stored PDF at: ${permanentPath}`);

            // Upload PDF to Gemini
            console.log('⬆️  Uploading PDF to Gemini...');
            const uploadResult = await fileManager.uploadFile(permanentPath, {
                mimeType: 'application/pdf',
                displayName: originalName
            });

            console.log(`✅ Uploaded to Gemini: ${uploadResult.file.uri}`);

            // Define modules to extract
            const moduleConfigs = [
                { section: 'ReadingWriting', moduleNumber: 1, promptSuffix: 'Reading and Writing Module 1' },
                { section: 'ReadingWriting', moduleNumber: 2, promptSuffix: 'Reading and Writing Module 2' },
                { section: 'Math', moduleNumber: 1, promptSuffix: 'Math Module 1' },
                { section: 'Math', moduleNumber: 2, promptSuffix: 'Math Module 2' }
            ];

            const extractedModules = [];
            let testName = originalName.replace('.pdf', '').replace(/[_-]/g, ' ');

            // Extract each module sequentially to stay within output token limits
            for (const config of moduleConfigs) {
                console.log(`🔍 Extracting ${config.section} Module ${config.moduleNumber}...`);
                const result = await this.extractModuleWithGemini(uploadResult.file, config);

                if (result.testName && !testName) testName = result.testName;

                extractedModules.push({
                    section: config.section,
                    moduleNumber: config.moduleNumber,
                    questions: result.questions
                });

                console.log(`   ✅ Extracted ${result.questions.length} questions for ${config.section} Module ${config.moduleNumber}`);
            }

            const parsedData = {
                testName: testName,
                modules: extractedModules
            };

            // Clean up Gemini file
            await fileManager.deleteFile(uploadResult.file.name);
            console.log('🗑️  Cleaned up Gemini file');

            // Store in database
            const satTest = await this.storeInDatabase(parsedData, pdfFilename, originalName);

            return satTest;
        } catch (error) {
            console.error('PDF parsing error:', error);
            throw error;
        }
    },

    // Extract a specific module using Gemini
    async extractModuleWithGemini(file, config) {
        try {
            const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

            const prompt = `You are an expert SAT test parser. Extract questions ONLY for "${config.promptSuffix}" from this PDF.

**YOUR TASK:**
Extract EVERY question for this specific module.

1. **Question Number**: The number of the question within this module.
2. **Question Type**: "MultipleChoice" (A, B, C, D) or "FreeResponse" (usually Math).
3. **Question Text**: Complete text. If there is a diagram, chart, or geometry figure, DESCRIBE it in detail within the text.
4. **Options**: For MultipleChoice, provide A, B, C, D. For FreeResponse, list these as null.
5. **Correct Answer**: The letter (A, B, C, or D) or the numeric value for FreeResponse.
6. **Explanation**: If provided in the text, extract it.

**OUTPUT FORMAT - Return valid JSON:**
{
  "testName": "The name of the test if found",
  "questions": [
    {
      "questionNumber": 1,
      "questionType": "MultipleChoice" or "FreeResponse",
      "questionText": "full question text",
      "hasFigure": true or false,
      "figureDescription": "detailed description of any figure/chart/graph" or null,
      "optionA": "option A text" or null,
      "optionB": "option B text" or null,
      "optionC": "option C text" or null,
      "optionD": "option D text" or null,
      "correctAnswer": "A/B/C/D" or "the actual answer for free response",
      "explanation": "explanation text" or ""
    }
  ]
}

Return ONLY valid JSON. No conversational text.`;

            const result = await model.generateContent([
                {
                    fileData: {
                        mimeType: file.mimeType,
                        fileUri: file.uri
                    }
                },
                { text: prompt }
            ]);

            const responseText = result.response.text();
            let jsonText = responseText.trim();
            if (jsonText.startsWith('```json')) {
                jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?$/g, '');
            } else if (jsonText.startsWith('```')) {
                jsonText = jsonText.replace(/```\n?/g, '').replace(/```\n?$/g, '');
            }

            return JSON.parse(jsonText);
        } catch (error) {
            console.error(`Error extracting ${config.promptSuffix}:`, error);
            return { questions: [] };
        }
    },

    // Store parsed data in database
    async storeInDatabase(parsedData, pdfFilename, originalName) {
        console.log('💾 Storing in database...');

        const satTest = await prisma.sATTest.create({
            data: {
                name: parsedData.testName || `SAT Practice Test - ${new Date().toLocaleDateString()}`,
                pdfFilename: pdfFilename,
                originalName: originalName,
                modules: {
                    create: parsedData.modules.map(module => ({
                        section: module.section,
                        moduleNumber: module.moduleNumber,
                        questions: {
                            create: module.questions.map(q => ({
                                questionNumber: q.questionNumber,
                                questionType: q.questionType,
                                questionText: q.questionText,
                                hasFigure: q.hasFigure || false,
                                figureCaption: q.figureDescription || null,
                                optionA: q.optionA || null,
                                optionB: q.optionB || null,
                                optionC: q.optionC || null,
                                optionD: q.optionD || null,
                                correctAnswer: String(q.correctAnswer),
                                explanation: q.explanation || ''
                            }))
                        }
                    }))
                }
            },
            include: {
                modules: {
                    include: {
                        questions: true
                    }
                }
            }
        });

        console.log(`\n📊 Database Storage Complete: Test ID: ${satTest.id}`);
        return satTest;
    },

    // Test parsing without saving to database
    async testParse(filePath) {
        try {
            console.log('📄 Test parsing PDF with Gemini 3 Flash...');

            const uploadResult = await fileManager.uploadFile(filePath, {
                mimeType: 'application/pdf',
                displayName: 'Test Parse'
            });

            const moduleConfigs = [
                { section: 'ReadingWriting', moduleNumber: 1, promptSuffix: 'Reading and Writing Module 1' },
                { section: 'Math', moduleNumber: 1, promptSuffix: 'Math Module 1' }
            ];

            const extractedModules = [];
            for (const config of moduleConfigs) {
                const result = await this.extractModuleWithGemini(uploadResult.file, config);
                extractedModules.push({
                    section: config.section,
                    moduleNumber: config.moduleNumber,
                    questions: result.questions
                });
            }

            await fileManager.deleteFile(uploadResult.file.name);
            await fs.unlink(filePath);

            return {
                testName: 'Test Parse',
                modules: extractedModules
            };
        } catch (error) {
            try { await fs.unlink(filePath); } catch { }
            throw error;
        }
    }
};
