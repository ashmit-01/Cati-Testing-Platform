
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const reportPath = path.resolve(
  process.env.PLAYWRIGHT_JSON_OUTPUT_FILE ||
  'playwright-results.json'
);

const command = process.platform === 'win32' ? 'npx.cmd' : 'npx';

if (fs.existsSync(reportPath)) {
  fs.unlinkSync(reportPath);
}

function runProcess(executable, args) {
  return new Promise((resolve) => {
    const child = spawn(executable, args, {
      env: process.env,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });

    child.once('error', (error) => {
      console.error(`Failed to start ${executable}:`, error);
      resolve(1);
    });

    child.once('close', (code, signal) => {
      if (signal) {
        console.error(`Process terminated by signal: ${signal}`);
        resolve(1);
        return;
      }

      resolve(code ?? 1);
    });
  });
}

async function main() {
  console.log('\n========== CATI QA TEST RUN ==========\n');

  const playwrightExitCode = await runProcess(
    command,
    ['playwright', 'test'],
  );

  console.log('\n========== NORMALIZING TEST RESULTS ==========\n');

  let normalizerExitCode = 1;

  if (fs.existsSync(reportPath)) {
    normalizerExitCode = await runProcess(
      process.execPath,
      ['reports/testNormalizer.js'],
    );
  } else {
    console.error(
      `Playwright JSON report not found: ${reportPath}`
    );
  }

  console.log('\n========== QA RUN SUMMARY ==========\n');
  console.log('Playwright exit code:', playwrightExitCode);
  console.log('Normalizer exit code:', normalizerExitCode);

  const finalExitCode =
    playwrightExitCode !== 0 ? playwrightExitCode :
    normalizerExitCode !== 0 ? normalizerExitCode :
    0;

  console.log(
    finalExitCode === 0
      ? 'QA run completed successfully.'
      : 'QA run completed with failures.'
  );

  process.exitCode = finalExitCode;
}

main().catch((error) => {
  console.error('Unexpected QA runner error:', error);
  process.exitCode = 1;
});
