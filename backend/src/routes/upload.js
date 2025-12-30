import express from 'express';
import upload from '../config/multer.js';
import { uploadController } from '../controllers/uploadController.js';

const router = express.Router();

// POST /api/upload/pdf - Upload and parse PDF, save to database
router.post('/pdf', upload.single('file'), uploadController.uploadPDF);

// GET /api/upload/status/:jobId - Get processing status
router.get('/status/:jobId', uploadController.getStatus);

// POST /api/upload/test - Test PDF parsing without saving to DB
router.post('/test', upload.single('file'), uploadController.testParse);

export default router;
