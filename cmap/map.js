// Vanilla JS map generator using value noise (seeded)
// Layers:
//  - Base terrain (noise)
//  - Region mask (GeoJSON for CAN, USA, MEX)
//  - Coastline overlay (pixel-level detection around water threshold)
//  - Country borders (GeoJSON stroke, subtle)
// The code is structured so additional layers (rivers, biomes, roads) can be
// added as further rendering passes after the base terrain is generated.

// Seeded RNG: Mulberry32 (small, simple)
function mulberry32(seed) {
  let t = seed >>> 0;
  return function() {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// Linear interpolation
function lerp(a, b, t) {
  return a + (b - a) * t;
}

// Smoothstep easing
function fade(t) {
  return t * t * (3 - 2 * t);
}

// Generate value noise grid and sample with bilinear interpolation
function valueNoise2D(seed, x, y, cellSize) {
  const xi = Math.floor(x / cellSize);
  const yi = Math.floor(y / cellSize);
  const xf = (x % cellSize) / cellSize;
  const yf = (y % cellSize) / cellSize;

  // pseudo-random corner values
  const a = pseudoGrid(seed, xi, yi);
  const b = pseudoGrid(seed, xi + 1, yi);
  const c = pseudoGrid(seed, xi, yi + 1);
  const d = pseudoGrid(seed, xi + 1, yi + 1);

  const u = fade(xf);
  const v = fade(yf);

  return lerp(lerp(a, b, u), lerp(c, d, u), v);
}

// Pseudo grid generation using seeded RNG with salt
function pseudoGrid(seed, x, y) {
  // create stable salt using bitmix of x,y
  const n = (x * 374761393 + y * 668265263 + seed) >>> 0;
  // derive small state
  const r = mulberry32((n ^ 0x9E3779B1) & 0xffffffff);
  return r(); // 0..1
}

// Fractal noise with octaves
function fractalNoise(seed, x, y, options) {
  let { scale, octaves, persistence } = options;
  let total = 0;
  let frequency = 1 / scale; // scale -> bigger values -> more island-like
  let amplitude = 1;
  let maxAmp = 0;
  for (let i = 0; i < octaves; i++) {
    const sample = valueNoise2D(seed, x * frequency, y * frequency, 1) * amplitude;
    total += sample;
    maxAmp += amplitude;
    amplitude *= persistence;
    frequency *= 2;
  }
  return total / maxAmp; // normalize 0..1
}

// Color palettes
const palettes = {
  classic: function(e) {
    // e is 0..1 elevation
    if (e < 0.4) {
      // water
      const t = e / 0.4;
      return lerpColor('#1b3b6f', '#1b78ff', t);
    } else if (e < 0.5) {
      const t = (e - 0.4) / 0.1;
      return lerpColor('#f0d9b5', '#d1b57b', t); // beach to sand
    } else if (e < 0.75) {
      const t = (e - 0.5) / 0.25;
      return lerpColor('#4bbf5b', '#2f8b3a', t); // grass
    } else if (e < 0.9) {
      const t = (e - 0.75) / 0.15;
      return lerpColor('#8b7a6b', '#80736d', t); // rocks
    } else {
      const t = (e - 0.9) / 0.1;
      return lerpColor('#eaeaea', '#ffffff', Math.min(t,1)); // snow
    }
  },
  grayscale: function(e) {
    const v = Math.round(e * 255);
    return `rgb(${v},${v},${v})`;
  },
  dessert: function(e) {
    // desert style
    if (e < 0.4) return lerpColor('#fff5d1', '#f7d69c', e/0.4);
    if (e < 0.7) return lerpColor('#f7d69c', '#e6b87b', (e-0.4)/0.3);
    return lerpColor('#e6b87b', '#d6a36a', (e-0.7)/0.3);
  }
};

// Hex to rgb then lerp
function hexToRgb(hex) {
  const h = hex.replace('#','');
  const bigint = parseInt(h, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return [r,g,b];
}

function lerpColor(a,b,t) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const r = Math.round(lerp(A[0],B[0],t));
  const g = Math.round(lerp(A[1],B[1],t));
  const bb = Math.round(lerp(A[2],B[2],t));
  return `rgb(${r},${g},${bb})`;
}

// Map generator
function generateMap(canvas, options) {
  const ctx = canvas.getContext('2d');
  canvas.width = options.width;
  canvas.height = options.height;
  // Offscreen buffer so we can clip to masks if needed
  const off = document.createElement('canvas');
  off.width = canvas.width; off.height = canvas.height;
  const octx = off.getContext('2d');
  const imgData = octx.createImageData(canvas.width, canvas.height);
  const data = imgData.data;
  const elev = new Float32Array(canvas.width * canvas.height);

  // Seed handling
  let seed = options.seedNumeric;
  const rand = mulberry32(seed);
  // seedNumeric is passed for the noise functions

  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const idx = (y * canvas.width + x) * 4;
      // fractal noise
      // project pixel to lon/lat for realistic region mapping if provided
      let lon, lat;
      if (options.bbox) {
        const p = xyToLonLat(x + 0.5, y + 0.5, canvas.width, canvas.height, options.bbox);
        lon = p.lon; lat = p.lat;
      } else {
        lon = (x / canvas.width) * options.width; lat = (y / canvas.height) * options.height;
      }

      const e = fractalNoise(options.seedNumeric, lon, lat, {
        scale: options.scale,
        octaves: options.octaves,
        persistence: options.persistence
      });
      // store elevation 0..1
      elev[y * canvas.width + x] = e;
      const paletteFn = palettes[options.palette] || palettes.classic;
      const col = paletteFn(e);

      // parse rgb string
      const match = col.match(/rgb\((\d+),(\d+),(\d+)\)/);
      if (match) {
        data[idx] = Number(match[1]);
        data[idx+1] = Number(match[2]);
        data[idx+2] = Number(match[3]);
        data[idx+3] = 255;
      } else {
        // fallback
        data[idx] = 0; data[idx+1] = 0; data[idx+2] = 0; data[idx+3] = 255;
      }
    }
  }
  octx.putImageData(imgData, 0, 0);

  const waterThreshold = (typeof options.coastThreshold === 'number') ? options.coastThreshold : 0.45;
  // If maskRegion and we have geojson features, clip by unioned path
  if (options.maskRegion && options.naFeatureCollection) {
    const maskPath = geojsonToPath(options.naFeatureCollection, options.bbox, canvas.width, canvas.height);
    ctx.save();
    ctx.beginPath();
    ctx.clip(maskPath);
    ctx.drawImage(off, 0, 0);
    ctx.restore();
  } else {
    ctx.drawImage(off, 0, 0);
  }

  // Coastline overlay if requested
  if (options.showCoastline) {
    const overlay = createCoastlineOverlay(elev, canvas.width, canvas.height, waterThreshold);
    const coastImage = ctx.createImageData(canvas.width, canvas.height);
    for (let i = 0; i < overlay.length; i++) {
      if (overlay[i]) {
        const id = i * 4;
        // coastline color (soft white)
        coastImage.data[id] = 255;
        coastImage.data[id+1] = 255;
        coastImage.data[id+2] = 240;
        coastImage.data[id+3] = 200;
      } else {
        coastImage.data[i*4+3] = 0;
      }
    }
    ctx.putImageData(coastImage, 0, 0);
  }

  // Draw country borders
  if (options.showBorders && options.naFeatureCollection) {
    const borderPath = geojsonToPath(options.naFeatureCollection, options.bbox, canvas.width, canvas.height);
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1.0;
    ctx.setLineDash([2,2]);
    ctx.stroke(borderPath);
    ctx.restore();
  }
}

// Project lon/lat to canvas XY using equirectangular projection
function lonLatToXY(lon, lat, width, height, bbox) {
  const { west, east, north, south } = bbox;
  const x = ((lon - west) / (east - west)) * width;
  const y = ((north - lat) / (north - south)) * height;
  return { x, y };
}

function xyToLonLat(x, y, width, height, bbox) {
  const { west, east, north, south } = bbox;
  const lon = west + (x / width) * (east - west);
  const lat = north - (y / height) * (north - south);
  return { lon, lat };
}

// Convert GeoJSON features to Path2D (equirectangular projection)
function geojsonToPath(featureCollection, bbox, width, height) {
  const path = new Path2D();
  function drawRing(coords) {
    coords.forEach((pt, i) => {
      const [lon, lat] = pt;
      const p = lonLatToXY(lon, lat, width, height, bbox);
      if (i === 0) path.moveTo(p.x, p.y);
      else path.lineTo(p.x, p.y);
    });
  }
  featureCollection.features.forEach(f => {
    const geom = f.geometry;
    if (!geom) return;
    if (geom.type === 'Polygon') {
      geom.coordinates.forEach(ring => { drawRing(ring); path.closePath(); });
    } else if (geom.type === 'MultiPolygon') {
      geom.coordinates.forEach(poly => { poly.forEach(ring => { drawRing(ring); path.closePath(); }); });
    }
  });
  return path;
}

// Compute centroid of a polygon (approx using average of points)
function polygonCentroidCoords(coords) {
  let x = 0, y = 0, n = 0;
  coords.forEach(pt => { x += pt[0]; y += pt[1]; n++; });
  return { lon: x / n, lat: y / n };
}

function getCountryColorByLatLon(lat, lon, paletteName) {
  // Simple lat-based biome shading + a tiny deterministic noise for country variation
  const tLat = Math.abs(lat) / 90; // 0..1 from equator->poles
  // base temperature factor
  let color;
  if (tLat > 0.75) {
    color = '#cbd5e1'; // tundra/ice
  } else if (tLat > 0.55) {
    color = '#8ec07c'; // boreal
  } else if (tLat > 0.38) {
    color = '#60a36f'; // temperate
  } else if (tLat > 0.18) {
    color = '#b7dba3'; // subtropical/grass
  } else {
    color = '#e7c87c'; // tropical/desert-ish
  }
  return color;
}

