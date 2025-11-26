# cmap — realistic map renderer

A minimal, static realistic map renderer that uses GeoJSON country polygons to draw the world map. The UI is intentionally simple and beginner-friendly — no advanced procedural controls are shown.

- Features:
- Realistic polygon-based base map using GeoJSON country polygons (world dataset)
- Default focus on North America with pan/zoom controls for detail
- Palette selection for color styles
- Always-visible subtle country borders and coastline outlines
- Download map as PNG
 - Fixed canvas size: 1920x1080 (so outputs always match this resolution)
 - Minimap: visual indicator in the lower-right showing where the viewport sits over the rendered map
 - Right-click context menu on the map with "Zoom here" and "Zoom out here"
 - Regions layer: translucent partitions over the map for coarse regional grouping

How to run locally:
1. Run a simple local static server:
```bash
# with node
npx http-server -c-1 . -p 8080
# or with python
python3 -m http.server 8080
```
2. Open http://localhost:8080 in your browser and use the "Refresh" button to draw the map.

Notes:
- The generator focuses on North America by default; pan/zoom to navigate for more detail.
- The world GeoJSON is fetched from a public dataset at runtime. If you prefer offline usage, we can embed a simplified GeoJSON file into the repo.

Optional: Deploy to GitHub Pages by creating a repository named `cmap` and pushing this folder as the `main` branch or use `gh-pages` branch.

Quick deployment using GitHub CLI:
```bash
cd /Users/sho/Desktop/collapsevtt/cmap
git init
git add .
git commit -m "chore: initial cmap realistic renderer"
# create remote and push
gh repo create shogmssometimes/cmap --public --source=. --remote=origin --push
```

Once pushed, GitHub Actions will deploy the site with the provided workflow on `main`.

