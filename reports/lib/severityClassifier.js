export function classifySeverity(message = "", testFile = "") {
  const file = testFile.toLowerCase().replace(/\\/g, "/");
  const text = message.toLowerCase();

  // CRITICAL: core application or voice system is unavailable
  if (
    text.includes("voice system unavailable") ||
    text.includes("core application unavailable") ||
    text.includes("login completely unavailable")
  ) {
    return "CRITICAL";
  }

  // HIGH: major functionality is unavailable
  if (
    text.includes("agent cannot be created") ||
    text.includes("calls cannot be initiated") ||
    text.includes("major api broken")
  ) {
    return "HIGH";
  }

  // LOW: explicitly identified minor issues
  if (
    text.includes("minor ui issue") ||
    text.includes("text issue") ||
    text.includes("minor validation issue")
  ) {
    return "LOW";
  }

  // Category-based fallback
  if (file.includes("/api/")) {
    return "HIGH";
  }

  if (file.includes("/websocket/") || file.includes("/ai/")) {
    return "HIGH";
  }

  if (file.includes("/ui/") || file.includes("/e2e/")) {
    return "MEDIUM";
  }

  // Unknown / infrastructure / environment / test-script failures
  // need more context before assigning a higher impact.
  return "MEDIUM";
}
