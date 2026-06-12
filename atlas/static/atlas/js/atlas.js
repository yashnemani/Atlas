/* =====================================================================
   HUMAN ATLAS — Interactive Canvas Implementation
   Django port of the original sophisticated atlas visualization
   ===================================================================== */

class HumanAtlas {
  constructor() {
    this.canvas = document.getElementById('stage');
    this.ctx = this.canvas.getContext('2d');
    this.W = 0;
    this.H = 0;
    this.DPR = Math.min(2, window.devicePixelRatio || 1);

    // Camera state
    this.cam = { x: 0, y: 0, z: 1, tx: 0, ty: 0, tz: 1 };

    // Mode state
    this.mode = 'atlas'; // 'atlas' | 'topic'
    this.currentTopic = null;

    // Physics
    this.nodes = [];
    this.links = [];
    this.hoverNode = null;
    this.dragNode = null;
    this.panning = false;
    this.lastMx = 0;
    this.lastMy = 0;
    this.downX = 0;
    this.downY = 0;
    this.moved = false;

    // Story mode
    this.storySlides = [];
    this.storyIdx = 0;

    // Data
    this.PEOPLE = [];
    this.TOPICS = [];
    this.EVENTS = [];
    this.personById = new Map();
    this.topicById = new Map();
    this.eventById = new Map();
    this.topicEvents = {};
    this.personEvents = {};

    this.init();
  }

  async init() {
    this.setupCanvas();
    this.setupEventListeners();
    this.createStarfield();
    await this.loadData();
    this.processData();
    this.makeAtlasNodes();
    this.startAnimation();
  }

  setupCanvas() {
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.W = innerWidth;
    this.H = innerHeight;
    this.canvas.width = this.W * this.DPR;
    this.canvas.height = this.H * this.DPR;
    this.canvas.style.width = this.W + 'px';
    this.canvas.style.height = this.H + 'px';
  }

  async loadData() {
    if (!window.ATLAS_DATA_URL) return;

    try {
      const response = await fetch(window.ATLAS_DATA_URL);
      const data = await response.json();

      this.PEOPLE = data.people;
      this.TOPICS = data.topics;
      this.EVENTS = data.events;

      // Create lookup maps
      this.personById = new Map(this.PEOPLE.map(p => [p.id, p]));
      this.topicById = new Map(this.TOPICS.map(t => [t.id, t]));
      this.eventById = new Map(this.EVENTS.map(e => [e.id, e]));

    } catch (error) {
      console.error('Failed to load atlas data:', error);
    }
  }

  processData() {
    // Sort events by date
    this.EVENTS.sort((a, b) => a.date.localeCompare(b.date));

    // Build topic events mapping
    this.TOPICS.forEach(t => {
      this.topicEvents[t.id] = this.EVENTS.filter(e => e.topics.includes(t.id));
    });

    // Build person events mapping
    this.PEOPLE.forEach(p => {
      this.personEvents[p.id] = this.EVENTS.filter(e => e.people.includes(p.id));
    });
  }

  createStarfield() {
    this.stars = Array.from({length: 170}, (_, i) => ({
      x: (Math.sin(i * 127.1) * 43758.5453) % 1 * 2400 - 1200,
      y: (Math.sin(i * 311.7) * 12543.987) % 1 * 1600 - 800,
      r: 0.5 + Math.abs(Math.sin(i * 7.3)) * 1.3,
      ph: i * 0.7
    }));
  }

  makeAtlasNodes() {
    this.mode = 'atlas';
    this.currentTopic = null;

    const maxEv = Math.max(...this.TOPICS.map(t => this.topicEvents[t.id]?.length || 0));

    this.nodes = this.TOPICS.map((t, i) => {
      const ang = (i / this.TOPICS.length) * Math.PI * 2 - Math.PI / 2;
      const evn = this.topicEvents[t.id]?.length || 0;
      const ppl = this.topicPeople(t.id).length;
      const R = 46 + 64 * (evn / maxEv);

      return {
        kind: 'topic',
        ref: t,
        id: t.id,
        x: Math.cos(ang) * 300 + (Math.sin(i * 99) * 40),
        y: Math.sin(ang) * 210 + (Math.cos(i * 57) * 30),
        vx: 0,
        vy: 0,
        r: R,
        baseR: R,
        phase: i * 1.37,
        sig: evn + ppl * 0.5
      };
    });

    // Create topic links based on shared events
    this.links = [];
    for (let i = 0; i < this.TOPICS.length; i++) {
      for (let j = i + 1; j < this.TOPICS.length; j++) {
        const shared = this.EVENTS.filter(e =>
          e.topics.includes(this.TOPICS[i].id) &&
          e.topics.includes(this.TOPICS[j].id)
        ).length;

        if (shared > 0) {
          this.links.push({
            a: this.nodes.find(n => n.id === this.TOPICS[i].id),
            b: this.nodes.find(n => n.id === this.TOPICS[j].id),
            w: shared,
            kind: 'tt'
          });
        }
      }
    }

    this.cam.tx = 0;
    this.cam.ty = 0;
    this.cam.tz = 1;

    document.getElementById('topic-actions').style.display = 'none';
    this.setCrumb('');
    this.setHint('Drift across the landscape · scroll to zoom · choose an island to enter its story');
  }

