import { pdfService } from '../services/pdfService.js';
import { satTestService } from '../services/satTestService.js';

export const uploadController = {
    // POST /api/upload/pdf - Upload and parse PDF, save to database
    async uploadPDF(req, res, next) {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'No file uploaded'
                });
            }

            const satTest = await pdfService.parsePDF(req.file.path, req.file.originalname);

            // Get stats for response
            const stats = await satTestService.getTestStats(satTest.id);

            res.status(201).json({
                success: true,
                message: `Successfully uploaded and parsed: ${satTest.name}`,
                data: {
                    testId: satTest.id,
                    testName: satTest.name,
                    pdfFilename: satTest.pdfFilename,
                    ...stats
                }
            });
        } catch (error) {
            next(error);
        }
    },

    // POST /api/upload/test - Test parsing without saving to database
    async testParse(req, res, next) {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'No file uploaded'
                });
            }

            const parsedData = await pdfService.testParse(req.file.path);

            // Calculate stats from parsed data
            const stats = {
                testName: parsedData.testName,
                totalModules: parsedData.modules.length,
                modules: parsedData.modules.map(m => ({
                    section: m.section,
                    moduleNumber: m.moduleNumber,
                    questionCount: m.questions.length,
                    multipleChoice: m.questions.filter(q => q.questionType === 'MultipleChoice').length,
                    freeResponse: m.questions.filter(q => q.questionType === 'FreeResponse').length,
                    withFigures: m.questions.filter(q => q.hasFigure).length
                }))
            };

            let totalQuestions = 0;
            stats.modules.forEach(m => totalQuestions += m.questionCount);
            stats.totalQuestions = totalQuestions;

            res.json({
                success: true,
                message: 'PDF parsed successfully (test mode - not saved)',
                data: {
                    stats,
                    sampleQuestions: parsedData.modules.flatMap(m =>
                        m.questions.slice(0, 2).map(q => ({
                            module: `${m.section} Module ${m.moduleNumber}`,
                            ...q
                        }))
                    ).slice(0, 8)
                }
            });
        } catch (error) {
            next(error);
        }
    }
};
