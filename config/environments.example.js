export const environments = {
  staging: {
    frontend: process.env.FRONTEND_URL || 'https://usecati.com',
    backend: process.env.BACKEND_URL || 'http://localhost:5000',
    engine: process.env.AI_ENGINE_URL || 'https://fucr8ewyudjjbqlxhajoahpn.200.234.39.243.sslip.io',
    websocket: process.env.AI_ENGINE_WS_URL || 'wss://fucr8ewyudjjbqlxhajoahpn.200.234.39.243.sslip.io'
  },
  production: {
    // Configure only after explicit QA authorization.
    frontend: process.env.FRONTEND_URL,
    backend: process.env.BACKEND_URL,
    engine: process.env.AI_ENGINE_URL,
    websocket: process.env.AI_ENGINE_WS_URL
  },
  local: {
    frontend: 'http://localhost:3000',
    backend: 'http://localhost:5000',
    engine: process.env.AI_ENGINE_URL || 'https://fucr8ewyudjjbqlxhajoahpn.200.234.39.243.sslip.io',
    websocket: process.env.AI_ENGINE_WS_URL || 'wss://fucr8ewyudjjbqlxhajoahpn.200.234.39.243.sslip.io'
  }
};

export function getCurrentEnvironment() {
  const envKey = (process.env.TEST_ENV || 'staging').toLowerCase();
  return environments[envKey] || environments.staging;
}
