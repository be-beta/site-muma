// Nav: alternar tema do nav conforme seção
const nav = document.getElementById('nav');
const darkSections = document.querySelectorAll('.hero, .servicos, .founders, .cta, footer');
function checkNav(){
  const y = window.scrollY + 80;
  let dark = false;
  darkSections.forEach(s=>{
    const r = s.getBoundingClientRect();
    const top = r.top + window.scrollY;
    const bot = top + s.offsetHeight;
    if(y >= top && y < bot) dark = true;
  });
  nav.classList.toggle('dark', dark);
}
window.addEventListener('scroll', checkNav, {passive:true});
checkNav();

// Reveal animations
const io = new IntersectionObserver((entries)=>{
  entries.forEach(e=>{ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target); }});
},{threshold:.15});
document.querySelectorAll('.reveal').forEach(el=>io.observe(el));

// Modular drag — light-touch: clicking a service highlights it
document.querySelectorAll('.mod').forEach(m=>{
  m.addEventListener('click', ()=>{
    document.querySelectorAll('.mod').forEach(x=>x.style.transform='');
    m.style.transform='scale(1.02)';
    setTimeout(()=>{m.style.transform=''},400);
  });
});

// ——————————————————————————————————————————————
// Cardume 3D Muma: órbitas elípticas com profundidade
// (planetas ao redor do cursor — sem cruzar o hotspot)
// ——————————————————————————————————————————————
const COLORS = ['#ff80e1','#a194ff','#9cff97','#ff80e1','#edecea','#a194ff'];
const REDUCE = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const ICON_VB = '0 0 320.23 538.51';
const ICON_D  = 'M315.5,203.29L283.8,0H0v283.8h173.8c0,73.34-13.7,140.23-115.61,151.47v103.24c135.51-13.76,291.32-117.03,257.3-335.23Z';
const ICON_AR = 538.51 / 320.23;

function makeIcon(size, color, rotate){
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', ICON_VB);
  svg.style.width  = size + 'px';
  svg.style.height = (size * ICON_AR) + 'px';
  svg.style.display = 'block';
  svg.style.transform = `rotate(${rotate}deg)`;
  svg.style.transformOrigin = 'center';
  svg.style.transition = 'transform .8s cubic-bezier(.4,0,.2,1)';
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', ICON_D);
  path.setAttribute('fill', color);
  path.style.transition = 'fill 1.2s cubic-bezier(.4,0,.2,1)';
  svg.appendChild(path);
  return { svg, path };
}

