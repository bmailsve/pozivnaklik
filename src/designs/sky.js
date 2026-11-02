// "Zvezdana noć": a live night sky (three.js) whose stars gather into the couple's initials.
// Loaded on demand (import()) only by the Starry Night design, so other pages never download three.js.
import {
  WebGLRenderer, Scene, PerspectiveCamera, BufferGeometry, BufferAttribute, Points, ShaderMaterial,
  AdditiveBlending, LineSegments, LineBasicMaterial, Mesh, PlaneGeometry, Group, Color
} from "three";

const easeInOut = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// Points that draw the initials: the text is drawn on a hidden canvas and its filled pixels sampled.
async function textPoints(text, font, want) {
  try { await document.fonts.load(`120px ${font}`, text); } catch (e) { /* fallback font */ }
  const W = 900, H = 360, c = document.createElement("canvas");
  c.width = W; c.height = H;
  const x = c.getContext("2d", { willReadFrequently: true });
  let size = 230;
  x.font = `${size}px ${font}`;
  while (x.measureText(text).width > W * .92 && size > 60) { size -= 10; x.font = `${size}px ${font}`; }
  x.fillStyle = "#fff"; x.textAlign = "center"; x.textBaseline = "middle";
  x.fillText(text, W / 2, H / 2 + size * .08);
  const img = x.getImageData(0, 0, W, H).data, pts = [];
  for (let y = 0; y < H; y += 3) for (let i = 0; i < W; i += 3) if (img[(y * W + i) * 4 + 3] > 140) pts.push([i / W - .5, .5 - y / H]);
  for (let i = pts.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [pts[i], pts[j]] = [pts[j], pts[i]]; }
  return { pts: pts.slice(0, want), aspect: W / H };
}

const VERT = /* glsl */`
uniform float uTime, uMorph, uPR, uWarp, uFade, uScale, uTextVis;
attribute vec3 aTarget; attribute float aSize, aPhase, aDelay, aIsText; attribute vec3 aColor;
varying vec3 vColor; varying float vAlpha;
void main(){
  float k = clamp((uMorph - aDelay) / (1.0 - 0.35), 0.0, 1.0);
  k = k < .5 ? 4.0*k*k*k : 1.0 - pow(-2.0*k + 2.0, 3.0) / 2.0;
  vec3 drift = vec3(sin(uTime*.11 + aPhase)*.06, cos(uTime*.09 + aPhase*1.7)*.06, 0.0);
  vec3 p = mix(position, aTarget, k * aIsText) + drift * (1.0 - k * aIsText * .85);
  // the warp pushes the field towards the viewer before the stars gather
  p.z += uWarp * (2.5 + aPhase) * (1.0 - k * aIsText);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float tw = .62 + .38 * sin(uTime * (1.2 + aPhase * .9) + aPhase * 6.283);
  float textGlow = mix(1.0, 1.35, k * aIsText);
  gl_PointSize = aSize * uPR * uScale * textGlow * (1.0 + uWarp * 1.6) * (26.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
  vColor = aColor;
  vAlpha = mix(tw, .9 + .1 * tw, k * aIsText) * uFade * mix(1.0, .55, (1.0 - aIsText) * uMorph * .6) * mix(1.0, uTextVis, aIsText * k);
}`;
const FRAG = /* glsl */`
varying vec3 vColor; varying float vAlpha;
void main(){
  float d = length(gl_PointCoord - .5);
  float a = smoothstep(.5, .0, d);
  a = a * a * .75 + smoothstep(.12, .0, d) * .9;
  if (a < .01) discard;
  gl_FragColor = vec4(vColor * a, a * vAlpha);
}`;

