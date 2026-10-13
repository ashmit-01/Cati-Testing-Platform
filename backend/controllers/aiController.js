
import { analyzeFailure } from "../services/failureAnalysisService.js";

export async function analyzeFailureController(req, res, next) {
  try {
    const { failureId } = req.body;

    if (!failureId) {
      return res.status(400).json({
        success: false,
        message: "failureId is required",
      });
    }

    const result = await analyzeFailure(failureId);

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    next(error);
  }
}