
const GITHUB_API = 'https://api.github.com';

const ALLOWED_TEST_SUITES = [
    'all',
    'ui',
    'api',
    'e2e',
    'websocket',
    'ai-voice'
];

export async function triggerGitHubWorkflow(req, res) {
    try {
        const {
            GITHUB_PAT,
            GITHUB_OWNER,
            GITHUB_REPO,
            GITHUB_WORKFLOW_ID,
            GITHUB_BRANCH
        } = process.env;

        // Validate GitHub configuration
        const missing = [];

        if (!GITHUB_PAT) missing.push('GITHUB_PAT');
        if (!GITHUB_OWNER) missing.push('GITHUB_OWNER');
        if (!GITHUB_REPO) missing.push('GITHUB_REPO');
        if (!GITHUB_WORKFLOW_ID) missing.push('GITHUB_WORKFLOW_ID');
        if (!GITHUB_BRANCH) missing.push('GITHUB_BRANCH');

        if (missing.length > 0) {
            return res.status(500).json({
                success: false,
                message: `Missing backend configuration: ${missing.join(', ')}`
            });
        }

        // Get selected test suite
        const testSuite = String(req.body?.testSuite || 'all')
            .trim()
            .toLowerCase();

        // Validate test suite
        if (!ALLOWED_TEST_SUITES.includes(testSuite)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid test suite selected.',
                allowedSuites: ALLOWED_TEST_SUITES
            });
        }

        const url =
            `${GITHUB_API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}` +
            `/actions/workflows/${GITHUB_WORKFLOW_ID}/dispatches`;

        console.log('Triggering CATI QA workflow:', {
            branch: GITHUB_BRANCH,
            testSuite
        });

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${GITHUB_PAT}`,
                Accept: 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ref: GITHUB_BRANCH,
                inputs: {
                    test_suite: testSuite
                }
            })
        });

        if (!response.ok) {
            const errorBody = await response.text();

            console.error('GitHub workflow dispatch failed:', {
                status: response.status,
                body: errorBody
            });

            return res.status(response.status).json({
                success: false,
                message: 'GitHub Actions could not be triggered.',
                details: errorBody
            });
        }

        return res.status(202).json({
            success: true,
            message: `${testSuite.toUpperCase()} tests triggered successfully.`,
            testSuite,
            workflowUrl:
                `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}` +
                `/actions/workflows/${GITHUB_WORKFLOW_ID}`,
            branch: GITHUB_BRANCH
        });

    } catch (error) {
        console.error('GitHub trigger error:', error);

        return res.status(500).json({
            success: false,
            message: 'Internal server error while triggering GitHub Actions.'
        });
    }
}
