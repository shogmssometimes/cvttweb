Simple GitHub Pages deploy

This repo builds the `collapse_web` app and publishes compiled artifacts to `gh-pages` branch for GitHub Pages to serve.

Deployment pipeline:
- CI: `.github/workflows/deploy-gh-pages.yml` builds `collapse_web` on `main` pushes and deploys `collapse_web/docs` to `gh-pages` using `peaceiris/actions-gh-pages@v3`.

Manual deploy:
- Build locally
  ```bash
  cd collapse_web
  npm ci
  npm run build
  ```
- Push to gh-pages manually (overwrite `gh-pages` with the built `docs` directory):
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
- Restrict direct pushes to `gh-pages` if you want only the action to update it.
