
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Play,
  Loader2,
  GitBranch,
  ExternalLink,
  ChevronDown,
  Square,
} from "lucide-react";
import { api } from "../services/api.js";

const TEST_SUITES = [
  { label: "All Tests", value: "all" },
  { label: "UI Tests", value: "ui" },
  { label: "API Tests", value: "api" },
  { label: "E2E Tests", value: "e2e" },
  { label: "WebSocket Tests", value: "websocket" },
  { label: "AI / Voice Tests", value: "ai-voice" },
];

export default function RunTestsButton({ className = "", onRunStarted }) {
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const [runUrl, setRunUrl] = useState("");
  const [runId, setRunId] = useState("");
  const [testSuite, setTestSuite] = useState("all");

  async function handleRunTests() {
    if (status === "starting" || status === "running" || status === "cancelling") {
      return;
    }

    setStatus("starting");
    setMessage("");
    setRunUrl("");
    setRunId("");

    try {
      const { data } = await api.post("/api/ci/trigger", {
        testSuite,
      });

      setMessage(
        data.message || "GitHub Actions workflow triggered successfully.",
      );

      if (data.workflowUrl) {
        setRunUrl(data.workflowUrl);
      }

      if (data.runId) {
        setRunId(data.runId);
        setStatus("running");
        onRunStarted?.(data.runId);
      } else {
        setStatus("success");
      }
    } catch (error) {
      console.error("GitHub Actions trigger failed:", error);

      setStatus("error");
      setMessage(
        error.response?.data?.message ||
          error.message ||
          "Unable to trigger GitHub Actions.",
      );
    }
  }

  async function handleStopTests() {
    if (!runId || status !== "running") return;

    const confirmed = window.confirm(
      "Are you sure you want to stop this GitHub Actions test run?",
    );

    if (!confirmed) return;

    setStatus("cancelling");
    setMessage("Requesting cancellation from GitHub Actions...");

    try {
      const { data } = await api.post(
        `/api/test-runs/${encodeURIComponent(runId)}/cancel`,
      );

      setStatus("cancelling");
      setMessage(
        data.message ||
          "Cancellation requested. Waiting for GitHub Actions to stop the run.",
      );
    } catch (error) {
      console.error("Test cancellation failed:", error);

      setStatus("running");
      setMessage(
        error.response?.data?.message ||
          error.message ||
          "Unable to cancel the test run.",
      );
    }
  }

  const isBusy = ["starting", "running", "cancelling"].includes(status);

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-3">
        {/* Test Suite Selection */}
        <div className="relative">
          <select
            value={testSuite}
            onChange={(e) => setTestSuite(e.target.value)}
            disabled={isBusy}
            className="appearance-none rounded-md border border-border bg-card px-4 py-2.5 pr-10 text-sm font-medium text-foreground outline-none focus:border-info disabled:opacity-60"
          >
            {TEST_SUITES.map((suite) => (
              <option key={suite.value} value={suite.value}>
                {suite.label}
              </option>
            ))}
          </select>

          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>

        {/* Run Tests Button */}
        <button
          type="button"
          onClick={handleRunTests}
          disabled={isBusy}
          className="inline-flex items-center gap-2 rounded-md bg-info px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-info/90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "starting" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Triggering GitHub Actions...
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Run GitHub Tests
              <GitBranch className="h-4 w-4" />
            </>
          )}
        </button>

        {/* Stop Tests Button */}
        {status === "running" && runId && (
          <button
            type="button"
            onClick={handleStopTests}
            className="inline-flex items-center gap-2 rounded-md bg-failure px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-failure/90"
          >
            <Square className="h-4 w-4" />
            Stop Run
          </button>
        )}

        {/* Cancelling State */}
        {status === "cancelling" && (
          <button
            type="button"
            disabled
            className="inline-flex items-center gap-2 rounded-md border border-warning/30 bg-warning/10 px-5 py-2.5 text-sm font-semibold text-warning"
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            Cancelling...
          </button>
        )}
      </div>

      {/* Execution Status */}
      {message && (
        <div
          className={`mt-3 rounded-md border px-3 py-2 text-sm ${
            status === "error"
              ? "border-failure/30 bg-failure/10 text-failure"
              : status === "cancelling"
                ? "border-warning/30 bg-warning/10 text-warning"
                : "border-success/30 bg-success/10 text-success"
          }`}
        >
          {message}

          {runId && (
            <Link
              to={`/runs/${encodeURIComponent(runId)}`}
              className="ml-2 inline-flex items-center gap-1 font-medium underline"
            >
              View live progress
            </Link>
          )}

          {runUrl && (
            <a
              href={runUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 inline-flex items-center gap-1 font-medium underline"
            >
              View GitHub Actions
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      )}
    </div>
  );
}
