import { Router } from 'express';
import { listFailures, getFailureById, analyzeFailureById } from '../controllers/failureController.js';

const router = Router();

router.get('/', listFailures);
router.get('/:id', getFailureById);
router.post('/:id/analyze', analyzeFailureById);

export default router;
