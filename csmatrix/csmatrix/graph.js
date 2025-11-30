// Simple graph model + SVG renderer
class CSGraph {
  constructor(svgEl, opts = {}) {
    this.svg = svgEl;
    this.nodes = [];
    this.edges = [];
    this.selected = { node: null };
    this.mode = null; // 'addNode', 'addEdge', null
    this.tempEdgeStart = null;
    this.draggingNode = null;
    this._initEvents();
    // default grid: -6..6
    this.gridMin = typeof opts.gridMin === 'number' ? opts.gridMin : -6;
    this.gridMax = typeof opts.gridMax === 'number' ? opts.gridMax : 6;
    this.viewBox = { x: 0, y: 0, w: 1200, h: 1200 };
    // symmetric padding — default base pad used when adjusting layout density
    this.basePad = { left: 160, right: 160, top: 160, bottom: 160 };
    this.pad = Object.assign({}, this.basePad);
    this.density = 'normal';
    this._initGrid();
    // make sure the svg viewBox matches our internal viewBox values
    try { this.svg.setAttribute('viewBox', `${this.viewBox.x} ${this.viewBox.y} ${this.viewBox.w} ${this.viewBox.h}`); } catch(e) {}
  }
  _initGrid() {
    const w = this.viewBox.w - this.pad.left - this.pad.right;
    const h = this.viewBox.h - this.pad.top - this.pad.bottom;
    this.gridW = w; this.gridH = h; this.gridSteps = this.gridMax - this.gridMin;
  }

