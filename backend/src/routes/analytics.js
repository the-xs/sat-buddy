import express from 'express';
import { analyticsController } from '../controllers/analyticsController.js';

const router = express.Router();

router.get('/', analyticsController.getAnalytics);

export default router;
