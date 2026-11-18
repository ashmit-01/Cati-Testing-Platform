/**
 * Validates the base URL a run targets (a branch deployment, staging, or a
 * local backend such as http://localhost:5000).
 *
 * API cases log in with the platform's test credentials (TEST_EMAIL,
 * INTERNAL_API_KEY, ...) against this URL, so it decides where those secrets
 * are sent. Set CATI_TARGET_ALLOWLIST (comma-separated hosts, "*." wildcard
 * allowed, e.g. "localhost,127.0.0.1,*.sslip.io") to restrict it.
 *
 * @returns {string|null} normalized URL without a trailing slash, or null when blank
 * @throws  {Error} when the URL is malformed or not allowed
 */
export function normalizeTargetUrl(raw, allowlist = process.env.CATI_TARGET_ALLOWLIST) {
    if (raw === undefined || raw === null || String(raw).trim() === '') return null;

    let url;
    try {
        url = new URL(String(raw).trim());
    } catch {
        throw new Error(`Target URL "${raw}" is not a valid URL.`);
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new Error('Target URL must start with http:// or https://');
    }
    if (url.username || url.password) {
        throw new Error('Target URL must not contain credentials.');
    }

    const patterns = String(allowlist || '')
        .split(',')
        .map((p) => p.trim().toLowerCase())
        .filter(Boolean);
    if (patterns.length > 0) {
        const host = url.hostname.toLowerCase();
        const allowed = patterns.some((pattern) =>
            pattern.startsWith('*.') ? host.endsWith(pattern.slice(1)) : host === pattern
        );
        if (!allowed) {
            throw new Error(`Target host "${host}" is not in CATI_TARGET_ALLOWLIST.`);
        }
    }

    return `${url.origin}${url.pathname}`.replace(/\/+$/, '');
}
