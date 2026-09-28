import TestRun from '../models/TestRun.js';

/**
 * Generates an application-level unique run identifier, e.g. "RUN-20260926-001".
 *
 * This is deliberately NOT MongoDB's _id — runId is the stable, external,
 * human-friendly identifier used throughout the public API (see
 * ARCHITECTURE / task spec: "Do not confuse runId with MongoDB's _id").
 *
 * Uniqueness strategy: count how many runs already exist for today's date
 * prefix and use the next sequence number, zero-padded to 3 digits. Falls
 * back to a random suffix if, for any reason, the generated id already
 * exists (defensive, since this is not run under heavy concurrency).
 */
export async function generateRunId() {
    const now = new Date();
    const datePart = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0')
    ].join('');

    const prefix = `RUN-${datePart}-`;

    const countToday = await TestRun.countDocuments({
        runId: { $regex: `^${prefix}` }
    });

    let sequence = countToday + 1;
    let candidate = `${prefix}${String(sequence).padStart(3, '0')}`;

    // Defensive uniqueness check in case of a race or a gap in numbering.
    // eslint-disable-next-line no-await-in-loop
    while (await TestRun.exists({ runId: candidate })) {
        sequence += 1;
        candidate = `${prefix}${String(sequence).padStart(3, '0')}`;
    }

    return candidate;
}