// Draw world or region features using polygon fill styles based on centroid lat/lon
// NOTE: we render the world polygon base to an offscreen canvas and then
// allow pan/zoom in the main canvas by drawing a source rect of the
// offscreen canvas into the visible canvas.
// Cache world renders keyed by bbox + scale to avoid recomputing expensive full renders
const worldRenderCache = new Map();
// Cache for Overpass queries (rivers/roads) to avoid repeated network requests
const overpassCache = new Map();
// Region worker helper - instantiate a Worker if available to offload heavy voronoi/lloyd computations
let regionWorker = null;
let regionWorkerReqId = 1;
const regionWorkerPending = new Map();
try {
  regionWorker = new Worker('regionWorker.js');
  regionWorker.onmessage = function(e) {
    const d = e.data; if (!d) return; const p = regionWorkerPending.get(d.reqId); if (!p) return;
    if (d.error) p.reject(new Error(d.error)); else p.resolve(d);
    regionWorkerPending.delete(d.reqId);
  };
} catch (err) { regionWorker = null; }

function computeVoronoiWithWorker({ gridW, gridH, img, seeds, riverMask, iterations, bbox }) {
  return new Promise((resolve, reject) => {
    if (!regionWorker) return reject(new Error('No region worker'));
    const reqId = regionWorkerReqId++;
    // copy image data and river mask to avoid transferring main thread buffers
    const imgCopy = new Uint8ClampedArray(img).buffer;
    const transfer = [imgCopy];
    let riverBuf = null;
    if (riverMask) { riverBuf = new Uint8Array(riverMask).buffer; transfer.push(riverBuf); }
    regionWorkerPending.set(reqId, { resolve, reject });
    try {
      regionWorker.postMessage({ type: 'compute', reqId, gridW, gridH, imgBuffer: imgCopy, seeds, riverMaskBuffer: riverBuf, iterations, bbox }, transfer);
    } catch (err) {
      regionWorkerPending.delete(reqId);
      reject(err);
    }
  });
}
function renderWorldOffscreen(features, baseWidth, baseHeight, options) {
  try {
    const key = JSON.stringify({ bbox: options.bbox, baseWidth, baseHeight, palette: options.palette });
    if (worldRenderCache.has(key)) return worldRenderCache.get(key);
  } catch (e) { /* ignore */ }
  
  // create offscreen canvas with full world render
  const off = document.createElement('canvas');
  off.width = baseWidth; off.height = baseHeight;
  const ctx = off.getContext('2d');
  // clear background (ocean)
  ctx.fillStyle = '#71a6d5'; // ocean
  ctx.fillRect(0,0,off.width, off.height);

  // draw countries
  features.features.forEach((f, idx) => {
    const geom = f.geometry;
    if (!geom) return;
    const path = new Path2D();
      if (geom.type === 'Polygon') {
        geom.coordinates.forEach(ring => {
          ring.forEach((pt, i) => {
            const p = lonLatToXY(pt[0], pt[1], baseWidth, baseHeight, options.bbox);
          if (i === 0) path.moveTo(p.x, p.y);
          else path.lineTo(p.x, p.y);
        });
      });
    } else if (geom.type === 'MultiPolygon') {
      geom.coordinates.forEach(poly => {
        poly.forEach(ring => {
          ring.forEach((pt, i) => {
            const p = lonLatToXY(pt[0], pt[1], baseWidth, baseHeight, options.bbox);
            if (i === 0) path.moveTo(p.x, p.y);
            else path.lineTo(p.x, p.y);
          });
        });
      });
    }
    // centroid approx
    const sampleRing = (geom.type === 'Polygon') ? geom.coordinates[0] : geom.coordinates[0][0];
    const centroid = polygonCentroidCoords(sampleRing);
    const fill = getCountryColorByLatLon(centroid.lat, centroid.lon, options.palette);
    ctx.fillStyle = fill;
    ctx.fill(path);
    // stroke subtle borders
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 0.8;
    ctx.stroke(path);
  });
  // coastline outline always (subtle)

  // coastline outline always shown
  // draw coastline using country edges
  // (we already draw fill+stroke; add an extra subtle line for the coastline)
  {
    // stroke coastlines by drawing country edges with darker stroke
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 0.5;
    features.features.forEach(f => {
      const geom = f.geometry;
      if (!geom) return;
      const path = new Path2D();
      if (geom.type === 'Polygon') {
        geom.coordinates.forEach(ring => {
          ring.forEach((pt, i) => {
            const p = lonLatToXY(pt[0], pt[1], baseWidth, baseHeight, options.bbox);
            if (i === 0) path.moveTo(p.x, p.y);
            else path.lineTo(p.x, p.y);
          });
        });
      } else if (geom.type === 'MultiPolygon') {
        geom.coordinates.forEach(poly => {
          poly.forEach(ring => {
            ring.forEach((pt, i) => {
              const p = lonLatToXY(pt[0], pt[1], baseWidth, baseHeight, options.bbox);
              if (i === 0) path.moveTo(p.x, p.y);
              else path.lineTo(p.x, p.y);
            });
          });
        });
      }
      ctx.stroke(path);
    });
  }
  
  // borders always shown (subtle dashed line)
    const path = geojsonToPath(features, options.bbox, off.width, off.height);
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 1.0;
    ctx.setLineDash([2,2]);
    ctx.stroke(path);
    ctx.restore();
  // add gentle coastline shadow under the coastline to give depth
  ctx.save();
  ctx.strokeStyle = 'rgba(0,0,0,0.12)'; ctx.lineWidth = 2.5; ctx.stroke(path);
  ctx.restore();
  // add a soft texture overlay (subtle paper-like noise)
  applyNoiseTexture(ctx, off.width, off.height, options.seedNumeric);
  try { if (key) worldRenderCache.set(key, off); } catch (err) { /* ignore cache set */ }
  return off;
}

function applyNoiseTexture(ctx, w, h, seed) {
  // small tiled texture with low opacity to provide subtle detail
  const tile = document.createElement('canvas'); tile.width = 256; tile.height = 256; const tctx = tile.getContext('2d');
  const id = tctx.createImageData(tile.width, tile.height);
  const rand = mulberry32((seed || 0) + 12345);
  for (let i = 0; i < id.data.length; i += 4) {
    const v = 200 + Math.floor((rand() - 0.5) * 30); id.data[i] = v; id.data[i+1] = v; id.data[i+2] = v; id.data[i+3] = 20; // low alpha
  }
  tctx.putImageData(id, 0, 0);
  const pattern = ctx.createPattern(tile, 'repeat');
  ctx.save();
  ctx.globalAlpha = 0.08;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = pattern; ctx.fillRect(0,0,w,h);
  ctx.restore();
}

