import { Router } from 'express';
import { listFailures, getFailureById } from '../controllers/failureController.js';

const router = Router();

router.get('/', listFailures);
router.get('/:id', getFailureById);

export default router;
