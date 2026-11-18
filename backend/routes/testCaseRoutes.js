import { Router } from 'express';
import {
    createTestCase,
    importEndpointCases,
    importOpenApiCases,
    bulkDeleteTestCases,
    listAuthOptions,
    listTestCases,
    getTestCase,
    updateTestCase,
    deleteTestCase
} from '../controllers/testCaseController.js';
import { validateTestCase } from '../middleware/validateRequest.js';

const router = Router();

router.post('/import-endpoints', importEndpointCases);
router.post('/import-openapi', importOpenApiCases);
router.post('/bulk-delete', bulkDeleteTestCases);
router.post('/', validateTestCase, createTestCase);
router.get('/', listTestCases);
router.get('/auth-options', listAuthOptions);
router.get('/:id', getTestCase);
router.put('/:id', updateTestCase);
router.delete('/:id', deleteTestCase);

export default router;