// Draw a Regions overlay on the offscreen canvas (translucent color grids for now)
  async function drawRegionsLayer(offCtx, bbox, baseWidth, baseHeight, regionCount, smoothPasses, useRivers, regionGridDivisor = 8) {
  // Weighted points for population/resources to bias region seeds
  const REGION_WEIGHT_POINTS = [
    { lon: -74.0060, lat: 40.7128, w: 3 }, // New York
    { lon: -118.2437, lat: 34.0522, w: 3 }, // Los Angeles
    { lon: -87.6298, lat: 41.8781, w: 2 }, // Chicago
    { lon: -99.1332, lat: 19.4326, w: 2 }, // Mexico City
    { lon: -79.3832, lat: 43.6532, w: 1.5 }, // Toronto
    { lon: -3.5, lat: 60.0, w: 0.2 }, // out-of-bbox placeholder (ignored)
    { lon: -123.1207, lat: 49.2827, w: 1.2 }, // Vancouver
    { lon: -122.3321, lat: 47.6062, w: 1.3 }, // Seattle
    { lon: -95.3698, lat: 29.7604, w: 1.8 }, // Houston
    { lon: -112.0740, lat: 33.4484, w: 1.1 }, // Phoenix
    { lon: -80.1918, lat: 25.7617, w: 1 }, // Miami
    { lon: -104.9903, lat: 39.7392, w: 1 }, // Denver
    { lon: -123.1162, lat: 49.2463, w: 0.8 }, // lower vancouver repeat
    { lon: -106.3468, lat: 56.1304, w: 0.6 }, // northern central canada
    { lon: -149.4937, lat: 64.2008, w: 0.6 }, // Alaska Anchorage/Talkeetna area
    { lon: -89.0, lat: 43.5, w: 0.9 }, // Great Lakes
    { lon: -95.9928, lat: 36.15398, w: 0.7 }, // Kansas region
    { lon: -111.0937, lat: 45.5202, w: 0.6 }, // Portland
    { lon: -100.0, lat: 45.0, w: 0.6 }, // Prairies
    { lon: -101.0, lat: 29.4, w: 0.7 }, // Texas
    { lon: -80.0, lat: 35.0, w: 0.7 }, // East coast mid
    { lon: -75.0, lat: 39.0, w: 0.7 }, // Mid-atlantic
    { lon: -88.0, lat: 19.0, w: 0.7 }, // Yucatan / Mexico gulf
  ].filter(p => p.lon >= bbox.west - 20 && p.lon <= bbox.east + 20 && p.lat >= bbox.south - 10 && p.lat <= bbox.north + 10);

  // small helper RNG: use a deterministic-ish value based on regionCount and sizes
  // smaller seedBrush for full quality; for quick previews, use smaller brushes
  const seedBrush = Math.abs(Math.floor((baseWidth + baseHeight) * (regionCount || 8) / Math.max(1, Math.round(regionGridDivisor/2))));
  const rrand = mulberry32(seedBrush);

  // grid resolution used for region rasterization / voronoi
  const gridW = Math.max(120, Math.round(baseWidth / Math.max(2, regionGridDivisor)));
  const gridH = Math.max(80, Math.round(baseHeight / Math.max(2, regionGridDivisor)));

  function randBetween(min, max) { return min + (max - min) * rrand(); }
  function pickWeighted(points) {
    const s = points.reduce((a, b) => a + b.w, 0);
    let t = rrand() * s;
    for (const pt of points) { t -= pt.w; if (t <= 0) return pt; }
    return points[points.length - 1];
  }

  // sample seeds near weighted points with jitter; ensure Alaska limited to 2 seeds
  function generateSeeds(k) {
    const seeds = [];
    for (let i = 0; i < k; i++) {
      const p = pickWeighted(REGION_WEIGHT_POINTS);
      // jitter with random gaussian-ish offset, but bounded to bbox
      const lon = Math.max(bbox.west, Math.min(bbox.east, p.lon + randBetween(-3, 3)));
      const lat = Math.max(bbox.south, Math.min(bbox.north, p.lat + randBetween(-2, 2)));
      seeds.push({ lon, lat });
    }
    // count Alaska seeds and reduce if >2
    const alaskaCount = seeds.filter(s => s.lon < -140 && s.lat > 55).length;
    if (alaskaCount > 2) {
      // move extra seeds more southwards
      let moved = 0;
      for (let i = 0; i < seeds.length && moved < alaskaCount - 2; i++) {
        const s = seeds[i];
        if (s.lon < -140 && s.lat > 55) {
          s.lat = Math.max(bbox.south + 5, s.lat - 12);
          moved++;
        }
      }
    }
    return seeds;
  }

  // grid-based voronoi: assign each grid cell to nearest seed
  let seeds = null;
  if (!window.__predefinedRegions) seeds = generateSeeds(regionCount || 8);
  let assignments = new Int32Array(gridW * gridH);
  // create a small downsampled version of the existing world render so we can skip ocean cells
  const temp = document.createElement('canvas'); temp.width = gridW; temp.height = gridH; const tctx = temp.getContext('2d');
  tctx.drawImage(offCtx.canvas, 0, 0, baseWidth, baseHeight, 0, 0, gridW, gridH);
  const img = tctx.getImageData(0, 0, gridW, gridH).data;

  // optionally fetch rivers to create a river mask (prevents regions crossing rivers)
  let riverMask = null;
  if (useRivers) {
    try {
      const riverGeo = await fetchRivers(bbox);
      riverMask = createRiverMask(riverGeo, gridW, gridH, bbox);
    } catch (err) { console.warn('fetchRivers failed', err); }
  }

  // If predefined regions are available, rasterize them into assignments and draw them
  if (window.__predefinedRegions) {
    try {
      const pre = window.__predefinedRegions;
      const rast = rasterizeRegionsToAssignments(pre, gridW, gridH, bbox, baseWidth, baseHeight);
      assignments = rast.assignments;
      // set reasonable seeds as centroids (for downstream cluster centroids calculation)
      seeds = (rast.centroids || []).map(c => ({ lon: c.lon, lat: c.lat })).filter(Boolean);
      try { window.__regionState = { assignments, gridW, gridH, bbox, baseWidth, baseHeight, seeds }; } catch (err) { /* ignore */ }
      // draw polygons on offCtx
      await drawPredefinedRegions(offCtx, pre, bbox, baseWidth, baseHeight);
      try { window.__regionPolygons = rast.lonlatPolys; } catch (err) { /* ignore */ }
      // continue to smoothed drawing logic below (assignments already set)
    } catch (err) { console.warn('Predefined region rasterization failed', err); }
  }

  // Voronoi assignment with Lloyd relaxation to produce organic, centroidal regions
  async function assignCellsToSeeds(seedsLocal, riverMask) {
    const assign = new Int32Array(gridW * gridH).fill(-1);
    // for each cell, assign to nearest seed by squared distance (grid coords)
    const seedGrid = seedsLocal.map(s => ({ x: (s.lon - bbox.west) / (bbox.east - bbox.west) * gridW, y: (bbox.north - s.lat) / (bbox.north - bbox.south) * gridH }));
    for (let gy = 0; gy < gridH; gy++) {
      for (let gx = 0; gx < gridW; gx++) {
        const pidx = (gy * gridW + gx) * 4;
        const r = img[pidx], g = img[pidx + 1], b = img[pidx + 2];
        const dr = r - 113, dg = g - 166, db = b - 213; const dist2 = dr * dr + dg * dg + db * db;
        if (dist2 < 45 * 45) continue; // ocean
        if (riverMask && riverMask[gy * gridW + gx]) continue; // river separator cell
        let best = -1; let bestD = Infinity;
        for (let si = 0; si < seedGrid.length; si++) {
          const dx = seedGrid[si].x - gx; const dy = seedGrid[si].y - gy; const d = dx * dx + dy * dy;
          if (d < bestD) { bestD = d; best = si; }
        }
        assign[gy * gridW + gx] = best;
      }
      // yield every 32 rows
      if (gy % 32 === 0) await new Promise(r => setTimeout(r, 0));
    }
    return assign;
  }

  async function lloydRelaxation(seedsLocal, iterations, riverMask) {
    let currentSeeds = seedsLocal.slice();
    for (let it = 0; it < iterations; it++) {
        const a = await assignCellsToSeeds(currentSeeds, riverMask);
      const clustersA = new Array(currentSeeds.length).fill(0).map(() => ({ sumX: 0, sumY: 0, n: 0 }));
      for (let gy = 0; gy < gridH; gy++) for (let gx = 0; gx < gridW; gx++) {
        const id = a[gy * gridW + gx];
        if (id === -1) continue;
        clustersA[id].sumX += gx; clustersA[id].sumY += gy; clustersA[id].n++;
      }
      const newSeeds = currentSeeds.map((s, idx) => {
        const c = clustersA[idx];
        if (!c || c.n === 0) return s; // keep same if no assignment
        const gx = c.sumX / c.n; const gy = c.sumY / c.n;
        // convert grid coords back to lon/lat
        const lon = bbox.west + (gx / gridW) * (bbox.east - bbox.west);
        const lat = bbox.north - (gy / gridH) * (bbox.north - bbox.south);
        // Slight jitter to avoid perfect grids
        return { lon: Math.max(bbox.west, Math.min(bbox.east, lon + randBetween(-0.5, 0.5))), lat: Math.max(bbox.south, Math.min(bbox.north, lat + randBetween(-0.5, 0.5))) };
      });
      currentSeeds = newSeeds;
      // yield occasionally to keep the UI responsive
      await new Promise(r => setTimeout(r, 0));
    }
    return { seeds: currentSeeds, assignments: await assignCellsToSeeds(currentSeeds, riverMask) };
  }

  // perform Lloyd relaxation with a small number of iterations, biasing to population centers
  const relaxIter = Math.max(1, Math.min(4, Math.floor((smoothPasses || 2))));
  // Prefer running heavy Voronoi/Lloyd work in the worker if available
  try {
    if (regionWorker) {
      const resp = await computeVoronoiWithWorker({ gridW, gridH, img, seeds, riverMask, iterations: relaxIter, bbox });
      // worker returns assignmentsBuffer
      if (resp && resp.assignmentsBuffer) {
        assignments = new Int32Array(resp.assignmentsBuffer);
      } else {
        const fallback = await lloydRelaxation(seeds, relaxIter, riverMask);
        assignments = fallback.assignments;
      }
    } else {
      const voronoiResult = await lloydRelaxation(seeds, relaxIter, riverMask);
      assignments = voronoiResult.assignments;
    }
  } catch (err) {
    console.warn('Region worker failed, falling back to main-thread computation', err);
    const voronoiResult = await lloydRelaxation(seeds, relaxIter, riverMask);
    assignments = voronoiResult.assignments;
  }

  // choose palette for regions
  function pastel(h) { return `hsla(${h}, 90%, 55%, 0.14)`; }
  const colors = [];
  for (let i = 0; i < seeds.length; i++) colors.push(pastel((i * 360 / seeds.length + (rrand() * 30 - 15)) % 360));

  

  // smoothing passes (majority filter) to simulate human-drawn regions
  let smooth = Math.max(0, Math.min(5, Number(smoothPasses || 0)));
  // reduce smoothing on low quality / large grid divisor to avoid long operations
  if (regionGridDivisor >= 16) smooth = Math.min(smooth, 1);
  else if (regionGridDivisor >= 8) smooth = Math.min(smooth, 2);
  else smooth = Math.min(smooth, 3);
  for (let pass = 0; pass < smooth; pass++) {
    const next = new Int32Array(assignments.length).fill(-1);
    for (let gy = 0; gy < gridH; gy++) {
      for (let gx = 0; gx < gridW; gx++) {
        const idx = gy * gridW + gx;
        const pidx = idx * 4;
        const r = img[pidx], g = img[pidx + 1], b = img[pidx + 2];
        const dr = r - 113, dg = g - 166, db = b - 213; const dist2 = dr * dr + dg * dg + db * db;
        if (dist2 < 45 * 45 || assignments[idx] === -1) { next[idx] = -1; continue; }
        const counts = {};
        for (let oy = -1; oy <= 1; oy++) {
          for (let ox = -1; ox <= 1; ox++) {
            const nx = gx + ox, ny = gy + oy;
            if (nx < 0 || nx >= gridW || ny < 0 || ny >= gridH) continue;
            const nid = assignments[ny * gridW + nx]; if (nid === -1) continue;
            counts[nid] = (counts[nid] || 0) + 1;
          }
        }
        // find majority
        let bestId = assignments[idx]; let bestCount = -1;
        for (const k in counts) { if (counts[k] > bestCount) { bestCount = counts[k]; bestId = Number(k); } }
        next[idx] = bestId;
      }
      if (gy % 16 === 0) await new Promise(r => setTimeout(r, 0));
    }
    assignments = next;
  }

  // merge small clusters
  const sizes = new Map();
  for (let i = 0; i < assignments.length; i++) {
    const v = assignments[i]; if (v === -1) continue; sizes.set(v, (sizes.get(v) || 0) + 1);
  }
  const minSize = Math.max(10, Math.round((gridW * gridH / Math.max(1, seeds.length)) * 0.08));
  const adjCounts = {}; // {cid: {neighborCid: count}}
  const neighborDirs = [[1,0],[-1,0],[0,1],[0,-1]];
  for (let gy = 0; gy < gridH; gy++) for (let gx = 0; gx < gridW; gx++) {
    const id = assignments[gy * gridW + gx]; if (id === -1) continue;
    if (!adjCounts[id]) adjCounts[id] = {};
    for (const [dx, dy] of neighborDirs) {
      const nx = gx + dx, ny = gy + dy; if (nx < 0 || nx >= gridW || ny < 0 || ny >= gridH) continue;
      const nid = assignments[ny * gridW + nx]; if (nid === -1 || nid === id) continue;
      adjCounts[id][nid] = (adjCounts[id][nid] || 0) + 1;
    }
  }
  for (const [cid, count] of sizes) {
    if (count >= minSize) continue;
    const neighbors = adjCounts[cid] || {};
    let best = null; let bestC = -1;
    for (const nidStr in neighbors) { const c = neighbors[nidStr]; if (c > bestC) { bestC = c; best = Number(nidStr); } }
    if (best !== null) {
      for (let i = 0; i < assignments.length; i++) { if (assignments[i] === cid) assignments[i] = best; }
    }
  }

  // publish final region state for click mapping and external use
  try { window.__regionState = { assignments, gridW, gridH, bbox, baseWidth, baseHeight, seeds }; } catch (err) { /* ignore */ }

  // draw on the offCtx: polygonize regions, smooth with Chaikin, and draw
  const cellW = baseWidth / gridW; const cellH = baseHeight / gridH;
  const clusters = new Array(seeds.length).fill(0).map(() => ({ sumX: 0, sumY: 0, n: 0 }));

  // helper functions
  function polygonArea(pts) {
    let a = 0; for (let i = 0, n = pts.length; i < n; i++) { const j = (i + 1) % n; a += pts[i].x * pts[j].y - pts[j].x * pts[i].y; } return a / 2; }
  function polygonCentroidXY(pts) {
    let cx = 0, cy = 0, a = 0; for (let i = 0, n = pts.length; i < n; i++) { const j = (i + 1) % n; const cross = pts[i].x * pts[j].y - pts[j].x * pts[i].y; cx += (pts[i].x + pts[j].x) * cross; cy += (pts[i].y + pts[j].y) * cross; a += cross; } a = a / 2; if (Math.abs(a) < 1e-9) return { x: pts[0].x, y: pts[0].y }; return { x: cx / (6 * a), y: cy / (6 * a) };
  }
  function pointKey(x, y) { return `${x},${y}`; }
  function parseKey(k) { const [a,b] = k.split(',').map(Number); return { x: a, y: b }; }
  function chaikinSmooth(points, iterations) {
    let pts = points.slice(); for (let it = 0; it < iterations; it++) { const next = []; for (let i = 0; i < pts.length; i++) { const p0 = pts[i]; const p1 = pts[(i + 1) % pts.length]; const q = { x: 0.75*p0.x + 0.25*p1.x, y: 0.75*p0.y + 0.25*p1.y }; const r = { x: 0.25*p0.x + 0.75*p1.x, y: 0.25*p0.y + 0.75*p1.y }; next.push(q); next.push(r); } pts = next; } return pts; }

  // Collect boundary segments per region
  const regionSegments = new Map();
  const snap = Math.max(1, Math.round((regionGridDivisor || 8) / 2));
  function snapCoord(v) { return Math.round(v / snap) * snap; }
  function addSeg(id, x1, y1, x2, y2) { x1 = snapCoord(x1); y1 = snapCoord(y1); x2 = snapCoord(x2); y2 = snapCoord(y2); if (!regionSegments.has(id)) regionSegments.set(id, []); regionSegments.get(id).push([pointKey(x1, y1), pointKey(x2, y2)]); }
  for (let gy = 0; gy < gridH; gy++) {
    for (let gx = 0; gx < gridW; gx++) {
      const id = assignments[gy * gridW + gx];
      if (id === -1 || id === null) continue;
      clusters[id].sumX += gx; clusters[id].sumY += gy; clusters[id].n++;
      const topId = gy - 1 >= 0 ? assignments[(gy - 1) * gridW + gx] : -1;
      const botId = gy + 1 < gridH ? assignments[(gy + 1) * gridW + gx] : -1;
      const leftId = gx - 1 >= 0 ? assignments[gy * gridW + (gx - 1)] : -1;
      const rightId = gx + 1 < gridW ? assignments[gy * gridW + (gx + 1)] : -1;
      const x = gx * cellW, y = gy * cellH, x2 = x + cellW, y2 = y + cellH;
      if (topId !== id) addSeg(id, x, y, x2, y);
      if (rightId !== id) addSeg(id, x2, y, x2, y2);
      if (botId !== id) addSeg(id, x2, y2, x, y2);
      if (leftId !== id) addSeg(id, x, y2, x, y);
    }
    if (gy % 32 === 0) await new Promise(r => setTimeout(r, 0));
  }
  // downsample points by returning every nth point to reduce complexity
  function downsample(points, step) {
    if (!points || points.length === 0) return points;
    if (!step || step <= 1) return points;
    const out = [];
    for (let i = 0; i < points.length; i += step) out.push(points[i]);
    return out;
  }

  // Build loops from segments
  async function buildLoopsForId(id) {
    const segs = regionSegments.get(id) || [];
    if (!segs.length) return [];
    const adj = new Map();
    function addAdj(a,b){ if (!adj.has(a)) adj.set(a, new Set()); adj.get(a).add(b); }
    segs.forEach(([a,b]) => { addAdj(a,b); addAdj(b,a); });
    const loops = [];
    const visited = new Set();
    function edgeKey(a,b){ return `${a}|${b}`; }
    let loopCount = 0;
    for (const a of adj.keys()){
      for (const b of adj.get(a)){
        const e = edgeKey(a,b); if (visited.has(e)) continue;
        let curr = a; let prev = null; const loop = [curr];
        while (true) {
          const neigh = [...adj.get(curr)].filter(x => x !== prev); if (!neigh.length) break;
          const next = neigh[0]; visited.add(edgeKey(curr, next)); prev = curr; curr = next; if (curr === a) break; loop.push(curr); if (loop.length > 20000) break;
        }
        if (loop.length > 2) loops.push(loop.map(parseKey));
        loopCount++;
        if (loopCount % 16 === 0) await new Promise(r => setTimeout(r, 0));
      }
    }
    return loops;
  }

  const regionsGeoPolygons = [];
  for (let rid = 0; rid < seeds.length; rid++) {
    const loops = await buildLoopsForId(rid);
    if (!loops || loops.length === 0) continue;
    const polygons = loops.map(pts => ({ pts, area: Math.abs(polygonArea(pts)) })).sort((a,b) => b.area - a.area);
    const fillColor = colors[rid];
    offCtx.fillStyle = fillColor; offCtx.strokeStyle = 'rgba(12,12,12,0.14)'; offCtx.lineWidth = 1.5;
    polygons.forEach(poly => {
      if (poly.area < (cellW * cellH * 2)) return;
      const maxSmooth = Math.max(1, Math.min(3, smoothPasses || 2));
      const limit = 800;
      const step = Math.ceil(poly.pts.length / limit);
      const ptsToSmooth = step > 1 ? downsample(poly.pts, step) : poly.pts;
      const smoothPts = chaikinSmooth(ptsToSmooth, maxSmooth);
      offCtx.beginPath(); offCtx.moveTo(smoothPts[0].x, smoothPts[0].y);
      for (let i = 1; i < smoothPts.length; i++) offCtx.lineTo(smoothPts[i].x, smoothPts[i].y);
      offCtx.closePath(); offCtx.fill(); offCtx.stroke();
      // store lon/lat polygon for export
      const lonlatPoly = smoothPts.map(p => ({ lon: bbox.west + (p.x / baseWidth) * (bbox.east - bbox.west), lat: bbox.north - (p.y / baseHeight) * (bbox.north - bbox.south) }));
      if (!regionsGeoPolygons[rid]) regionsGeoPolygons[rid] = [];
      regionsGeoPolygons[rid].push(lonlatPoly);
    });
  }
  try { window.__regionPolygons = regionsGeoPolygons; } catch (err) { /* ignore */ }
  // region boundaries are drawn by polygon strokes above, so grid-edge borders removed

  // regionCentroids: compute centroid from polygon if available, else fall back to cluster average
  const regionCentroids = new Array(seeds.length).fill(null);
  // attempt to derive centroids from regionSegments polygons
  for (let rid = 0; rid < seeds.length; rid++) {
    const segs = regionSegments.get(rid) || [];
    if (!segs.length) continue;
    const loops = await buildLoopsForId(rid);
    if (!loops || loops.length === 0) continue;
    // pick the largest loop and compute centroid
    const loopsPoly = loops.map(pts => ({ pts, area: Math.abs(polygonArea(pts)) })).sort((a,b) => b.area - a.area);
    const largest = loopsPoly[0]; if (!largest) continue;
    const maxSmooth = Math.max(1, Math.min(3, smoothPasses || 2));
    const limit = 800;
    const step = Math.ceil(largest.pts.length / limit);
    const ptsToSmooth = step > 1 ? downsample(largest.pts, step) : largest.pts;
    const smoothPts = chaikinSmooth(ptsToSmooth, maxSmooth);
    const centroidXY = polygonCentroidXY(smoothPts);
    // convert pixel XY to lon/lat
    const lon = bbox.west + (centroidXY.x / baseWidth) * (bbox.east - bbox.west);
    const lat = bbox.north - (centroidXY.y / baseHeight) * (bbox.north - bbox.south);
    regionCentroids[rid] = { lon, lat, gx: centroidXY.x / cellW, gy: centroidXY.y / cellH };
  }
  // fallback to pixel-average cluster centroids
  const clusterCentroids = clusters.map((c, i) => {
    if (c.n === 0) return null; const gx = c.sumX / c.n; const gy = c.sumY / c.n; const lon = bbox.west + (gx / gridW) * (bbox.east - bbox.west); const lat = bbox.north - (gy / gridH) * (bbox.north - bbox.south); return { lon, lat, gx, gy };
  });
  // prefer regionCentroids when available
  const effectiveCentroids = regionCentroids.map((rc, i) => rc || clusterCentroids[i]);

  // simple evocative name generator using expected locale hints
  const namePools = {
    north: ['Glacial', 'Frost', 'Boreal', 'Arctic', 'Fjord', 'Tundra'],
    pacific: ['Cascadia', 'Rainshore', 'Pacifica', 'Fogreach'],
    prairie: ['Prairie', 'Wheat', 'Golden', 'Plains', 'Windstep'],
    mountain: ['Rock', 'Ridge', 'Crown', 'Highland', 'Spine'],
    gulf: ['Gulf', 'Bay', 'Marsh', 'Delta'],
    east: ['Hearth', 'Harbor', 'Granite', 'Iron'],
    desert: ['Sun', 'Dune', 'Dust'],
    mexican: ['Sierra', 'Sol', 'Cenote', 'Basin']
  };
  const regionNames = [];
  effectiveCentroids.forEach((c, i) => {
    if (!c) { regionNames.push('Unknown'); return; }
    const parts = [];
    if (c.lat > 60) parts.push(namePools.north[Math.floor(rrand() * namePools.north.length)]);
    if (c.lon < -140 || (c.lon < -130 && c.lat > 50)) parts.push(namePools.pacific[Math.floor(rrand() * namePools.pacific.length)]);
    if (c.lon > -125 && c.lon < -95 && c.lat > 30 && c.lat < 55) parts.push(namePools.prairie[Math.floor(rrand() * namePools.prairie.length)]);
    if (c.lon > -120 && c.lon < -100 && c.lat > 35 && c.lat < 65) parts.push(namePools.mountain[Math.floor(rrand() * namePools.mountain.length)]);
    if (c.lat < 30) parts.push(namePools.gulf[Math.floor(rrand() * namePools.gulf.length)]);
    if (c.lon > -90 && c.lon < -65) parts.push(namePools.east[Math.floor(rrand() * namePools.east.length)]);
    if (c.lat < 25) parts.push(namePools.mexican[Math.floor(rrand() * namePools.mexican.length)]);
    if (parts.length === 0) parts.push(['Frontier', 'Belt', 'Shore', 'Wastes'][Math.floor(rrand() * 4)]);
    // combine unique parts and add an evocative noun
    const main = parts.join(' ');
    const suffix = ['Dominion', 'Marches', 'Expanse', 'Heights', 'Terrace', 'Province'][Math.floor(rrand() * 6)];
    regionNames.push(`${main} ${suffix}`);
  });

  // draw labels on offCtx (font size based on region area)
  offCtx.textAlign = 'center'; offCtx.textBaseline = 'middle';
  effectiveCentroids.forEach((c, i) => {
    if (!c || clusters[i].n < 8) return;
    const xy = lonLatToXY(c.lon, c.lat, baseWidth, baseHeight, bbox);
    const name = regionNames[i] || `Region ${i+1}`;
    const areaPixels = clusters[i].n * (cellW * cellH);
    const fontSize = Math.round(Math.max(12, Math.min(48, Math.sqrt(areaPixels) / 6)));
    offCtx.font = `bold ${fontSize}px sans-serif`;
    const pad = Math.max(8, Math.round(fontSize / 3));
    // draw rounded background
    const metrics = offCtx.measureText(name); const wRect = metrics.width + pad * 2; const hRect = fontSize + pad;
    const rx = xy.x - wRect / 2; const ry = xy.y - hRect / 2; const r = Math.max(6, Math.round(hRect / 6));
    offCtx.fillStyle = 'rgba(0,0,0,0.48)'; offCtx.beginPath(); offCtx.moveTo(rx + r, ry); offCtx.arcTo(rx + wRect, ry, rx + wRect, ry + hRect, r); offCtx.arcTo(rx + wRect, ry + hRect, rx, ry + hRect, r); offCtx.arcTo(rx, ry + hRect, rx, ry, r); offCtx.arcTo(rx, ry, rx + wRect, ry, r); offCtx.closePath(); offCtx.fill();
    // label text
    offCtx.fillStyle = 'rgba(255,255,255,0.95)'; offCtx.strokeStyle = 'rgba(0,0,0,0.6)'; offCtx.lineWidth = Math.max(1, Math.floor(fontSize / 6)); offCtx.strokeText(name, xy.x, xy.y + 1); offCtx.fillText(name, xy.x, xy.y + 1);
  });
}

