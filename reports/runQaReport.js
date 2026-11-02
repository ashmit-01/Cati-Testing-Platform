import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

// Resolve paths from the project root.
const projectRoot = process.cwd();

const reportPath = path.resolve(
    projectRoot,
    process.env.PLAYWRIGHT_JSON_OUTPUT_FILE || 'playwright-results.json'
);

const playwrightCli = path.resolve(
    projectRoot,
    'node_modules',
    '@playwright',
    'test',
    'cli.js'
);

const normalizerPath = path.resolve(
    projectRoot,
    'reports',
    'testNormalizer.js'
);

function runProcess(args) {
    return new Promise((resolve) => {
        const child = spawn(process.execPath, args, {
            cwd: projectRoot,
            env: process.env,
            stdio: 'inherit',
            shell: false
        });

        child.once('error', (error) => {
            console.error('Failed to start process:', error);
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

    if (!fs.existsSync(playwrightCli)) {
        throw new Error(`Playwright CLI not found: ${playwrightCli}`);
    }

    if (!fs.existsSync(normalizerPath)) {
        throw new Error(`Normalizer not found: ${normalizerPath}`);
    }

    // Remove the previous report so we never normalize stale results.
    if (fs.existsSync(reportPath)) {
        fs.unlinkSync(reportPath);
    }

    const playwrightExitCode = await runProcess([
        playwrightCli,
        'test'
    ]);

    console.log('\n========== NORMALIZING TEST RESULTS ==========\n');

    let normalizerExitCode = 1;

    if (fs.existsSync(reportPath)) {
        normalizerExitCode = await runProcess([
            normalizerPath
        ]);
    } else {
        console.error(`Playwright JSON report not found: ${reportPath}`);
    }

    console.log('\n========== QA RUN SUMMARY ==========\n');
    console.log('Playwright exit code:', playwrightExitCode);
    console.log('Normalizer exit code:', normalizerExitCode);

    const finalExitCode =
        normalizerExitCode !== 0
            ? normalizerExitCode
            : playwrightExitCode;

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