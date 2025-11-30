// Minimal graph renderer for the social matrix
class CSGraph {
  constructor(svg) {
    this.svg = svg;
    this.nodes = [];
    this.selected = { node: null };
    this.gridMin = -6; this.gridMax = 6; this.gridSteps = this.gridMax - this.gridMin;
    this.viewBox = { x: 0, y: 0, w: 1200, h: 1200 };
    this.pad = { left: 160, right: 160, top: 160, bottom: 160 };
    try { this.svg.setAttribute('viewBox', `${this.viewBox.x} ${this.viewBox.y} ${this.viewBox.w} ${this.viewBox.h}`); } catch (e) {}
    this._initEvents();
  }
  _initEvents() {
    this.svg.addEventListener('click', (ev) => {
      const t = ev.target;
      if (t && t.dataset && t.dataset.nodeId) {
        const n = this.nodes.find(x => x.id === t.dataset.nodeId);
        if (n) this.selectNode(n);
      } else {
        this.clearSelection();
      }
    });
  }
  addNode(n) {
    n.id = n.id || `n${Date.now()}`;
    n.gx = typeof n.gx === 'number' ? n.gx : 0;
    n.gy = typeof n.gy === 'number' ? n.gy : 0;
    n.color = n.color || '#8bc34a';
    this.nodes.push(n);
    console.log('graph.addNode', n.id, 'color:', n.color);
    this.render();
    return n;
  }
  removeNode(id) {
    console.log('graph.removeNode called', id, 'before', this.nodes.length);
    this.nodes = this.nodes.filter(x => x.id !== id);
    console.log('graph.removeNode after', this.nodes.length);
    if (this.selected.node && this.selected.node.id === id) {
      this.selected.node = null;
      try { this.svg.dispatchEvent(new CustomEvent('graph:select', { detail: { node: null } })); } catch (e) { /* ignore */ }
    }
    this.render();
    // Ensure listeners are notified immediately after removal
    if (this.onChange) try { this.onChange(); } catch (e) { /* ignore */ }
  }
  clearSelection() { this.selected.node = null; this.svg.dispatchEvent(new CustomEvent('graph:select', { detail: { node: null } })); this.render(); }
  selectNode(node) { this.selected.node = node; this.svg.dispatchEvent(new CustomEvent('graph:select', { detail: { node } })); this.render(); }
  gridToPixel(gx, gy) {
    const steps = this.gridSteps;
    const w = this.viewBox.w - this.pad.left - this.pad.right;
    const h = this.viewBox.h - this.pad.top - this.pad.bottom;
    const x = this.pad.left + ((gx - this.gridMin) / steps) * w;
    const y = this.pad.top + ((this.gridMax - gy) / steps) * h;
    return { x, y };
  }
  render() {
    while (this.svg.firstChild) this.svg.removeChild(this.svg.firstChild);
    // grid lines and edge ticks
    const w = this.viewBox.w - this.pad.left - this.pad.right;
    const h = this.viewBox.h - this.pad.top - this.pad.bottom;
    const cellW = w / this.gridSteps; const cellH = h / this.gridSteps;
    // center axes pixel coordinates for placing tick labels along 0 axes
    const center = this.gridToPixel(0, 0); const centerX = center.x; const centerY = center.y;
    for (let i = this.gridMin; i <= this.gridMax; i++) {
      const x = this.pad.left + (i - this.gridMin) * cellW;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x); line.setAttribute('x2', x);
      line.setAttribute('y1', this.pad.top); line.setAttribute('y2', this.viewBox.h - this.pad.bottom);
      line.setAttribute('stroke', 'var(--border)'); this.svg.appendChild(line);
      const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      t.setAttribute('x', x); t.setAttribute('y', (centerY + 26).toString()); t.setAttribute('text-anchor', 'middle'); t.setAttribute('fill', 'var(--muted)'); t.textContent = i.toString(); this.svg.appendChild(t);
    }
    // Notify client code when the graph changes (persist and update UI)
    if (this.onChange) try { this.onChange(); } catch (err) { /* ignore */ }
    for (let i = this.gridMin; i <= this.gridMax; i++) {
      const y = this.pad.top + (i - this.gridMin) * cellH;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('y1', y); line.setAttribute('y2', y); line.setAttribute('x1', this.pad.left); line.setAttribute('x2', this.viewBox.w - this.pad.right);
      line.setAttribute('stroke', 'var(--border)'); this.svg.appendChild(line);
      // Hide the Y-axis label at the grid center (i === 0) to avoid duplicated '0' at intersection.
      if (i === 0) { const spacer = document.createElementNS('http://www.w3.org/2000/svg','text'); spacer.setAttribute('x', (centerX - 12).toString()); spacer.setAttribute('y', y); spacer.setAttribute('font-size','0'); spacer.textContent = ''; this.svg.appendChild(spacer); }
      else { const tY = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tY.setAttribute('x', (centerX - 12).toString()); tY.setAttribute('y', y); tY.setAttribute('text-anchor', 'end'); tY.setAttribute('dominant-baseline', 'middle'); tY.setAttribute('fill', 'var(--muted)'); tY.textContent = (-i).toString(); this.svg.appendChild(tY); }
    }
    // axis title labels removed; axis pills provide those labels outside the SVG
    // nodes
    this.nodes.forEach(n => {
      const p = this.gridToPixel(n.gx, n.gy);
      const g = document.createElementNS('http://www.w3.org/2000/svg','g'); g.setAttribute('transform', `translate(${p.x},${p.y})`); g.setAttribute('data-node-id', n.id);
      const accentColor = (typeof window !== 'undefined' && window.getComputedStyle) ? (getComputedStyle(document.documentElement).getPropertyValue('--accent-influence').trim() || '#4caf50') : '#4caf50';
      const fillColor = (n.color && n.color.startsWith('#')) ? n.color : (n.color && n.color.startsWith('hsl') ? n.color : (n.color ? n.color : accentColor));
      const defaultRadius = 48;
      const maxRadius = 72;
      const r = (typeof window !== 'undefined' && document && document.body.classList.contains('graph-max')) ? maxRadius : defaultRadius;
      const circle = document.createElementNS('http://www.w3.org/2000/svg','circle'); circle.setAttribute('r', r.toString()); circle.setAttribute('cx', 0); circle.setAttribute('cy', 0); circle.setAttribute('fill', fillColor); circle.setAttribute('fill-opacity', '1'); circle.setAttribute('stroke', 'rgba(255,255,255,0.06)'); circle.setAttribute('stroke-width', '2'); g.appendChild(circle);
      if (this.selected.node && this.selected.node.id === n.id) {
        const ring = document.createElementNS('http://www.w3.org/2000/svg','circle'); ring.setAttribute('r', (r + 6).toString()); ring.setAttribute('cx', 0); ring.setAttribute('cy', 0); ring.setAttribute('fill', 'none'); ring.setAttribute('stroke', 'var(--accent-collapse)'); ring.setAttribute('stroke-width', '4'); g.appendChild(ring);
      }
      // Node label: visible on hover/select, larger font-size by default and grow on hover/tap
      const text = document.createElementNS('http://www.w3.org/2000/svg','text');
      text.setAttribute('x', '0');
      text.setAttribute('y', '44');
      text.setAttribute('text-anchor','middle');
      text.setAttribute('fill','var(--text)');
      text.textContent = n.name || 'Node';
      // Default text sizing: double the original size for readability
      const defaultTextSize = '40';
      const hoverTextSize = '72';
      const activeTextSize = '100';
      text.setAttribute('font-size', defaultTextSize);
      try { text.classList.add('node-label'); } catch(e) {}
      text.setAttribute('opacity', (this.selected.node && this.selected.node.id === n.id) ? '1' : '0');
      // Pointer events: show label on hover and grow it; on touch (pointerdown) enlarge more briefly
      let _hoverTimeout = null;
      const defaultSize = defaultTextSize;
      const hoverSize = hoverTextSize;
      const activeSize = activeTextSize;
      g.addEventListener('pointerenter', () => { if (_hoverTimeout) { clearTimeout(_hoverTimeout); _hoverTimeout = null; } text.setAttribute('opacity','1'); text.setAttribute('font-size', hoverSize); });
      g.addEventListener('pointerleave', () => { if (_hoverTimeout) { clearTimeout(_hoverTimeout); _hoverTimeout = null; } text.setAttribute('font-size', defaultSize); text.setAttribute('opacity', (this.selected.node && this.selected.node.id === n.id) ? '1' : '0'); });
      g.addEventListener('pointerdown', () => { if (_hoverTimeout) clearTimeout(_hoverTimeout); text.setAttribute('opacity','1'); text.setAttribute('font-size', activeSize); // restore after short delay if not selected
        _hoverTimeout = setTimeout(() => { _hoverTimeout = null; if (!(this.selected.node && this.selected.node.id === n.id)) { text.setAttribute('font-size', defaultSize); text.setAttribute('opacity','0'); } else { text.setAttribute('font-size', hoverSize); text.setAttribute('opacity','1'); } }, 1200); });
      g.addEventListener('pointerup', () => { if (_hoverTimeout) clearTimeout(_hoverTimeout); _hoverTimeout = null; if (!(this.selected.node && this.selected.node.id === n.id)) { text.setAttribute('opacity', '0'); text.setAttribute('font-size', defaultSize); } else { text.setAttribute('font-size', hoverSize); text.setAttribute('opacity','1'); } });
      g.appendChild(text);
      console.log('render node', n.id, 'color:', n.color, 'px', p.x, p.y);
      this.svg.appendChild(g);
    });
  }
}
export default CSGraph;
