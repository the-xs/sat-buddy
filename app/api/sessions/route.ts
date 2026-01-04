import { NextRequest, NextResponse } from 'next/server';
import { satTestService } from '@/lib/services/satTestService';
import { getAuthenticatedUser } from '@/lib/auth';

// POST /api/sessions - Create a new test session
export async function POST(request: NextRequest) {
    const { user, error } = await getAuthenticatedUser();
    if (error) return error;

    try {
        const { testId } = await request.json();

        if (!testId) {
            return NextResponse.json(
                { success: false, error: 'testId is required' },
                { status: 400 }
            );
        }

        const session = await satTestService.createSession(parseInt(testId), user.id);
        return NextResponse.json({ success: true, data: { sessionId: session.sessionId } });
    } catch (error) {
        console.error('Error creating session:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to create session' },
            { status: 500 }
        );
    }
}

// GET /api/sessions - Get all completed sessions
export async function GET() {
    const { user, error } = await getAuthenticatedUser();
    if (error) return error;

    try {
        const sessions = await satTestService.getCompletedSessions(user.id);
        return NextResponse.json({ success: true, data: sessions });
    } catch (error) {
        console.error('Error fetching sessions:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch sessions' },
            { status: 500 }
        );
    }
}
