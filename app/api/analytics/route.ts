import { NextResponse } from 'next/server';
import { analyticsService } from '@/lib/services/analyticsService';
import { getAuthenticatedUser } from '@/lib/auth';

// GET /api/analytics - Get analytics data
export async function GET() {
    const { user, error } = await getAuthenticatedUser();
    if (error) return error;

    try {
        const analytics = await analyticsService.getAnalytics(user.id);
        return NextResponse.json({ success: true, data: analytics });
    } catch (error) {
        console.error('Error fetching analytics:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch analytics' },
            { status: 500 }
        );
    }
}
