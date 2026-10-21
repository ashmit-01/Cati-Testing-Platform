/**
 * Deterministic failure classifier.
 *
 * Classifies Playwright test failures into standard, explainable categories:
 * - Test Script
 * - Authentication
 * - Authorization
 * - Timeout
 * - Network
 * - WebSocket
 * - AI Engine
 * - Validation
 * - API
 * - Locator
 * - Assertion
 *
 * Implements Phase 17 requirements with deterministic precedence rules.
 */

export function classifyFailure(testFile = "", message = "", aiError = null) {
    const file = testFile.toLowerCase().replace(/\\/g, "/");
    const text = (message || "").toLowerCase();

    // 1. Explicit AI Error evidence takes precedence if available
    if (aiError?.classification) {
        return aiError.classification;
    }

    // 2. Test-script / code-syntax failures
    if (
        text.includes("syntaxerror") ||
        text.includes("referenceerror") ||
        text.includes("typeerror") ||
        text.includes("is not defined") ||
        text.includes("cannot find module") ||
        text.includes("cannot find package")
    ) {
        return "Test Script";
    }

    // 3. Authentication failures
    if (
        text.includes("401") ||
        text.includes("unauthorized") ||
        text.includes("authentication failed") ||
        text.includes("missing test_email") ||
        text.includes("invalid token") ||
        text.includes("token expired") ||
        text.includes("login failed")
    ) {
        return "Authentication";
    }

    // 4. Authorization / permission failures
    if (
        text.includes("403") ||
        text.includes("forbidden") ||
        text.includes("permission denied") ||
        text.includes("access denied")
    ) {
        return "Authorization";
    }

    // 5. Timeout failures
    if (
        text.includes("timeout") ||
        text.includes("timed out") ||
        (text.includes("exceeded") && text.includes("timeout"))
    ) {
        return "Timeout";
    }

    // 6. Network connectivity failures
    if (
        text.includes("econnrefused") ||
        text.includes("enotfound") ||
        text.includes("socket hang up") ||
        text.includes("connection refused")
    ) {
        return "Network";
    }

    // 7. WebSocket failures
    if (
        text.includes("websocket") ||
        text.includes("socket closed") ||
        text.includes("close code") ||
        text.includes("handshake response") ||
        file.includes("/websocket/")
    ) {
        return "WebSocket";
    }

    // 8. AI Engine failures
    if (
        text.includes("ai engine") ||
        text.includes("ai-engine") ||
        text.includes("llm") ||
        text.includes("rag") ||
        text.includes("greeting") ||
        text.includes("transcription") ||
        text.includes("intent recognition") ||
        text.includes("guardrails") ||
        file.includes("/ai/") ||
        file.includes("ai-engine.spec.js")
    ) {
        return "AI Engine";
    }

    // 9. Validation failures
    if (
        text.includes("validation") ||
        text.includes("invalid input") ||
        text.includes("invalid value") ||
        text.includes("required field") ||
        text.includes("400") ||
        text.includes("422")
    ) {
        return "Validation";
    }

    // 10. API / HTTP response status failures
    if (
        /\b(404|405|409|429|500|502|503|504)\b/.test(text) ||
        text.includes("http error") ||
        text.includes("api error") ||
        text.includes("request failed") ||
        text.includes("response status") ||
        file.includes("/api/")
    ) {
        return "API";
    }

    // 11. Locator / UI element failures
    if (
        text.includes("locator") ||
        text.includes("element not found") ||
        text.includes("element is not visible") ||
        text.includes("strict mode violation")
    ) {
        return "Locator";
    }

    // 12. General assertion failures
    if (
        text.includes("expect(") ||
        text.includes("expected") ||
        text.includes("received") ||
        text.includes("assertion")
    ) {
        return "Assertion";
    }

    // 13. File-based fallback
    if (file.includes("/ui/")) return "UI";
    if (file.includes("/e2e/")) return "E2E";

    return "Unknown";
}
