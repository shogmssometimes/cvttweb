Simple GitHub Pages deploy (Pages API)

This repo builds the `collapse_web` app and publishes compiled artifacts directly to GitHub Pages using the Pages API. The automated CI workflow uploads the built `collapse_web/docs` artifact and deploys it directly via Actions, no `gh-pages` branch is required.

Deployment pipeline:
- CI: `.github/workflows/deploy-gh-pages.yml` builds `collapse_web` on `main` pushes, uploads `collapse_web/docs` as an artifact, and publishes via `actions/deploy-pages@v4`.
  - Note: This workflow is pinned to Node 18 for stable builds because some Rollup native bindings work more reliably on Node 18.

Manual deploy:
- Build locally
  ```bash
  cd collapse_web
  npm ci
  npm run build
  ```
-- (Optional) Push to `gh-pages` manually (overwrite `gh-pages` with the built `docs` directory):
  ```bash
  # From repository root
  git checkout --orphan gh-pages-deploy
  git rm -rf .
  cp -R collapse_web/docs/* .
  git add .
  git commit -m "Manual deploy: update gh-pages"
  git push origin HEAD:gh-pages --force
  git checkout main
  git branch -D gh-pages-deploy
  ```

Notes:
- Keep `main` as the default branch for development.
- Protect `main` with required PR reviews and CI checks.
- With the Pages API approach the `gh-pages` branch is optional — if you prefer a visible branch with the built artifacts keep `gh-pages` and the `peaceiris` deployment method instead.
