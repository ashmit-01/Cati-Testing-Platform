import { Router } from 'express';

import dashboardRoutes from './dashboardRoutes.js';
import authRoutes from './authRoutes.js';
import healthRoutes from './healthRoutes.js';
import testRunRoutes from './testRunRoutes.js';
import resultRoutes from './resultRoutes.js';
import failureRoutes from './failureRoutes.js';
import reportRoutes from './reportRoutes.js';
import testCaseRoutes from './testCaseRoutes.js';
import testSuiteRoutes from './testSuiteRoutes.js';

import { authenticate } from '../middleware/authMiddleware.js';

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

// Test runs
router.use('/test-runs', authenticate, testRunRoutes);

// Results
router.use('/results', authenticate, resultRoutes);

// Failures
router.use('/failures', authenticate, failureRoutes);

// Reports
router.use('/reports', authenticate, reportRoutes);

export default router;