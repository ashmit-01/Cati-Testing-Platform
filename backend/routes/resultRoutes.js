import { Router } from 'express';
import { listResults, getResultById } from '../controllers/resultController.js';

const router = Router();

router.get('/', listResults);
router.get('/:id', getResultById);

export default router;
