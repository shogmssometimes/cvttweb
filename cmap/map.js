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
function renderWorldOffscreen(features, baseWidth, baseHeight, options) {
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
  return off;
}

// Draw a Regions overlay on the offscreen canvas (translucent color grids for now)
function drawRegionsLayer(offCtx, bbox, baseWidth, baseHeight) {
  // define simple region boxes (longitude/latitude ranges); rough partitions
  const regions = [
    { name: 'Pacific/West', lonA: -170, lonB: -125, latA: 14, latB: 72, color: 'rgba(255,214,0,0.12)' },
    { name: 'Rockies/Plains', lonA: -125, lonB: -100, latA: 14, latB: 72, color: 'rgba(0,204,136,0.10)' },
    { name: 'Midwest/East', lonA: -100, lonB: -80, latA: 14, latB: 72, color: 'rgba(0,122,255,0.08)' },
    { name: 'Atlantic/East', lonA: -80, lonB: -50, latA: 14, latB: 72, color: 'rgba(255,88,88,0.08)' },
    { name: 'Mexico', lonA: -118, lonB: -86, latA: 14, latB: 32, color: 'rgba(255,160,0,0.12)' }
  ];
  function rectFromLonLatBox(lonA, latA, lonB, latB) {
    const tl = lonLatToXY(lonA, latB, baseWidth, baseHeight, bbox);
    const br = lonLatToXY(lonB, latA, baseWidth, baseHeight, bbox);
    return { x: tl.x, y: tl.y, w: Math.max(1, br.x - tl.x), h: Math.max(1, br.y - tl.y) };
  }
  regions.forEach(r => {
    const rect = rectFromLonLatBox(r.lonA, r.latA, r.lonB, r.latB);
    offCtx.fillStyle = r.color;
    offCtx.fillRect(rect.x, rect.y, rect.w, rect.h);
    offCtx.strokeStyle = 'rgba(255,255,255,0.08)';
    offCtx.strokeRect(rect.x + 0.5, rect.y + 0.5, rect.w - 1, rect.h - 1);
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
  const paletteSelect = document.getElementById('palette');
  const generateBtn = document.getElementById('generate');
  const downloadBtn = document.getElementById('download');
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
      zoomSlider.addEventListener('input', (ev) => {
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
      });
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

    // click outside hides it
    window.addEventListener('click', function(ev) {
      const menu = document.getElementById('ctx-menu');
      if (!menu) return;
      const target = ev.target;
      // if clicking on the menu we don't hide yet
      if (menu.contains(target)) return;
      menu.style.display = 'none'; menu.setAttribute('aria-hidden', 'true');
    });
  }

    // Implement context menu actions here so offCanvas is in scope
    const ctxMenuZoomIn = document.getElementById('ctx-zoom-in');
    const ctxMenuZoomOut = document.getElementById('ctx-zoom-out');
    if (ctxMenuZoomIn && ctxMenuZoomOut) {
      ctxMenuZoomIn.addEventListener('click', (ev) => {
        const menu = document.getElementById('ctx-menu');
        if (!menu) return;
        const cx = Number(menu.dataset.clientX);
        const cy = Number(menu.dataset.clientY);
        const rect = canvas.getBoundingClientRect();
        const mx = cx - rect.left;
        const my = cy - rect.top;
        const worldX = camera.srcX + (mx / canvas.width) * camera.srcW;
        const worldY = camera.srcY + (my / canvas.height) * camera.srcH;
        // zoom in
        const zoomFactor = 0.5;
        const newSrcW = Math.max(20, camera.srcW * zoomFactor);
        const newSrcH = (newSrcW * canvas.height) / canvas.width;
        camera.srcX = worldX - (mx / canvas.width) * newSrcW;
        camera.srcY = worldY - (my / canvas.height) * newSrcH;
        camera.srcW = newSrcW; camera.srcH = newSrcH;
        clampCamValues(camera, offCanvas);
        drawView(canvas, offCanvas);
        menu.style.display = 'none';
      });
      ctxMenuZoomOut.addEventListener('click', (ev) => {
        const menu = document.getElementById('ctx-menu');
        if (!menu) return;
        const cx = Number(menu.dataset.clientX);
        const cy = Number(menu.dataset.clientY);
        const rect = canvas.getBoundingClientRect();
        const mx = cx - rect.left;
        const my = cy - rect.top;
        const worldX = camera.srcX + (mx / canvas.width) * camera.srcW;
        const worldY = camera.srcY + (my / canvas.height) * camera.srcH;
        // zoom out
        const zoomFactor = 2.0;
        const newSrcW = Math.min(offCanvas.width, camera.srcW * zoomFactor);
        const newSrcH = (newSrcW * canvas.height) / canvas.width;
        camera.srcX = worldX - (mx / canvas.width) * newSrcW;
        camera.srcY = worldY - (my / canvas.height) * newSrcH;
        camera.srcW = newSrcW; camera.srcH = newSrcH;
        clampCamValues(camera, offCanvas);
        drawView(canvas, offCanvas);
        menu.style.display = 'none';
      });
    }
  function unsetupPanZoom(canvas) {
    canvas.onwheel = null;
    canvas.onmousedown = null;
    canvas.ondblclick = null;
    window.onmousemove = null;
    window.onmouseup = null;
    panZoomAttached = false;
  }

  let panZoomAttached = false;

  function doGenerate() {
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
    // Always use realistic base style
    const features = worldFeatureCollection || naFeatureCollection;
    if (features) {
      const off = renderWorldOffscreen(features, options.width * 2, options.height * 2, options);
      // draw regions overlay onto offscreen: use bbox passed via options
      const offCtx = off.getContext('2d');
      drawRegionsLayer(offCtx, options.bbox, off.width, off.height);
      // initialize camera (src rect) to North America focus if not already set
      if (!camera || !camera.initialized) {
        const naBbox = { west: -170, east: -50, north: 72, south: 14 };
        const tl = lonLatToXY(naBbox.west, naBbox.north, off.width, off.height, options.bbox);
        const br = lonLatToXY(naBbox.east, naBbox.south, off.width, off.height, options.bbox);
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
        srcW = Math.min(off.width - srcX, srcW + padW * 2);
        srcH = Math.min(off.height - srcY, srcH + padH * 2);
        camera = { srcX, srcY, srcW, srcH, initialized: true };
      }
      // ensure visible canvas matches requested dimensions
      canvas.width = options.width; canvas.height = options.height;
      drawView(canvas, off);
      if (statusEl) statusEl.textContent = 'Rendered';
      // Reattach pan/zoom handlers to the new offCanvas
      unsetupPanZoom(canvas);
      setupPanZoom(canvas, off, options.bbox);
      panZoomAttached = true;
      return; // drawn
    } else {
      // fallback in case GeoJSON isn't ready
      generateMap(canvas, options);
      if (statusEl) statusEl.textContent = 'Rendered (procedural fallback)';
    }
  }

  generateBtn.addEventListener('click', doGenerate);
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

  // generate initially
  doGenerate();
}

window.onload = initUI;