  makeTopicNodes(tid) {
    this.mode = 'topic';
    this.currentTopic = this.topicById.get(tid);

    const ppl = this.topicPeople(tid);
    const maxC = Math.max(...ppl.map(p => p.count));

    const center = {
      kind: 'topicCenter',
      ref: this.currentTopic,
      id: tid,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      r: 92,
      phase: 0,
      fixed: true
    };

    const orbiters = ppl.map((pc, i) => {
      const ang = (i / ppl.length) * Math.PI * 2 - Math.PI / 2 + 0.35;
      const ringR = 185 + (maxC - pc.count) * 62;

      return {
        kind: 'person',
        ref: pc.person,
        id: pc.person.id,
        count: pc.count,
        x: Math.cos(ang) * ringR,
        y: Math.sin(ang) * ringR,
        vx: 0,
        vy: 0,
        r: 30 + pc.count * 4.5,
        phase: i * 0.9,
        anchorAngle: ang,
        anchorR: ringR
      };
    });

    this.nodes = [center, ...orbiters];
    this.links = orbiters.map(o => ({ a: center, b: o, w: o.count, kind: 'tp' }));

    this.cam.tx = 0;
    this.cam.ty = 0;
    this.cam.tz = 1;

    document.getElementById('topic-actions').style.display = 'flex';
    document.getElementById('play-story-btn').onclick = () => this.openStory(tid);

    this.setCrumb(`<span class="link" onclick="goAtlas()">Atlas</span> &nbsp;→&nbsp; <b>${this.currentTopic.name}</b>`);
    this.setHint('The closer a person floats, the deeper their part in this story · click a portrait to read their timeline');
  }

  topicPeople(tid) {
    const counts = {};
    const events = this.topicEvents[tid] || [];

    events.forEach(e => {
      e.people.forEach(p => {
        counts[p] = (counts[p] || 0) + 1;
      });
    });

    return Object.entries(counts)
      .map(([pid, c]) => ({ person: this.personById.get(pid), count: c }))
      .filter(pc => pc.person)
      .sort((a, b) => b.count - a.count);
  }

  setCrumb(html) {
    document.getElementById('crumb').innerHTML = html;
  }

  setHint(s) {
    const h = document.getElementById('hint');
    h.style.opacity = 0;
    setTimeout(() => {
      h.textContent = s;
      h.style.opacity = 1;
    }, 350);
  }