// Create pixel-level coastline overlay by scanning elevation array
function createCoastlineOverlay(elev, width, height, threshold) {
  const overlay = new Uint8ClampedArray(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const isWater = elev[i] <= threshold;
      // check 4-neighbor
      let touchesOpposite = false;
      const neighbors = [[1,0],[-1,0],[0,1],[0,-1]];
      for (const [dx, dy] of neighbors) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
        const ni = ny * width + nx;
        const nIsWater = elev[ni] <= threshold;
        if (nIsWater !== isWater) { touchesOpposite = true; break; }
      }
      overlay[i] = touchesOpposite ? 255 : 0;
    }
  }
  return overlay;
}

// Fetch simple river geometries from Overpass given bbox
async function fetchRivers(bbox) {
  const pad = 0.02; const south = Math.max(-90, bbox.south - pad * (bbox.north - bbox.south));
  const north = Math.min(90, bbox.north + pad * (bbox.north - bbox.south));
  const west = Math.max(-180, bbox.west - pad * (bbox.east - bbox.west));
  const east = Math.min(180, bbox.east + pad * (bbox.east - bbox.west));
  const bboxStr = `${south},${west},${north},${east}`;
  if (overpassCache.has(bboxStr)) return overpassCache.get(bboxStr);
  // reconstruct bboxStr above
  const query = `[out:json][timeout:25];(way["waterway"~"river|stream|canal"](${bboxStr}););out geom;`;
  const resp = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: query });
  if (!resp.ok) throw new Error('Overpass request failed: ' + resp.status);
  const json = await resp.json();
  const elems = json.elements || [];
  const ways = elems.filter(e => e.type === 'way' && e.geometry && e.geometry.length);
  const out = ways.map(w => w.geometry.map(pt => ({ lon: pt.lon, lat: pt.lat })));
  try { overpassCache.set(bboxStr, out); } catch (err) { /* ignore */ }
  return out;
}

