/**
 * Minimal leveled logger for the QA backend.
 *
 * Kept dependency-free on purpose (no winston/pino) since the backend's
 * logging needs are simple: timestamped, leveled console output that never
 * leaks secrets. Swap this out for a proper logging library later if needed.
 */

const REDACT_KEYS = [
    'password',
    'token',
    'apikey',
    'api_key',
    'secret',
    'mongo_uri',
    'authorization'
];

function redact(meta) {
    if (!meta || typeof meta !== 'object') return meta;

    const clone = Array.isArray(meta) ? [...meta] : { ...meta };

    for (const key of Object.keys(clone)) {
        const lower = key.toLowerCase();
        if (REDACT_KEYS.some((redactKey) => lower.includes(redactKey))) {
            clone[key] = '[REDACTED]';
        } else if (typeof clone[key] === 'object' && clone[key] !== null) {
            clone[key] = redact(clone[key]);
        }
    }

    return clone;
}

function timestamp() {
    return new Date().toISOString();
}

function write(level, message, meta) {
    const safeMeta = meta ? redact(meta) : undefined;
    const line = `[${timestamp()}] [${level.toUpperCase()}] ${message}`;

    if (safeMeta && Object.keys(safeMeta).length > 0) {
        // eslint-disable-next-line no-console
        console[level === 'error' ? 'error' : 'log'](line, safeMeta);
    } else {
        // eslint-disable-next-line no-console
        console[level === 'error' ? 'error' : 'log'](line);
    }
}

export const logger = {
    info: (message, meta) => write('info', message, meta),
    warn: (message, meta) => write('warn', message, meta),
    error: (message, meta) => write('error', message, meta),
    debug: (message, meta) => {
        if (process.env.NODE_ENV !== 'production') {
            write('debug', message, meta);
        }
    }
};
