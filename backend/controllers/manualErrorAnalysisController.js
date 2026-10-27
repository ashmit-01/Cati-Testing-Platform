
import { analyzeManualError } from '../services/aiFailureAnalysisService.js';

export async function analyzeManualErrorController(req, res, next) {
    try {
        const result = await analyzeManualError(req.body || {});
        return res.status(200).json({ result });
    } catch (error) {
        next(error);
    }
}