export async function mountSky(canvas, { initials = "A & B", font = "'Pinyon Script', cursive", small = false } = {}) {
  let renderer;
  try { renderer = new WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: "high-performance" }); }
  catch (e) { return null; }
  const maxPR = small ? 1.5 : 1.75;
  let pr = Math.min(devicePixelRatio || 1, maxPR);
  renderer.setPixelRatio(pr);
  const scene = new Scene();
  const camera = new PerspectiveCamera(50, 1, .1, 100);
  camera.position.set(0, 0, 10);
  const sky = new Group(); scene.add(sky);

  const total = small ? 2600 : 4200, textN = small ? 1100 : 1500;
  const { pts, aspect } = await textPoints(initials, font, textN);
  const pos = new Float32Array(total * 3), tgt = new Float32Array(total * 3), col = new Float32Array(total * 3);
  const size = new Float32Array(total), phase = new Float32Array(total), delay = new Float32Array(total), isText = new Float32Array(total);
  const tints = [new Color("#ffffff"), new Color("#fff1d6"), new Color("#ffe2a8"), new Color("#cfdcff"), new Color("#e9d8ff")];
  const gold = new Color("#ffe6b0");
  for (let i = 0; i < total; i++) {
    // a deep shell of stars around and behind the viewer's line of sight
    const r = 9 + Math.random() * 26, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
    pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th) * .75;
    pos[i * 3 + 2] = -Math.abs(r * Math.cos(ph)) - 2;
    // the milky way: a soft band of extra stars across the sky
    if (i % 5 === 0) { const t = Math.random() * 2 - 1; pos[i * 3] = t * 22; pos[i * 3 + 1] = t * 7 + (Math.random() - .5) * 3.2; pos[i * 3 + 2] = -14 - Math.random() * 10; }
    const c = tints[(Math.random() * tints.length) | 0];
    col.set([c.r, c.g, c.b], i * 3);
    size[i] = .6 + Math.pow(Math.random(), 3) * 2.6;
    phase[i] = Math.random();
    delay[i] = Math.random() * .35;
    if (i < pts.length) {
      isText[i] = 1;
      tgt[i * 3] = pts[i][0] * 7.2; tgt[i * 3 + 1] = pts[i][1] * 7.2 / aspect; tgt[i * 3 + 2] = (Math.random() - .5) * .25;
      col.set([gold.r, gold.g, gold.b], i * 3);
      size[i] = .85 + Math.random() * 1.2;
    } else tgt.set(pos.subarray(i * 3, i * 3 + 3), i * 3);
  }
  const geo = new BufferGeometry();
  geo.setAttribute("position", new BufferAttribute(pos, 3));
  geo.setAttribute("aTarget", new BufferAttribute(tgt, 3));
  geo.setAttribute("aColor", new BufferAttribute(col, 3));
  geo.setAttribute("aSize", new BufferAttribute(size, 1));
  geo.setAttribute("aPhase", new BufferAttribute(phase, 1));
  geo.setAttribute("aDelay", new BufferAttribute(delay, 1));
  geo.setAttribute("aIsText", new BufferAttribute(isText, 1));
  const U = { uTime: { value: 0 }, uMorph: { value: 0 }, uPR: { value: pr }, uWarp: { value: 0 }, uFade: { value: 0 }, uScale: { value: 1 }, uTextVis: { value: 1 } };
  const mat = new ShaderMaterial({ uniforms: U, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: AdditiveBlending });
  const stars = new Points(geo, mat);
  stars.frustumCulled = false;
  sky.add(stars);

  // constellation lines between neighbouring stars of the initials, drawn once they have gathered
  const anchors = [];
  for (let i = 0; i < pts.length; i += 7) anchors.push([tgt[i * 3], tgt[i * 3 + 1], tgt[i * 3 + 2]]);
  const seg = [];
  for (let a = 0; a < anchors.length; a++) {
    let best = -1, bd = .42;
    for (let b = a + 1; b < anchors.length; b++) { const d = Math.hypot(anchors[a][0] - anchors[b][0], anchors[a][1] - anchors[b][1]); if (d < bd) { bd = d; best = b; } }
    if (best >= 0) seg.push(...anchors[a], ...anchors[best]);
  }
  const lineMat = new LineBasicMaterial({ color: 0xffe6b0, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false });
  const lineGeo = new BufferGeometry(); lineGeo.setAttribute("position", new BufferAttribute(new Float32Array(seg), 3));
  const lines = new LineSegments(lineGeo, lineMat);
  sky.add(lines);

  // an occasional shooting star
  const shootMat = new ShaderMaterial({
    uniforms: { uA: { value: 0 } }, transparent: true, depthWrite: false, blending: AdditiveBlending,
    vertexShader: "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: "uniform float uA;varying vec2 vUv;void main(){float a=pow(vUv.x,3.)*smoothstep(.5,.0,abs(vUv.y-.5));gl_FragColor=vec4(vec3(1.,.95,.85)*a*uA,a*uA);}"
  });
  const shoot = new Mesh(new PlaneGeometry(3.2, .035), shootMat);
  shoot.visible = false; scene.add(shoot);
  let shootT = -1, nextShoot = 4 + Math.random() * 4, shootFrom = [0, 0], shootDir = [1, 0];

  // the initials sit in the upper part of the screen; on narrow screens they are scaled to fit
  let textScale = 1;
  function resize() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    const visW = 2 * Math.tan(25 * Math.PI / 180) * 10 * camera.aspect;
    textScale = Math.min(1, (visW * .86) / 7.2);
    U.uScale.value = Math.min(1.25, Math.max(.75, h / 800));
  }
  resize();
  const ro = new ResizeObserver(resize); ro.observe(canvas);

  let morph = 0, morphFrom = 0, morphTo = 0, morphT0 = 0, morphDur = 1;
  let warp = 0, scroll = 0, px = 0, py = 0, tx = 0, ty = 0, fade = 0, running = true, last = performance.now(), slow = 0;
  const onPointer = e => { tx = (e.clientX / innerWidth - .5) * 2; ty = (e.clientY / innerHeight - .5) * 2; };
  addEventListener("pointermove", onPointer, { passive: true });
  const onVis = () => { running = !document.hidden; if (running) { last = performance.now(); renderer.setAnimationLoop(frame); } else renderer.setAnimationLoop(null); };
  document.addEventListener("visibilitychange", onVis);
  canvas.addEventListener("webglcontextlost", e => { e.preventDefault(); renderer.setAnimationLoop(null); canvas.dispatchEvent(new CustomEvent("sky-lost", { bubbles: true })); });

  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    // keep it smooth on slower phones: drop resolution if frames take too long
    slow = dt > .028 ? slow + dt : Math.max(0, slow - dt * .5);
    if (slow > 1.5 && pr > 1) { pr = 1; renderer.setPixelRatio(pr); U.uPR.value = pr; resize(); slow = 0; }
    const t = now / 1000;
    U.uTime.value = t;
    fade = Math.min(1, fade + dt * .7); U.uFade.value = easeInOut(fade);
    if (morphT0) { const k = Math.min(1, (now - morphT0) / morphDur); morph = morphFrom + (morphTo - morphFrom) * k; if (k >= 1) morphT0 = 0; }
    U.uMorph.value = morph;
    U.uWarp.value = warp;
    lineMat.opacity = Math.max(0, (morph - .85) / .15) * .22 * (1 - scroll);
    px += (tx - px) * .03; py += (ty - py) * .03;
    sky.rotation.y = px * .06 + t * .004;
    sky.rotation.x = py * .04;
    // as the guest scrolls, the initials rise and fade and the sky drifts, becoming a calm backdrop
    U.uTextVis.value = Math.max(0, 1 - scroll * 1.6);
    sky.position.y = 2.6 * textScale + scroll * 2.4;
    sky.scale.setScalar(textScale);
    stars.position.z = scroll * 1.5;
    if (shootT < 0 && t > nextShoot) { shootT = 0; shootFrom = [(Math.random() - .2) * 8, 3 + Math.random() * 3]; const a = -.35 - Math.random() * .4; shootDir = [Math.cos(a + Math.PI), Math.sin(a + Math.PI)]; shoot.rotation.z = Math.atan2(shootDir[1], shootDir[0]) + Math.PI; shoot.visible = true; }
    if (shootT >= 0) {
      shootT += dt; const k = shootT / 1.1;
      shoot.position.set(shootFrom[0] + shootDir[0] * k * 9, shootFrom[1] + shootDir[1] * k * 9, -4);
      shootMat.uniforms.uA.value = Math.sin(Math.min(1, k) * Math.PI) * .9;
      if (k >= 1) { shootT = -1; shoot.visible = false; nextShoot = t + 6 + Math.random() * 8; }
    }
    renderer.render(scene, camera);
  }
  renderer.setAnimationLoop(frame);

  return {
    // the guest tapped: the field rushes forward, then the stars gather into the initials
    form(reduced) {
      return new Promise(res => {
        if (reduced) { morph = 1; morphT0 = 0; return res(); }
        const t0 = performance.now(), w = () => { const k = Math.min(1, (performance.now() - t0) / 1600); warp = Math.sin(k * Math.PI) * .9; if (k < 1) requestAnimationFrame(w); else warp = 0; };
        requestAnimationFrame(w);
        setTimeout(() => { morphFrom = morph; morphTo = 1; morphDur = 2800; morphT0 = performance.now(); setTimeout(res, 2600); }, 500);
      });
    },
    formed() { morph = 1; morphT0 = 0; },
    setScroll(p) { scroll = Math.max(0, Math.min(1, p)); },
    destroy() {
      renderer.setAnimationLoop(null); ro.disconnect();
      removeEventListener("pointermove", onPointer); document.removeEventListener("visibilitychange", onVis);
      geo.dispose(); mat.dispose(); lineGeo.dispose(); lineMat.dispose(); shoot.geometry.dispose(); shootMat.dispose(); renderer.dispose();
    }
  };
}
