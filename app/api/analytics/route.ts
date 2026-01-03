import { NextResponse } from 'next/server';
import { analyticsService } from '@/lib/services/analyticsService';

// GET /api/analytics - Get analytics data
export async function GET() {
    try {
        const analytics = await analyticsService.getAnalytics();
        return NextResponse.json({ success: true, data: analytics });
    } catch (error) {
        console.error('Error fetching analytics:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch analytics' },
            { status: 500 }
        );
    }
}
