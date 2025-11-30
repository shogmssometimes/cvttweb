# CS Matrix

A small static site scaffold called **csmatrix** — a place to experiment with social matrix visuals and components.  

## Local development

Install and run the static server in the `csmatrix` folder (Node required):

```bash
cd csmatrix
npm install
npm start
```

It will run `http-server` on port 8080 (open http://localhost:8080).

## Interactive Graph
The site now includes an interactive social matrix:
- Drag nodes to reposition (snaps to integer grid coordinates)
- Click to select a node and edit properties on the right
- Add nodes at the center using 'Add Node' button or tap the canvas (when 'Add Node' mode is active)
- Export/Import JSON to save or load graphs

### Coordinate system
- X axis: -6 (Distrust) on the left to +6 (Trust) on the right
- Y axis: +6 (Carte Blanche) at the top to -6 (Surveillance) at the bottom
Nodes snap to integer coordinates on the grid; you can edit X/Y in the node property panel.

## JSON import/export
Use the Import/Export controls to save or load social matrix data as JSON. Note: The simplified editor only includes nodes with position grid coords (no edges); global meters are stored in JSON meta.

## To push to GitHub Pages
If you want to publish this repository, create a GitHub repo `csmatrix`, push this folder, and enable Pages or add the workflow included in `.github`.

## Next steps
- Replace placeholder grid with your graph/matrix rendering.
- Add import/export of JSON for matrix configs.
- Add unit tests and build steps if you move to a bundler.
