import { Router } from 'express';
import {
    createTestSuite,
    assignTestCases,
    setSuiteActive,
    listTestSuites,
    getTestSuite,
    updateTestSuite,
    deleteTestSuite
} from '../controllers/testSuiteController.js';
import { validateTestSuite } from '../middleware/validateRequest.js';

const router = Router();

router.post('/', validateTestSuite, createTestSuite);
router.get('/', listTestSuites);
router.post('/:id/assign', assignTestCases);
router.post('/:id/active', setSuiteActive);
router.get('/:id', getTestSuite);
router.put('/:id', updateTestSuite);
router.delete('/:id', deleteTestSuite);

export default router;
