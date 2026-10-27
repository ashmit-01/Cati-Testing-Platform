
import { Router } from 'express';
import { analyzeManualErrorController } from '../controllers/manualErrorAnalysisController.js';

const router = Router();

router.post('/', analyzeManualErrorController);

export default router;
