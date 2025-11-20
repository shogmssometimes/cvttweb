## Summary

Add a short summary of changes and the reason.

## Preview

This repository automatically creates a preview deployment for PRs using GitHub Pages. Once the workflow runs, you'll see a comment on this PR with a Preview URL like:

`https://${{ github.repository_owner }}.github.io/${{ github.event.repository.name }}/previews/pr-<PR_NUMBER>/`

Open it on a mobile device to verify PWA behavior and mobile UI.

## Notes

- The preview is deployed to the `gh-pages` branch under `previews/pr-<PR_NUMBER>` to avoid overwriting the main site.
- The preview is removed when the PR is closed.
