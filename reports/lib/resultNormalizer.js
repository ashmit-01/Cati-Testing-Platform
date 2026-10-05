import "dotenv/config";
import fs from "fs";

import { classifyFailure } from "./failureClassifier.js";
import { classifySeverity } from "./severityClassifier.js";
import { parseAssertionError } from "./assertionParser.js";
function readJsonAttachment(attachment) {
  if (!attachment.body) {
    return null;
  }

  return JSON.parse(Buffer.from(attachment.body, "base64").toString("utf-8"));
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
  }

  return evidence;
}
export function normalizeTestResult(spec, result) {
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
            result.attachments?.find(
              (attachment) => attachment.name === "error-context",
            )?.path
              ? fs.readFileSync(
                  result.attachments.find(
                    (attachment) => attachment.name === "error-context",
                  ).path,
                  "utf-8",
                )
              : "",
          ),

          classification: classifyFailure(spec.file, result.error.message),
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
    evidence: normalizeAttachments(result.attachments),
  };
}
