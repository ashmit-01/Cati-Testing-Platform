# Contributing

## Branching

Create a feature branch from the latest `develop`:

```bash
git checkout develop
git pull origin develop
git checkout -b feature/your-feature
```

## Commit

Use clear commits:

```bash
git add .
git commit -m "Add API authentication tests"
git push origin feature/your-feature
```

## Pull Request

Open a PR:

```text
feature/your-feature -> develop
```

Request review before merging.

## Rules

1. Do not push directly to `main`.
2. Avoid direct pushes to `develop` unless the team explicitly agrees.
3. Keep changes focused on your assigned module.
4. Pull/rebase/merge the latest `develop` before final PR integration when requested by the team.
5. Never commit `.env`, passwords, tokens, or API keys.
6. Do not modify CATI repositories for QA functionality.
7. Do not run destructive production tests without authorization.
