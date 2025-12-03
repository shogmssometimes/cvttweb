// interactive social matrix
import CSGraph from './graph.js';
console.log('csmatrix: starting boot');
let svg = document.getElementById('matrix-svg');
console.log('csmatrix: svg element', !!svg, svg ? `viewbox:${svg.getAttribute('viewBox')}` : 'no-svg');
if (!svg) {
	try {
		const wrap = document.getElementById('matrix-canvas-wrap') || document.body;
		const created = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		created.setAttribute('id', 'matrix-svg');
		created.setAttribute('width', '100%');
		created.setAttribute('viewBox', '0 0 1000 1000');
		created.setAttribute('preserveAspectRatio', 'xMidYMid meet');
		created.style.display = 'block';
		wrap.appendChild(created);
		svg = created;
		console.log('csmatrix: created fallback svg element');
	} catch (err) { console.warn('csmatrix: could not create fallback svg', err); }
}
let graph;
try {
	graph = new CSGraph(svg);
	console.log('csmatrix: graph created');
	if (typeof window !== 'undefined') { window.graph = graph; window.svg = svg; }
} catch (err) {
	console.error('csmatrix: graph creation failed', err);
}
// graph.globalMeters will be set after globalMeters is declared (below)
// persist changes to localStorage
// global meters (not node dependent)
let globalMeters = { collapse: 0, influence: 0, record: 0 };
// ensure graph has the global meters for initial rendering
function persistGraph() {
	try {
		const json = (graph && typeof graph.toJSON === 'function') ? graph.toJSON() : { nodes: [], edges: [] };
		json.meta = { globalMeters };
		localStorage.setItem('csmatrix.graph', JSON.stringify(json));
	} catch (err) { /* ignore */ }
}
// whenever graph changes, persist and update the node list
graph.onChange = () => { console.log('csmatrix nested: graph.onChange nodes', graph.nodes.length); persistGraph(); updateNodeList(); };
// Sync canvas wrapper height with svg render height to minimize vertical padding
function syncCanvasHeight() {
	try {
		const svgEl = document.getElementById('matrix-svg');
		const wrap = document.getElementById('matrix-canvas-wrap');
		if (!svgEl || !wrap) return;
		const rect = svgEl.getBoundingClientRect();
		const minH = 220;
		const newH = Math.max(minH, Math.round(rect.height));
		wrap.style.height = `${newH}px`;
	} catch (e) { /* ignore */ }
}
if (svg) svg.addEventListener('graph:rendered', () => { syncCanvasHeight(); });
console.log('csmatrix: listeners wired (approx)');
if (!graph) {
	console.error('csmatrix: graph failed to initialize; skipping interactive wiring');
	const errEl = document.getElementById('app-error'); if (errEl) { errEl.classList.remove('hidden'); }
} else {

// HUD click handler removed (meters are changed from Controls only)
function getCssVar(varName, fallback) {
	try {
		const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
		return v || fallback;
	} catch (err) { return fallback; }
}
function hslToHex(hsl) {
	try {
		// parse hsl(h,s%,l%)
		const m = hsl.match(/hsl\((\d+),\s*(\d+)%\s*,\s*(\d+)%\)/i);
		if (!m) return getCssVar('--text', '#e8eef3');
		const h = Number(m[1]) / 360; const s = Number(m[2]) / 100; const l = Number(m[3]) / 100;
		function hue2rgb(p, q, t) {
			if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1/6) return p + (q - p) * 6 * t; if (t < 1/2) return q; if (t < 2/3) return p + (q - p) * (2/3 - t) * 6; return p;
		}
		const q = l < 0.5 ? l * (1 + s) : l + s - l * s; const p = 2 * l - q;
		const r = Math.round(hue2rgb(p, q, h + 1/3) * 255); const g = Math.round(hue2rgb(p, q, h) * 255); const b = Math.round(hue2rgb(p, q, h - 1/3) * 255);
		const toHex = (x) => ('0' + x.toString(16)).slice(-2);
		return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
	} catch (err) { return getCssVar('--text', '#e8eef3'); }
}
// wire controls
document.getElementById('btn-add-node').addEventListener('click', () => {
	// add a node at center by default
	const gx = 0, gy = 0;
	const node = graph.addNode({ name: 'New Node', gx, gy, color: graph._nextColor ? graph._nextColor() : getCssVar('--accent-influence', '#4caf50') });
	graph.selectNode(node);
	// also allow click-to-place: set mode briefly
	graph.setMode('addNode'); svg.classList.add('adding-node');
	setTimeout(() => { graph.setMode(null); svg.classList.remove('adding-node'); }, 3000);
});
document.getElementById('btn-delete').addEventListener('click', () => {
	if (graph.selected.node) {
		console.log('Delete Selected clicked for', graph.selected.node.id);
		graph.removeNode(graph.selected.node.id);
		try { persistGraph(); } catch (e) {}
		updateNodeList();
	}
});
document.getElementById('btn-export').addEventListener('click', () => {
	const json = graph.toJSON(); json.meta = { globalMeters };
	const blob = new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' });
	const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `csmatrix-${Date.now()}.json`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
});
document.getElementById('import-file').addEventListener('change', (ev) => {
	const f = ev.target.files[0]; if (!f) return; const reader = new FileReader(); reader.onload = () => {
		try {
			const json = JSON.parse(reader.result);
			graph.fromJSON(json);
			if (json.meta && json.meta.globalMeters) { globalMeters = json.meta.globalMeters; updateGlobalMetersUI(); updateControlMeterBars(); }
			persistGraph();
		} catch (err) { alert('Invalid JSON file'); }
	};
	reader.readAsText(f);
});
document.getElementById('btn-reset').addEventListener('click', () => { localStorage.removeItem('csmatrix.graph'); loadSample(); });

