import { NextRequest, NextResponse } from 'next/server';
import { testGeneratorService } from '@/lib/services/testGeneratorService';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for generation

// POST /api/tests/generate - Start generating a new AI-powered SAT test (async)
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { name, difficulty, topicFocus } = body;

        // Generate a unique job ID
        const jobId = `gen-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

        // Initialize progress tracking
        testGeneratorService.updateProgress(jobId, 'Starting...', 0);

        // Start generation in background (don't await)
        testGeneratorService.generateFullTest({
            name,
            difficulty,
            topicFocus,
            jobId
        }).catch(error => {
            console.error('Background test generation error:', error);
            testGeneratorService.updateProgress(
                jobId,
                'Error',
                -1,
                null,
                error instanceof Error ? error.message : 'Failed to generate test'
            );
        });

        // Return immediately with job ID for polling
        return NextResponse.json({
            success: true,
            jobId,
            message: 'Test generation started, poll for progress'
        });
    } catch (error) {
        console.error('Error starting test generation:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to start test generation' },
            { status: 500 }
        );
    }
}

// GET /api/tests/generate?jobId=xxx - Get generation progress
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const jobId = searchParams.get('jobId');

        if (!jobId) {
            return NextResponse.json(
                { success: false, error: 'jobId required' },
                { status: 400 }
            );
        }

        const progress = testGeneratorService.getProgress(jobId);
        return NextResponse.json({
            success: true,
            data: {
                status: progress.status,
                progress: progress.progress,
                logs: progress.logs || [],
                result: progress.result,
                error: progress.error
            }
        });
    } catch (error) {
        console.error('Error getting progress:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to get progress' },
            { status: 500 }
        );
    }
}
