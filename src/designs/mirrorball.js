// "Disko": a real mirror ball (three.js) — about a thousand mirror tiles reflecting a studio, with glints
// flashing on single tiles — and the light it throws: soft spots sweeping across the whole page.
// The ball sits wherever the page puts its anchor element (the opener, then the closing section).
// Loaded on demand (import()) only by the Disko design.
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, InstancedMesh, PlaneGeometry, SphereGeometry, CylinderGeometry,
  MeshStandardMaterial, MeshBasicMaterial, BackSide, Object3D, Color, Vector3, PMREMGenerator, BufferGeometry, BufferAttribute,
  Points, ShaderMaterial, AdditiveBlending, ACESFilmicToneMapping, DirectionalLight, Line, LineBasicMaterial
} from "three";

const SPOT_VERT = `
attribute float aSize, aPhase; attribute vec3 aColor;
uniform float uTime, uPR, uGain, uSweep;
varying vec3 vColor; varying float vA;
void main(){
  // spots slide across the wall in front of the guest as the ball turns, wrapping round off-screen
  vec3 p = position;
  p.x = mod(p.x + uSweep * (.8 + aPhase * .5) + 14.0, 28.0) - 14.0;
  p.y += sin(uTime * .3 + aPhase * 9.0) * .4;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = aSize * uPR;
  // a spot is brightest while its tile faces the light, then slides off
  float face = .5 + .5 * sin(uTime * (1.1 + aPhase) + aPhase * 6.283);
  vA = uGain * (.25 + .75 * face * face);
  vColor = aColor;
}`;
const SPOT_FRAG = `
varying vec3 vColor; varying float vA;
void main(){ vec2 c = gl_PointCoord - .5; float d = length(c * vec2(1.0, 1.35));
  float a = smoothstep(.5, .05, d); if (a < .01) discard; gl_FragColor = vec4(vColor * a * vA, a * vA); }`;
const GLINT_FRAG = `
varying vec3 vColor; varying float vA;
void main(){ vec2 c = abs(gl_PointCoord - .5);
  float star = max(smoothstep(.06, .0, c.y) * smoothstep(.5, .0, c.x), smoothstep(.06, .0, c.x) * smoothstep(.5, .0, c.y));
  float core = smoothstep(.18, .0, length(gl_PointCoord - .5));
  float a = max(star, core); if (a < .01) discard; gl_FragColor = vec4(vec3(1.0) * a * vA, a * vA); }`;

