
import { Router } from "express";
import { analyzeFailureController } from "../controllers/aiController.js";
import { validateAnalyzeFailure } from "../middleware/validateRequest.js";

const router = Router();

router.post(
    "/analyze-failure",
    validateAnalyzeFailure,
    analyzeFailureController
);

export default router;