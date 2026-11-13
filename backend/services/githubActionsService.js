
const GITHUB_API = "https://api.github.com";

function getGitHubConfig() {
  const { GITHUB_PAT, GITHUB_OWNER, GITHUB_REPO } = process.env;

  if (!GITHUB_PAT || !GITHUB_OWNER || !GITHUB_REPO) {
    throw new Error("GitHub Actions configuration is missing.");
  }

  return {
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    headers: {
      Authorization: `Bearer ${GITHUB_PAT}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  };
}

// Request cancellation of a GitHub Actions workflow.
export async function cancelGitHubWorkflow(githubRunId) {
  const config = getGitHubConfig();

  const response = await fetch(
    `${GITHUB_API}/repos/${config.owner}/${config.repo}/actions/runs/${encodeURIComponent(githubRunId)}/cancel`,
    {
      method: "POST",
      headers: config.headers,
    }
  );

  // GitHub can return 409 if the run has already completed.
  if (response.status !== 202 && response.status !== 409) {
    const details = await response.text();
    throw new Error(
      `GitHub cancellation failed (${response.status}): ${details}`
    );
  }

  return response.status === 202;
}

// Fetch the current status of a GitHub Actions workflow.
export async function getGitHubWorkflowRun(githubRunId) {
  const config = getGitHubConfig();

  const response = await fetch(
    `${GITHUB_API}/repos/${config.owner}/${config.repo}/actions/runs/${encodeURIComponent(githubRunId)}`,
    {
      method: "GET",
      headers: config.headers,
    }
  );

  if (!response.ok) {
    const details = await response.text();
    throw new Error(
      `GitHub status check failed (${response.status}): ${details}`
    );
  }

  const data = await response.json();

  return {
    id: String(data.id),
    status: data.status,
    conclusion: data.conclusion,
    runUrl: data.html_url,
  };
}
