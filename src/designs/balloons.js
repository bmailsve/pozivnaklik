// "Baloni": glossy 3D balloons the guest pops to open a children's birthday invitation (three.js).
// Loaded on demand (import()) only by this design.
import {
  WebGLRenderer, Scene, PerspectiveCamera, SphereGeometry, ConeGeometry, MeshPhysicalMaterial, Mesh, Group,
  HemisphereLight, DirectionalLight, BufferGeometry, BufferAttribute, Line, LineBasicMaterial, Points, ShaderMaterial,
  Raycaster, Vector2, Color, CatmullRomCurve3, Vector3, NormalBlending
} from "three";

export const BALLOON_COLORS = ["#F59AB0", "#FFCB6B", "#8FD3C1", "#9EC2F7", "#C8AEF5", "#FFAE84"];

// one balloon shape for all: a sphere stretched upward and narrowed at the bottom, with a knot
function balloonGeometry() {
  const g = new SphereGeometry(1, 40, 28), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), k = y < 0 ? 1 + y * .2 : 1;
    p.setXYZ(i, p.getX(i) * k, y * 1.17, p.getZ(i) * k);
  }
  g.computeVertexNormals();
  return g;
}

const CONF_VERT = `
attribute vec3 aColor; attribute float aLife, aSize;
varying vec3 vColor; varying float vLife;
uniform float uPR;
void main(){ vColor = aColor; vLife = aLife; vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = aSize * uPR * (14.0 / -mv.z) * step(0.001, aLife); gl_Position = projectionMatrix * mv; }`;
const CONF_FRAG = `
varying vec3 vColor; varying float vLife;
void main(){ vec2 c = gl_PointCoord - .5; if (abs(c.x) > .5 || abs(c.y) > .28) discard;
  gl_FragColor = vec4(vColor, smoothstep(0.0, .25, vLife)); }`;

