import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'

import apiRoutes from './routes/index.js'
import {
  errorMiddleware,
  notFoundMiddleware
} from './middleware/errorMiddleware.js'


// ============================================================
// PATH SETUP
// ============================================================

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Project root:
// D:\New folder\Cati_OA_Platform
const PROJECT_ROOT = path.resolve(__dirname, '..')

// Playwright evidence folder:
// D:\New folder\Cati_OA_Platform\test-results
const TEST_RESULTS_DIR = path.join(
  PROJECT_ROOT,
  'test-results'
)


// ============================================================
// CREATE APP
// ============================================================

export function createApp() {

  const app = express()


  // ==========================================================
  // CORS
  // ==========================================================

  const allowedOrigin =
    process.env.FRONTEND_ORIGIN

  app.use(
    cors(
      allowedOrigin
        ? {
            origin: allowedOrigin
          }
        : {
            origin:
              process.env.NODE_ENV === 'production'
                ? false
                : '*'
          }
    )
  )


  // ==========================================================
  // JSON
  // ==========================================================

  app.use(
    express.json()
  )


  // ==========================================================
  // PLAYWRIGHT EVIDENCE
  // ==========================================================

  /*
   * Expose Playwright screenshots, videos,
   * traces and other test artifacts.
   *
   * Physical file:
   *
   * D:\New folder\Cati_OA_Platform\test-results\...
   *
   * Browser URL:
   *
   * http://localhost:5001/test-results/...
   */

  app.use(
    '/test-results',
    express.static(TEST_RESULTS_DIR)
  )


  // ==========================================================
  // API ROUTES
  // ==========================================================

  app.use(
    '/api',
    apiRoutes
  )


  // ==========================================================
  // 404
  // ==========================================================

  app.use(
    notFoundMiddleware
  )


  // ==========================================================
  // ERROR
  // ==========================================================

  app.use(
    errorMiddleware
  )


  return app
}