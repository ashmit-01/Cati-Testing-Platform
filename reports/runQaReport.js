
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

// Available test suites and their directories.
const TEST_SUITES = {
    all: null,
    ui: 'test-engine/ui',
    api: 'test-engine/api',
    e2e: 'test-engine/e2e',
    websocket: 'test-engine/websocket',
    'ai-voice': 'test-engine/ai'
};

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

    // Read selected suite from environment.
    const selectedSuite = (
        process.env.TEST_SUITE || 'all'
    ).trim().toLowerCase();

    if (!Object.hasOwn(TEST_SUITES, selectedSuite)) {
        throw new Error(
            `Invalid TEST_SUITE: "${selectedSuite}". ` +
            `Available options: ${Object.keys(TEST_SUITES).join(', ')}`
        );
    }

    const selectedDirectory = TEST_SUITES[selectedSuite];

    console.log('Selected test suite:', selectedSuite);

    // Build Playwright command.
    const playwrightArgs = [
        playwrightCli,
        'test'
    ];

    if (selectedDirectory) {
        const testPath = path.resolve(
            projectRoot,
            selectedDirectory
        );

        if (!fs.existsSync(testPath)) {
            throw new Error(
                `Test directory not found: ${testPath}`
            );
        }

        playwrightArgs.push(selectedDirectory);

        console.log('Executing directory:', selectedDirectory);
    } else {
        console.log('Executing all Playwright tests.');
    }

    // Remove previous reports to prevent stale results.
    if (fs.existsSync(reportPath)) {
        fs.unlinkSync(reportPath);
    }

    // Execute selected Playwright tests.
    console.log('\n========== EXECUTING PLAYWRIGHT TESTS ==========\n');

    const playwrightExitCode = await runProcess(playwrightArgs);

    // Normalize generated JSON report.
    console.log('\n========== NORMALIZING TEST RESULTS ==========\n');

    let normalizerExitCode = 1;

    if (fs.existsSync(reportPath)) {
        normalizerExitCode = await runProcess([
            normalizerPath
        ]);
    } else {
        console.error(
            `Playwright JSON report not found: ${reportPath}`
        );
    }

    // Final summary.
    console.log('\n========== QA RUN SUMMARY ==========\n');

    console.log('Selected suite:', selectedSuite);
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
