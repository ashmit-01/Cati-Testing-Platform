#!/usr/bin/env node
/**
 * Local test recorder.
 *
 *   npm run record -- <start-url> [--out file.json] [--keep-origin]
 *
 * Opens a real browser on THIS machine, records what you do, then asks a few
 * questions and writes a `.cati.json` file. Upload that file with
 * "Import" on the Test Cases page of the deployed dashboard.
 *
 * By default the start page and navigation steps are saved as paths
 * (e.g. /login), so the deployed runner replays them against its own
 * FRONTEND_URL instead of your localhost. Use --keep-origin to save full URLs.
 */
import { chromium } from '@playwright/test';
import { unlink, writeFile } from 'fs/promises';
import path from 'path';
import readline from 'readline/promises';
import { pageRecorder, addStep } from '../services/recorderCore.js';

const args = process.argv.slice(2);
const keepOrigin = args.includes('--keep-origin');
const outIndex = args.indexOf('--out');
const outArg = outIndex >= 0 ? args[outIndex + 1] : null;
const startUrl = args.find((a, i) => !a.startsWith('--') && args[i - 1] !== '--out');

if (!startUrl || !/^https?:\/\//i.test(startUrl)) {
    console.error('Usage: npm run record -- <http(s)://start-url> [--out file.json] [--keep-origin]');
    process.exit(1);
}

async function launch() {
    let firstError;
    for (const options of [{}, { channel: 'chrome' }, { channel: 'msedge' }]) {
        try {
            return await chromium.launch({ headless: false, ...options, args: ['--start-maximized'] });
        } catch (err) {
            firstError ??= err;
        }
    }
    console.error(`Could not start a browser: ${firstError.message.split('\n')[0]}`);
    console.error('Run "npx playwright install chromium" or install Chrome/Edge.');
    process.exit(1);
}

function toPortable(value) {
    if (keepOrigin) return value;
    try {
        const u = new URL(value);
        return `${u.pathname}${u.search}${u.hash}` || '/';
    } catch {
        return value;
    }
}

const slug = (s) => s.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30);

const session = { steps: [{ kind: 'navigate', value: startUrl }], lastAt: 0 };
let finalUrl = startUrl;

const browser = await launch();
const context = await browser.newContext({ viewport: null });
await context.exposeBinding('__catiRecord', (_s, step) => {
    if (step && step.kind && step.locator) {
        addStep(session, step);
        console.log(`  ${session.steps.length}. ${step.kind} ${step.locator.value}`);
    }
});
await context.addInitScript(pageRecorder);
const page = await context.newPage();
page.on('framenavigated', (frame) => { if (frame === page.mainFrame()) finalUrl = frame.url(); });

console.log(`\nRecording ${startUrl}\nDo your test in the browser, then close the browser window (or press Ctrl+C here).\n`);
await page.goto(startUrl, { waitUntil: 'domcontentloaded' }).catch((e) => console.error(`Could not open page: ${e.message.split('\n')[0]}`));

let done;
const closed = new Promise((resolve) => { done = resolve; });
browser.on('disconnected', done);
// Closing the last tab/window doesn't always end the browser process (Chrome/Edge
// can linger in the background), so treat "no pages left" as the end of recording.
const watchClose = (p) => p.on('close', () => {
    setTimeout(() => {
        if (context.pages().every((x) => x.isClosed())) browser.close().catch(() => {}).finally(done);
    }, 300);
});
context.on('page', watchClose);
watchClose(page);
// Ctrl+C while recording: close the browser and carry on to saving (no crash).
let interrupted = false;
const onSignal = () => {
    if (interrupted) return;
    interrupted = true;
    console.log('\nStopping recording...');
    browser.close().catch(() => {}).finally(done);
};
process.on('SIGINT', onSignal);
process.on('SIGTERM', onSignal);
await closed;

if (session.steps.length < 2) {
    console.error('\nNo steps were recorded. Nothing saved.');
    process.exit(1);
}

function buildPayload(name, testCaseId, priority, successText) {
    const assertions = successText
        ? [{ kind: 'visibleText', operator: 'equals', expected: successText }]
        : [{ kind: 'url', operator: 'equals', expected: new URL(finalUrl).pathname }];
    const actions = session.steps.map((s) => (s.kind === 'navigate' ? { ...s, value: toPortable(s.value) } : s));
    return {
        format: 'cati-testcase',
        version: 1,
        recordedAt: new Date().toISOString(),
        testCase: {
            testCaseId,
            name,
            type: 'UI',
            priority,
            precondition: '',
            active: false,
            input: { path: toPortable(startUrl) },
            definition: { actions, assertions },
            expectedResult: assertions
        }
    };
}

// Autosave first, so a crash or Ctrl+C in the prompts can never lose the recording.
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, '').replace('T', '-');
const draftId = `UI-${stamp}`;
const draftPath = path.resolve(outArg || `recording-${stamp}.cati.json`);
const draftPayload = buildPayload(`Recorded test ${stamp}`, draftId, 'MEDIUM', '');
await writeFile(draftPath, JSON.stringify(draftPayload, null, 2));
console.log(`\nCaptured ${session.steps.length} steps. Autosaved to ${draftPath}`);

// Questions are optional: blank answers, Ctrl+C or closed input keep the autosaved file.
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
let aborted = false;
rl.on('SIGINT', () => { aborted = true; rl.close(); });
rl.on('close', () => { aborted = true; });
const ask = async (q, def = '') => {
    if (aborted) return def;
    try {
        return (await rl.question(def ? `${q} [${def}]: ` : `${q}: `)).trim() || def;
    } catch {
        aborted = true;
        return def;
    }
};

console.log('Optional: name it now (leave blank or press Ctrl+C to keep the autosaved file).\n');
const name = await ask('Test name');
let finalPath = draftPath;
if (name && !aborted) {
    const testCaseId = await ask('Case ID', slug(name) || draftId);
    const priority = (await ask('Priority (LOW/MEDIUM/HIGH/CRITICAL)', 'MEDIUM')).toUpperCase();
    const successText = await ask('Text that must be visible at the end (blank = check final URL path)');
    if (!aborted) {
        finalPath = path.resolve(outArg || `${testCaseId.toLowerCase()}.cati.json`);
        await writeFile(finalPath, JSON.stringify(buildPayload(name, testCaseId, priority, successText), null, 2));
        if (finalPath !== draftPath) await unlink(draftPath).catch(() => {});
    }
}
rl.close();

console.log(`\nSaved ${finalPath}\nUpload it via "Import" on the Test Cases page. Rename it there if it was autosaved.`);
console.log('Note: typed values (including passwords) are stored in the file as typed.');
process.exit(0);
