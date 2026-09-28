import { Router } from 'express';
import { createTestRun, listTestRuns, getTestRunById } from '../controllers/testRunController.js';
import { validateCreateTestRun } from '../middleware/validateRequest.js';

const router = Router();

router.post('/', validateCreateTestRun, createTestRun);
router.get('/', listTestRuns);
router.get('/:id', getTestRunById);

export default router;