export async function mountMirrorBall(canvas, { anchors, small = false } = {}) {
  let renderer;
  try { renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" }); }
  catch (e) { return null; }
  let pr = Math.min(devicePixelRatio || 1, small ? 1.6 : 1.75);
  renderer.setPixelRatio(pr);
  renderer.toneMapping = ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  const scene = new Scene();
  const pmrem = new PMREMGenerator(renderer);
  // what the tiles reflect: a dark club with a few hot spotlights, so each tile is either dark or blazing
  const club = new Scene();
  club.add(new Mesh(new SphereGeometry(20, 32, 16), new MeshBasicMaterial({ color: 0x4a4a54, side: BackSide })));
  // a soft bright ceiling and a dimmer floor give the silver body; the lamps give the flashes
  const ceil = new Mesh(new SphereGeometry(9, 16, 8), new MeshBasicMaterial({ color: new Color(.72, .72, .76) })); ceil.position.set(0, 16, 2); club.add(ceil);
  const floor = new Mesh(new SphereGeometry(9, 16, 8), new MeshBasicMaterial({ color: new Color(.16, .16, .18) })); floor.position.set(0, -16, 0); club.add(floor);
  [[6, 5, 8, 9], [-7, 4, 5, 7], [0, 9, -6, 8], [8, -2, -7, 5], [-6, -3, -8, 4], [2, 7, 9, 6], [-3, 10, 2, 9]].forEach(([x, y, z, k]) => {
    const lamp = new Mesh(new SphereGeometry(.9, 12, 8), new MeshBasicMaterial({ color: new Color(1, .97, .92).multiplyScalar(k) }));
    lamp.position.set(x, y, z); club.add(lamp);
  });
  const glow = new Mesh(new SphereGeometry(2.5, 12, 8), new MeshBasicMaterial({ color: new Color(.9, .35, .7).multiplyScalar(1.2) })); glow.position.set(-9, -6, 6); club.add(glow);
  const glow2 = new Mesh(new SphereGeometry(2.5, 12, 8), new MeshBasicMaterial({ color: new Color(.3, .6, 1).multiplyScalar(1.2) })); glow2.position.set(9, -5, 4); club.add(glow2);
  const envTex = pmrem.fromScene(club, 0).texture;
  scene.environment = envTex;
  const camera = new PerspectiveCamera(40, 1, .1, 200);
  camera.position.set(0, 0, 10);
  const key = new DirectionalLight(0xffffff, 2.2); key.position.set(-4, 5, 6); scene.add(key);

  // the ball: rows of square mirror tiles over a dark core
  const ball = new Group(); scene.add(ball);
  const spinner = new Group(); spinner.rotation.z = .2; ball.add(spinner);
  const tile = .118, rows = 26, dummy = new Object3D(), places = [];
  for (let r = 0; r < rows; r++) {
    const lat = -Math.PI / 2 + (r + .5) / rows * Math.PI, ring = Math.cos(lat), n = Math.max(4, Math.round(2 * Math.PI * ring / tile));
    for (let k = 0; k < n; k++) {
      const lon = (k + (r % 2) * .5) / n * Math.PI * 2;
      places.push(new Vector3(ring * Math.cos(lon), Math.sin(lat), ring * Math.sin(lon)));
    }
  }
  const tiles = new InstancedMesh(new PlaneGeometry(tile * .9, tile * .9), new MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: .05, envMapIntensity: 1.6 }), places.length);
  const shade = new Color();
  places.forEach((p, i) => {
    dummy.position.copy(p); dummy.lookAt(p.clone().multiplyScalar(2));
    dummy.rotateZ((Math.random() - .5) * .08); dummy.updateMatrix();
    tiles.setMatrixAt(i, dummy.matrix);
    tiles.setColorAt(i, shade.setScalar(.55 + Math.random() * .45)); // slightly uneven glass, like a real ball
  });
  spinner.add(tiles);
  spinner.add(new Mesh(new SphereGeometry(.985, 48, 32), new MeshStandardMaterial({ color: 0x18181a, metalness: .4, roughness: .6 })));
  const cap = new Mesh(new CylinderGeometry(.09, .13, .14, 20), new MeshStandardMaterial({ color: 0xbfc3c8, metalness: 1, roughness: .25 }));
  cap.position.y = 1.02; ball.add(cap);
  const cord = new Line(new BufferGeometry().setFromPoints([new Vector3(0, 1.08, 0), new Vector3(0, 60, 0)]), new LineBasicMaterial({ color: 0x8a8a8f }));
  ball.add(cord);

  // glints: a few tiles at a time flash like a star
  const GN = 7, gPos = new Float32Array(GN * 3), gSize = new Float32Array(GN), gPh = new Float32Array(GN), gCol = new Float32Array(GN * 3).fill(1);
  const gGeo = new BufferGeometry();
  gGeo.setAttribute("position", new BufferAttribute(gPos, 3)); gGeo.setAttribute("aSize", new BufferAttribute(gSize, 1));
  gGeo.setAttribute("aPhase", new BufferAttribute(gPh, 1)); gGeo.setAttribute("aColor", new BufferAttribute(gCol, 3));
  const gU = { uTime: { value: 0 }, uPR: { value: pr }, uGain: { value: 1 }, uSweep: { value: 0 } };
  const glints = new Points(gGeo, new ShaderMaterial({ uniforms: gU, vertexShader: SPOT_VERT, fragmentShader: GLINT_FRAG, transparent: true, depthWrite: false, blending: AdditiveBlending }));
  glints.frustumCulled = false; ball.add(glints);
  const gLife = new Float32Array(GN).map(() => Math.random());

  // the light the ball throws around the room: spots on a big sphere around it, turning with the ball
  const SN = small ? 70 : 110, sPos = new Float32Array(SN * 3), sSize = new Float32Array(SN), sPh = new Float32Array(SN), sCol = new Float32Array(SN * 3);
  const tints = [new Color("#ffffff"), new Color("#ffffff"), new Color("#fff1d8"), new Color("#ffd6f1"), new Color("#d4ecff")];
  for (let i = 0; i < SN; i++) {
    const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    sPos.set([(Math.random() * 2 - 1) * 14, u * 8, -6 - Math.random() * 6], i * 3);
    sSize[i] = (small ? 20 : 26) + Math.random() * 38; sPh[i] = Math.random();
    const c = tints[(Math.random() * tints.length) | 0]; sCol.set([c.r, c.g, c.b], i * 3);
  }
  const sGeo = new BufferGeometry();
  sGeo.setAttribute("position", new BufferAttribute(sPos, 3)); sGeo.setAttribute("aSize", new BufferAttribute(sSize, 1));
  sGeo.setAttribute("aPhase", new BufferAttribute(sPh, 1)); sGeo.setAttribute("aColor", new BufferAttribute(sCol, 3));
  const sU = { uTime: { value: 0 }, uPR: { value: pr }, uGain: { value: .8 }, uSweep: { value: 0 } };
  const spots = new Points(sGeo, new ShaderMaterial({ uniforms: sU, vertexShader: SPOT_VERT, fragmentShader: SPOT_FRAG, transparent: true, depthWrite: false, blending: AdditiveBlending }));
  spots.frustumCulled = false;
  const room = new Group(); room.add(spots); scene.add(room);

  let W = 1, H = 1, halfH = 1, halfW = 1;
  function resize() {
    W = canvas.clientWidth || innerWidth; H = canvas.clientHeight || innerHeight;
    renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix();
    halfH = Math.tan(20 * Math.PI / 180) * 10; halfW = halfH * camera.aspect;
  }
  resize();
  const ro = new ResizeObserver(resize); ro.observe(canvas);

  let last = performance.now(), slow = 0, spin = 0, boost = 0, show = 0, gain = .8;
  const target = new Vector3(), want = { x: 0, y: 0, r: 1, on: false };
  function readAnchor() {
    want.on = false;
    for (const el of anchors()) {
      if (!el || !el.isConnected) continue;
      const r = el.getBoundingClientRect();
      if (!r.width || r.bottom < -r.height || r.top > H + r.height) continue;
      want.x = ((r.left + r.width / 2) / W * 2 - 1) * halfW;
      want.y = -((r.top + r.height / 2) / H * 2 - 1) * halfH;
      want.r = r.width / H * halfH; // the element's width becomes the ball's diameter
      want.on = true; return;
    }
  }
  const onVis = () => { if (document.hidden) renderer.setAnimationLoop(null); else { last = performance.now(); renderer.setAnimationLoop(frame); } };
  document.addEventListener("visibilitychange", onVis);
  canvas.addEventListener("webglcontextlost", e => { e.preventDefault(); renderer.setAnimationLoop(null); canvas.dispatchEvent(new CustomEvent("ball-lost", { bubbles: true })); });

  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    slow = dt > .028 ? slow + dt : Math.max(0, slow - dt * .5);
    if (slow > 1.5 && pr > 1) { pr = 1; renderer.setPixelRatio(pr); gU.uPR.value = sU.uPR.value = pr; resize(); slow = 0; }
    const t = now / 1000;
    readAnchor();
    show += ((want.on ? 1 : 0) - show) * Math.min(1, dt * 5);
    if (want.on) target.set(want.x, want.y, 0);
    ball.position.lerp(target, show < .05 ? 1 : Math.min(1, dt * 14));
    ball.scale.setScalar(Math.max(.0001, want.r * show));
    ball.visible = show > .01;
    boost = Math.max(0, boost - dt * .55);
    spin += dt * (.32 + boost * 3.2);
    spinner.rotation.y = spin;
    ball.rotation.z = Math.sin(t * .7) * .04;
    // glints wander over the tiles facing the viewer
    for (let i = 0; i < GN; i++) {
      gLife[i] += dt * .9;
      if (gLife[i] > 1) { gLife[i] = 0; const a = (Math.random() - .5) * 1.6, b = (Math.random() - .5) * 1.6; const z = Math.sqrt(Math.max(0, 1 - a * a * .4 - b * b * .4)); gPos.set([a * .62, b * .62, z * 1.02], i * 3); gPh[i] = Math.random(); }
      gSize[i] = Math.sin(gLife[i] * Math.PI) * (small ? 26 : 34) * Math.min(1.6, Math.max(.5, want.r));
    }
    gGeo.attributes.position.needsUpdate = true; gGeo.attributes.aSize.needsUpdate = true;
    gU.uTime.value = t; gU.uGain.value = show;
    // the spots turn with the ball, around it
    room.rotation.z = Math.sin(t * .2) * .06;
    sU.uSweep.value = spin * 2.2;
    sU.uTime.value = t; sU.uGain.value = gain * (1 + boost * 2.2);
    renderer.render(scene, camera);
  }
  renderer.setAnimationLoop(frame);

  return {
    // the guest tapped the ball: it whirls and the room fills with light, then calms down
    burst() { boost = 1; },
    // softer light on the page than on the opening screen
    setGain(g) { gain = g; },
    destroy() {
      renderer.setAnimationLoop(null); ro.disconnect(); document.removeEventListener("visibilitychange", onVis);
      scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach(m => m.dispose()); });
      envTex.dispose(); pmrem.dispose(); renderer.dispose();
    }
  };
}
