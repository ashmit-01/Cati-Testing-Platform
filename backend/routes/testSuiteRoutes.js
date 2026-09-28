import { Router } from 'express';
import {
    createTestSuite,
    listTestSuites,
    getTestSuite,
    updateTestSuite,
    deleteTestSuite
} from '../controllers/testSuiteController.js';
import { validateTestSuite } from '../middleware/validateRequest.js';

const router = Router();

router.post('/', validateTestSuite, createTestSuite);
router.get('/', listTestSuites);
router.get('/:id', getTestSuite);
router.put('/:id', updateTestSuite);
router.delete('/:id', deleteTestSuite);

export default router;
