import { Router } from 'express';

import {
    login,
    getMe,
} from '../controllers/authController.js';

import { authenticate } from '../middleware/authMiddleware.js';

const router = Router();

router.post('/login', login);

router.get('/me', authenticate, getMe);

export default router;