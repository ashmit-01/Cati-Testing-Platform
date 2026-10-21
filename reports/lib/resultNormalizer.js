import "dotenv/config";
import fs from "fs";

import { classifyFailure } from "./failureClassifier.js";
import { classifySeverity } from "./severityClassifier.js";
import { parseAssertionError } from "./assertionParser.js";

function readJsonAttachment(attachment) {
  if (!attachment) return null;

  if (attachment.body) {
    try {
      return JSON.parse(Buffer.from(attachment.body, "base64").toString("utf-8"));
    } catch {
      return null;
    }
  }

  if (attachment.path && fs.existsSync(attachment.path)) {
    try {
      return JSON.parse(fs.readFileSync(attachment.path, "utf-8"));
    } catch {
      return null;
    }
  }

  return null;
}

function readErrorContext(attachments = []) {
  const attachment = attachments.find(
    (attachment) => attachment.name === "error-context",
  );

  if (!attachment?.path) {
    return "";
  }

  try {
    return fs.readFileSync(attachment.path, "utf-8");
  } catch {
    return "";
  }
}

function normalizeAttachments(attachments = []) {
  const evidence = {};

  for (const attachment of attachments) {
    if (attachment.name === "screenshot") {
      evidence.screenshot = attachment.path;
    }

    if (attachment.name === "video") {
      evidence.video = attachment.path;
    }

    if (attachment.name === "trace") {
      evidence.trace = attachment.path;
    }

    if (attachment.name === "error-context") {
      evidence.errorContext = attachment.path;
    }

    if (attachment.name === "console-logs") {
      evidence.consoleLogs = readJsonAttachment(attachment);
    }

    if (attachment.name === "requests") {
      evidence.requests = readJsonAttachment(attachment);
    }

    if (attachment.name === "responses") {
      evidence.responses = readJsonAttachment(attachment);
    }

    // Capture structured AI Engine Error Evidence (Phase 16)
    if (attachment.name === "AI Engine Error Evidence") {
      evidence.aiEngineError = readJsonAttachment(attachment);
    }

    // Capture structured API Call Evidence and mirror into requests/responses
    if (attachment.name === "API Call Evidence") {
      const apiCall = readJsonAttachment(attachment);
      evidence.apiCall = apiCall;

      if (apiCall) {
        if (!evidence.requests && apiCall.request !== undefined) {
          evidence.requests = [
            {
              method: apiCall.method,
              endpoint: apiCall.endpoint,
              body: apiCall.request,
            },
          ];
        }
        if (
          !evidence.responses &&
          (apiCall.response !== undefined || apiCall.actualStatus !== undefined)
        ) {
          evidence.responses = [
            {
              status: apiCall.actualStatus,
              endpoint: apiCall.endpoint,
              body: apiCall.response,
            },
          ];
        }
      }
    }

    // Capture WebSocket Evidence
    if (attachment.name === "WebSocket Evidence") {
      evidence.webSocket = readJsonAttachment(attachment);
    }
  }

  return evidence;
}

export function normalizeTestResult(spec, result) {
  const evidence = normalizeAttachments(result.attachments);

  return {
    test: {
      title: spec.title,
      file: spec.file,
      line: spec.line,
      column: spec.column,
    },

    result: {
      status: result.status,
      duration: result.duration,
      retry: result.retry,
      startTime: result.startTime,
      environment: process.env.TEST_ENV || "unknown",
      url: process.env.FRONTEND_URL || null,
    },

    failure: result.error
      ? {
          message: result.error.message,
          stack: result.error.stack,

          ...parseAssertionError(
            result.error.message,
            readErrorContext(result.attachments),
          ),

          classification: classifyFailure(
            spec.file,
            result.error.message,
            evidence.aiEngineError,
          ),
          severity: classifySeverity(result.error.message, spec.file),
          location: result.errorLocation
            ? {
                file: result.errorLocation.file,
                line: result.errorLocation.line,
                column: result.errorLocation.column,
              }
            : null,
        }
      : null,
    evidence,
  };
}