function spawnCardume(container, opts){
  if(!container || REDUCE) return;
  const cfg = Object.assign({
    shapes: 10,
    follow: true,
    followStrength: 1,
    mouseSmoothing: 0.04,
    orbitFollow: 0.14,
    opacity: 0.95,
    sizeMul: 1,
    idleAnchor: null,
    clickScare: true,
    tilt: 0.55,
    depthMin: 0.55,
    depthMax: 1.20,
    enableAtomIdle: true,
    idleMs: 5000,
    enableFollowFormation: true,  // STATE_FOLLOW (rastro/bando)
    velocityThreshold: 0.45,      // px/ms — acima disso → bando
    trailDelayMs: 280,            // janela total do rastro (ms)
    threeShells: false,
  }, opts || {});

  // Miniaturizado: ícones 12-28, pontos 4-10
  const baseShapes = [
    { kind:'icon', size: 28 },
    { kind:'icon', size: 22 },
    { kind:'icon', size: 18 },
    { kind:'icon', size: 14 },
    { kind:'icon', size: 12 },
    { kind:'dot',  size: 10 },
    { kind:'dot',  size: 7  },
    { kind:'dot',  size: 6  },
    { kind:'dot',  size: 5  },
    { kind:'dot',  size: 4  },
  ].slice(0, cfg.shapes);

  // 3 tilts do átomo: 45°, -45°, 90°
  const ATOM_TILTS = [Math.PI/4, -Math.PI/4, Math.PI/2];

  const ps = baseShapes.map((c, i) => {
    const el = document.createElement('span');
    el.className = 'cardume-p';
    el.style.willChange = 'transform, opacity, z-index';
    const ci = i % COLORS.length;
    const color = COLORS[ci];
    const size = c.size * cfg.sizeMul;
    let path = null;

    if (c.kind === 'icon') {
      const rot = (Math.random()*40 - 20);
      const { svg, path: p } = makeIcon(size, color, rot);
      el.appendChild(svg);
      path = p;
      el.dataset.kind = 'icon';
      el.dataset.rot = rot;
    } else {
      el.style.width = size + 'px';
      el.style.height = size + 'px';
      el.style.borderRadius = '50%';
      el.style.background = color;
      el.dataset.kind = 'dot';
      el.style.transition = 'background 1.2s cubic-bezier(.4,0,.2,1)';
    }
    el.style.opacity = cfg.opacity;
    container.appendChild(el);

    const seed = ((i * 37 + 13) % 100) / 100;
    const tiltIdx = i % 3;
    const radius = cfg.threeShells ? (65 + (i % 3) * 40) : (80 + i * 12);
    const sameTiltIdx = Math.floor(i / 3);
    const totalInThisTilt = Math.ceil(baseShapes.length / 3);
    const atomBaseAngle = (sameTiltIdx / totalInThisTilt) * Math.PI * 2;
    // delay próprio para sampling do rastro — particulas mais ao fundo seguem com mais atraso
    const trailDelay = ((i + 1) / baseShapes.length) * cfg.trailDelayMs;

    return {
      el, path, kind:c.kind, baseSize: size,
      x:0, y:0, vx:0, vy:0,
      angle: (i / baseShapes.length) * Math.PI * 2 + seed * 0.5,
      atomAngle: atomBaseAngle,
      atomTiltIdx: tiltIdx,
      baseOrbitSpeed: (0.0004 + (i % 4) * 0.0002) * (i % 2 ? 1 : -1),
      radiusX: radius,
      radiusY: radius * cfg.tilt,
      atomRadius: 100 + (sameTiltIdx * 14),
      ci, nextColor: 0,
      rot: parseFloat(el.dataset.rot || '0'),
      trailDelay,
      // pequena ondulação lateral pra parecer cardume "nadando"
      wavePhase: seed * Math.PI * 2,
    };
  });

  const bounds = () => container.getBoundingClientRect();
  let bb = bounds();
  ps.forEach((p) => { p.x = bb.width * 0.5; p.y = bb.height * 0.5; });

  let mx = bb.width * 0.7, my = bb.height * 0.45;
  let smx = mx, smy = my;
  let inside = false;
  let scareUntil = 0;
  let scareCx = 0, scareCy = 0;

  let mouseInertia = 0;
  let prevMx = mx, prevMy = my;
  let lastMoveT = performance.now();
  let atomT = 0;
  let atomSpin = 0;
  let idleId = null;

  // Estado FOLLOW (bando) — buffer circular do rastro
  const TRAIL_MAX = 90;
  const trail = [];
  let followT = 0; // 0..1 — quanto está em estado bando vs órbita
  let mouseSpeed = 0; // px/ms (suavizada)

  function pushTrail(t){
    trail.push({ t, x: mx, y: my });
    while (trail.length > TRAIL_MAX) trail.shift();
  }
  function sampleTrail(targetT){
    // interpola entre os dois pontos mais próximos
    if (!trail.length) return { x: mx, y: my };
    if (trail.length === 1) return trail[0];
    // procura par envolvendo targetT
    for (let i = trail.length - 1; i > 0; i--){
      const a = trail[i-1], b = trail[i];
      if (a.t <= targetT && b.t >= targetT){
        const f = (targetT - a.t) / Math.max(1, b.t - a.t);
        return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
      }
    }
    return trail[0];
  }

  function startIdleTimer(){
    clearTimeout(idleId);
    if (!cfg.enableAtomIdle) return;
    idleId = setTimeout(()=>{}, cfg.idleMs);
  }

  if (cfg.follow){
    container.addEventListener('mousemove', e => {
      const b = bounds();
      const newMx = e.clientX - b.left;
      const newMy = e.clientY - b.top;
      const dx = newMx - prevMx, dy = newMy - prevMy;
      const delta = Math.hypot(dx, dy);
      mouseInertia += delta * 0.00003;
      prevMx = newMx; prevMy = newMy;
      mx = newMx; my = newMy;
      inside = true;
      lastMoveT = performance.now();
      pushTrail(lastMoveT);
      startIdleTimer();
    });
    container.addEventListener('mouseleave', () => { inside = false; });
  }

  let mousedownTime = 0;
  if (cfg.clickScare){
    container.addEventListener('mousedown', e => {
      mousedownTime = performance.now();
    });
    container.addEventListener('mouseup', e => {
      const duration = performance.now() - mousedownTime;
      const charge = Math.min(1.0, duration / 1200); // 0..1
      const chargeMultiplier = 1.0 + charge * 1.5; // up to 2.5x larger dispersion
      
      const b = bounds();
      scareCx = e.clientX - b.left;
      scareCy = e.clientY - b.top;
      scareUntil = performance.now() + 1100 * chargeMultiplier;
      lastMoveT = performance.now();
      startIdleTimer();
      for (const p of ps){
        const dx = p.x - scareCx, dy = p.y - scareCy;
        const d = Math.hypot(dx, dy) || 1;
        const kick = (14 + Math.random()*14) * chargeMultiplier;
        p.vx = (dx/d) * kick + (Math.random()-0.5)*5;
        p.vy = (dy/d) * kick + (Math.random()-0.5)*5;
        const newCi = (p.ci + 1 + Math.floor(Math.random()*4)) % COLORS.length;
        p.ci = newCi;
        const c = COLORS[newCi];
        // COR INSTANTÂNEA AO ASSUSTAR: Remove transitions temporarily for instant update
        if (p.path) {
          p.path.style.transition = 'none';
          p.path.setAttribute('fill', c);
          void p.path.offsetHeight; // force reflow
          p.path.style.transition = 'fill 1.2s cubic-bezier(.4,0,.2,1)';
        } else {
          p.el.style.transition = 'none';
          p.el.style.background = c;
          void p.el.offsetHeight; // force reflow
          p.el.style.transition = 'background 1.2s cubic-bezier(.4,0,.2,1)';
        }
        if (p.kind === 'icon') {
          p.rot += (Math.random()-0.5) * 80 * chargeMultiplier;
          const svg = p.el.querySelector('svg');
          if (svg) svg.style.transform = `rotate(${p.rot}deg)`;
        }
        p.nextColor = performance.now() + 3200 + Math.random()*1500;
      }
    });
  }

  window.addEventListener('resize', () => { bb = bounds(); }, {passive:true});
  startIdleTimer();

  let last = performance.now();
  function tick(t){
    const dt = Math.min(33, t - last); last = t;
    bb = bounds();

    const ax = (cfg.idleAnchor && cfg.idleAnchor.x) ?? 0.66;
    const ay = (cfg.idleAnchor && cfg.idleAnchor.y) ?? 0.50;
    const idleX = bb.width  * (ax + Math.sin(t*0.0001)*0.06);
    const idleY = bb.height * (ay + Math.cos(t*0.00012)*0.07);

    const useMouse = inside && cfg.follow;
    const targetX = useMouse ? (mx*cfg.followStrength + idleX*(1-cfg.followStrength)) : idleX;
    const targetY = useMouse ? (my*cfg.followStrength + idleY*(1-cfg.followStrength)) : idleY;

    smx += (targetX - smx) * cfg.mouseSmoothing;
    smy += (targetY - smy) * cfg.mouseSmoothing;

    mouseInertia *= 0.95;

    // velocidade média do mouse recente (~120ms)
    let recentSpeed = 0;
    if (trail.length > 1){
      let total = 0, dts = 0;
      const cutoff = t - 120;
      for (let i = 1; i < trail.length; i++){
        if (trail[i].t < cutoff) continue;
        total += Math.hypot(trail[i].x - trail[i-1].x, trail[i].y - trail[i-1].y);
        dts   += trail[i].t - trail[i-1].t;
      }
      recentSpeed = dts > 0 ? total / dts : 0;
    }
    // suaviza
    mouseSpeed += (recentSpeed - mouseSpeed) * 0.25;

    // alvo de followT: 1 quando rápido, 0 quando lento — easing
    const wantFollow = cfg.enableFollowFormation && useMouse && mouseSpeed > cfg.velocityThreshold;
    followT += ((wantFollow ? 1 : 0) - followT) * (wantFollow ? 0.18 : 0.08);
    // ease-out elástico sutil no retorno via desaceleração progressiva já no easing acima

    // modo átomo
    const idleFor = t - lastMoveT;
    const wantAtom = cfg.enableAtomIdle && idleFor > cfg.idleMs && !scareUntil && followT < 0.05;
    if (wantAtom) atomT += (1 - atomT) * 0.04;
    else atomT += (0 - atomT) * 0.22;
    atomSpin += dt * 0.0002;

    const scared = t < scareUntil;
    const scareDecay = scared ? (scareUntil - t) / 1100 : 0;
    const depthRange = cfg.depthMax - cfg.depthMin;
    const depthMid = (cfg.depthMax + cfg.depthMin) / 2;

    for (let i=0;i<ps.length;i++){
      const p = ps[i];

      if (!scared){
        p.angle += (p.baseOrbitSpeed + mouseInertia * (p.baseOrbitSpeed > 0 ? 1 : -1)) * dt;
      }

      // === posição na ÓRBITA elíptica 3D distribuída em 4 planos (45°, 90°, 135°, 180°) ===
      const x_local = Math.cos(p.angle) * p.radiusX;
      const y_local = Math.sin(p.angle) * p.radiusY;
      const plane = [Math.PI/4, Math.PI/2, 3*Math.PI/4, Math.PI][i % 4];
      const orbX = smx + (x_local * Math.cos(plane) - y_local * Math.sin(plane));
      const orbY = smy + (x_local * Math.sin(plane) + y_local * Math.cos(plane));
      const s1 = Math.sin(p.angle);

      // === posição no ÁTOMO (3 elipses cruzadas) ===
      const T = ATOM_TILTS[p.atomTiltIdx] + atomSpin;
      const aA = p.atomAngle + atomSpin;
      const lx = Math.cos(aA) * p.atomRadius;
      const ly = Math.sin(aA) * p.atomRadius * 0.35;
      const atomX = smx + (lx * Math.cos(T) - ly * Math.sin(T));
      const atomY = smy + (lx * Math.sin(T) + ly * Math.cos(T));

      // === posição no BANDO (rastro do mouse) ===
      const sample = sampleTrail(t - p.trailDelay);
      // wave lateral (ondulação de cardume) — perpendicular à direção
      const wave = Math.sin(t*0.006 + p.wavePhase) * 6 * (1 - i/ps.length);
      // direção do rastro: deriva de dois pontos próximos
      const aheadSample = sampleTrail(t - p.trailDelay + 60);
      const tdx = aheadSample.x - sample.x;
      const tdy = aheadSample.y - sample.y;
      const tlen = Math.hypot(tdx, tdy) || 1;
      // perpendicular
      const px = -tdy/tlen, py = tdx/tlen;
      const followX = sample.x + px * wave;
      const followY = sample.y + py * wave;

      // === blends: órbita ↔ átomo ↔ bando ===
      // primeiro: órbita-átomo
      const oaX = orbX + (atomX - orbX) * atomT;
      const oaY = orbY + (atomY - orbY) * atomT;
      // depois: órbita-átomo ↔ bando
      const tgtX = oaX + (followX - oaX) * followT;
      const tgtY = oaY + (followY - oaY) * followT;

      if (scared){
        p.x += p.vx; p.y += p.vy;
        p.vx *= 0.91; p.vy *= 0.91;
        p.x += (Math.random()-0.5) * 2.5 * scareDecay;
        p.y += (Math.random()-0.5) * 2.5 * scareDecay;
        const fdx = p.x - scareCx, fdy = p.y - scareCy;
        const fd = Math.hypot(fdx, fdy) || 1;
        if (fd < 260){
          const fk = (1 - fd/260) * 5 * scareDecay;
          p.x += (fdx/fd) * fk;
          p.y += (fdy/fd) * fk;
        }
      } else {
        // ease maior durante follow (responsividade) e menor durante átomo (sereno)
        const ease = cfg.orbitFollow * (1 + followT * 0.6);
        p.x += (tgtX - p.x) * ease;
        p.y += (tgtY - p.y) * ease;
      }

      // profundidade — atenuada em modo bando (formação plana, sem profundidade)
      const depth = (depthMid + s1 * (depthRange / 2)) * (1 - followT * 0.4) + followT * 0.85;
      const opa = ((s1 > 0 ? 0.95 : 0.50) * (1 - followT) + 0.90 * followT) * cfg.opacity;

      p.el.style.transform =
        `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0) translate(-50%, -50%) scale(${depth.toFixed(3)})`;
      p.el.style.zIndex = s1 > 0 ? 3 : 1;
      p.el.style.opacity = opa.toFixed(2);

      if (!scared && t > p.nextColor){
        p.nextColor = t + 3200 + Math.random()*2800;
        p.ci = (p.ci + 1 + Math.floor(Math.random()*3)) % COLORS.length;
        const c = COLORS[p.ci];
        if (p.path) p.path.setAttribute('fill', c);
        else p.el.style.background = c;
      }
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// Spawn cardumes — guarded by a11y mode
if (!document.documentElement.classList.contains('a11y-mode')) {
  // Hero: cardume 3D miniatura, com inércia e modo átomo em repouso
  spawnCardume(document.querySelector('.hero'), {
    shapes: 10, follow: true, opacity: 0.95, sizeMul: 1.0,
    mouseSmoothing: 0.035, orbitFollow: 0.055,
    tilt: 0.55, depthMin: 0.50, depthMax: 1.25,
    enableAtomIdle: true, idleMs: 5000,
    enableFollowFormation: false, // Elétrons estáveis de eletrosfera (sem bando caótico)
    idleAnchor: {x:0.72, y:0.46},
    threeShells: true,
  });

  // Manifesto: planetas pequenos, ambient, sem seguir o mouse
  spawnCardume(document.querySelector('.manifesto'), {
    shapes: 5, follow: false, clickScare: false, enableAtomIdle: false,
    opacity: 0.32, sizeMul: 0.55,
    mouseSmoothing: 0.02, orbitFollow: 0.08,
    tilt: 0.6, depthMin: 0.6, depthMax: 1.1,
    idleAnchor: {x:0.88, y:0.78},
  });

  // CTA: segue o mouse de leve, cardume premium com 3 cascas
  spawnCardume(document.querySelector('.cta'), {
    shapes: 10, follow: true, opacity: 0.95, sizeMul: 1.0,
    mouseSmoothing: 0.035, orbitFollow: 0.055,
    tilt: 0.55, depthMin: 0.50, depthMax: 1.25,
    enableAtomIdle: true, idleMs: 5000,
    enableFollowFormation: false,
    idleAnchor: {x:0.84, y:0.52},
    threeShells: true,
  });
}

// ——————————————————————————————————————————————
// Cursor customizado (esfera + halo) — perfeitamente concêntricos
// + Fibonacci burst no clique + X-Ray cromático nos cases
// + Ímã magnético iPadOS (halo abraça botão)
// ——————————————————————————————————————————————
(function customCursor(){
  if (window.matchMedia('(pointer: coarse)').matches) return;
  if (document.documentElement.classList.contains('a11y-mode')) return;
  const dot  = document.getElementById('cursor');
  const halo = document.getElementById('cursor-halo');
  const fx   = document.getElementById('cursor-fx-container');
  if (!dot || !halo) return;

  let x = -100, y = -100;
  let hx = -100, hy = -100;
  // estado magnético: se setado, halo "abraça" esse elemento
  let magnetEl = null;
  let activeMagnetEl = null;

  // Elementos "atraidores" (geleca): cursor se estica em direção a eles quando próximo
  const STICKY_SEL = '.nav-links a, .nav-cta, #a11yToggle, #copyEmail, .ghost-btn, .cta .form button, .modal-close, .modal-submit';
  const STICKY_RANGE = 70; // px até a borda do botão pra começar a esticar

  document.addEventListener('mousemove', e => {
    x = e.clientX; y = e.clientY;
  }, {passive:true});

  // ——— Fibonacci burst: anéis concêntricos 1,2,3,5,8 ———
  const FIB = [1, 2, 3, 5, 8];
  const FIB_BASE = 22;
  function fibonacciBurst(cx, cy, shape, chargeMultiplier = 1.0){
    if (!fx) return;
    FIB.forEach((n, i) => {
      setTimeout(() => {
        const ring = document.createElement('div');
        ring.className = 'fibonacci-ring' + (shape ? ' shaped' : '');
        if (shape){
          // nasce contornando o botão, expande virando círculo
          const expansion = n * 6 * chargeMultiplier;
          ring.style.width  = (shape.width  + expansion) + 'px';
          ring.style.height = (shape.height + expansion) + 'px';
          ring.style.borderRadius = shape.radius;
          ring.style.left = shape.cx + 'px';
          ring.style.top  = shape.cy + 'px';
        } else {
          const size = n * FIB_BASE * chargeMultiplier;
          ring.style.width  = size + 'px';
          ring.style.height = size + 'px';
          ring.style.left = cx + 'px';
          ring.style.top  = cy + 'px';
        }
        ring.style.borderColor = (i % 2 === 0) ? 'var(--pink)' : 'var(--green)';
        ring.style.borderWidth = (i < 2 ? '1.5px' : '1px');
        fx.appendChild(ring);
        setTimeout(() => ring.remove(), 460);
      }, i * 28);
    });
  }
  let clickStartTime = 0;
  document.addEventListener('mousedown', (e) => {
    clickStartTime = performance.now();
    dot.classList.add('click');
  });
  document.addEventListener('mouseup', (e) => {
    dot.classList.remove('click');
    const duration = performance.now() - clickStartTime;
    const charge = Math.min(1.0, duration / 1200); // 0..1
    const chargeMultiplier = 1.0 + charge * 1.2; // up to 2.2x larger rings
    
    // se o clique foi DENTRO de um CTA, anéis nascem com formato do botão
    const ctaTarget = e.target.closest(STICKY_SEL);
    if (ctaTarget){
      const r = ctaTarget.getBoundingClientRect();
      const cs = getComputedStyle(ctaTarget);
      fibonacciBurst(0, 0, {
        width: r.width, height: r.height,
        radius: cs.borderRadius,
        cx: r.left + r.width/2,
        cy: r.top  + r.height/2,
      }, chargeMultiplier);
    } else {
      fibonacciBurst(e.clientX, e.clientY, null, chargeMultiplier);
    }
  });

  // ——— Idle Atom timer: entering rotating 3D atom state after 20s of mouse idleness ———
  let idleTimer = null;
  function resetIdleTimer(){
    clearTimeout(idleTimer);
    dot.classList.remove('idle-atom');
    halo.classList.remove('idle-atom');
    idleTimer = setTimeout(() => {
      // enter idle-atom only if completely idle and not hovering or holding down
      if (!magnetEl && !dot.classList.contains('hover') && !dot.classList.contains('text') && !dot.classList.contains('click') && !dot.classList.contains('case-lens') && !dot.classList.contains('detail-lens')) {
        dot.classList.add('idle-atom');
        halo.classList.add('idle-atom');
      }
    }, 20000);
  }
  document.addEventListener('mousemove', resetIdleTimer, {passive:true});
  document.addEventListener('mousedown', resetIdleTimer, {passive:true});
  resetIdleTimer();

  // ——— Loop principal: posiciona dot + halo + stretch geleca ———
  function loop(){
    // halo: segue cursor OU abraça magnetEl
    if (magnetEl){
      if (activeMagnetEl !== magnetEl) {
        if (activeMagnetEl) {
          activeMagnetEl.style.transform = '';
          activeMagnetEl.classList.remove('magnetic-active');
        }
        activeMagnetEl = magnetEl;
        activeMagnetEl.classList.add('magnetic-active');
      }

      const r = magnetEl.getBoundingClientRect();
      const cx = r.left + r.width/2;
      const cy = r.top  + r.height/2;
      
      hx += (cx - hx) * 0.65;
      hy += (cy - hy) * 0.65;
      halo.style.transform = `translate3d(${hx}px, ${hy}px, 0) translate(-50%, -50%)`;
      // iPad snap border wrapping
      halo.style.width  = (r.width  + 14) + 'px';
      halo.style.height = (r.height + 10) + 'px';
      const cs = getComputedStyle(magnetEl);
      halo.style.borderRadius = cs.borderRadius;

      // iPad magnetic translate: subtle shift of the button toward the cursor
      const pullX = (x - cx) * 0.25;
      const pullY = (y - cy) * 0.3;
      magnetEl.style.transform = `translate3d(${pullX.toFixed(1)}px, ${pullY.toFixed(1)}px, 0) scale(1.02)`;
    } else {
      if (activeMagnetEl) {
        activeMagnetEl.style.transform = '';
        activeMagnetEl.classList.remove('magnetic-active');
        activeMagnetEl = null;
      }
      hx += (x - hx) * 0.28;
      hy += (y - hy) * 0.28;
      halo.style.transform = `translate3d(${hx}px, ${hy}px, 0) translate(-50%, -50%)`;
      // Restore default dimensions when not magnetic
      halo.style.width = '';
      halo.style.height = '';
      halo.style.borderRadius = '';
    }

    // dot: se NÃO em estado magnético (escondido), calcula stretch toward CTA mais próximo
    if (!magnetEl){
      let nearestDist = Infinity;
      let nearCx = 0, nearCy = 0;
      let insideCTA = false;
      const ctas = document.querySelectorAll(STICKY_SEL);
      for (const btn of ctas){
        // Ignora botões magnéticos invisíveis dentro do modal fechado
        const modalParent = btn.closest('#contactModal');
        if (modalParent && !modalParent.classList.contains('active')) {
          continue;
        }
        // Y-Guard: ignora os botões fixos da navbar se o mouse já passou dela (y > 80)
        if (btn.closest('#nav') && y > 80) {
          continue;
        }
        const r = btn.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;

        // distância do cursor à caixa do botão (0 se dentro)
        const dxBox = Math.max(r.left - x, 0, x - r.right);
        const dyBox = Math.max(r.top  - y, 0, y - r.bottom);
        const dist = Math.hypot(dxBox, dyBox);
        if (dist < nearestDist){
          nearestDist = dist;
          nearCx = r.left + r.width/2;
          nearCy = r.top  + r.height/2;
          insideCTA = (dist === 0);
        }
      }
      if (insideCTA){
        dot.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
      } else if (nearestDist < STICKY_RANGE){
        // perto: estica como gota em direção ao centro do botão
        const angle = Math.atan2(nearCy - y, nearCx - x);
        const amount = 1 - nearestDist / STICKY_RANGE; // 0..1
        const sx = 1 + amount * 0.9;
        const sy = 1 - amount * 0.25;
        // ao se aproximar muito, "puxa" o cursor levemente na direção do botão (atração)
        const pull = amount * amount * 8;
        const ax2 = x + Math.cos(angle) * pull;
        const ay2 = y + Math.sin(angle) * pull;
        dot.style.transform = `translate3d(${ax2}px, ${ay2}px, 0) translate(-50%, -50%) rotate(${angle}rad) scale(${sx.toFixed(3)}, ${sy.toFixed(3)}) rotate(${(-angle).toFixed(4)}rad)`;
      } else {
        dot.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
      }
    }

    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  // ——— Lente X-Ray + tint cromático nos cases ———
  document.querySelectorAll('.case').forEach(c => {
    const back = c.querySelector('.img-back');
    if (!back) return;
    // injeta tint + edge
    const tint = document.createElement('div'); tint.className = 'lens-tint';
    const edge = document.createElement('div'); edge.className = 'lens-edge';
    c.appendChild(tint); c.appendChild(edge);

    let raf = null, mx = 0, my = 0;
    let openness = 0;
    const TARGET = 150;
    let hovering = false;

    c.addEventListener('mouseenter', () => { hovering = true; runLens(); });
    c.addEventListener('mousemove', e => {
      const r = c.getBoundingClientRect();
      mx = e.clientX - r.left;
      my = e.clientY - r.top;
      // var pra o radial gradient do tint
      tint.style.setProperty('--lx', mx + 'px');
      tint.style.setProperty('--ly', my + 'px');
      edge.style.setProperty('--lx', mx + 'px');
      edge.style.setProperty('--ly', my + 'px');
    });
    c.addEventListener('mouseleave', () => {
      hovering = false;
      back.style.clipPath = `circle(0px at ${mx}px ${my}px)`;
      tint.style.clipPath = `circle(0px at ${mx}px ${my}px)`;
    });
    function runLens(){
      cancelAnimationFrame(raf);
      function tick(){
        const t = hovering ? TARGET : 0;
        openness += (t - openness) * 0.22;
        const cp = `circle(${openness.toFixed(1)}px at ${mx}px ${my}px)`;
        back.style.clipPath = cp;
        tint.style.clipPath = cp;
        edge.style.setProperty('--lr', openness.toFixed(1) + 'px');
        if (Math.abs(t - openness) > 0.5 || hovering) raf = requestAnimationFrame(tick);
      }
      tick();
    }
  });

  // ——— Estados mutantes do cursor por contexto ———
  const matches = (el, sel) => el && el.matches && el.matches(sel);
  const textMatch = el => matches(el, 'input:not([type=file]):not([type=checkbox]):not([type=radio]):not([type=submit]):not([type=button]):not([type=hidden]), textarea, [contenteditable=true]');

  const CONTEXTS = [
    { sel: '.case',          cls: 'case-lens',   html: '<span class="cursor-text">ver ↗</span>' },
    { sel: '.photo',         cls: 'detail-lens', html: '<span class="cursor-text plus">+</span>' },
    { sel: STICKY_SEL,       cls: 'magnetic',    magnetic: true, html: '' }
  ];
  const HOVER_FALLBACK = 'a, button, [role=button], summary, label, .mod, .photo, .cardume-p, .marquee, .brand, .copy-email-btn, .client-grid div, select';

  function resetCursor(){
    dot.classList.remove('hover','text','case-lens','detail-lens','magnetic','hidden');
    halo.classList.remove('hover','hidden');
    halo.style.width = ''; halo.style.height = ''; halo.style.borderRadius = '';
    magnetEl = null;
    if (dot.innerHTML) dot.innerHTML = '';
  }

  document.addEventListener('mouseover', e => {
    let n = e.target;
    while (n && n !== document.body){
      if (textMatch(n)){
        if (!dot.classList.contains('text')) {
          resetCursor();
          dot.classList.add('text');
          halo.classList.add('hidden');
        }
        return;
      }
      for (const c of CONTEXTS){
        if (matches(n, c.sel)){
          if (!dot.classList.contains(c.cls)){
            if (c.magnetic){
              // Ignora se estiver dentro do modal fechado
              const modalParent = n.closest('#contactModal, #careerModal');
              if (modalParent && !modalParent.classList.contains('active')) {
                continue;
              }
            }
            resetCursor();
            dot.classList.add(c.cls);
            dot.innerHTML = c.html;
            if (c.magnetic){
              magnetEl = n;
              halo.classList.remove('hidden');
            } else {
              halo.classList.add('hidden');
            }
          } else if (c.magnetic && magnetEl !== n){
            // mudou de botão magnético sem sair do contexto
            const modalParent = n.closest('#contactModal, #careerModal');
            if (modalParent && !modalParent.classList.contains('active')) {
              continue;
            }
            magnetEl = n;
          }
          return;
        }
      }
      if (matches(n, HOVER_FALLBACK)){
        if (!dot.classList.contains('hover') || dot.innerHTML){
          resetCursor();
          dot.classList.add('hover');
          halo.classList.add('hover');
        }
        return;
      }
      n = n.parentElement;
    }
    if (dot.classList.length > 0 || dot.innerHTML) resetCursor();
  }, {passive:true});

  document.addEventListener('mouseleave', () => { dot.classList.add('hidden'); halo.classList.add('hidden'); });
  document.addEventListener('mouseenter', () => { dot.classList.remove('hidden'); halo.classList.remove('hidden'); });
})();

// ——————————————————————————————————————————————
// Copy email button — Clipboard API + tip "Copiado!"
// ——————————————————————————————————————————————
(function copyEmail(){
  const btn = document.getElementById('copyEmail');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText('oi@mumaestudio.com.br'); }
    catch(e){
      // fallback antigo
      const ta = document.createElement('textarea');
      ta.value = 'oi@mumaestudio.com.br';
      ta.style.position='fixed';ta.style.opacity='0';
      document.body.appendChild(ta); ta.select();
      try{ document.execCommand('copy'); }catch(_){}
      ta.remove();
    }
    btn.classList.add('copied');
    setTimeout(() => btn.classList.remove('copied'), 1500);
  });
})();

// ——————————————————————————————————————————————
// Logo mutante: intro sequencial (swap entre orig/alt)
// + variação aleatória no header
// ——————————————————————————————————————————————
(function logoMutante(){
  const svg = document.getElementById('brandSvg');
  if (!svg) return;
  const letters = svg.querySelectorAll('.lp');
  if (!letters.length) return;

  function popLetter(idx){
    const el = letters[idx];
    if (!el) return;
    el.classList.remove('pop');
    void el.offsetWidth;
    el.classList.add('pop');
  }
  function toggleAlt(idx, force){
    const el = letters[idx];
    if (!el) return;
    const isCurrentlySwapped = el.classList.contains('swap');
    const targetState = typeof force === 'boolean' ? force : !isCurrentlySwapped;
    
    if (targetState) {
      // Find other swapped letters
      const currentSwapped = [];
      letters.forEach((l, i) => {
        if (i !== idx && l.classList.contains('swap')) {
          currentSwapped.push(i);
        }
      });
      // Limit to max 2 swaps: remove swap from the oldest one if exceeding
      if (currentSwapped.length >= 2) {
        letters[currentSwapped[0]].classList.remove('swap');
      }
      el.classList.add('swap');
    } else {
      el.classList.remove('swap');
    }
  }
  function setRandomState(){
    // Choose 1 or 2 random letters to be alternative (limit active swaps to max 2)
    letters.forEach((_, i) => letters[i].classList.remove('swap'));
    const count = Math.random() > 0.5 ? 2 : 1;
    const indices = [0, 1, 2, 3];
    indices.sort(() => Math.random() - 0.5);
    for (let i = 0; i < count; i++) {
      letters[indices[i]].classList.add('swap');
    }
  }

  // Intro: cycle ultra-rápido entre orig/alt em cada letra (200ms × 8 = 1.6s)
  let step = 0;
  const totalSteps = letters.length * 2;
  const intro = setInterval(() => {
    const idx = step % letters.length;
    toggleAlt(idx); // toggle
    popLetter(idx);
    step++;
    if (step >= totalSteps){
      clearInterval(intro);
      // estabiliza num estado aleatório (não todos voltam ao orig)
      setRandomState();
    }
  }, 200);

  // Header hover/click: troca uma letra aleatória entre orig ↔ alt
  const navEl = document.getElementById('nav');
  let throttled = false;
  function randomSwap(){
    if (throttled) return;
    throttled = true;
    const idx = Math.floor(Math.random() * letters.length);
    toggleAlt(idx);
    popLetter(idx);
    setTimeout(() => { throttled = false; }, 420);
  }
  navEl && navEl.addEventListener('mouseenter', randomSwap);
  document.getElementById('brandLogo') && document.getElementById('brandLogo').addEventListener('click', randomSwap);
})();

// ——————————————————————————————————————————————
// Nav ticker: rotação de frases do repertório verbal
// ——————————————————————————————————————————————
(function ticker(){
  const node = document.querySelector('#navTicker .phrase');
  if (!node) return;
  const phrases = [
    '<em>disponível</em> para projetos · 2025',
    'do detalhe <em>ao todo</em>.',
    'criamos <em>em rede</em>.',
    'conectamos <em>o que importa</em>.',
    'produção <em>sem cilada</em>.',
    'conteúdo <em>sem fórmula</em> de bolo.',
  ];
  let i = 0;
  setInterval(() => {
    node.classList.add('out');
    setTimeout(() => {
      i = (i + 1) % phrases.length;
      node.innerHTML = phrases[i];
      node.classList.remove('out');
    }, 420);
  }, 4400);
})();

// ——————————————————————————————————————————————
// Email Obfuscation — Anti-bot
// ——————————————————————————————————————————————
(function emailObfuscation() {
  const u = 'oi'; const d = 'mumaestudio.com.br';
  const email = u + '@' + d;
  const emailLink = document.getElementById('emailLink');
  const footerEmail = document.getElementById('footerEmail');
  if (emailLink) {
    emailLink.textContent = email;
    emailLink.href = 'mailto:' + email;
  }
  if (footerEmail) {
    footerEmail.textContent = email;
    footerEmail.href = 'mailto:' + email;
  }
})();

// ——————————————————————————————————————————————
// Contact Modal — Form + Anti-spam + EmailJS
// ——————————————————————————————————————————————
(function contactModal() {
  const modal = document.getElementById('contactModal');
  const form = document.getElementById('contactForm');
  const closeBtn = document.getElementById('modalClose');
  const successEl = document.getElementById('modalSuccess');
  const errorEl = document.getElementById('modalError');
  const submitBtn = document.getElementById('modalSubmit');
  const dropZone = document.getElementById('dropZone');
  const fileInput = document.getElementById('contactFile');
  const dropZoneText = dropZone ? dropZone.querySelector('.drop-zone-text') : null;
  const dropZoneFile = document.getElementById('dropZoneFile');
  const fileNameEl = document.getElementById('fileName');
  const fileRemoveBtn = document.getElementById('fileRemove');
  if (!modal || !form) return;

  // EmailJS config — replace with your IDs to enable real sending
  const EMAILJS_SERVICE  = 'YOUR_SERVICE_ID';
  const EMAILJS_TEMPLATE = 'YOUR_TEMPLATE_ID';
  const EMAILJS_KEY      = 'YOUR_PUBLIC_KEY';
  // Test email (change to your production email when ready)
  const FALLBACK_EMAIL   = 'beai.bernardot@gmail.com';
  const isEmailJSConfigured = EMAILJS_SERVICE !== 'YOUR_SERVICE_ID';

  let formOpenedAt = 0;
  let submissionCount = 0;
  let lastSubmitTime = 0;
  const MAX_SUBMISSIONS = 3;
  const RATE_LIMIT_MS = 600000; // 10 minutes
  const MIN_FILL_TIME_MS = 2000; // 2 seconds minimum

  // Open modal
  function openModal() {
    modal.classList.add('active');
    document.body.classList.add('modal-open');
    formOpenedAt = Date.now();
    // Reset form state
    form.style.display = '';
    const header = modal.querySelector('.modal-header');
    if (header) header.style.display = '';
    successEl.style.display = 'none';
    errorEl.style.display = 'none';
    form.reset();
    clearFile();

    // Auto-prefill email from CTA input if it exists
    const ctaEmail = document.getElementById('ctaEmailInput');
    const contactEmail = document.getElementById('contactEmail');
    if (ctaEmail && contactEmail && ctaEmail.value) {
      contactEmail.value = ctaEmail.value;
    }
  }

  // Close modal
  function closeModal() {
    modal.classList.remove('active');
    document.body.classList.remove('modal-open');
  }

  // Open triggers: all CTA buttons that should open the modal
  document.querySelectorAll('.nav-cta, .cta .form button, .ghost-btn[href="#contato"], a[href="#contato"]').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      openModal();
    });
  });
  // Override the original CTA form submit
  const ctaForm = document.querySelector('.cta .form');
  if (ctaForm) {
    ctaForm.addEventListener('submit', e => {
      e.preventDefault();
      openModal();
    });
  }

  // Close triggers
  closeBtn && closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', e => {
    if (e.target === modal) closeModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal.classList.contains('active')) closeModal();
  });

  // File handling
  function clearFile() {
    if (fileInput) fileInput.value = '';
    if (dropZoneText) dropZoneText.style.display = '';
    if (dropZoneFile) dropZoneFile.style.display = 'none';
  }

  function showFile(file) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Arquivo muito grande. Máximo: 5MB');
      clearFile();
      return;
    }
    if (fileNameEl) fileNameEl.textContent = file.name;
    if (dropZoneText) dropZoneText.style.display = 'none';
    if (dropZoneFile) dropZoneFile.style.display = 'flex';
  }

  if (fileInput) {
    fileInput.addEventListener('change', () => {
      if (fileInput.files.length) showFile(fileInput.files[0]);
    });
  }
  if (fileRemoveBtn) {
    fileRemoveBtn.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      clearFile();
    });
  }
  if (dropZone) {
    ['dragenter', 'dragover'].forEach(evt => {
      dropZone.addEventListener(evt, e => {
        e.preventDefault();
        dropZone.classList.add('dragover');
      });
    });
    ['dragleave', 'drop'].forEach(evt => {
      dropZone.addEventListener(evt, e => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
      });
    });
    dropZone.addEventListener('drop', e => {
      const dt = e.dataTransfer;
      if (dt.files.length && fileInput) {
        fileInput.files = dt.files;
        showFile(dt.files[0]);
      }
    });
  }

  // Form submission
  form.addEventListener('submit', async e => {
    e.preventDefault();

    // Anti-spam checks
    // 1. Honeypot
    const hp = form.querySelector('.hp-field');
    if (hp && hp.value) { showSuccess(); return; } // silently "succeed" for bots

    // 2. Timer check
    const fillTime = Date.now() - formOpenedAt;
    if (fillTime < MIN_FILL_TIME_MS) {
      showSpamWarning();
      return;
    }

    // 3. Rate limit
    const now = Date.now();
    if (now - lastSubmitTime < RATE_LIMIT_MS && submissionCount >= MAX_SUBMISSIONS) {
      showSpamWarning();
      return;
    }

    // Disable button
    submitBtn.disabled = true;
    submitBtn.querySelector('.submit-text').style.display = 'none';
    submitBtn.querySelector('.submit-loading').style.display = '';

    const name = form.querySelector('#contactName').value;
    const email = form.querySelector('#contactEmail').value;
    const project = form.querySelector('#contactProject').value;
    const message = form.querySelector('#contactMessage').value;

    try {
      if (isEmailJSConfigured && window.emailjs) {
        // Real EmailJS send
        await emailjs.send(EMAILJS_SERVICE, EMAILJS_TEMPLATE, {
          from_name: name,
          from_email: email,
          project_type: project,
          message: message,
          origin: 'Landing Page Muma',
        }, EMAILJS_KEY);
      } else {
        // Fallback: construct mailto link
        const subject = encodeURIComponent('[Landing Page Muma] Novo briefing de ' + name);
        const body = encodeURIComponent(
          'Nome: ' + name + '\n' +
          'Email: ' + email + '\n' +
          'Tipo de projeto: ' + (project || 'Não informado') + '\n' +
          '---\n' +
          message + '\n' +
          '---\n' +
          'Origem: Landing Page Muma\n' +
          'Enviado em: ' + new Date().toLocaleString('pt-BR')
        );
        window.location.href = 'mailto:' + FALLBACK_EMAIL + '?subject=' + subject + '&body=' + body;
        // Small delay so mailto triggers before showing success
        await new Promise(r => setTimeout(r, 500));
      }
      submissionCount++;
      lastSubmitTime = Date.now();
      showSuccess();
    } catch (err) {
      showError();
    }
  });

  function showSuccess() {
    form.style.display = 'none';
    errorEl.style.display = 'none';
    successEl.style.display = 'block';
    const header = modal.querySelector('.modal-header');
    if (header) header.style.display = 'none';
    submitBtn.disabled = false;
    submitBtn.querySelector('.submit-text').style.display = '';
    submitBtn.querySelector('.submit-loading').style.display = 'none';
    setTimeout(() => {
      closeModal();
    }, 4000);
  }

  function showError() {
    errorEl.style.display = 'block';
    submitBtn.disabled = false;
    submitBtn.querySelector('.submit-text').style.display = '';
    submitBtn.querySelector('.submit-loading').style.display = 'none';
  }

  function showSpamWarning() {
    form.style.display = 'none';
    const warning = document.createElement('div');
    warning.className = 'modal-spam';
    warning.innerHTML = 'Muitas tentativas detectadas.<br>Tente novamente em alguns minutos.';
    form.parentNode.insertBefore(warning, form.nextSibling);
    setTimeout(() => {
      warning.remove();
      form.style.display = '';
    }, 5000);
  }
})();

