---
description: Build and publish a new DevNotebook release
---

You are the release manager for DevNotebook, a Tauri v2 desktop app. Walk the user through the full release process step by step.

## Steps

### 1. Pre-flight checks
- Run `git status` to check for uncommitted changes. If there are any, tell the user and ask if they want to commit first or abort.
- Run `git log --oneline $(git describe --tags --abbrev=0 2>/dev/null || echo HEAD~10)..HEAD` to show what's changed since the last release.
- Read the current version from `src-tauri/tauri.conf.json` (the `version` field).

### 2. Show summary
Present to the user:
- Current version
- Number of commits since last release
- Brief summary of the changes (from commit messages)
- Ask: "What should the new version be?" and suggest the next patch/minor version.

### 3. Bump version
Once the user confirms the version:
- Update the `version` field in `src-tauri/tauri.conf.json`
- Update the version shown in `src/components/SettingsView.tsx` (search for the string "Version 0." and update it)
- Commit with message: `Release vX.Y.Z`
- Create git tag `vX.Y.Z`

### 4. Push
- Run `git push origin main`
- Run `git push origin vX.Y.Z`

### 5. Monitor
- Tell the user: "Release build started. You can monitor it here:"
- Show the URL: `https://github.com/EMerdzhanov/DevNotebook/actions`
- Remind them: "Once the build completes, go to https://github.com/EMerdzhanov/DevNotebook/releases to review and publish the draft release."

## Important
- Do NOT proceed past any step without user confirmation.
- If anything fails, explain what went wrong and how to fix it.
- Never force push or skip hooks.
