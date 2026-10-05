export function classifyFailure(testFile = "", message = "") {
  const file = testFile.toLowerCase().replace(/\\/g, "/");
  const text = message.toLowerCase();

  // Authentication failures
  if (
    text.includes("401") ||
    text.includes("unauthorized") ||
    text.includes("authentication failed") ||
    text.includes("invalid token") ||
    text.includes("token expired") ||
    text.includes("login failed")
  ) {
    return "Authentication";
  }

  // Authorization / permission failures
  if (
    text.includes("403") ||
    text.includes("forbidden") ||
    text.includes("permission denied") ||
    text.includes("access denied")
  ) {
    return "Authorization";
  }

  // Timeout failures
  if (
    text.includes("timeout") ||
    text.includes("timed out") ||
    (text.includes("exceeded") && text.includes("timeout"))
  ) {
    return "Timeout";
  }

  // Locator / UI element failures
  if (
    text.includes("locator") ||
    text.includes("element not found") ||
    text.includes("element is not visible") ||
    text.includes("strict mode violation")
  ) {
    return "Locator";
  }

  // Assertion failures
  if (
    text.includes("expect(") ||
    text.includes("expected") ||
    text.includes("received") ||
    text.includes("assertion")
  ) {
    return "Assertion";
  }

  // WebSocket failures
  if (
    text.includes("websocket") ||
    text.includes("socket connection") ||
    text.includes("connection closed")
  ) {
    return "WebSocket";
  }

  // Voice / audio failures
  if (
    text.includes("voice") ||
    text.includes("audio") ||
    text.includes("transcription") ||
    text.includes("speech")
  ) {
    return "Voice";
  }

  // API / HTTP failures
  if (
    /\b(400|404|405|409|422|429|500|502|503|504)\b/.test(text) ||
    text.includes("http error") ||
    text.includes("api error") ||
    text.includes("request failed") ||
    text.includes("response status")
  ) {
    return "API";
  }

  // Validation failures
  if (
    text.includes("validation") ||
    text.includes("invalid input") ||
    text.includes("invalid value") ||
    text.includes("required field")
  ) {
    return "Validation";
  }

  // Test-script failures
  if (
    text.includes("syntaxerror") ||
    text.includes("referenceerror") ||
    text.includes("typeerror") ||
    text.includes("is not defined")
  ) {
    return "Test Script";
  }

  // Preserve existing file-based classification as fallback
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