  setDensity(density) {
    const map = { compact: 0.75, normal: 1.0, spacious: 1.25 };
    const scale = map[density] || 1.0;
    this.density = density;
    this.pad = { left: Math.round(this.basePad.left * scale), right: Math.round(this.basePad.right * scale), top: Math.round(this.basePad.top * scale), bottom: Math.round(this.basePad.bottom * scale) };
    this._initGrid();
    try { this.svg.setAttribute('viewBox', `${this.viewBox.x} ${this.viewBox.y} ${this.viewBox.w} ${this.viewBox.h}`); } catch(e) {}
    this.render();
  }
  addNode(node) {
    node.id = node.id || `n${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
    // grid coords integers only
    node.gx = (typeof node.gx === 'number') ? node.gx : Math.floor(Math.random() * (this.gridMax - this.gridMin + 1)) + this.gridMin;
    node.gy = (typeof node.gy === 'number') ? node.gy : Math.floor(Math.random() * (this.gridMax - this.gridMin + 1)) + this.gridMin;
    // clamp
    node.gx = Math.max(this.gridMin, Math.min(this.gridMax, node.gx));
    node.gy = Math.max(this.gridMin, Math.min(this.gridMax, node.gy));
    node.color = node.color || this._nextColor();
    // node-level meters removed; meters are globally tracked in main.js (meta.globalMeters)
    const p = this.gridToPixel(node.gx, node.gy);
    node.x = p.x; node.y = p.y;
    this.nodes.push(node);
    console.log('nested graph.addNode', node.id, 'color:', node.color);
    this.render();
    return node;
  }
  removeNode(nodeId) {
    console.log('nested graph.removeNode called', nodeId, 'before', this.nodes.length);
    this.nodes = this.nodes.filter(n => n.id !== nodeId);
    console.log('nested graph.removeNode after', this.nodes.length);
    this.edges = this.edges.filter(e => e.source !== nodeId && e.target !== nodeId);
    if (this.selected.node && this.selected.node.id === nodeId) {
      this.selected.node = null;
      try { this.svg.dispatchEvent(new CustomEvent('graph:select', { detail: { node: null } })); } catch (e) { /* ignore */ }
    }
    this.render();
    // Ensure listeners are notified immediately after removal
    if (this.onChange) try { this.onChange(); } catch (e) { /* ignore */ }
  }
  // addEdge removed from simplified UI
  removeEdge(edgeId) { /* edges are not used in the simplified UI */ }
  findNodeAt(x,y, radius=40) {
    return this.nodes.find(n => {
      const p = this.gridToPixel(n.gx, n.gy);
      const dx = p.x - x, dy = p.y - y; return dx*dx + dy*dy <= radius*radius;
    });
  }
  setMode(m) { this.mode = m; if (m !== 'addEdge') { this.tempEdgeStart = null; } }
  clearSelection() { this.selected.node = null; this.svg.dispatchEvent(new CustomEvent('graph:select', { detail: { node: null } })); }
  selectNode(node) { this.selected.node = node; this.render(); this.svg.dispatchEvent(new CustomEvent('graph:select', { detail: { node } })); }
  // selectEdge removed; edges are not used
  toJSON() {
    // export as nodes with id, name, gx, gy, color (meters are global)
    const nodes = this.nodes.map(n => ({ id: n.id, name: n.name, color: n.color, gx: n.gx, gy: n.gy }));
    const edges = this.edges.map(e => ({ id: e.id, source: e.source, target: e.target, weight: e.weight }));
    return { nodes, edges };
  }
  fromJSON(j) {
    this.nodes = (j.nodes || []).map(n => {
      let gx = (typeof n.gx === 'number') ? n.gx : (typeof n.x === 'number' ? this.pixelToGrid(n.x, n.y).gx : undefined);
      let gy = (typeof n.gy === 'number') ? n.gy : (typeof n.y === 'number' ? this.pixelToGrid(n.x, n.y).gy : undefined);
      if (typeof gx !== 'number') gx = Math.floor(Math.random() * (this.gridMax - this.gridMin + 1)) + this.gridMin;
      if (typeof gy !== 'number') gy = Math.floor(Math.random() * (this.gridMax - this.gridMin + 1)) + this.gridMin;
      return { id: n.id, name: n.name, gx, gy, color: n.color || this._nextColor() };
    });
    this.edges = (j.edges || []).map(e => ({ id: e.id, source: e.source, target: e.target, weight: e.weight }));
    this.render();
  }
  _initEvents() {
    this.svg.addEventListener('pointerdown', (ev) => {
      const pt = this._svgPoint(ev.clientX, ev.clientY);
      const n = this.findNodeAt(pt.x, pt.y, 40);
      if (this.mode === 'addNode') { const g = this.pixelToGrid(pt.x, pt.y); const node = this.addNode({ name: 'New Node', gx: g.gx, gy: g.gy }); // finalize add
        this.setMode(null); try { this.svg.classList.remove('adding-node'); } catch (e) {}
        this.selectNode(node); return; }
      // addEdge mode removed in simplified UI
      if (n) {
        this.draggingNode = n; this.selectNode(n); this.svg.setPointerCapture(ev.pointerId);
        // set node grid coords to clicked grid (snap)
        const g = this.pixelToGrid(pt.x, pt.y);
        n.gx = Math.max(this.gridMin, Math.min(this.gridMax, g.gx));
        n.gy = Math.max(this.gridMin, Math.min(this.gridMax, g.gy));
        const p2 = this.gridToPixel(n.gx, n.gy);
        n.x = p2.x; n.y = p2.y;
        return;
      }
      // click on background: clear selection
      this.clearSelection(); this.render();
    });
    this.svg.addEventListener('pointermove', (ev) => {
      if (!this.draggingNode) return;
      const pt = this._svgPoint(ev.clientX, ev.clientY);
      const g = this.pixelToGrid(pt.x, pt.y);
      g.gx = Math.max(this.gridMin, Math.min(this.gridMax, g.gx));
      g.gy = Math.max(this.gridMin, Math.min(this.gridMax, g.gy));
      this.draggingNode.gx = g.gx; this.draggingNode.gy = g.gy;
      const p2 = this.gridToPixel(g.gx, g.gy);
      this.draggingNode.x = p2.x; this.draggingNode.y = p2.y;
      this.render();
    });
    this.svg.addEventListener('pointerup', (ev) => {
      // snap finalize
      if (this.draggingNode) {
        const pt = this._svgPoint(ev.clientX, ev.clientY);
        const g = this.pixelToGrid(pt.x, pt.y);
        this.draggingNode.gx = Math.max(this.gridMin, Math.min(this.gridMax, g.gx));
        this.draggingNode.gy = Math.max(this.gridMin, Math.min(this.gridMax, g.gy));
        const p2 = this.gridToPixel(this.draggingNode.gx, this.draggingNode.gy);
        this.draggingNode.x = p2.x; this.draggingNode.y = p2.y;
      }
      this.draggingNode = null; this.svg.releasePointerCapture(ev.pointerId);
    });
    // click on edges or nodes via DOM events (delegation)
    this.svg.addEventListener('click', (ev) => {
      const t = ev.target;
      // no HUD meter clicks — meters are controlled via Controls panel only
      if (t && t.dataset && t.dataset.nodeId) {
        const n = this.nodes.find(x => x.id === t.dataset.nodeId); if (n) { this.selectNode(n); }
      }
      // edges are not selectable in the simplified UI
    });
  }
  _svgPoint(clientX, clientY) {
    const pt = this.svg.createSVGPoint(); pt.x = clientX; pt.y = clientY; const ctm = this.svg.getScreenCTM().inverse(); return pt.matrixTransform(ctm);
  }
  // Grid mapping helpers
  gridToPixel(gx, gy) {
    const steps = this.gridSteps;
    const x0 = this.pad.left; const y0 = this.pad.top;
    const x = x0 + ((gx - this.gridMin) / steps) * this.gridW;
    const y = y0 + ((this.gridMax - gy) / steps) * this.gridH; // invert Y
    return { x, y };
  }
  pixelToGrid(x, y) {
    const steps = this.gridSteps;
    const gx = Math.round(this.gridMin + ((x - this.pad.left) / this.gridW) * steps);
    const gy = Math.round(this.gridMax - ((y - this.pad.top) / this.gridH) * steps);
    return { gx, gy };
  }
  _nextColor() {
    this._colorIdx = (this._colorIdx || 0) + 1; const hue = (this._colorIdx * 137) % 360;
    // convert hsl to hex with s=72%, l=82%
    const s = 0.72, l = 0.82;
    const h = hue / 360;
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s; const p = 2 * l - q;
    function hue2rgb(pv, qv, tv) { if (tv < 0) tv += 1; if (tv > 1) tv -= 1; if (tv < 1/6) return pv + (qv - pv) * 6 * tv; if (tv < 1/2) return qv; if (tv < 2/3) return pv + (qv - pv) * (2/3 - tv) * 6; return pv; }
    const r = Math.round(hue2rgb(p, q, h + 1/3) * 255); const g = Math.round(hue2rgb(p, q, h) * 255); const b = Math.round(hue2rgb(p, q, h - 1/3) * 255);
    const toHex = (x) => ('0' + x.toString(16)).slice(-2);
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }
  render() {
    console.log('CSGraph.render: rendering', this.nodes.length);
    // Clear
    while (this.svg.firstChild) this.svg.removeChild(this.svg.firstChild);
    const defs = document.createElementNS('http://www.w3.org/2000/svg','defs');
    this.svg.appendChild(defs);
    // draw grid and axes
    // draw grid lines + ticks along edges (reverted from central-axis ticks)
    const steps = this.gridSteps;
    const cellW = this.gridW / steps;
    const cellH = this.gridH / steps;
    // compute pixel coords for center axes (0,0) to place tick numbers along center axes
    const center = this.gridToPixel(0, 0); const centerX = center.x; const centerY = center.y;
    // vertical grid lines + bottom tick labels
    for (let i = this.gridMin; i <= this.gridMax; i++) {
      const x = this.pad.left + (i - this.gridMin) * cellW;
      const line = document.createElementNS('http://www.w3.org/2000/svg','line');
      line.setAttribute('x1', x.toString());
      line.setAttribute('y1', this.pad.top.toString());
      line.setAttribute('x2', x.toString());
      line.setAttribute('y2', (this.viewBox.h - this.pad.bottom).toString());
      line.setAttribute('stroke', 'var(--border)');
      line.setAttribute('stroke-width', '1');
      this.svg.appendChild(line);
      const t = document.createElementNS('http://www.w3.org/2000/svg','text');
      t.setAttribute('x', x.toString());
      t.setAttribute('y', (centerY + 26).toString());
      t.setAttribute('font-size','16');
      t.setAttribute('fill','var(--muted)');
      t.setAttribute('text-anchor','middle');
      t.textContent = i.toString();
      this.svg.appendChild(t);
    }
    // horizontal grid lines + left tick labels
    for (let i = this.gridMin; i <= this.gridMax; i++) {
      const y = this.pad.top + (i - this.gridMin) * cellH;
      const lineY = document.createElementNS('http://www.w3.org/2000/svg','line');
      lineY.setAttribute('x1', this.pad.left.toString());
      lineY.setAttribute('y1', y.toString());
      lineY.setAttribute('x2', (this.viewBox.w - this.pad.right).toString());
      lineY.setAttribute('y2', y.toString());
      lineY.setAttribute('stroke', 'var(--border)');
      lineY.setAttribute('stroke-width', '1');
      this.svg.appendChild(lineY);
        // Only show Y labels for non-zero tick rows to avoid duplicating the central 0
        if (i === 0) { const spacer = document.createElementNS('http://www.w3.org/2000/svg','text'); spacer.setAttribute('x', (centerX - 12).toString()); spacer.setAttribute('y', y.toString()); spacer.setAttribute('font-size','0'); spacer.textContent = ''; this.svg.appendChild(spacer); } else {
          const tY = document.createElementNS('http://www.w3.org/2000/svg','text');
      tY.setAttribute('x', (centerX - 12).toString());
      tY.setAttribute('y', y.toString());
      tY.setAttribute('font-size','16');
      tY.setAttribute('fill','var(--muted)');
      tY.setAttribute('text-anchor','end');
      tY.setAttribute('dominant-baseline', 'middle');
      tY.textContent = (-i).toString();
      this.svg.appendChild(tY);
        }
    }
    // Axis title labels removed — axis pills are shown in the UI outside the SVG
    // draw nodes (reuse steps/cell sizes computed above)
    this.nodes.forEach(n => {
      const p = this.gridToPixel(n.gx, n.gy);
      const g = document.createElementNS('http://www.w3.org/2000/svg','g'); g.setAttribute('transform', `translate(${p.x},${p.y})`); g.setAttribute('data-node-id', n.id);
      const r = 36;
        const accentColor = (typeof window !== 'undefined' && window.getComputedStyle) ? (getComputedStyle(document.documentElement).getPropertyValue('--accent-influence').trim() || '#4caf50') : '#4caf50';
        const fillColor = (n.color && n.color.startsWith('#')) ? n.color : (n.color && n.color.startsWith('hsl') ? n.color : (n.color ? n.color : accentColor));
        const circle = document.createElementNS('http://www.w3.org/2000/svg','circle'); circle.setAttribute('cx', '0'); circle.setAttribute('cy', '0'); circle.setAttribute('r', r.toString()); circle.setAttribute('fill', fillColor); circle.setAttribute('fill-opacity', '1'); circle.setAttribute('stroke', 'rgba(255,255,255,0.06)'); circle.setAttribute('stroke-width', '2'); circle.setAttribute('data-node-id', n.id);
      g.appendChild(circle);
      // selection ring
      if (this.selected.node && this.selected.node.id === n.id) {
        const ring = document.createElementNS('http://www.w3.org/2000/svg','circle'); ring.setAttribute('cx','0'); ring.setAttribute('cy','0'); ring.setAttribute('r', (r + 6).toString()); ring.setAttribute('fill','none'); ring.setAttribute('stroke','var(--accent-collapse)'); ring.setAttribute('stroke-width','4'); g.appendChild(ring);
      }
        // label shows only for selected node
        // Create the text element first before setting attributes (avoid TDZ)
        const text = document.createElementNS('http://www.w3.org/2000/svg','text');
        text.setAttribute('x', 0);
        text.setAttribute('y', 48);
        text.setAttribute('text-anchor', 'middle');
        text.textContent = n.name || 'Node';
        // Label: slightly larger by default, reveal on hover/tap and selection
          text.setAttribute('font-size', '18');
        text.setAttribute('font-weight', '700');
        text.setAttribute('opacity', (this.selected.node && this.selected.node.id === n.id) ? '1' : '0');
        let _hoverTimeout = null;
        const defaultSize = '18';
        const hoverSize = '30';
        const activeSize = '38';
        g.addEventListener('pointerenter', () => { if (_hoverTimeout) { clearTimeout(_hoverTimeout); _hoverTimeout = null; } text.setAttribute('opacity','1'); text.setAttribute('font-size', hoverSize); });
        g.addEventListener('pointerleave', () => { if (_hoverTimeout) { clearTimeout(_hoverTimeout); _hoverTimeout = null; } text.setAttribute('font-size', defaultSize); text.setAttribute('opacity', (this.selected.node && this.selected.node.id === n.id) ? '1' : '0'); });
        g.addEventListener('pointerdown', () => { if (_hoverTimeout) clearTimeout(_hoverTimeout); text.setAttribute('opacity','1'); text.setAttribute('font-size', activeSize); _hoverTimeout = setTimeout(() => { _hoverTimeout = null; if (!(this.selected.node && this.selected.node.id === n.id)) { text.setAttribute('font-size', defaultSize); text.setAttribute('opacity','0'); } else { text.setAttribute('font-size', hoverSize); text.setAttribute('opacity','1'); } }, 1200); });
        g.addEventListener('pointerup', () => { if (_hoverTimeout) clearTimeout(_hoverTimeout); _hoverTimeout = null; if (!(this.selected.node && this.selected.node.id === n.id)) { text.setAttribute('opacity', '0'); text.setAttribute('font-size', defaultSize); } else { text.setAttribute('font-size', hoverSize); text.setAttribute('opacity','1'); } });
      g.appendChild(text);
      console.log('nested render node', n.id, 'color:', n.color, 'px', p.x, p.y);
      this.svg.appendChild(g);
    });
    // Global meters removed from the SVG; they are controlled from the Controls panel instead
    if (this.onChange) try { this.onChange(); } catch (err) { /* ignore */ }
  }
  // role color mapping removed in simplified UI
}

export default CSGraph;

