import { Router } from "express";

import {
  createTestRun,
  listTestRuns,
  getTestRunById,
  downloadTestRunLog,
  cancelTestRun,
} from "../controllers/testRunController.js";

import { validateCreateTestRun } from "../middleware/validateRequest.js";

const router = Router();

router.post("/", validateCreateTestRun, createTestRun);

router.get("/", listTestRuns);

// Download a test execution log
router.get("/:id/log", downloadTestRunLog);

router.post("/:id/cancel", cancelTestRun);

router.get("/:id", getTestRunById);

export default router;
