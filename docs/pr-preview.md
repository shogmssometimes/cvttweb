# PR Preview (GitHub Pages)

This repository creates a preview deployment for each PR using a GitHub Action.

How it works
- On PR open/update/opened/synchronize/reopened, the action builds the site and copies the `collapse_web/docs/` output to `gh-pages/previews/pr-<PR_NUMBER>/`.
- The action comments a preview URL on the PR where you can open the build in a real device/browser for testing.
- When the PR is closed, the action removes the preview folder and comments that the preview was removed.

Notes
- Previews may not work on PRs from forks due to GitHub Actions' permissions for the forked branch. If the PR is from a fork, CI might not have write access and the preview step may fail.
- Previews are meant for QA and quick mobile device tests. They are not a replacement for production deployments.

Local testing
- Run the dev server locally with: `npm run dev -- --host` to open access from other devices on the LAN.
- For production-like builds: `npm run build` followed by `npm run preview`.
