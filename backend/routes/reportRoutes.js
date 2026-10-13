import { Router } from 'express';
import { getReports, getReportForRun } from '../controllers/reportController.js';

const router = Router();

router.get('/', getReports);
router.get('/:runId', getReportForRun);

export default router;
