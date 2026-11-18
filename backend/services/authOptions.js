/**
 * Authentication choices a test case can use, and whether this platform has
 * the credentials for each one configured. Values only report availability;
 * secrets are never returned.
 */
export function getAuthOptions() {
    const hasUser = Boolean(process.env.TEST_EMAIL && process.env.TEST_PASSWORD);
    const hasAdmin = Boolean(
        (process.env.TEST_ADMIN_EMAIL && process.env.TEST_ADMIN_PASSWORD) || hasUser
    );
    return [
        { value: 'public', label: 'None (public endpoint)', available: true },
        {
            value: 'jwt',
            label: 'Test user login (TEST_EMAIL)',
            available: hasUser,
            hint: 'Set TEST_EMAIL and TEST_PASSWORD in .env'
        },
        {
            value: 'admin',
            label: 'Admin login (TEST_ADMIN_EMAIL)',
            available: hasAdmin,
            hint: 'Set TEST_ADMIN_EMAIL and TEST_ADMIN_PASSWORD in .env'
        },
        {
            value: 'internal-key',
            label: 'Internal API key (INTERNAL_API_KEY)',
            available: Boolean(process.env.INTERNAL_API_KEY),
            hint: 'Set INTERNAL_API_KEY in .env'
        },
        {
            value: 'custom',
            label: 'Custom (token, header or login)',
            available: true
        }
    ];
}