// ——————————————————————————————————————————————
// Accessibility Toggle — cursor, animations, contrast
// ——————————————————————————————————————————————
(function a11yToggle() {
  const btn = document.getElementById('a11yToggle');
  if (!btn) return;
  const KEY = 'muma-a11y';

  function applyA11y(enabled) {
    document.documentElement.classList.toggle('a11y-mode', enabled);
    btn.classList.toggle('active', enabled);
    localStorage.setItem(KEY, enabled ? '1' : '0');
  }

  // Restore from localStorage or system preference
  const stored = localStorage.getItem(KEY);
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (stored === '1' || (stored === null && prefersReduced)) {
    applyA11y(true);
  }

  btn.addEventListener('click', () => {
    const isActive = document.documentElement.classList.contains('a11y-mode');
    applyA11y(!isActive);
    // If disabling a11y mode, we need to reload to reinitialize cursor/cardume
    if (isActive) {
      window.location.reload();
    }
  });
})();

// ——————————————————————————————————————————————
// Founders Easter Egg overlay & Career Modal triggers
// ——————————————————————————————————————————————
(function foundersEasterEgg() {
  document.querySelectorAll('.founders .photo').forEach(photo => {
    const overlay = photo.querySelector('.easter-egg-overlay');
    photo.addEventListener('click', e => {
      // Se o clique foi dentro do overlay, o tratador do overlay cuida disso
      if (e.target.closest('.easter-egg-overlay')) return;
      if (overlay) overlay.classList.add('active');
    });

    if (overlay) {
      overlay.addEventListener('click', e => {
        // Se clicar em qualquer lugar do overlay exceto no botão de carreiras, fecha
        if (!e.target.closest('.easter-egg-btn')) {
          e.stopPropagation();
          overlay.classList.remove('active');
        }
      });
    }

    const eggBtn = photo.querySelector('.easter-egg-btn');
    if (eggBtn) {
      eggBtn.addEventListener('click', e => {
        e.stopPropagation();
        e.preventDefault();
        if (overlay) overlay.classList.remove('active');
        if (window.openCareerModal) window.openCareerModal();
      });
    }
  });

  // Fecha overlays ao clicar fora
  document.addEventListener('click', e => {
    if (!e.target.closest('.founders .photo')) {
      document.querySelectorAll('.easter-egg-overlay.active').forEach(overlay => {
        overlay.classList.remove('active');
      });
    }
  });
})();