function createRiverMask(geoms, gridW, gridH, bbox) {
  const canvas = document.createElement('canvas'); canvas.width = gridW; canvas.height = gridH; const ctx = canvas.getContext('2d');
  ctx.clearRect(0,0,gridW,gridH); ctx.strokeStyle = 'rgba(0,0,0,1)'; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  function mapXY(lon, lat) { const fx = (lon - bbox.west) / (bbox.east - bbox.west); const fy = (bbox.north - lat) / (bbox.north - bbox.south); return { x: Math.round(fx * gridW), y: Math.round(fy * gridH) }; }
  geoms.forEach(line => { ctx.beginPath(); for (let i = 0; i < line.length; i++) { const p = mapXY(line[i].lon, line[i].lat); if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); } ctx.stroke(); });
  const id = ctx.getImageData(0,0,gridW,gridH).data; const mask = new Uint8Array(gridW * gridH);
  for (let i = 0; i < gridW * gridH; i++) mask[i] = id[i*4 + 3] > 10 ? 1 : 0;
  return mask;
}

// Load predefined regions from a mapping of country -> GeoJSON URL or FeatureCollection
async function loadPredefinedRegions(sources) {
  // sources: { CAN: urlOrObj, USA: urlOrObj, MEX: urlOrObj }
  const outFeatures = [];
  for (const code of ['CAN','USA','MEX']) {
    const src = sources && sources[code];
    if (!src) continue;
    try {
      let obj = null;
      if (typeof src === 'string') {
        const resp = await fetch(src);
        obj = await resp.json();
      } else {
        obj = src;
      }
      // Expect FeatureCollection or Feature(s)
      if (obj.type === 'FeatureCollection') {
        obj.features.forEach(f => outFeatures.push(f));
      } else if (obj.type === 'Feature') outFeatures.push(obj);
      else if (obj.features) obj.features.forEach(f => outFeatures.push(f));
    } catch (err) { console.warn('loadPredefinedRegions failed for', code, err); }
  }
  const fc = { type: 'FeatureCollection', features: outFeatures };
  try { window.__predefinedRegions = fc; } catch (err) { /* ignore */ }
  return fc;
}

