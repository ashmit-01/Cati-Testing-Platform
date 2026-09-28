import { Router } from 'express';
import healthRoutes from './healthRoutes.js';
import testRunRoutes from './testRunRoutes.js';
import resultRoutes from './resultRoutes.js';
import failureRoutes from './failureRoutes.js';
import reportRoutes from './reportRoutes.js';
import testCaseRoutes from './testCaseRoutes.js';
import testSuiteRoutes from './testSuiteRoutes.js';
import dashboardRoutes from './dashboardRoutes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/test-cases', testCaseRoutes);
router.use('/test-suites', testSuiteRoutes);
router.use('/test-runs', testRunRoutes);
router.use('/results', resultRoutes);
router.use('/failures', failureRoutes);
router.use('/reports', reportRoutes);
router.use('/dashboard', dashboardRoutes);

export default router;