// Node edit panel wiring
// Node panel overlay removed; per-card panels are embedded in the node list.
graph.svg.addEventListener('graph:select', (ev) => { requestAnimationFrame(() => { updateEdgePanel(); updateNodeList(); }); });
	// per-card save handlers are created inline when building node cards.

// live input handlers for sliders and color
// per-card live input handlers are created when panels are built in updateNodeList().

// Global meters buttons (wired regardless of graph presence)
function updateGlobalMetersUI() {
	const elCollapse = document.getElementById('global-meter-collapse-value'); if (elCollapse) elCollapse.textContent = globalMeters.collapse || 0;
	const elInfluence = document.getElementById('global-meter-influence-value'); if (elInfluence) elInfluence.textContent = globalMeters.influence || 0;
	const elRecord = document.getElementById('global-meter-record-value'); if (elRecord) elRecord.textContent = globalMeters.record || 0;
}
const changeGlobalMeter = (name, delta) => {
	globalMeters[name] = Math.max(0, Math.min(6, (globalMeters[name] || 0) + delta));
	updateGlobalMetersUI();
	persistGraph();
	updateControlMeterBars();
};
const bindBtn = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
bindBtn('global-plus-collapse', ()=> changeGlobalMeter('collapse', +1));
bindBtn('global-minus-collapse', ()=> changeGlobalMeter('collapse', -1));
bindBtn('global-plus-influence', ()=> changeGlobalMeter('influence', +1));
bindBtn('global-minus-influence', ()=> changeGlobalMeter('influence', -1));
bindBtn('global-plus-record', ()=> changeGlobalMeter('record', +1));
bindBtn('global-minus-record', ()=> changeGlobalMeter('record', -1));
// Update small control meter bars when values change
function updateControlMeterBars() {
	const renderBars = (id, value, colorClass) => {
		const el = document.getElementById(id);
		if (!el) return;
		el.innerHTML = '';
		for (let i=0;i<6;i++) {
			const unit = document.createElement('span'); unit.className = `unit ${i < value ? 'active ' + colorClass : ''}`; el.appendChild(unit);
		}
	};
	renderBars('ctrl-meter-collapse', globalMeters.collapse || 0, 'collapse');
	renderBars('ctrl-meter-influence', globalMeters.influence || 0, 'influence');
	renderBars('ctrl-meter-record', globalMeters.record || 0, 'record');
}
// wire toggle for showing controls on mobile
const btnToggleControls = document.getElementById('btn-toggle-controls');
if (btnToggleControls) {
	btnToggleControls.addEventListener('click', () => {
		const isOpen = document.body.classList.toggle('controls-open');
		btnToggleControls.textContent = isOpen ? 'Hide Controls' : 'Show Controls';
		try { if (graph && typeof graph.render === 'function') graph.render(); } catch(e) {}
		updateControlsVisibilityNested();
	});
}
// Maximize graph removed
// hide controls from within the controls panel
const btnHideControls = document.getElementById('btn-hide-controls');
if (btnHideControls) {
	btnHideControls.addEventListener('click', () => { document.body.classList.remove('controls-open'); btnToggleControls.textContent = 'Show Controls'; updateControlsVisibilityNested(); });
}
if (btnHideControls) {
	btnHideControls.addEventListener('click', () => { try { if (graph && typeof graph.render === 'function') graph.render(); } catch(e) {} });
}
// HUD toggle button: hide/show header meters and controls
const btnToggleHud = document.getElementById('btn-toggle-hud');
if (btnToggleHud) {
	btnToggleHud.setAttribute('aria-pressed', document.body.classList.contains('hud-hidden') ? 'true' : 'false');
	btnToggleHud.addEventListener('click', () => {
		const hidden = document.body.classList.toggle('hud-hidden');
		// set aria-pressed state and update aria-label for screen readers
		btnToggleHud.setAttribute('aria-pressed', hidden ? 'true' : 'false');
		btnToggleHud.setAttribute('aria-label', hidden ? 'Show HUD' : 'Hide HUD');
		// also ensure Controls are hidden when HUD is hidden
		if (hidden) { document.body.classList.remove('controls-open'); }
		// update axis pills for screen readers
		document.querySelectorAll('.axis-pill').forEach(el => { el.setAttribute('aria-hidden', hidden ? 'true' : 'false'); });
		try { if (graph && typeof graph.render === 'function') graph.render(); } catch(e) {}
	});
}
	window.addEventListener('resize', () => { try { if (graph && typeof graph.render === 'function') graph.render(); } catch(e) {} });
