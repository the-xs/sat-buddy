import { analyticsService } from '../services/analyticsService.js';

export const analyticsController = {
    // GET /api/analytics - Get aggregated user performance data
    async getAnalytics(req, res, next) {
        try {
            const data = await analyticsService.getAnalytics();
            res.json({
                success: true,
                data
            });
        } catch (error) {
            next(error);
        }
    }
};
