import { NextRequest, NextResponse } from 'next/server';
import { practiceService } from '@/lib/services/practiceService';

// GET /api/practice - Get practice history and stats
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action');

        if (action === 'stats') {
            const stats = await practiceService.getPracticeStats();
            return NextResponse.json({ success: true, data: stats });
        } else if (action === 'history') {
            const history = await practiceService.getPracticeHistory();
            return NextResponse.json({ success: true, data: history });
        }

        // Default: return stats
        const stats = await practiceService.getPracticeStats();
        return NextResponse.json({ success: true, data: stats });
    } catch (error) {
        console.error('Error fetching practice data:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch practice data' },
            { status: 500 }
        );
    }
}

// POST /api/practice - Generate, check, or explain
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, category, questionId, questionData, userAnswer } = body;

        if (action === 'generate') {
            const question = await practiceService.generateQuestion(category || 'random');
            return NextResponse.json({ success: true, data: question });
        } else if (action === 'check') {
            const result = await practiceService.checkAnswer(questionId, questionData, userAnswer);
            return NextResponse.json({ success: true, data: result });
        } else if (action === 'explain') {
            const result = await practiceService.explainAnswer(questionId, questionData, userAnswer);
            return NextResponse.json({ success: true, data: result });
        } else {
            return NextResponse.json(
                { success: false, error: 'Invalid action' },
                { status: 400 }
            );
        }
    } catch (error) {
        console.error('Error processing practice action:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to process action' },
            { status: 500 }
        );
    }
}