// Note: previously there was an in-graph HUD button; it's removed from markup to avoid duplication
// Toggle pills and header by double-tap on the canvas (mobile friendly gesture)
document.getElementById('matrix-canvas-wrap').addEventListener('dblclick', () => {
	const btn = document.getElementById('btn-toggle-hud'); if (btn) btn.click();
});
// Density select wiring
const densitySelect = document.getElementById('density-select');
function loadDensity() {
	try { const saved = localStorage.getItem('csmatrix.density'); if (saved) { densitySelect.value = saved; graph.setDensity(saved); } }
	catch(e) {}
}
if (densitySelect) {
	densitySelect.addEventListener('change', (ev) => { const val = ev.target.value; if (graph && typeof graph.setDensity === 'function') graph.setDensity(val); localStorage.setItem('csmatrix.density', val); });
}
loadDensity();
// Optional: make density select respond to body class toggle for accessibility
// Persist class on body for other UI changes
const applyScaleClass = (density) => {
	document.body.classList.remove('ui-scale-compact','ui-scale-normal','ui-scale-spacious');
	document.body.classList.add(density === 'compact' ? 'ui-scale-compact' : (density === 'spacious' ? 'ui-scale-spacious' : 'ui-scale-normal'));
};
if (densitySelect) { applyScaleClass(densitySelect.value); densitySelect.addEventListener('change', (ev) => applyScaleClass(ev.target.value)); }
// posture toggle: compact UI vs normal (persisted)
const btnPosture = document.getElementById('btn-posture');
function loadPosture() {
	try {
		const p = localStorage.getItem('csmatrix.posture');
		if (p) applyScaleClass(p);
		if (btnPosture) btnPosture.setAttribute('aria-pressed', document.body.classList.contains('ui-scale-compact') ? 'true' : 'false');
	} catch (e) {}
}
if (btnPosture) {
	btnPosture.addEventListener('click', () => {
		const compact = document.body.classList.toggle('ui-scale-compact');
		applyScaleClass(compact ? 'compact' : 'normal');
		localStorage.setItem('csmatrix.posture', compact ? 'compact' : 'normal');
		btnPosture.setAttribute('aria-pressed', compact ? 'true' : 'false');
	});
}
loadPosture();
// Auto-max / Auto-fit graph toggle wiring
const autoMaxToggle = document.getElementById('auto-max-toggle');
function loadAutoMax() {
	try {
		const saved = localStorage.getItem('csmatrix.autoMax');
		const enabled = saved === null ? true : JSON.parse(saved);
		if (autoMaxToggle) autoMaxToggle.checked = !!enabled;
		if (graph && typeof graph.setAutoMax === 'function') graph.setAutoMax(!!enabled);
		try { document.body.classList.toggle('graph-auto-max', !!enabled); } catch(e) {}
	} catch (e) { /* ignore */ }
}
if (autoMaxToggle) {
	autoMaxToggle.addEventListener('change', (ev) => {
		const v = !!ev.target.checked;
		try { if (graph && typeof graph.setAutoMax === 'function') graph.setAutoMax(v); localStorage.setItem('csmatrix.autoMax', JSON.stringify(v)); } catch (e) {}
		try { document.body.classList.toggle('graph-auto-max', v); } catch(e) {}
	});
}
loadAutoMax();
// lock scale toggle wiring for nested copy
const lockScaleToggle = document.getElementById('lock-scale-toggle');
function loadLockScale() {
	try {
		const saved = localStorage.getItem('csmatrix.lockScale');
		const enabled = saved === null ? false : JSON.parse(saved);
		if (lockScaleToggle) lockScaleToggle.checked = !!enabled;
		if (graph && typeof graph.setLockScale === 'function') graph.setLockScale(!!enabled);
	} catch (e) { /* ignore */ }
}
if (lockScaleToggle) {
	lockScaleToggle.addEventListener('change', (ev) => {
		const v = !!ev.target.checked;
		try { if (graph && typeof graph.setLockScale === 'function') graph.setLockScale(v); localStorage.setItem('csmatrix.lockScale', JSON.stringify(v)); } catch (e) {}
		try { if (v) svg.setAttribute('preserveAspectRatio','xMidYMid slice'); else svg.setAttribute('preserveAspectRatio','xMidYMid meet'); } catch(e) {}
	});
}
loadLockScale();
// Controls visibility helper for nested copy
function updateControlsVisibilityNested() {
	const controlsEl = document.getElementById('controls');
	if (!controlsEl) return;
	const small = window.matchMedia('(max-width: 720px)').matches;
	if (document.body.classList.contains('hud-hidden')) { controlsEl.style.setProperty('display', 'none', 'important'); return; }
	if (!small) { controlsEl.style.removeProperty('display'); return; }
	if (document.body.classList.contains('controls-open')) controlsEl.style.setProperty('display', 'block', 'important'); else controlsEl.style.setProperty('display', 'none', 'important');
}
try { window.updateControlsVisibilityNested = updateControlsVisibilityNested; } catch(e) {}
window.addEventListener('resize', updateControlsVisibilityNested);
updateControlsVisibilityNested();
// overlay cancel button removed — per-card cancel buttons now used.

