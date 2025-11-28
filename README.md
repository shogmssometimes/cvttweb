# cvttweb

This repository contains the Collapse VTT web UI, the Collapse system, and supporting tools.

## Branching Policy
- This is a single-developer repository. The primary branch is `main`.
- All development and changes should be made directly on `main` or in feature branches that are merged back into `main`.
- The `gh-pages` branch has been removed; GitHub Pages deployments are performed via the Pages API using GitHub Actions and artifacts built from `main`.

## Deployment
- The repository uses `./.github/workflows/deploy-gh-pages.yml` to build and upload the release artifact and then deploy it using the Pages API.
- If you need to debug or preview builds, use `pages-api-test.yml` which builds and uploads separate `pages-node-18` / `pages-node-20` artifacts.

## Commands
- To delete a remote branch that you don't need anymore:
  ```bash
  git push origin --delete gh-pages
  git remote prune origin
  ```

If you prefer PR-based workflows instead of direct pushes, open a PR against `main` and merge after verification.

If you need me to remove other branches or tidy up backups, say the word and I’ll handle it.