// Rasterize a FeatureCollection of polygons into an assignments Int32Array grid
function rasterizeRegionsToAssignments(featureCollection, gridW, gridH, bbox, baseWidth, baseHeight) {
  // draw each feature into an offscreen grid canvas with a unique color index
  const cvs = document.createElement('canvas'); cvs.width = gridW; cvs.height = gridH; const ctx = cvs.getContext('2d');
  ctx.clearRect(0,0,gridW,gridH);
  function mapXY(lon, lat) { const fx = (lon - bbox.west) / (bbox.east - bbox.west); const fy = (bbox.north - lat) / (bbox.north - bbox.south); return { x: Math.round(fx * gridW), y: Math.round(fy * gridH) }; }
  const features = featureCollection.features || [];
  const idToPolys = [];
  for (let i = 0; i < features.length; i++) {
    const f = features[i]; if (!f || !f.geometry) continue;
    ctx.beginPath(); ctx.fillStyle = `rgb(${(i+1)&255},${((i+1)>>8)&255},${((i+1)>>16)&255})`;
    const geom = f.geometry;
    function drawRing(coords) {
      coords.forEach((pt, j) => { const p = mapXY(pt[0], pt[1]); if (j === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
    }
    if (geom.type === 'Polygon') {
      geom.coordinates.forEach(ring => { drawRing(ring); ctx.closePath(); });
    } else if (geom.type === 'MultiPolygon') {
      geom.coordinates.forEach(poly => { poly.forEach(ring => { drawRing(ring); ctx.closePath(); }); });
    }
    ctx.fill();
  }
  const img = ctx.getImageData(0,0,gridW,gridH).data;
  const assignments = new Int32Array(gridW * gridH).fill(-1);
  for (let y = 0; y < gridH; y++) for (let x = 0; x < gridW; x++) {
    const i = (y * gridW + x) * 4; const r = img[i], g = img[i+1], b = img[i+2];
    if (r === 0 && g === 0 && b === 0) { assignments[y * gridW + x] = -1; continue; }
    const idx = r + (g<<8) + (b<<16) - 1;
    assignments[y * gridW + x] = idx >= 0 ? idx : -1;
  }
  // compute centroids and lon/lat polygons per feature for UI
  const centroids = new Array(features.length).fill(null);
  const lonlatPolys = new Array(features.length).fill(null).map(() => []);
  for (let i = 0; i < features.length; i++) {
    const f = features[i]; if (!f || !f.geometry) continue;
    // try to derive centroid from geometry coordinates
    let coords = [];
    if (f.geometry.type === 'Polygon') coords = f.geometry.coordinates[0];
    else if (f.geometry.type === 'MultiPolygon') coords = f.geometry.coordinates[0][0] || [];
    if (coords && coords.length) {
      let sx = 0, sy = 0; coords.forEach(pt => { sx += pt[0]; sy += pt[1]; }); const lon = sx / coords.length; const lat = sy / coords.length; centroids[i] = { lon, lat };
      // store lonlat polys as provided
      if (f.geometry.type === 'Polygon') lonlatPolys[i].push(coords.map(c => ({ lon: c[0], lat: c[1] })));
      else if (f.geometry.type === 'MultiPolygon') f.geometry.coordinates.forEach(poly => { const ring = poly[0]; lonlatPolys[i].push(ring.map(c => ({ lon: c[0], lat: c[1] }))); });
    }
  }
  return { assignments, centroids, lonlatPolys };
}

// Draw predefined regions on the offscreen context using stored FeatureCollection
async function drawPredefinedRegions(offCtx, featureCollection, bbox, baseWidth, baseHeight) {
  if (!featureCollection || !featureCollection.features) return;
  const colors = []; for (let i = 0; i < featureCollection.features.length; i++) colors.push(`hsla(${(i*137.5)%360},80%,60%,0.14)`);
  featureCollection.features.forEach((f, idx) => {
    const geom = f.geometry; if (!geom) return;
    offCtx.beginPath();
    function drawRing(coords) { coords.forEach((pt, i) => { const p = lonLatToXY(pt[0], pt[1], baseWidth, baseHeight, bbox); if (i === 0) offCtx.moveTo(p.x, p.y); else offCtx.lineTo(p.x, p.y); }); }
    if (geom.type === 'Polygon') { geom.coordinates.forEach(ring => { drawRing(ring); offCtx.closePath(); }); }
    else if (geom.type === 'MultiPolygon') { geom.coordinates.forEach(poly => { poly.forEach(ring => { drawRing(ring); offCtx.closePath(); }); }); }
    offCtx.fillStyle = colors[idx] || 'rgba(255,255,255,0.06)'; offCtx.strokeStyle = 'rgba(12,12,12,0.14)'; offCtx.lineWidth = 1.5; offCtx.fill(); offCtx.stroke();
  });
}


// Convert seed string to numeric
function seedFromString(str) {
  if (!str || str === 'random') return Math.floor(Math.random() * 2**31);
  // simple hash
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

// UI wiring
function initUI() {
  const canvas = document.getElementById('map');
  // canvas is fixed to 1920x1080
  const widthInput = null;
  const heightInput = null;
    // Removed advanced and random controls; simplify
    const advancedControls = null;
    // advanced persistence input removed
    let windowClickHandlerRef = null;
    let attachedZoomSliderRef = null;
    let attachedSliderHandlerRef = null;
    let attachedMinimapHandlerRef = null;
  const paletteSelect = document.getElementById('palette');
  const regionsToggle = document.getElementById('regionsToggle');
  const regionsCountSlider = document.getElementById('regionsCount');
  const regionsCountLabel = document.getElementById('regionsCountLabel');
  const regionsSmoothSlider = document.getElementById('regionsSmooth');
  const regionsSmoothLabel = document.getElementById('regionsSmoothLabel');
  if (regionsCountSlider && regionsCountLabel) {
    // Force 21 regions - consistently use 21 regardless of slider
    regionsCountSlider.value = '21';
    regionsCountSlider.disabled = true; regionsCountSlider.hidden = true;
    regionsCountLabel.textContent = 'Regions: 21';
  }
  if (regionsSmoothSlider && regionsSmoothLabel) regionsSmoothLabel.textContent = 'Smoothing: ' + regionsSmoothSlider.value;
  const generateBtn = document.getElementById('generate');
  const downloadBtn = document.getElementById('download');
  const qualitySelect = document.getElementById('qualitySelect');
  const useRiversCheckbox = document.getElementById('useRivers');
  const exportRegionsBtn = document.getElementById('exportRegions');
  // Always show coastline and borders (no toggles)

  // Load GeoJSON for countries
  let worldFeatureCollection = null;
  let naFeatureCollection = null;
  const statusEl = document.getElementById('status');
  const worldGeojsonUrl = 'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson';
  fetch(worldGeojsonUrl)
    .then(r => r.json())
    .then(data => {
      worldFeatureCollection = data;
      // filter to USA/CAN/MEX (ISO_A3)
      const hawaiiBbox = {west: -161, east: -154, south: 18, north: 23};
      function inBbox(lon, lat, bbox) {
        return lon >= bbox.west && lon <= bbox.east && lat >= bbox.south && lat <= bbox.north;
      }
      function polygonCentroid(coords) {
        // coords is array of [lon,lat]
        let sx = 0, sy = 0, n = 0;
        coords.forEach(pt => { sx += pt[0]; sy += pt[1]; n++; });
        return [sx / n, sy / n];
      }
      const features = data.features.map(f => {
        // strip polygons that are Hawaii (for USA)
        const props = f.properties || {};
        const iso = (props.ISO_A3 || props.iso_a3 || props.ADM0_A3 || props['ISO_A3']);
        if (iso === 'USA' && f.geometry) {
          if (f.geometry.type === 'MultiPolygon') {
            const newPolys = f.geometry.coordinates.filter(poly => {
              // decide by centroid of exterior ring
              const exterior = poly[0];
              const [cx, cy] = polygonCentroid(exterior);
              if (inBbox(cx, cy, hawaiiBbox)) return false;
              return true;
            });
            return { ...f, geometry: { type: 'MultiPolygon', coordinates: newPolys } };
          } else if (f.geometry.type === 'Polygon') {
            const [cx, cy] = polygonCentroid(f.geometry.coordinates[0]);
            if (inBbox(cx, cy, hawaiiBbox)) {
              // drop this polygon
              return null;
            }
          }
        }
        return f;
      }).filter(Boolean).filter(f => {
        const props = f.properties || {};
        const iso = (props.ISO_A3 || props.ISO_A3_US || props.iso_a3 || props.ISO_A3) || props.ADM0_A3 || props['ISO_A3'];
        // fallback by name
        const name = (props.ADMIN || props.name || props.NAME || '').toLowerCase();
        return iso === 'USA' || iso === 'CAN' || iso === 'MEX' || name.includes('united states') || name.includes('canada') || name.includes('mexico');
      });
      naFeatureCollection = { type: 'FeatureCollection', features };
      console.log('Loaded world features:', worldFeatureCollection.features.length);
      console.log('Loaded NA country features:', features.length);
      if (statusEl) statusEl.textContent = 'GeoJSON loaded: North America features ready';
    })
    .catch(err => { console.warn('Could not load world geojson for masking:', err); if (statusEl) statusEl.textContent = 'GeoJSON load failed'; });

  let camera = null; // {srcX, srcY, srcW, srcH}
  let lastGenId = 0; // incrementing ID to cancel stale background tasks

  function drawView(canvas, offCanvas) {
    if (!camera) {
      camera = { srcX: 0, srcY: 0, srcW: offCanvas.width, srcH: offCanvas.height };
    }
    const ctx = canvas.getContext('2d');
    // clamp camera
    camera.srcX = Math.max(0, Math.min(camera.srcX, offCanvas.width - camera.srcW));
    camera.srcY = Math.max(0, Math.min(camera.srcY, offCanvas.height - camera.srcH));
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(offCanvas, camera.srcX, camera.srcY, camera.srcW, camera.srcH, 0, 0, canvas.width, canvas.height);
    // update minimap
    const mini = document.getElementById('minimap');
    if (mini) {
      const mctx = mini.getContext('2d');
      // scale the whole world into minimap
      mctx.clearRect(0, 0, mini.width, mini.height);
      mctx.drawImage(offCanvas, 0, 0, offCanvas.width, offCanvas.height, 0, 0, mini.width, mini.height);
      // draw viewport rectangle
      mctx.strokeStyle = 'rgba(255,255,255,0.8)';
      mctx.lineWidth = 2;
      mctx.setLineDash([4,4]);
      const rx = (camera.srcX / offCanvas.width) * mini.width;
      const ry = (camera.srcY / offCanvas.height) * mini.height;
      const rw = (camera.srcW / offCanvas.width) * mini.width;
      const rh = (camera.srcH / offCanvas.height) * mini.height;
      mctx.strokeRect(rx + 0.5, ry + 0.5, Math.max(1, rw - 1), Math.max(1, rh - 1));
      mctx.setLineDash([]);
    }
  // update zoom slider to reflect current camera zoom
  const zoomSlider = document.getElementById('zoomSlider');
  if (zoomSlider && camera && offCanvas) {
    const minSrcW = Math.max(100, Math.round(offCanvas.width / 20));
    const maxSrcW = offCanvas.width;
    const t = (camera.srcW - minSrcW) / (maxSrcW - minSrcW);
    const val = Math.round(1 + (t * 99));
    zoomSlider.value = Math.max(1, Math.min(100, val));
  }
  }

  function clampCamValues(cam, off) {
    cam.srcW = Math.max(1, Math.min(cam.srcW, off.width));
    cam.srcH = Math.max(1, Math.min(cam.srcH, off.height));
    cam.srcX = Math.max(0, Math.min(cam.srcX, off.width - cam.srcW));
    cam.srcY = Math.max(0, Math.min(cam.srcY, off.height - cam.srcH));
  }

  function setupPanZoom(canvas, offCanvas, bbox) {
    let dragging = false;
    let lastMouse = { x: 0, y: 0 };
    let startCam = null;
    canvas.onwheel = function(e) {
      e.preventDefault();
      const delta = e.deltaY;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const srcW = camera.srcW;
      const srcH = camera.srcH;
      const worldX = camera.srcX + (mx / canvas.width) * srcW;
      const worldY = camera.srcY + (my / canvas.height) * srcH;
      const zoomFactor = delta > 0 ? 1.2 : 0.8;
      const newSrcW = Math.min(offCanvas.width, Math.max(20, srcW * zoomFactor));
      const newSrcH = (newSrcW * canvas.height) / canvas.width;
      let newSrcX = worldX - (mx / canvas.width) * newSrcW;
      let newSrcY = worldY - (my / canvas.height) * newSrcH;
      camera.srcW = newSrcW; camera.srcH = newSrcH; camera.srcX = newSrcX; camera.srcY = newSrcY;
      clampCamValues(camera, offCanvas);
      drawView(canvas, offCanvas);
    };
    // connect zoom slider
    const zoomSlider = document.getElementById('zoomSlider');
    if (zoomSlider) {
      if (attachedZoomSliderRef && attachedSliderHandlerRef) {
        attachedZoomSliderRef.removeEventListener('input', attachedSliderHandlerRef);
      }
      attachedZoomSliderRef = zoomSlider;
      attachedSliderHandlerRef = (ev) => {
        const v = Number(zoomSlider.value);
        // slider 1..100 maps to srcW between minSrcW..offCanvas.width
        const minSrcW = Math.max(100, Math.round(offCanvas.width / 20));
        const maxSrcW = offCanvas.width;
        const t = (v - 1) / 99.0;
        const newSrcW = minSrcW + t * (maxSrcW - minSrcW);
        const newSrcH = (newSrcW * canvas.height) / canvas.width;
        const worldX = camera.srcX + camera.srcW / 2;
        const worldY = camera.srcY + camera.srcH / 2;
        camera.srcW = newSrcW; camera.srcH = newSrcH;
        camera.srcX = worldX - camera.srcW / 2; camera.srcY = worldY - camera.srcH / 2;
        clampCamValues(camera, offCanvas);
        drawView(canvas, offCanvas);
      };
      zoomSlider.addEventListener('input', attachedSliderHandlerRef);
    }
    // minimap click -> center camera
    const mini = document.getElementById('minimap');
    if (mini) {
      if (attachedMinimapHandlerRef) mini.removeEventListener('click', attachedMinimapHandlerRef);
      attachedMinimapHandlerRef = function(me) {
        const r = mini.getBoundingClientRect();
        const mx = me.clientX - r.left;
        const my = me.clientY - r.top;
        const worldX = (mx / mini.width) * offCanvas.width;
        const worldY = (my / mini.height) * offCanvas.height;
        camera.srcX = worldX - camera.srcW / 2;
        camera.srcY = worldY - camera.srcH / 2;
        clampCamValues(camera, offCanvas);
        drawView(canvas, offCanvas);
      };
      mini.addEventListener('click', attachedMinimapHandlerRef);
    }
    canvas.onmousedown = function(e) {
      dragging = true;
      lastMouse = { x: e.clientX, y: e.clientY };
      startCam = { ...camera };
    };
    window.onmousemove = function(e) {
      if (!dragging) return;
      const dx = e.clientX - lastMouse.x;
      const dy = e.clientY - lastMouse.y;
      // move camera in offCanvas coordinates
      const sx = (dx / canvas.width) * camera.srcW;
      const sy = (dy / canvas.height) * camera.srcH;
      camera.srcX = startCam.srcX - sx;
      camera.srcY = startCam.srcY - sy;
      clampCamValues(camera, offCanvas);
      drawView(canvas, offCanvas);
    };
    window.onmouseup = function(e) { dragging = false; };
    // double-click resets to NA focus
    canvas.ondblclick = function(e) {
      const naBbox = { west: -170, east: -50, north: 72, south: 14 };
      const tl = lonLatToXY(naBbox.west, naBbox.north, offCanvas.width, offCanvas.height, bbox);
      const br = lonLatToXY(naBbox.east, naBbox.south, offCanvas.width, offCanvas.height, bbox);
      let srcX = Math.floor(tl.x);
      let srcY = Math.floor(tl.y);
      let srcW = Math.ceil(br.x - tl.x);
      let srcH = Math.ceil(br.y - tl.y);
      const pad = 0.08; // 8% padding
      const padW = Math.round(srcW * pad);
      const padH = Math.round(srcH * pad);
      srcX = Math.max(0, srcX - padW);
      srcY = Math.max(0, srcY - padH);
      srcW = Math.min(offCanvas.width - srcX, srcW + padW * 2);
      srcH = Math.min(offCanvas.height - srcY, srcH + padH * 2);
      camera = { srcX, srcY, srcW, srcH, initialized: true };
      drawView(canvas, offCanvas);
    };

    // right click - custom context menu
    canvas.addEventListener('contextmenu', function(e) {
      e.preventDefault();
      const menu = document.getElementById('ctx-menu');
      if (!menu) return;
      // position menu
      menu.style.left = e.clientX + 'px';
      menu.style.top = e.clientY + 'px';
      menu.style.display = 'block';
      menu.setAttribute('aria-hidden', 'false');
      // store pointer location for actions
      menu.dataset.clientX = e.clientX;
      menu.dataset.clientY = e.clientY;
    });

    // add context menu action wiring for Open region
    const ctxOpenRegionBtn = document.getElementById('ctx-open-region');
    if (ctxOpenRegionBtn) ctxOpenRegionBtn.addEventListener('click', () => {
      const menu = document.getElementById('ctx-menu'); if (!menu) return; menu.style.display = 'none'; menu.setAttribute('aria-hidden','true');
      const cx = Number(menu.dataset.clientX), cy = Number(menu.dataset.clientY);
      const rid = pickRegionAtClientXY(cx, cy);
      if (rid === -1 || rid === null || typeof rid === 'undefined') { alert('No region found at that location'); return; }
      openRegionPanel(rid);
    });

    // click outside hides it (replace any previous handler)
    if (windowClickHandlerRef) window.removeEventListener('click', windowClickHandlerRef);
    windowClickHandlerRef = function(ev) {
      const menu = document.getElementById('ctx-menu');
      if (!menu) return;
      const target = ev.target;
      // if clicking on the menu we don't hide yet
      if (menu.contains(target)) return;
      menu.style.display = 'none'; menu.setAttribute('aria-hidden', 'true');
    };
    window.addEventListener('click', windowClickHandlerRef);
  }

    // context menu actions are handled inside this setup so offCanvas is in scope
  function unsetupPanZoom(canvas) {
    canvas.onwheel = null;
    canvas.onmousedown = null;
    canvas.ondblclick = null;
    window.onmousemove = null;
    window.onmouseup = null;
    // remove click handler and attached slider listener
    if (windowClickHandlerRef) { window.removeEventListener('click', windowClickHandlerRef); windowClickHandlerRef = null; }
    if (attachedZoomSliderRef && attachedSliderHandlerRef) {
      attachedZoomSliderRef.removeEventListener('input', attachedSliderHandlerRef);
      attachedZoomSliderRef = null; attachedSliderHandlerRef = null;
    }
    // remove minimap click handler
    const mini = document.getElementById('minimap');
    if (attachedMinimapHandlerRef && mini) { mini.removeEventListener('click', attachedMinimapHandlerRef); attachedMinimapHandlerRef = null; }
    panZoomAttached = false;
  }

  // Map a clientX/clientY on the visible canvas to a region id using stored assignment grid
  function pickRegionAtClientXY(clientX, clientY) {
    try {
      const state = window.__regionState; if (!state) return -1;
      const off = window.__lastOffscreenCanvas; if (!off) return -1;
      const canvas = document.getElementById('map');
      if (!canvas || !camera) return -1;
      // map client coords to canvas local coords (account for page scroll and canvas position)
      const rect = canvas.getBoundingClientRect();
      const localX = clientX - rect.left; const localY = clientY - rect.top;
      // map to offCanvas coordinates
      const offX = camera.srcX + (localX / canvas.width) * camera.srcW;
      const offY = camera.srcY + (localY / canvas.height) * camera.srcH;
      // convert to grid coords
      const gx = Math.floor((offX / state.baseWidth) * state.gridW);
      const gy = Math.floor((offY / state.baseHeight) * state.gridH);
      if (gx < 0 || gx >= state.gridW || gy < 0 || gy >= state.gridH) return -1;
      const id = state.assignments[gy * state.gridW + gx];
      return id;
    } catch (err) { console.warn('pickRegionAtClientXY failed', err); return -1; }
  }

  // Open a modal overlay for region rid; draws a cropped high-resolution area and region polygon overlay
  function openRegionPanel(rid) {
    try {
      const panel = document.getElementById('region-panel');
      const canvasEl = document.getElementById('region-canvas');
      const titleEl = document.getElementById('region-title');
      if (!panel || !canvasEl) return;
      const polygons = (window.__regionPolygons && window.__regionPolygons[rid]) || [];
      if (!polygons || polygons.length === 0) { alert('No region polygon to display this region (may be a water/outside cell)'); return; }
      // compute bbox in lon/lat
      let minLon = 180, maxLon = -180, minLat = 90, maxLat = -90;
      polygons.forEach(poly => {
        poly.forEach(pt => { if (pt.lon < minLon) minLon = pt.lon; if (pt.lon > maxLon) maxLon = pt.lon; if (pt.lat < minLat) minLat = pt.lat; if (pt.lat > maxLat) maxLat = pt.lat; });
      });
      // pad
      const padLon = (maxLon - minLon) * 0.12 || 0.5; const padLat = (maxLat - minLat) * 0.12 || 0.5;
      minLon -= padLon; maxLon += padLon; minLat -= padLat; maxLat += padLat;
      // compute crop coordinates on last offscreen canvas
      const off = window.__lastOffscreenCanvas; const state = window.__regionState;
      const bbox = state.bbox; const baseW = state.baseWidth; const baseH = state.baseHeight;
      const tl = lonLatToXY(minLon, maxLat, baseW, baseH, bbox);
      const br = lonLatToXY(maxLon, minLat, baseW, baseH, bbox);
      let sx = Math.floor(Math.max(0, tl.x)); let sy = Math.floor(Math.max(0, tl.y)); let sw = Math.ceil(Math.min(baseW - sx, br.x - tl.x)); let sh = Math.ceil(Math.min(baseH - sy, Math.max(1, br.y - tl.y)));
      if (sw <= 0 || sh <= 0) { alert('Region crop invalid'); return; }
      // draw crop into panel canvas
      const ctx = canvasEl.getContext('2d');
      // clear and size canvas
      canvasEl.width = Math.min(2048, Math.max(400, sw)); canvasEl.height = Math.min(2048, Math.max(300, sh));
      ctx.clearRect(0,0, canvasEl.width, canvasEl.height);
      // draw background
      ctx.drawImage(off, sx, sy, sw, sh, 0, 0, canvasEl.width, canvasEl.height);
      // overlay polygon paths
      ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.beginPath();
      polygons.forEach((poly, pi) => {
        poly.forEach((pt, i) => {
          const xy = lonLatToXY(pt.lon, pt.lat, baseW, baseH, bbox);
          const x = ((xy.x - sx) / sw) * canvasEl.width; const y = ((xy.y - sy) / sh) * canvasEl.height;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.closePath();
      });
      ctx.fill(); ctx.stroke();
      // title
      if (titleEl) titleEl.textContent = `Region ${rid+1}`;
      // reveal panel
      panel.style.display = 'flex';
      // highlight the selected region with overlay
      highlightSelectedRegion(rid);
    } catch (err) { console.warn('openRegionPanel error', err); alert('Failed to open region'); }
  }

  function highlightSelectedRegion(rid) {
    try {
      const overlay = document.getElementById('region-overlay'); const canvas = document.getElementById('map');
      if (!overlay || !canvas) return;
      overlay.width = canvas.width; overlay.height = canvas.height;
      const ctx = overlay.getContext('2d'); ctx.clearRect(0,0,overlay.width, overlay.height);
      const polygons = (window.__regionPolygons && window.__regionPolygons[rid]) || [];
      const state = window.__regionState; if (!state || polygons.length === 0) return;
      const baseW = state.baseWidth, baseH = state.baseHeight, bbox = state.bbox;
      ctx.fillStyle = 'rgba(255,200,0,0.06)'; ctx.strokeStyle = 'rgba(255,200,0,0.9)'; ctx.lineWidth = 3;
      ctx.beginPath();
      polygons.forEach(poly => {
        poly.forEach((pt, i) => {
          const xy = lonLatToXY(pt.lon, pt.lat, baseW, baseH, bbox);
          // convert to canvas coords via camera
          const cx = Math.round(((xy.x - camera.srcX) / camera.srcW) * canvas.width);
          const cy = Math.round(((xy.y - camera.srcY) / camera.srcH) * canvas.height);
          if (i === 0) ctx.moveTo(cx, cy); else ctx.lineTo(cx, cy);
        });
        ctx.closePath();
      });
      ctx.fill(); ctx.stroke();
    } catch (err) { console.warn('highlightSelectedRegion failed', err); }
  }

  let panZoomAttached = false;

  async function doGenerate() {
    const myGenId = ++lastGenId;
    const options = {
      width: 1920,
      height: 1080,
      // fixed detail for realistic base; procedural fallback uses defaults
      scale: 80,
      octaves: 4,
      persistence: 0.5,
      palette: paletteSelect.value,
      seedNumeric: 0
    };

    // Default focus: North America bounding box
    options.bbox = { west: -170, east: -50, north: 72, south: 14 };
    // Always show coastline and borders
    options.showCoastline = true;
    options.showBorders = true;
    options.naFeatureCollection = naFeatureCollection;
    options.showRegions = regionsToggle ? regionsToggle.checked : false;
    // Override regionsCount - always 21
    options.regionsCount = 21;
    options.regionsSmooth = regionsSmoothSlider ? Number(regionsSmoothSlider.value) : 2;
    const qv = (qualitySelect && qualitySelect.value) ? qualitySelect.value : 'medium';
    const qualityScale = (qv === 'low') ? 1 : (qv === 'medium') ? 2 : 4;
    const regionGridDivisor = (qv === 'low') ? 16 : (qv === 'medium') ? 8 : 4;
    options.regionGridDivisor = regionGridDivisor;
    options.offscreenScale = qualityScale;
    options.useRivers = useRiversCheckbox ? useRiversCheckbox.checked : false;
    // Always use realistic base style
    const features = worldFeatureCollection || naFeatureCollection;
    if (features) {
      // Progressive rendering: quick low-resolution render and regional partitions
      const quickScale = Math.max(1, Math.floor(options.offscreenScale / 2));
      const quickOff = renderWorldOffscreen(features, options.width * quickScale, options.height * quickScale, options);
      try { window.__lastOffscreenCanvas = quickOff; } catch (err) { /* ignore */ }
      // show quick preview
      drawView(canvas, quickOff);
      // quick regions with coarser grid
      if (options.showRegions) await drawRegionsLayer(quickOff.getContext('2d'), options.bbox, quickOff.width, quickOff.height, options.regionsCount, options.regionsSmooth, options.useRivers, Math.max(8, regionGridDivisor * 2));
      // now perform full render and refined region generation asynchronously
      const scheduleIdle = (fn) => {
        if (typeof window !== 'undefined' && window.requestIdleCallback) { window.requestIdleCallback(fn); }
        else setTimeout(fn, 50);
      };
      scheduleIdle(async () => {
        if (myGenId !== lastGenId) return; // canceled by newer generation
        const off = renderWorldOffscreen(features, options.width * options.offscreenScale, options.height * options.offscreenScale, options);
        try { window.__lastOffscreenCanvas = off; } catch (err) { /* ignore */ }
        // draw refined regions (finer grid)
        if (myGenId !== lastGenId) return; // canceled
        if (options.showRegions) await drawRegionsLayer(off.getContext('2d'), options.bbox, off.width, off.height, options.regionsCount, options.regionsSmooth, options.useRivers, regionGridDivisor);
        // finalize draw
        drawView(canvas, off);
        if (myGenId !== lastGenId) return; // canceled
        if (statusEl) statusEl.textContent = 'Rendered (high quality)';
        unsetupPanZoom(canvas);
        setupPanZoom(canvas, off, options.bbox);
        panZoomAttached = true;
      });
      // we used quick preview + started refined rendering; continue
      // initialize camera (src rect) to North America focus if not already set
      if (!camera || !camera.initialized) {
        const naBbox = { west: -170, east: -50, north: 72, south: 14 };
        const tl = lonLatToXY(naBbox.west, naBbox.north, quickOff.width, quickOff.height, options.bbox);
        const br = lonLatToXY(naBbox.east, naBbox.south, quickOff.width, quickOff.height, options.bbox);
        let srcX = Math.floor(tl.x);
        let srcY = Math.floor(tl.y);
        let srcW = Math.ceil(br.x - tl.x);
        let srcH = Math.ceil(br.y - tl.y);
        // add padding
        const pad = 0.08; // 8% padding
        const padW = Math.round(srcW * pad);
        const padH = Math.round(srcH * pad);
        srcX = Math.max(0, srcX - padW);
        srcY = Math.max(0, srcY - padH);
        srcW = Math.min(quickOff.width - srcX, srcW + padW * 2);
        srcH = Math.min(quickOff.height - srcY, srcH + padH * 2);
        camera = { srcX, srcY, srcW, srcH, initialized: true };
      }
      // ensure visible canvas matches requested dimensions
      canvas.width = options.width; canvas.height = options.height;
      drawView(canvas, quickOff);
      if (statusEl) statusEl.textContent = 'Rendered (preview)';
      // Reattach pan/zoom handlers to the quick preview offCanvas
      unsetupPanZoom(canvas);
      setupPanZoom(canvas, quickOff, options.bbox);
      panZoomAttached = true;
      return; // drawn
    } else {
      // fallback in case GeoJSON isn't ready
      generateMap(canvas, options);
      if (statusEl) statusEl.textContent = 'Rendered (procedural fallback)';
    }
  }

  generateBtn.addEventListener('click', doGenerate);
  if (regionsToggle) regionsToggle.addEventListener('change', doGenerate);
  if (regionsCountSlider) {
    regionsCountSlider.addEventListener('input', (e) => {
      regionsCountLabel.textContent = 'Regions: ' + regionsCountSlider.value;
    });
    regionsCountSlider.addEventListener('change', doGenerate);
  }
  if (regionsSmoothSlider) {
    regionsSmoothSlider.addEventListener('input', (e) => { regionsSmoothLabel.textContent = 'Smoothing: ' + regionsSmoothSlider.value; });
    regionsSmoothSlider.addEventListener('change', doGenerate);
  }
  // Randomize button — generate a random seed but keep option deterministic by default
  // All other interactions (randomize/focus/reset/advanced) removed for simplicity
  downloadBtn.addEventListener('click', () => {
    canvas.toBlob(function(blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cmap-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    });
  });

  if (exportRegionsBtn) exportRegionsBtn.addEventListener('click', () => {
    const polygons = window.__regionPolygons || [];
    if (!polygons || polygons.length === 0) { alert('No region polygons available. Generate the map with regions first.'); return; }
    const features = [];
    for (let i = 0; i < polygons.length; i++) {
      const polys = polygons[i];
      if (!polys || !polys.length) continue;
      if (polys.length === 1) {
        const coords = polys[0].map(p => [p.lon, p.lat]);
        // ensure closed
        if (coords.length && (coords[0][0] !== coords[coords.length-1][0] || coords[0][1] !== coords[coords.length-1][1])) coords.push(coords[0]);
        features.push({ type: 'Feature', properties: { id: i }, geometry: { type: 'Polygon', coordinates: [coords] } });
      } else {
        const coordsList = polys.map(poly => {
          const coords = poly.map(p => [p.lon, p.lat]); if (coords.length && (coords[0][0] !== coords[coords.length-1][0] || coords[0][1] !== coords[coords.length-1][1])) coords.push(coords[0]); return coords;
        });
        features.push({ type: 'Feature', properties: { id: i }, geometry: { type: 'MultiPolygon', coordinates: coordsList.map(c => [c]) } });
      }
    }
    const fc = { type: 'FeatureCollection', features };
    const blob = new Blob([JSON.stringify(fc, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `cmap-regions-${Date.now()}.geojson`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  });

  // generate initially
  doGenerate();

  // panel close
  const panelClose = document.getElementById('region-close');
  if (panelClose) panelClose.addEventListener('click', () => { const p = document.getElementById('region-panel'); if (p) p.style.display = 'none'; });
  // clear overlay when panel closed
  if (panelClose) panelClose.addEventListener('click', () => { const overlay = document.getElementById('region-overlay'); if (overlay) { const ctx = overlay.getContext('2d'); ctx.clearRect(0,0,overlay.width, overlay.height); } });
}

window.onload = initUI;