// Edge UI removed - edges are not used for simplified social matrix
function updateEdgePanel() { return; }

// Node list rendering
function updateNodeList() {
	const list = document.getElementById('node-list'); if (!list) return;
	console.log('nested updateNodeList called, nodes:', graph.nodes.map(n => n.id));
	list.innerHTML = '';
	if (!graph.nodes || graph.nodes.length === 0) { const empt = document.createElement('div'); empt.textContent = 'No nodes yet — Add a node with the Add Node button'; empt.style.color='var(--muted)'; list.appendChild(empt); return; }
	graph.nodes.forEach(n => {
		const card = document.createElement('div'); card.className = 'node-card'; card.tabIndex = 0; card.setAttribute('role','button');
		const sw = document.createElement('div'); sw.className = 'node-swatch'; sw.style.backgroundColor = n.color || 'var(--muted)'; card.appendChild(sw);
		const meta = document.createElement('div'); meta.className = 'node-meta';
		const title = document.createElement('div'); title.textContent = n.name || '(no name)'; title.style.fontWeight = '600'; title.style.fontSize = '14px'; meta.appendChild(title);
		const coords = document.createElement('div'); coords.textContent = `x: ${n.gx} y: ${n.gy}`; coords.style.fontSize = '12px'; coords.style.color = 'var(--border)'; meta.appendChild(coords);
		card.appendChild(meta);
		const del = document.createElement('button'); del.className = 'delete-node'; del.textContent = 'Delete'; del.setAttribute('aria-label', `Delete ${n.name || 'node'}`);
		del.addEventListener('click', (ev) => { ev.stopPropagation(); console.log('nested delete click for', n.id); if (confirm(`Delete node '${n.name || n.id}'?`)) { graph.removeNode(n.id); try { persistGraph(); } catch (e) {} updateNodeList(); } });
		card.appendChild(del);
		// inline node panel
		const panel = document.createElement('div'); panel.className = 'node-panel-inline panel';
		const heading = document.createElement('h4'); heading.textContent = 'Node'; panel.appendChild(heading);
		const nameLabel = document.createElement('label'); nameLabel.textContent = 'Name: '; const nameInput = document.createElement('input'); nameInput.value = n.name || ''; nameLabel.appendChild(nameInput); panel.appendChild(nameLabel);
		const xLabel = document.createElement('label'); xLabel.textContent = 'Trust (X): '; const xInput = document.createElement('input'); xInput.type = 'range'; xInput.min = -6; xInput.max = 6; xInput.step = 1; xInput.value = typeof n.gx === 'number' ? n.gx : 0; const xSpan = document.createElement('span'); xSpan.textContent = xInput.value; xLabel.appendChild(xInput); xLabel.appendChild(xSpan); panel.appendChild(xLabel);
		const yLabel = document.createElement('label'); yLabel.textContent = 'Carte Blanche / Surveillance (Y): '; const yInput = document.createElement('input'); yInput.type = 'range'; yInput.min = -6; yInput.max = 6; yInput.step = 1; yInput.value = typeof n.gy === 'number' ? n.gy : 0; const ySpan = document.createElement('span'); ySpan.textContent = yInput.value; yLabel.appendChild(yInput); yLabel.appendChild(ySpan); panel.appendChild(yLabel);
		const colorLabel = document.createElement('label'); colorLabel.textContent = 'Color: '; const colorInput = document.createElement('input'); colorInput.type = 'color'; colorInput.value = (n.color && n.color.startsWith('#')) ? n.color : '#8bc34a'; colorLabel.appendChild(colorInput); panel.appendChild(colorLabel);
		const actions = document.createElement('div'); actions.className = 'panel-actions'; const saveBtn = document.createElement('button'); saveBtn.textContent = 'Save'; const cancelBtn = document.createElement('button'); cancelBtn.textContent = 'Cancel'; actions.appendChild(saveBtn); actions.appendChild(cancelBtn); panel.appendChild(actions);
		saveBtn.addEventListener('click', (ev) => { ev.stopPropagation(); n.name = nameInput.value; title.textContent = n.name || '(no name)'; n.color = colorInput.value; const gx = parseInt(xInput.value,10); const gy = parseInt(yInput.value,10); if (Number.isFinite(gx)) n.gx = Math.max(-6, Math.min(6, gx)); if (Number.isFinite(gy)) n.gy = Math.max(-6, Math.min(6, gy)); coords.textContent = `x: ${n.gx} y: ${n.gy}`; try { persistGraph(); } catch(e) {} graph.render(); updateNodeList(); });
		cancelBtn.addEventListener('click', (ev) => { ev.stopPropagation(); nameInput.value = n.name || ''; xInput.value = typeof n.gx === 'number' ? n.gx : 0; xSpan.textContent = xInput.value; yInput.value = typeof n.gy === 'number' ? n.gy : 0; ySpan.textContent = yInput.value; colorInput.value = (n.color && n.color.startsWith('#')) ? n.color : '#8bc34a'; });
		xInput.addEventListener('input', (ev) => { xSpan.textContent = ev.target.value; const gx = parseInt(ev.target.value,10); if (!Number.isNaN(gx)) { n.gx = Math.max(-6, Math.min(6, gx)); graph.render(); } });
		yInput.addEventListener('input', (ev) => { ySpan.textContent = ev.target.value; const gy = parseInt(ev.target.value,10); if (!Number.isNaN(gy)) { n.gy = Math.max(-6, Math.min(6, gy)); graph.render(); } });
		colorInput.addEventListener('input', (ev) => { n.color = ev.target.value; graph.render(); });
		card.addEventListener('click', () => { graph.selectNode(n); });
		card.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); graph.selectNode(n); } });
		if (graph.selected.node && graph.selected.node.id === n.id) { card.classList.add('selected'); panel.style.display = 'block'; } else { panel.style.display = 'none'; }
		card.appendChild(panel);
		list.appendChild(card);
	});
}

