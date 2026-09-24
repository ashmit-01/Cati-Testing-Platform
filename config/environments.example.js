export const environments = {
  staging: {
    frontend: process.env.FRONTEND_URL,
    backend: process.env.BACKEND_URL,
    engine: process.env.AI_ENGINE_URL,
    websocket: process.env.AI_ENGINE_WS_URL
  },
  production: {
    // Configure only after explicit authorization.
    frontend: process.env.FRONTEND_URL,
    backend: process.env.BACKEND_URL,
    engine: process.env.AI_ENGINE_URL,
    websocket: process.env.AI_ENGINE_WS_URL
  }
};
