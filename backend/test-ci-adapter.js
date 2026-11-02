import {
    adaptCiReport
} from './services/ciResultAdapter.js';

const sampleReport = {
    environment: 'staging',
    url: 'https://usecati.com',

    results: [
        {
            test: {
                title: 'Login should work',
                file: 'test-engine/ui/login.spec.js',
            },

            result: {
                status: 'passed',
                duration: 1200,
            },

            failure: null,
            evidence: {},
        },

        {
            test: {
                title: 'API should return 200',
                file: 'test-engine/api/specs/health.spec.js',
            },

            result: {
                status: 'failed',
                duration: 2500,
            },

            failure: {
                message: 'Expected 200, received 500',
                stack: 'Example stack trace',
                expected: 200,
                actual: 500,
            },

            evidence: {
                requests: [
                    {
                        endpoint: '/api/health',
                        method: 'GET',
                    },
                ],
            },
        },
    ],
};

const adapted = adaptCiReport(sampleReport);

console.log(JSON.stringify(adapted, null, 2));