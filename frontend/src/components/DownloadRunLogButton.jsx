import { useState } from "react";
import { Download, LoaderCircle } from "lucide-react";
import { api } from "../services/api.js";

async function readDownloadError(error) {
  const responseData = error?.response?.data;

  if (responseData instanceof Blob) {
    try {
      const text = await responseData.text();
      const payload = JSON.parse(text);
      return (
        payload.message || payload.error || "Unable to download this test log."
      );
    } catch {
      return "Unable to download this test log.";
    }
  }

  return (
    responseData?.message ||
    error?.message ||
    "Unable to download this test log."
  );
}

export default function DownloadRunLogButton({
  runId,
  available = false,
  running = false,
  compact = false,
  expiresAt = null,
}) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  async function handleDownload(event) {
    event?.stopPropagation();
    if (!runId || downloading || !available) return;

    setDownloading(true);
    setError("");

    try {
      const response = await api.get(
        `/api/test-runs/${encodeURIComponent(runId)}/log`,
        { responseType: "blob" },
      );

      const blob = new Blob([response.data], {
        type: response.headers["content-type"] || "text/plain;charset=utf-8",
      });
      const objectUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const disposition = response.headers["content-disposition"] || "";
      const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1];

      anchor.href = objectUrl;
      anchor.download = filename || `cati-test-run-${runId}.txt`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);
    } catch (downloadError) {
      setError(await readDownloadError(downloadError));
    } finally {
      setDownloading(false);
    }
  }

  if (!available) {
    return (
      <span
        className="text-xs text-secondary"
        title={
          running
            ? "The log will be available after this run finishes."
            : "The 30-day log retention period has ended."
        }
      >
        {running ? "After completion" : "Expired"}
      </span>
    );
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleDownload}
        disabled={downloading}
        title={
          expiresAt
            ? `Available until ${new Date(expiresAt).toLocaleString()}`
            : "Download the test execution log"
        }
        className={`inline-flex items-center gap-1.5 rounded-md border border-border text-xs font-medium text-primary transition-colors hover:border-info hover:text-info disabled:cursor-wait disabled:opacity-60 ${compact ? "px-2 py-1.5" : "px-3 py-2"}`}
      >
        {downloading ? (
          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Download className="h-3.5 w-3.5" />
        )}
        {downloading ? "Preparing…" : "Download log"}
      </button>
      {error && <span className="max-w-48 text-xs text-failure">{error}</span>}
    </div>
  );
}
