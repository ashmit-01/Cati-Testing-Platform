import { Router } from "express";

import {
  createTestRun,
  listTestRuns,
  getTestRunById,
  downloadTestRunLog,
} from "../controllers/testRunController.js";

import { validateCreateTestRun } from "../middleware/validateRequest.js";

const router = Router();

router.post("/", validateCreateTestRun, createTestRun);

router.get("/", listTestRuns);

// Download a test execution log
router.get("/:id/log", downloadTestRunLog);

router.get("/:id", getTestRunById);

export default router;
