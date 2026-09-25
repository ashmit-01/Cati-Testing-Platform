export function classifyFailure(testFile = "") {
  const file = testFile.toLowerCase().replace(/\\/g, "/");

  if (file.includes("/api/")) {
    return "API";
  }

  if (file.includes("/ui/")) {
    return "UI";
  }

  if (file.includes("/e2e/")) {
    return "E2E";
  }

  if (file.includes("/websocket/")) {
    return "WebSocket";
  }

  if (file.includes("/ai/")) {
    return "AI";
  }

  if (file.includes("/infrastructure/")) {
    return "Infrastructure";
  }

  if (file.includes("/environment/")) {
    return "Environment";
  }

  if (file.includes("/test-script/") || file.includes("/testscript/")) {
    return "Test Script";
  }

  return "Unknown";
}
