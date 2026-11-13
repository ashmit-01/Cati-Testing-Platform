
const GITHUB_API = "https://api.github.com";

export async function cancelGitHubWorkflow(githubRunId) {
  const {
    GITHUB_PAT,
    GITHUB_OWNER,
    GITHUB_REPO,
  } = process.env;

  if (!GITHUB_PAT || !GITHUB_OWNER || !GITHUB_REPO) {
    throw new Error("GitHub cancellation configuration is missing.");
  }

  const response = await fetch(
    `${GITHUB_API}/repos/${GITHUB_OWNER}/${GITHUB_REPO}/actions/runs/${encodeURIComponent(githubRunId)}/cancel`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GITHUB_PAT}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );

  if (response.status !== 202) {
    const details = await response.text();
    throw new Error(
      `GitHub cancellation failed (${response.status}): ${details}`
    );
  }

  return true;
}
