import { spawn } from "node:child_process";
import { spawnSync } from "node:child_process";

const command = process.platform === "win32" ? "npx.cmd" : "npx";

const playwright = spawn(command, ["playwright", "test"], {
  env: process.env,
  shell: true,
  stdio: "inherit",
});

playwright.on("close", (exitCode) => {
  if (exitCode !== 0) {
    console.log(`Playwright finished with exit code ${exitCode}`);
  }

  const normalizer = spawnSync(
    process.execPath,
    ["reports/testNormalizer.js"],
    {
      stdio: "inherit",
      env: process.env,
    },
  );

  process.exit(exitCode ?? normalizer.status ?? 1);
});
