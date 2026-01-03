import { NextRequest, NextResponse } from 'next/server';
import { satTestService } from '@/lib/services/satTestService';

// GET /api/sessions/[id] - Get session results
export async function GET(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const sessionId = params.id;
        const results = await satTestService.getSessionResults(sessionId);
        return NextResponse.json({ success: true, data: results });
    } catch (error) {
        console.error('Error fetching session results:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch session results' },
            { status: 500 }
        );
    }
}

// POST /api/sessions/[id] - Record answer or submit session
export async function POST(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const sessionId = params.id;
        const { action, questionId, answer } = await request.json();

        if (action === 'answer') {
            const result = await satTestService.recordAnswer(sessionId, parseInt(questionId), answer);
            return NextResponse.json({ success: true, data: result });
        } else if (action === 'submit') {
            const result = await satTestService.submitSession(sessionId);
            return NextResponse.json({ success: true, data: result });
        } else {
            return NextResponse.json(
                { success: false, error: 'Invalid action' },
                { status: 400 }
            );
        }
    } catch (error) {
        console.error('Error processing session action:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to process action' },
            { status: 500 }
        );
    }
}
