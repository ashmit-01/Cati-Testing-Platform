import { Router } from 'express';
import {
    createTestCase,
    listTestCases,
    getTestCase,
    updateTestCase,
    deleteTestCase
} from '../controllers/testCaseController.js';
import { validateTestCase } from '../middleware/validateRequest.js';

const router = Router();

router.post('/', validateTestCase, createTestCase);
router.get('/', listTestCases);
router.get('/:id', getTestCase);
router.put('/:id', updateTestCase);
router.delete('/:id', deleteTestCase);

export default router;
