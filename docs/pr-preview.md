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

Vercel & Netlify (Recommended for HTTPS previews)
- Vercel and Netlify can publish PR previews automatically and over HTTPS, which is critical to validate PWA features and Service Workers on mobile devices.
- For Vercel: Connect the repo at https://vercel.com/new, set the build command to `cd collapse_web && npm ci && npm run build`, and the Output Directory to `collapse_web/docs/`. You can optionally create or use `vercel.json` included at the repo root to preconfigure the behavior.
- For Netlify: Connect your repository and set the build command and publish directory via the UI or the provided `netlify.toml` in the repo root.

CI Tests & Stability
- Playwright smoke tests are run on the deployed preview by the GitHub Actions PR workflow for same-repository PRs; Playwright HTML reports are created and uploaded as Actions artifacts.
 - Playwright smoke tests are run on the deployed preview by the GitHub Actions PR workflow for same-repository PRs; Playwright HTML reports are created and uploaded as Actions artifacts. The report HTML is also copied into the preview folder so you can view it directly at: `https://<owner>.github.io/<repo>/previews/pr-<n>/playwright-report/`.
- For fork PRs where the workflow cannot deploy to GH Pages, CI falls back to a local `vite preview` server in the runner and runs Playwright with `SKIP_SW_CHECK=true` (because local HTTP does not support SW registration).
- If Playwright tests are flaky, add more deterministic selectors and increase `waitFor` timeouts where necessary. The CI environment can be slower than local dev and needs slightly larger timeouts.


CI Tests
- The PR workflow also runs Playwright smoke tests against the deployed preview URL (mobile + desktop) to validate key interactions and PWA behaviors.
- Test results and HTML reports are uploaded as artifacts to the workflow run and can be downloaded from the Actions page.
 - For PRs from forks, the workflow cannot deploy a preview due to GitHub token restrictions. Instead, it runs Playwright tests against a local preview server and skips service worker checks.