// ——————————————————————————————————————————————
// Career Modal — Form + Dynamic Links + Drag-and-drop
// ——————————————————————————————————————————————
(function careerModal() {
  const modal = document.getElementById('careerModal');
  const form = document.getElementById('careerForm');
  const closeBtn = document.getElementById('careerModalClose');
  const successEl = document.getElementById('careerSuccess');
  const errorEl = document.getElementById('careerError');
  const submitBtn = document.getElementById('careerSubmit');
  const dropZone = document.getElementById('careerDropZone');
  const fileInput = document.getElementById('careerFile');
  const dropZoneText = dropZone ? dropZone.querySelector('.drop-zone-text') : null;
  const dropZoneFile = document.getElementById('careerDropZoneFile');
  const fileNameEl = document.getElementById('careerFileName');
  const fileRemoveBtn = document.getElementById('careerFileRemove');
  const linksContainer = document.getElementById('linksContainer');
  const btnAddLink = document.getElementById('btnAddLink');
  if (!modal || !form) return;

  // Setup triggers
  window.openCareerModal = function() {
    modal.classList.add('active');
    document.body.classList.add('modal-open');
    formOpenedAt = Date.now();
    form.style.display = '';
    const header = modal.querySelector('.modal-header');
    if (header) header.style.display = '';
    successEl.style.display = 'none';
    errorEl.style.display = 'none';
    form.reset();
    clearFile();
    
    // Reset links back to initial state (single link)
    if (linksContainer) {
      linksContainer.innerHTML = `
        <div class="dynamic-link-row">
          <select name="link_platform[]" class="link-platform">
            <option value="portfolio">Portfólio / Site</option>
            <option value="linkedin">LinkedIn</option>
            <option value="behance">Behance</option>
            <option value="instagram">Instagram</option>
            <option value="dribbble">Dribbble</option>
            <option value="vimeo">Vimeo</option>
            <option value="youtube">YouTube</option>
            <option value="outro">Outro</option>
          </select>
          <input type="url" name="link_url[]" placeholder="https://" class="link-url">
          <button type="button" class="btn-remove-link" style="display:none">✕</button>
        </div>
      `;
    }
  };

  document.querySelectorAll('.career-modal-trigger').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      openCareerModal();
    });
  });

  closeBtn && closeBtn.addEventListener('click', () => {
    modal.classList.remove('active');
    document.body.classList.remove('modal-open');
  });
  modal.addEventListener('click', e => {
    if (e.target === modal) {
      modal.classList.remove('active');
      document.body.classList.remove('modal-open');
    }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
      modal.classList.remove('active');
      document.body.classList.remove('modal-open');
    }
  });

  // Drag-and-drop / File handling
  function clearFile() {
    if (fileInput) fileInput.value = '';
    if (dropZoneText) dropZoneText.style.display = '';
    if (dropZoneFile) dropZoneFile.style.display = 'none';
  }

  function showFile(file) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      alert('Arquivo muito grande. Máximo: 10MB');
      clearFile();
      return;
    }
    if (fileNameEl) fileNameEl.textContent = file.name;
    if (dropZoneText) dropZoneText.style.display = 'none';
    if (dropZoneFile) dropZoneFile.style.display = 'flex';
  }

  if (fileInput) {
    fileInput.addEventListener('change', () => {
      if (fileInput.files.length) showFile(fileInput.files[0]);
    });
  }
  if (fileRemoveBtn) {
    fileRemoveBtn.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      clearFile();
    });
  }
  if (dropZone) {
    ['dragenter', 'dragover'].forEach(evt => {
      dropZone.addEventListener(evt, e => {
        e.preventDefault();
        dropZone.classList.add('dragover');
      });
    });
    ['dragleave', 'drop'].forEach(evt => {
      dropZone.addEventListener(evt, e => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
      });
    });
    dropZone.addEventListener('drop', e => {
      const dt = e.dataTransfer;
      if (dt.files.length && fileInput) {
        fileInput.files = dt.files;
        showFile(dt.files[0]);
      }
    });
  }

  // Dynamic link additions
  if (btnAddLink && linksContainer) {
    btnAddLink.addEventListener('click', () => {
      const rows = linksContainer.querySelectorAll('.dynamic-link-row');
      if (rows.length >= 8) {
        alert('Máximo de 8 links atingido.');
        return;
      }
      const newRow = document.createElement('div');
      newRow.className = 'dynamic-link-row';
      newRow.innerHTML = `
        <select name="link_platform[]" class="link-platform">
          <option value="portfolio">Portfólio / Site</option>
          <option value="linkedin">LinkedIn</option>
          <option value="behance">Behance</option>
          <option value="instagram">Instagram</option>
          <option value="dribbble">Dribbble</option>
          <option value="vimeo">Vimeo</option>
          <option value="youtube">YouTube</option>
          <option value="outro">Outro</option>
        </select>
        <input type="url" name="link_url[]" placeholder="https://" class="link-url">
        <button type="button" class="btn-remove-link">✕</button>
      `;
      
      const removeBtn = newRow.querySelector('.btn-remove-link');
      removeBtn.addEventListener('click', () => {
        newRow.remove();
      });
      
      linksContainer.appendChild(newRow);
    });
  }

  // EmailJS form submit details
  const EMAILJS_SERVICE  = 'YOUR_SERVICE_ID';
  const EMAILJS_TEMPLATE = 'YOUR_CAREER_TEMPLATE_ID';
  const EMAILJS_KEY      = 'YOUR_PUBLIC_KEY';
  const FALLBACK_EMAIL   = 'beai.bernardot@gmail.com';
  const isEmailJSConfigured = EMAILJS_SERVICE !== 'YOUR_SERVICE_ID';

  let formOpenedAt = 0;
  let submissionCount = 0;
  let lastSubmitTime = 0;
  const MAX_SUBMISSIONS = 3;
  const RATE_LIMIT_MS = 600000;
  const MIN_FILL_TIME_MS = 2000;

  form.addEventListener('submit', async e => {
    e.preventDefault();

    const hp = form.querySelector('.hp-field');
    if (hp && hp.value) {
      showSuccess();
      return;
    }

    const fillTime = Date.now() - formOpenedAt;
    if (fillTime < MIN_FILL_TIME_MS) {
      showSpamWarning();
      return;
    }

    const now = Date.now();
    if (now - lastSubmitTime < RATE_LIMIT_MS && submissionCount >= MAX_SUBMISSIONS) {
      showSpamWarning();
      return;
    }

    submitBtn.disabled = true;
    submitBtn.querySelector('.submit-text').style.display = 'none';
    submitBtn.querySelector('.submit-loading').style.display = '';

    const name = form.querySelector('#careerName').value;
    const email = form.querySelector('#careerEmail').value;
    const profession = form.querySelector('#careerProfession').value;

    const platforms = Array.from(form.querySelectorAll('.link-platform')).map(el => el.value);
    const urls = Array.from(form.querySelectorAll('.link-url')).map(el => el.value);
    let linksStr = '';
    for (let i = 0; i < platforms.length; i++) {
      if (urls[i]) {
        linksStr += `- ${platforms[i].toUpperCase()}: ${urls[i]}\n`;
      }
    }

    try {
      if (isEmailJSConfigured && window.emailjs) {
        await emailjs.send(EMAILJS_SERVICE, EMAILJS_TEMPLATE, {
          from_name: name,
          from_email: email,
          profession: profession,
          links: linksStr || 'Nenhum informado',
          origin: 'Candidatura Landing Page Muma',
        }, EMAILJS_KEY);
      } else {
        const subject = encodeURIComponent('[Candidatura Muma] Nova candidatura de ' + name);
        const body = encodeURIComponent(
          'Nome: ' + name + '\n' +
          'Email: ' + email + '\n' +
          'Profissão/Área: ' + profession + '\n' +
          '---\n' +
          'Links:\n' + (linksStr || 'Nenhum informado') + '\n' +
          '---\n' +
          'Origem: Candidatura Landing Page Muma\n' +
          'Enviado em: ' + new Date().toLocaleString('pt-BR')
        );
        window.location.href = 'mailto:' + FALLBACK_EMAIL + '?subject=' + subject + '&body=' + body;
        await new Promise(r => setTimeout(r, 500));
      }
      submissionCount++;
      lastSubmitTime = Date.now();
      showSuccess();
    } catch (err) {
      showError();
    }
  });

  function showSuccess() {
    form.style.display = 'none';
    errorEl.style.display = 'none';
    successEl.style.display = 'block';
    const header = modal.querySelector('.modal-header');
    if (header) header.style.display = 'none';
    submitBtn.disabled = false;
    submitBtn.querySelector('.submit-text').style.display = '';
    submitBtn.querySelector('.submit-loading').style.display = 'none';
    setTimeout(() => {
      modal.classList.remove('active');
      document.body.classList.remove('modal-open');
    }, 4000);
  }

  function showError() {
    errorEl.style.display = 'block';
    submitBtn.disabled = false;
    submitBtn.querySelector('.submit-text').style.display = '';
    submitBtn.querySelector('.submit-loading').style.display = 'none';
  }

  function showSpamWarning() {
    alert('Comportamento de spam detectado. Por favor, preencha o formulário com calma ou envie direto para oi@mumaestudio.com.br');
    submitBtn.disabled = false;
    submitBtn.querySelector('.submit-text').style.display = '';
    submitBtn.querySelector('.submit-loading').style.display = 'none';
  }
})();
