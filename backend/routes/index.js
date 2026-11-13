import { Router } from 'express';

import dashboardRoutes from './dashboardRoutes.js';
import authRoutes from './authRoutes.js';
import healthRoutes from './healthRoutes.js';
import testRunRoutes from './testRunRoutes.js';
import resultRoutes from './resultRoutes.js';
import failureRoutes from './failureRoutes.js';
import reportRoutes from './reportRoutes.js';
import { authenticateCi } from '../middleware/authenticateCi.js';
import {
  ingestCiReport,
  reportCiProgress,
  reportCiFailure,
} from "../controllers/testRunController.js";
import testCaseRoutes from './testCaseRoutes.js';
import testSuiteRoutes from './testSuiteRoutes.js';

import { authenticate } from '../middleware/authMiddleware.js';
import manualErrorAnalysisRoutes from './manualErrorAnalysisRoutes.js';
import { triggerGitHubWorkflow } from '../controllers/ciController.js';

const router = Router();

/*
 * PUBLIC ROUTES
 */

// Authentication
router.use('/auth', authRoutes);

// Health check
router.use('/health', healthRoutes);


/*
 * PROTECTED ROUTES
 *
 * These routes require the admin JWT token.
 */

// Dashboard
router.use('/dashboard', authenticate, dashboardRoutes);

// Test cases
router.use('/test-cases', authenticate, testCaseRoutes);

// Test suites
router.use('/test-suites', authenticate, testSuiteRoutes);

// Trigger GitHub Actions (admin only)
router.post('/ci/trigger', authenticate, triggerGitHubWorkflow);

// GitHub Actions CI report ingestion
router.post('/test-runs/ci', authenticateCi, ingestCiReport);
// Live progress updates from GitHub Actions
router.post(
    '/test-runs/:runId/progress',
    authenticateCi,
    reportCiProgress
);

// Failure notification from GitHub Actions
router.post(
    '/test-runs/:runId/failure',
    authenticateCi,
    reportCiFailure
);

// Test runs
router.use('/test-runs', authenticate, testRunRoutes);

// Results
router.use('/results', authenticate, resultRoutes);

// Failures
router.use('/failures', authenticate, failureRoutes);

// Reports
router.use('/reports', authenticate, reportRoutes);
// Manual error analysis
router.use('/manual-error-analysis', authenticate, manualErrorAnalysisRoutes);

export default router;