// load a simple sample
function loadSample() {
	const saved = localStorage.getItem('csmatrix.graph');
	if (saved) {
		try {
			const parsed = JSON.parse(saved);
			if (!parsed || !parsed.nodes || parsed.nodes.length === 0) { throw new Error('Saved graph is empty or invalid'); }
			graph.fromJSON(parsed);
			if (parsed.meta && parsed.meta.globalMeters) { globalMeters = parsed.meta.globalMeters; updateControlMeterBars(); }
			updateGlobalMetersUI();
			return;
		} catch (err) { /* continue to sample */ }
	}
	const sample = { nodes: [ { id: 'n1', name: 'Organizer', gx: -1, gy: 2 }, { id: 'n2', name: 'Ally', gx: 1, gy: 2 }, { id: 'n3', name: 'Neutral', gx: 0, gy: 0 } ], edges: [], meta: { globalMeters: { collapse: 0, influence: 2, record: 1 } } };
	try {
		graph.fromJSON(sample);
	} catch (err) { console.error('csmatrix: graph.fromJSON failed', err); }
	if (sample.meta && sample.meta.globalMeters) { globalMeters = sample.meta.globalMeters; updateControlMeterBars(); }
	updateGlobalMetersUI();
	// Ensure the node organizer and list are shown on initial load
	try { updateNodeList(); } catch(e) { /* ignore */ }
}
try { loadSample(); } catch (err) { console.error('csmatrix: loadSample failed', err); }
	updateControlMeterBars();
	// ensure axis pills have default aria state
	document.querySelectorAll('.axis-pill').forEach(el => el.setAttribute('aria-hidden', 'false'));
}