export async function mountBalloons(canvas, { count = 5, small = false, onPop, onDone } = {}) {
  let renderer;
  try { renderer = new WebGLRenderer({ canvas, antialias: !small, alpha: true, powerPreference: "high-performance" }); }
  catch (e) { return null; }
  let pr = Math.min(devicePixelRatio || 1, small ? 1.6 : 1.75);
  renderer.setPixelRatio(pr);
  const scene = new Scene();
  const camera = new PerspectiveCamera(45, 1, .1, 100);
  camera.position.set(0, 0, 12);
  scene.add(new HemisphereLight(0xffffff, 0xf3d3dc, 1.25));
  const key = new DirectionalLight(0xffffff, 2.1); key.position.set(4, 6, 8); scene.add(key);
  const rim = new DirectionalLight(0xffeef4, .8); rim.position.set(-6, 2, -5); scene.add(rim);

  const geo = balloonGeometry(), knotGeo = new ConeGeometry(.09, .16, 12);
  const mats = BALLOON_COLORS.map(c => new MeshPhysicalMaterial({ color: new Color(c), roughness: .3, metalness: 0, clearcoat: 1, clearcoatRoughness: .12, sheen: .4, sheenColor: new Color("#ffffff") }));
  const stringMat = new LineBasicMaterial({ color: 0xbfaeb5, transparent: true, opacity: .8 });
  function balloon(mat, scale) {
    const g = new Group(), b = new Mesh(geo, mat), knot = new Mesh(knotGeo, mat);
    knot.position.y = -1.2; knot.rotation.x = Math.PI;
    const curve = new CatmullRomCurve3([new Vector3(0, -1.25, 0), new Vector3(.12, -2, .05), new Vector3(-.1, -2.8, 0), new Vector3(.06, -3.6, 0)]);
    const s = new Line(new BufferGeometry().setFromPoints(curve.getPoints(16)), stringMat);
    g.add(b, knot, s); g.scale.setScalar(scale); g.userData.body = b;
    return g;
  }

  // the balloons to pop, in front
  const front = [];
  for (let i = 0; i < count; i++) {
    const g = balloon(mats[i % mats.length], 1);
    g.userData = { ...g.userData, i, phase: Math.random() * 6.28, popped: false, popT: 0 };
    front.push(g); scene.add(g);
  }
  // small balloons drifting up far behind, for the rest of the page
  const back = [];
  for (let i = 0; i < 10; i++) {
    const g = balloon(mats[(i + 2) % mats.length], .45 + Math.random() * .3);
    g.position.set((Math.random() - .5) * 18, -12 + Math.random() * 24, -8 - Math.random() * 10);
    g.userData = { ...g.userData, speed: .35 + Math.random() * .4, phase: Math.random() * 6.28 };
    back.push(g); scene.add(g);
  }

  // confetti: one reusable particle buffer, refilled at every pop
  const CN = 720, cPos = new Float32Array(CN * 3), cVel = new Float32Array(CN * 3), cCol = new Float32Array(CN * 3), cLife = new Float32Array(CN), cSize = new Float32Array(CN);
  const cGeo = new BufferGeometry();
  cGeo.setAttribute("position", new BufferAttribute(cPos, 3));
  cGeo.setAttribute("aColor", new BufferAttribute(cCol, 3));
  cGeo.setAttribute("aLife", new BufferAttribute(cLife, 1));
  cGeo.setAttribute("aSize", new BufferAttribute(cSize, 1));
  const cMat = new ShaderMaterial({ uniforms: { uPR: { value: pr } }, vertexShader: CONF_VERT, fragmentShader: CONF_FRAG, transparent: true, depthWrite: false, blending: NormalBlending });
  const conf = new Points(cGeo, cMat); conf.frustumCulled = false; scene.add(conf);
  let cNext = 0;
  function burst(at, color) {
    const base = new Color(color), white = new Color("#ffffff"), gold = new Color("#FFD36E");
    for (let k = 0; k < 110; k++) {
      const i = cNext; cNext = (cNext + 1) % CN;
      const a = Math.random() * Math.PI * 2, e = Math.random() * Math.PI - Math.PI / 2, sp = 3 + Math.random() * 5;
      cPos.set([at.x, at.y, at.z], i * 3);
      cVel.set([Math.cos(a) * Math.cos(e) * sp, Math.sin(e) * sp + 2.5, Math.sin(a) * Math.cos(e) * sp * .5], i * 3);
      const c = k % 3 === 0 ? white : k % 3 === 1 ? gold : base;
      cCol.set([c.r, c.g, c.b], i * 3);
      cLife[i] = 1; cSize[i] = 2.2 + Math.random() * 2.4;
    }
  }

  let W = 1, H = 1, spread = 1;
  function layout() {
    // place the front balloons in a loose cluster that fits the screen width
    // between the title (top quarter) and the buttons (bottom quarter): one row on wide screens, two on phones
    const visH = 2 * Math.tan(22.5 * Math.PI / 180) * 12, visW = visH * camera.aspect;
    const cols = Math.min(count, camera.aspect < .8 ? 3 : 5), rows = Math.ceil(count / cols);
    spread = Math.min(1, visW / (cols * 2.45 + .5), (visH * .5) / (rows * 2.7));
    front.forEach((g, i) => {
      const row = Math.floor(i / cols), col = i % cols, inRow = Math.min(cols, count - row * cols);
      const x = (col - (inRow - 1) / 2) * 2.45 * spread;
      const y = -.15 + ((rows - 1) / 2 - row) * 2.7 * spread + (col % 2 ? -.25 : .25) * spread;
      g.userData.home = new Vector3(x, y, (col % 2 ? -.5 : .3));
      g.scale.setScalar(spread * (1 + (i % 3) * .07));
    });
  }
  function resize() {
    W = canvas.clientWidth || innerWidth; H = canvas.clientHeight || innerHeight;
    renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix(); layout();
  }
  resize();
  front.forEach(g => g.position.copy(g.userData.home).add(new Vector3(0, -9, 0))); // they float in from below
  const ro = new ResizeObserver(resize); ro.observe(canvas);

  const ray = new Raycaster(), ptr = new Vector2();
  let left = count, done = false, scroll = 0, released = false;
  function pop(g) {
    const u = g.userData; if (u.popped) return;
    u.popped = true; u.popT = 0; left--;
    const at = new Vector3(); g.getWorldPosition(at);
    burst(at, BALLOON_COLORS[u.i % BALLOON_COLORS.length]);
    onPop && onPop(u.i, left);
    if (!left && !done) { done = true; setTimeout(() => onDone && onDone(), 650); }
  }
  function onDown(e) {
    if (done) return;
    const r = canvas.getBoundingClientRect();
    ptr.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    const hit = ray.intersectObjects(front.filter(g => !g.userData.popped).map(g => g.userData.body), false)[0];
    if (hit) { pop(hit.object.parent); e.preventDefault(); }
  }
  canvas.addEventListener("pointerdown", onDown);
  const onVis = () => { if (document.hidden) renderer.setAnimationLoop(null); else { last = performance.now(); renderer.setAnimationLoop(frame); } };
  document.addEventListener("visibilitychange", onVis);
  canvas.addEventListener("webglcontextlost", e => { e.preventDefault(); renderer.setAnimationLoop(null); canvas.dispatchEvent(new CustomEvent("balloons-lost", { bubbles: true })); });

  let last = performance.now(), slow = 0, t0 = last;
  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    slow = dt > .028 ? slow + dt : Math.max(0, slow - dt * .5);
    if (slow > 1.5 && pr > 1) { pr = 1; renderer.setPixelRatio(pr); cMat.uniforms.uPR.value = pr; resize(); slow = 0; }
    const t = (now - t0) / 1000;
    front.forEach(g => {
      const u = g.userData;
      if (u.popped) {
        u.popT += dt;
        // a quick swell, then gone
        const k = u.popT / .09;
        if (k < 1) g.userData.body.scale.setScalar(1 + k * .3); else g.visible = false;
        return;
      }
      if (released) { g.position.y += dt * (3 + u.i * .4); g.rotation.z = Math.sin(t * 2 + u.phase) * .08; return; }
      const target = u.home.clone().add(new Vector3(Math.sin(t * .7 + u.phase) * .18, Math.sin(t * 1.1 + u.phase) * .25, 0));
      g.position.lerp(target, Math.min(1, dt * 1.6));
      g.rotation.z = Math.sin(t * .9 + u.phase) * .07;
      g.rotation.y = Math.sin(t * .5 + u.phase) * .25;
    });
    back.forEach(g => {
      const u = g.userData;
      g.position.y += dt * u.speed;
      g.position.x += Math.sin(t * .4 + u.phase) * dt * .15;
      g.rotation.z = Math.sin(t * .8 + u.phase) * .08;
      if (g.position.y > 13) { g.position.y = -13; g.position.x = (Math.random() - .5) * 18; }
    });
    for (let i = 0; i < CN; i++) {
      if (cLife[i] <= 0) continue;
      cVel[i * 3 + 1] -= 9 * dt; cVel[i * 3] *= .985; cVel[i * 3 + 2] *= .985;
      cPos[i * 3] += cVel[i * 3] * dt; cPos[i * 3 + 1] += cVel[i * 3 + 1] * dt; cPos[i * 3 + 2] += cVel[i * 3 + 2] * dt;
      cLife[i] = Math.max(0, cLife[i] - dt * .55);
    }
    cGeo.attributes.position.needsUpdate = true; cGeo.attributes.aLife.needsUpdate = true;
    cGeo.attributes.aColor.needsUpdate = true; cGeo.attributes.aSize.needsUpdate = true;
    camera.position.y = -scroll * 3;
    renderer.render(scene, camera);
  }
  renderer.setAnimationLoop(frame);

  return {
    // keyboard and "skip": pop the next balloon
    popNext() { const g = front.find(x => !x.userData.popped); if (g) pop(g); },
    // the invitation is open: any balloons left float away
    release() { released = true; done = true; },
    setScroll(p) { scroll = Math.max(0, Math.min(1, p)); },
    destroy() {
      renderer.setAnimationLoop(null); ro.disconnect();
      canvas.removeEventListener("pointerdown", onDown); document.removeEventListener("visibilitychange", onVis);
      geo.dispose(); knotGeo.dispose(); mats.forEach(m => m.dispose()); stringMat.dispose(); cGeo.dispose(); cMat.dispose();
      scene.traverse(o => { if (o.isLine) o.geometry.dispose(); });
      renderer.dispose();
    }
  };
}
