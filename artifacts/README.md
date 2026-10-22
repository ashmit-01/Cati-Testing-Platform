# Test Artifacts

Failure evidence may include, depending on what the current implementation collects:
- Logs
- API response information
- Screenshots, videos and Playwright traces, only if enabled in `playwright.config.js` (currently `off`)

The AI failure analysis feature uses text evidence only; it does not read files in this folder.

Do not commit generated artifacts to Git unless the team explicitly decides to version them.