  // Physics simulation
  physics(dt, time) {
    const T = time * 0.001;

    for (const n of this.nodes) {
      if (n.fixed) {
        n.x *= 0.85;
        n.y *= 0.85;
        continue;
      }

      // Organic wander
      n.vx += Math.sin(T * 0.55 + n.phase * 3.1) * 1.1 * dt;
      n.vy += Math.cos(T * 0.43 + n.phase * 2.3) * 1.1 * dt;

      if (this.mode === 'atlas') {
        // Weak gravity to center
        n.vx += -n.x * 0.12 * dt;
        n.vy += -n.y * 0.14 * dt;
      } else {
        // Spring to orbital anchor
        const ax = Math.cos(n.anchorAngle) * n.anchorR;
        const ay = Math.sin(n.anchorAngle) * n.anchorR;
        n.vx += (ax - n.x) * 1.7 * dt;
        n.vy += (ay - n.y) * 1.7 * dt;
        n.anchorAngle += dt * 0.011 * (n.phase % 2 ? 1 : -1);
      }
    }

    // Pairwise repulsion
    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        const a = this.nodes[i], b = this.nodes[j];
        let dx = b.x - a.x, dy = b.y - a.y;
        let d = Math.hypot(dx, dy) || 0.01;
        const minD = a.r + b.r + 26;

        if (d < minD) {
          const f = (minD - d) / d * 2.6 * dt;
          const fx = dx * f, fy = dy * f;
          if (!a.fixed) { a.vx -= fx; a.vy -= fy; }
          if (!b.fixed) { b.vx += fx; b.vy += fy; }
        } else {
          const f = 5200 / (d * d) * dt;
          const fx = dx / d * f, fy = dy / d * f;
          if (!a.fixed) { a.vx -= fx; a.vy -= fy; }
          if (!b.fixed) { b.vx += fx; b.vy += fy; }
        }
      }
    }

    // Link springs (atlas only)
    if (this.mode === 'atlas') {
      for (const l of this.links) {
        const dx = l.b.x - l.a.x, dy = l.b.y - l.a.y;
        const d = Math.hypot(dx, dy) || 0.01;
        const rest = l.a.r + l.b.r + 150 - l.w * 16;
        const f = (d - rest) / d * 0.5 * dt;
        l.a.vx += dx * f; l.a.vy += dy * f;
        l.b.vx -= dx * f; l.b.vy -= dy * f;
      }
    }

    // Update positions
    for (const n of this.nodes) {
      if (n === this.dragNode || n.fixed) {
        n.vx = 0;
        n.vy = 0;
        continue;
      }

      n.vx *= Math.pow(0.18, dt);
      n.vy *= Math.pow(0.18, dt);
      n.x += n.vx * dt * 60 * 0.016;
      n.y += n.vy * dt * 60 * 0.016;
      n.x += n.vx;
      n.y += n.vy;
    }
  }

  // Coordinate transformations
  worldToScreen(x, y) {
    return [
      (x - this.cam.x) * this.cam.z + this.W / 2,
      (y - this.cam.y) * this.cam.z + this.H / 2
    ];
  }

  screenToWorld(sx, sy) {
    return [
      (sx - this.W / 2) / this.cam.z + this.cam.x,
      (sy - this.H / 2) / this.cam.z + this.cam.y
    ];
  }

  hexA(hex, a) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  // Drawing
  draw(time) {
    this.ctx.setTransform(this.DPR, 0, 0, this.DPR, 0, 0);

    // Background
    const bg = this.ctx.createRadialGradient(this.W/2, this.H*0.38, 80, this.W/2, this.H/2, Math.max(this.W, this.H)*0.85);
    bg.addColorStop(0, '#16203a');
    bg.addColorStop(1, '#0a0f1d');
    this.ctx.fillStyle = bg;
    this.ctx.fillRect(0, 0, this.W, this.H);

    const T = time * 0.001;

    // Stars
    for (const s of this.stars) {
      const [sx, sy] = this.worldToScreen(s.x * 0.55 + this.cam.x * 0.45, s.y * 0.55 + this.cam.y * 0.45);
      if (sx < -10 || sx > this.W + 10 || sy < -10 || sy > this.H + 10) continue;

      const tw = 0.25 + 0.45 * Math.abs(Math.sin(T * 0.7 + s.ph));
      this.ctx.fillStyle = `rgba(232,226,208,${tw * 0.4})`;
      this.ctx.beginPath();
      this.ctx.arc(sx, sy, s.r, 0, 7);
      this.ctx.fill();
    }

    // Links
    for (const l of this.links) {
      const [ax, ay] = this.worldToScreen(l.a.x, l.a.y);
      const [bx, by] = this.worldToScreen(l.b.x, l.b.y);
      const hot = this.hoverNode && (this.hoverNode === l.a || this.hoverNode === l.b);
      const baseAlpha = l.kind === 'tt' ? 0.05 + l.w * 0.035 : 0.10 + l.w * 0.04;

      this.ctx.strokeStyle = hot ? 'rgba(201,162,39,0.55)' : `rgba(232,226,208,${baseAlpha})`;
      this.ctx.lineWidth = (hot ? 1.6 : 1) * (0.6 + l.w * 0.35) * this.cam.z;

      const mx = (ax + bx) / 2;
      const my = (ay + by) / 2 + Math.sin(T * 0.8 + l.w) * 8 * this.cam.z;

      this.ctx.beginPath();
      this.ctx.moveTo(ax, ay);
      this.ctx.quadraticCurveTo(mx, my, bx, by);
      this.ctx.stroke();

      // Travelling spark on hot links
      if (hot) {
        const p = (T * 0.35 + l.w * 0.17) % 1;
        const qx = (1-p)*(1-p)*ax + 2*(1-p)*p*mx + p*p*bx;
        const qy = (1-p)*(1-p)*ay + 2*(1-p)*p*my + p*p*by;
        this.ctx.fillStyle = 'rgba(201,162,39,0.9)';
        this.ctx.beginPath();
        this.ctx.arc(qx, qy, 2.4 * this.cam.z, 0, 7);
        this.ctx.fill();
      }
    }

    // Nodes
    for (const n of this.nodes) {
      const [sx, sy] = this.worldToScreen(n.x, n.y);
      const breathe = 1 + 0.025 * Math.sin(T * 1.1 + n.phase * 4);
      const r = n.r * this.cam.z * breathe * (n === this.hoverNode ? 1.07 : 1);

      if (n.kind === 'topic' || n.kind === 'topicCenter') {
        const c = n.ref.color;

        // Halo
        const halo = this.ctx.createRadialGradient(sx, sy, r * 0.4, sx, sy, r * 2.1);
        halo.addColorStop(0, this.hexA(c, n === this.hoverNode ? 0.34 : 0.22));
        halo.addColorStop(1, this.hexA(c, 0));
        this.ctx.fillStyle = halo;
        this.ctx.beginPath();
        this.ctx.arc(sx, sy, r * 2.1, 0, 7);
        this.ctx.fill();

        // Body
        const body = this.ctx.createRadialGradient(sx - r * 0.3, sy - r * 0.35, r * 0.15, sx, sy, r);
        body.addColorStop(0, this.hexA(c, 0.95));
        body.addColorStop(1, this.hexA(c, 0.55));
        this.ctx.fillStyle = body;
        this.ctx.beginPath();
        this.ctx.arc(sx, sy, r, 0, 7);
        this.ctx.fill();

        this.ctx.strokeStyle = n === this.hoverNode ? 'rgba(243,234,215,0.95)' : 'rgba(243,234,215,0.4)';
        this.ctx.lineWidth = 1.6 * this.cam.z;
        this.ctx.beginPath();
        this.ctx.arc(sx, sy, r, 0, 7);
        this.ctx.stroke();

        // Inner ring detail
        this.ctx.strokeStyle = 'rgba(13,19,33,0.25)';
        this.ctx.lineWidth = 1 * this.cam.z;
        this.ctx.beginPath();
        this.ctx.arc(sx, sy, r * 0.82, 0, 7);
        this.ctx.stroke();

        // Label
        this.ctx.fillStyle = '#0d1321';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        const fs = Math.max(10, Math.min(r * 0.24, 20 * this.cam.z));
        this.ctx.font = `600 ${fs}px "Avenir Next","Helvetica Neue",Arial,sans-serif`;
        this.wrapText(n.ref.name, sx, sy - fs * 0.25, r * 1.5, fs * 1.12);

        this.ctx.font = `${Math.max(8, fs * 0.62)}px "Avenir Next","Helvetica Neue",Arial,sans-serif`;
        this.ctx.fillStyle = 'rgba(13,19,33,0.72)';
        const evn = this.topicEvents[n.id]?.length || 0;
        this.ctx.fillText(`${evn} moments`, sx, sy + (n.ref.name.length > 14 ? fs * 1.25 : fs * 0.85));
      }

      if (n.kind === 'person') {
        const p = n.ref;
        const h = this.personHue(p);

        // Halo
        const halo = this.ctx.createRadialGradient(sx, sy, r * 0.5, sx, sy, r * 1.9);
        halo.addColorStop(0, `hsla(${h},45%,65%,${n === this.hoverNode ? 0.3 : 0.16})`);
        halo.addColorStop(1, `hsla(${h},45%,65%,0)`);
        this.ctx.fillStyle = halo;
        this.ctx.beginPath();
        this.ctx.arc(sx, sy, r * 1.9, 0, 7);
        this.ctx.fill();

        // Portrait disc
        const body = this.ctx.createLinearGradient(sx - r, sy - r, sx + r, sy + r);
        body.addColorStop(0, `hsl(${h},42%,74%)`);
        body.addColorStop(1, `hsl(${(h + 40) % 360},48%,50%)`);
        this.ctx.fillStyle = body;
        this.ctx.beginPath();
        this.ctx.arc(sx, sy, r, 0, 7);
        this.ctx.fill();

        this.ctx.strokeStyle = n === this.hoverNode ? '#f3ead7' : 'rgba(243,234,215,0.55)';
        this.ctx.lineWidth = (n === this.hoverNode ? 2.2 : 1.4) * this.cam.z;
        this.ctx.beginPath();
        this.ctx.arc(sx, sy, r, 0, 7);
        this.ctx.stroke();

        // Initials
        this.ctx.fillStyle = 'rgba(13,19,33,0.85)';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.font = `600 ${r * 0.62}px "Avenir Next","Helvetica Neue",Arial,sans-serif`;
        this.ctx.fillText(this.initials(p.name), sx, sy + 1);

        // Name caption
        this.ctx.font = `${Math.max(9, 12.5 * this.cam.z)}px "Avenir Next","Helvetica Neue",Arial,sans-serif`;
        this.ctx.fillStyle = n === this.hoverNode ? '#f3ead7' : 'rgba(232,226,208,0.78)';
        this.ctx.fillText(p.name, sx, sy + r + 16 * this.cam.z);

        this.ctx.font = `italic ${Math.max(8, 10.5 * this.cam.z)}px Georgia,serif`;
        this.ctx.fillStyle = 'rgba(201,162,39,0.85)';
        this.ctx.fillText(`${n.count} moment${n.count > 1 ? 's' : ''} together`, sx, sy + r + 31 * this.cam.z);
      }
    }
  }

  wrapText(text, x, y, maxW, lh) {
    const words = text.split(' ');
    let line = '', lines = [];

    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (this.ctx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = w;
      } else {
        line = test;
      }
    }
    lines.push(line);

    const oy = y - (lines.length - 1) * lh / 2;
    lines.forEach((l, i) => this.ctx.fillText(l, x, oy + i * lh));
  }

  initials(name) {
    const parts = name.replace(/\./g, '').split(/\s+/).filter(w => w.length > 0);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  personHue(p) {
    let h = 0;
    for (const ch of p.id) h = (h * 31 + ch.charCodeAt(0)) % 360;
    return h;
  }

  avatarStyle(p) {
    const h = this.personHue(p);
    return `background: linear-gradient(135deg, hsl(${h},42%,72%), hsl(${(h + 40) % 360},48%,52%))`;
  }

  fmtDate(e) {
    return e.display || e.date;
  }

  esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  }

  // Event handling
  setupEventListeners() {
    // Canvas interactions
    this.canvas.addEventListener('pointerdown', e => this.onPointerDown(e));
    this.canvas.addEventListener('pointermove', e => this.onPointerMove(e));
    this.canvas.addEventListener('pointerup', e => this.onPointerUp(e));
    this.canvas.addEventListener('wheel', e => this.onWheel(e), { passive: false });

    // Global keyboard
    window.addEventListener('keydown', e => this.onKeyDown(e));

    // Make functions globally available
    window.goAtlas = () => this.goAtlas();
    window.closePanels = () => this.closePanels();
    window.exitStory = () => this.exitStory();
    window.storyStep = (d) => this.storyStep(d);
    window.storyGo = (i) => this.storyGo(i);
    window.openPerson = (pid, tid) => this.openPerson(pid, tid);
    window.openEvent = (eid) => this.openEvent(eid);
    window.enterTopic = (tid) => this.enterTopic(tid);
  }

  nodeAt(sx, sy) {
    const [wx, wy] = this.screenToWorld(sx, sy);
    for (let i = this.nodes.length - 1; i >= 0; i--) {
      const n = this.nodes[i];
      if (Math.hypot(wx - n.x, wy - n.y) < n.r + 8) return n;
    }
    return null;
  }

  onPointerDown(e) {
    this.downX = e.clientX;
    this.downY = e.clientY;
    this.moved = false;

    const n = this.nodeAt(e.clientX, e.clientY);
    if (n && !n.fixed) {
      this.dragNode = n;
    } else {
      this.panning = true;
      this.canvas.classList.add('dragging');
    }

    this.lastMx = e.clientX;
    this.lastMy = e.clientY;
    this.canvas.setPointerCapture(e.pointerId);
  }

  onPointerMove(e) {
    const dx = e.clientX - this.lastMx;
    const dy = e.clientY - this.lastMy;

    if (Math.hypot(e.clientX - this.downX, e.clientY - this.downY) > 5) {
      this.moved = true;
    }

    if (this.dragNode) {
      this.dragNode.x += dx / this.cam.z;
      this.dragNode.y += dy / this.cam.z;

      if (this.dragNode.anchorR !== undefined) {
        this.dragNode.anchorAngle = Math.atan2(this.dragNode.y, this.dragNode.x);
        this.dragNode.anchorR = Math.max(150, Math.hypot(this.dragNode.x, this.dragNode.y));
      }
    } else if (this.panning) {
      this.cam.tx -= dx / this.cam.z;
      this.cam.ty -= dy / this.cam.z;
      this.cam.x = this.cam.tx;
      this.cam.y = this.cam.ty;
    } else {
      const n = this.nodeAt(e.clientX, e.clientY);
      this.hoverNode = n;
      this.canvas.classList.toggle('pointing', !!n);
      this.showTooltip(n, e.clientX, e.clientY);
    }

    this.lastMx = e.clientX;
    this.lastMy = e.clientY;
  }

  onPointerUp(e) {
    this.canvas.classList.remove('dragging');

    if (!this.moved) {
      const n = this.nodeAt(e.clientX, e.clientY);
      if (n) {
        if (n.kind === 'topic') this.makeTopicNodes(n.id);
        else if (n.kind === 'person') this.openPerson(n.id, this.currentTopic ? this.currentTopic.id : null);
        else if (n.kind === 'topicCenter') this.openStory(n.id);
      }
    }

    this.dragNode = null;
    this.panning = false;
  }

  onWheel(e) {
    e.preventDefault();
    const f = Math.exp(-e.deltaY * 0.0012);
    this.cam.tz = Math.max(0.4, Math.min(2.6, this.cam.tz * f));
  }

  onKeyDown(e) {
    if (document.getElementById('story').classList.contains('open')) {
      if (e.key === 'ArrowRight' || e.key === ' ') this.storyStep(1);
      if (e.key === 'ArrowLeft') this.storyStep(-1);
      if (e.key === 'Escape') this.exitStory();
      return;
    }

    if (e.key === 'Escape') {
      if (document.getElementById('event-panel').classList.contains('open') ||
          document.getElementById('person-panel').classList.contains('open')) {
        this.closePanels();
      } else if (this.mode === 'topic') {
        this.goAtlas();
      }
    }
  }

  showTooltip(n, x, y) {
    const tip = document.getElementById('tip');

    if (n) {
      tip.style.opacity = 1;
      tip.style.left = Math.min(this.W - 300, x + 18) + 'px';
      tip.style.top = (y + 18) + 'px';

      if (n.kind === 'topic' || n.kind === 'topicCenter') {
        tip.querySelector('.t-title').textContent = n.ref.name;
        const ppl = this.topicPeople(n.id).length;
        const evn = this.topicEvents[n.id]?.length || 0;
        tip.querySelector('.t-sub').textContent = `${evn} moments · ${ppl} people · ${n.kind === 'topic' ? 'click to enter' : 'the heart of this story'}`;
      } else {
        tip.querySelector('.t-title').textContent = n.ref.name;
        tip.querySelector('.t-sub').textContent = `${n.ref.role} · click to read their timeline`;
      }
    } else {
      tip.style.opacity = 0;
    }
  }

  goAtlas() {
    this.closePanels();
    this.exitStory();
    this.makeAtlasNodes();
  }

  enterTopic(tid) {
    this.closePanels();
    this.exitStory();
    this.makeTopicNodes(tid);
  }

  // Panel system
  openPerson(pid, tid) {
    const p = this.personById.get(pid);
    if (!p) return;

    let evs = this.personEvents[pid] || [];
    const scoped = tid && evs.some(e => e.topics.includes(tid));
    if (scoped) evs = evs.filter(e => e.topics.includes(tid));
    const t = tid ? this.topicById.get(tid) : null;

    let html = `
      <div class="person-head">
        <div class="avatar" style="${this.avatarStyle(p)}">${this.initials(p.name)}</div>
        <div>
          <h2>${this.esc(p.name)}${scoped ? ` <span style="color:var(--text-faint)">×</span> <span style="color:${t.color}">${this.esc(t.name)}</span>` : ''}</h2>
          <div class="role">${this.esc(p.role)}</div>
        </div>
      </div>
      <p class="person-bio">${this.esc(p.bio)}</p>`;

    if (scoped && this.personEvents[pid].length > evs.length) {
      html += `<div style="margin-top:6px"><span class="chip" onclick="openPerson('${pid}',null)">View full timeline — ${this.personEvents[pid].length} moments across all topics →</span></div>`;
    }

    html += `<div class="tl-context">${scoped ? `The story of ${this.esc(p.name.split(' ')[0])} and ${this.esc(t.name)}` : 'A life in moments'}</div>`;
    html += `<div class="timeline">`;

    let lastYear = '';
    for (const e of evs) {
      const yr = e.date.slice(0, 4);
      if (yr !== lastYear) {
        html += `<div class="tl-year">${yr}</div>`;
        lastYear = yr;
      }
      html += this.storyCardHTML(e);
    }
    html += `</div>`;

    document.getElementById('person-body').innerHTML = html;
    document.getElementById('event-panel').classList.remove('open');
    document.getElementById('person-panel').classList.add('open');
    document.getElementById('veil').classList.add('on');
  }

  storyCardHTML(e) {
    const others = e.people.slice(0, 4).map(pid => {
      const pp = this.personById.get(pid);
      return pp ? `<span class="chip" onclick="event.stopPropagation();openPerson('${pid}',null)">${this.esc(pp.name)}</span>` : '';
    }).filter(Boolean).join('');

    const tchips = e.topics.map(tid => {
      const tt = this.topicById.get(tid);
      return tt ? `<span class="chip topic-chip" onclick="event.stopPropagation();enterTopic('${tid}')"><span class="dot" style="background:${tt.color}"></span>${this.esc(tt.name)}</span>` : '';
    }).filter(Boolean).join('');

    return `<div class="story-card" onclick="openEvent('${e.id}')">
      <div class="sc-date">${this.fmtDate(e)}</div>
      <h3>${this.esc(e.title)}</h3>
      <div class="sc-sum">${this.esc(e.summary.length > 180 ? e.summary.slice(0, 178).replace(/\s+\S*$/, '') + '…' : e.summary)}</div>
      <div class="sc-meta">${tchips}${others}</div>
    </div>`;
  }

  openEvent(eid) {
    const e = this.eventById.get(eid);
    if (!e) return;

    const nb = this.eventNeighbors(e);

    const ppl = e.people.map(pid => {
      const p = this.personById.get(pid);
      return p ? `<div class="person-pill" onclick="openPerson('${pid}',null)">
        <div class="avatar" style="${this.avatarStyle(p)}">${this.initials(p.name)}</div>
        <div><span class="pp-name">${this.esc(p.name)}</span><span class="pp-role">${this.esc(p.role)}</span></div>
      </div>` : '';
    }).filter(Boolean).join('');

    const tchips = e.topics.map(tid => {
      const tt = this.topicById.get(tid);
      return tt ? `<span class="chip topic-chip" onclick="enterTopic('${tid}')"><span class="dot" style="background:${tt.color}"></span>${this.esc(tt.name)}</span>` : '';
    }).filter(Boolean).join('');

    const connCol = (list, empty) => list.length
      ? list.map(o => `<div class="conn-card" onclick="openEvent('${o.id}')"><div class="cc-date">${this.fmtDate(o)}</div><div class="cc-title">${this.esc(o.title)}</div></div>`).join('')
      : `<div class="conn-empty">${empty}</div>`;

    const docs = e.docs && e.docs.length
      ? `<div class="ev-section"><h4>From the archive</h4>${e.docs.map(d => `<div class="doc-link"><span class="ico">⌘</span>${this.esc(d.title || d)}</div>`).join('')}</div>`
      : '';

    const related = nb.related.length
      ? `<div class="ev-section"><h4>Threads that cross here</h4>${nb.related.map(o => `<div class="conn-card" onclick="openEvent('${o.id}')"><div class="cc-date">${this.fmtDate(o)}</div><div class="cc-title">${this.esc(o.title)}</div></div>`).join('')}</div>`
      : '';

    document.getElementById('event-body').innerHTML = `
      <div class="ev-date">${this.fmtDate(e)}</div>
      <div class="ev-title">${this.esc(e.title)}</div>
      <div class="ev-summary">${this.esc(e.summary)}</div>
      <div class="ev-section"><h4>Who was in the room</h4><div class="people-row">${ppl}</div></div>
      <div class="ev-section"><h4>Part of these stories</h4><div class="sc-meta">${tchips}</div></div>
      <div class="ev-section"><h4>The chain of events</h4>
        <div class="conn-grid">
          <div class="conn-col"><h5>What led to this</h5>${connCol(nb.before, 'This is where the story begins.')}</div>
          <div class="conn-col"><h5>What came after</h5>${connCol(nb.after, 'The story is still being written.')}</div>
        </div>
      </div>
      ${related}${docs}`;

    document.getElementById('event-panel').classList.add('open');
    document.getElementById('veil').classList.add('on');
  }

  eventNeighbors(e) {
    const before = new Map(), after = new Map();

    for (const tid of e.topics) {
      const seq = this.topicEvents[tid] || [];
      const i = seq.indexOf(e);
      if (i > 0) before.set(seq[i-1].id, seq[i-1]);
      if (i < seq.length - 1) after.set(seq[i+1].id, seq[i+1]);
    }

    const related = this.EVENTS.filter(o =>
      o !== e &&
      !before.has(o.id) &&
      !after.has(o.id) &&
      o.people.some(p => e.people.includes(p))
    ).slice(0, 4);

    return { before: [...before.values()], after: [...after.values()], related };
  }

  closePanels() {
    document.getElementById('person-panel').classList.remove('open');
    document.getElementById('event-panel').classList.remove('open');
    document.getElementById('veil').classList.remove('on');
  }

  // Story mode
  actLabel(i, n) {
    if (i === 0) return 'Prologue';
    if (i === n - 1) return 'Epilogue';
    const frac = i / (n - 1);
    if (frac < 0.34) return 'The Beginning';
    if (frac < 0.5) return 'The Pressure Builds';
    if (frac < 0.75) return 'The Turning Point';
    return 'A New Course';
  }

  openStory(tid) {
    this.closePanels();
    const t = this.topicById.get(tid);
    if (!t) return;

    const evs = this.topicEvents[tid] || [];
    const cast = this.topicPeople(tid).slice(0, 5);
    const span = evs.length > 0 ? `${evs[0].date.slice(0, 4)} – ${evs[evs.length - 1].date.slice(0, 4)}` : '';

    this.storySlides = [];
    this.storySlides.push({
      act: 'Prologue',
      date: span,
      title: t.name,
      body: t.description,
      people: cast.map(c => c.person)
    });

    const n = evs.length + 2;
    evs.forEach((e, i) => this.storySlides.push({
      act: this.actLabel(i + 1, n),
      date: this.fmtDate(e),
      title: e.title,
      body: e.summary,
      people: e.people.map(p => this.personById.get(p)).filter(Boolean),
      eid: e.id
    }));

    this.storySlides.push({
      act: 'Epilogue',
      date: '…and after',
      title: 'Where the story stands',
      body: `${evs.length} moments. ${this.topicPeople(tid).length} people. ${t.name} began as one thread of a national emergency and ended as part of a new settlement — proof that crises don't make reforms, people do. Step back to the atlas to follow the threads that cross this story: every person here appears in other stories, and every story bends the others.`,
      people: cast.map(c => c.person)
    });

    this.storyIdx = 0;
    document.getElementById('story-kicker').textContent = `A Story from the Atlas · ${t.name}`;
    this.renderStorySlide();
    document.getElementById('story').classList.add('open');
  }

  renderStorySlide() {
    const s = this.storySlides[this.storyIdx];

    const ppl = s.people && s.people.length ? `<div class="ss-people">${s.people.map(p => `
      <div class="sp" onclick="exitStory();openPerson('${p.id}',null)" style="cursor:pointer">
        <div class="avatar" style="${this.avatarStyle(p)};margin:0 auto">${this.initials(p.name)}</div>
        <div class="spn">${this.esc(p.name)}</div>
      </div>`).join('')}</div>` : '';

    const open = s.eid ? `<div style="margin-top:26px"><span class="chip" onclick="exitStory();openEvent('${s.eid}')">Open this moment →</span></div>` : '';

    document.getElementById('story-stage').innerHTML = `
      <div class="story-slide">
        <div class="ss-act">${s.act}</div>
        <div class="ss-date">${this.esc(s.date)}</div>
        <div class="ss-title">${this.esc(s.title)}</div>
        <div class="ss-body">${this.esc(s.body)}</div>
        ${ppl}${open}
      </div>`;

    const prog = document.getElementById('story-progress');
    prog.innerHTML = this.storySlides.map((_, i) =>
      `<div class="pip ${i < this.storyIdx ? 'done' : ''} ${i === this.storyIdx ? 'now' : ''}" onclick="storyGo(${i})"></div>`
    ).join('');

    document.getElementById('snav-prev').disabled = this.storyIdx === 0;
    document.getElementById('snav-next').disabled = this.storyIdx === this.storySlides.length - 1;
  }

  storyStep(d) {
    this.storyGo(this.storyIdx + d);
  }

  storyGo(i) {
    if (i < 0 || i >= this.storySlides.length) return;
    this.storyIdx = i;
    this.renderStorySlide();
  }

  exitStory() {
    document.getElementById('story').classList.remove('open');
  }

  // Animation loop
  startAnimation() {
    let last = performance.now();

    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      // Smooth camera movement
      this.cam.x += (this.cam.tx - this.cam.x) * 0.09;
      this.cam.y += (this.cam.ty - this.cam.y) * 0.09;
      this.cam.z += (this.cam.tz - this.cam.z) * 0.09;

      this.physics(dt, now);
      this.draw(now);

      requestAnimationFrame(frame);
    };

    requestAnimationFrame(frame);
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new HumanAtlas();
});