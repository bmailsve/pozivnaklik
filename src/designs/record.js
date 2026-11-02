// "Zlatna ploča": a turntable with a gold record whose label carries the couple's names and years (three.js).
// The guest drops the needle, the record spins up and the camera glides over the label.
// Loaded on demand (import()) only by this design.
import {
  WebGLRenderer, Scene, PerspectiveCamera, Group, Mesh, BoxGeometry, CylinderGeometry, CircleGeometry, TorusGeometry,
  MeshStandardMaterial, MeshPhysicalMaterial, CanvasTexture, DirectionalLight, SpotLight, HemisphereLight, PMREMGenerator,
  SRGBColorSpace, Vector3, ACESFilmicToneMapping
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

const ease = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

// the grooves: fine concentric rings, a little brighter at each track gap
function grooveTexture() {
  const S = 1024, c = document.createElement("canvas"); c.width = c.height = S;
  const x = c.getContext("2d"), m = S / 2;
  x.fillStyle = "#808080"; x.fillRect(0, 0, S, S);
  for (let r = m * .36; r < m * .985; r += 1.6) {
    const gap = [.52, .64, .76, .88].some(g => Math.abs(r / m - g) < .008);
    x.strokeStyle = gap ? "rgba(255,255,255,.55)" : `rgba(${Math.random() < .5 ? "0,0,0" : "255,255,255"},${.08 + Math.random() * .12})`;
    x.lineWidth = gap ? 3 : 1; x.beginPath(); x.arc(m, m, r, 0, Math.PI * 2); x.stroke();
  }
  const t = new CanvasTexture(c); t.anisotropy = 8; return t;
}

// the label in the middle of the record, drawn in the page's own fonts
async function labelTexture({ n1, n2, years, sub }) {
  const fonts = ["400 90px 'Pinyon Script'", "600 200px 'Bodoni Moda'", "500 40px 'Jost'"];
  try { await Promise.all(fonts.map(f => document.fonts.load(f, n1 + n2 + years + sub))); } catch (e) { /* fallback fonts */ }
  const S = 1024, c = document.createElement("canvas"); c.width = c.height = S;
  const x = c.getContext("2d"), m = S / 2;
  const g = x.createRadialGradient(m, m * .8, 40, m, m, m);
  g.addColorStop(0, "#8E2335"); g.addColorStop(1, "#4E0F1B");
  x.fillStyle = g; x.beginPath(); x.arc(m, m, m, 0, Math.PI * 2); x.fill();
  x.strokeStyle = "rgba(232,199,126,.85)"; x.lineWidth = 6; x.beginPath(); x.arc(m, m, m - 30, 0, Math.PI * 2); x.stroke();
  x.lineWidth = 2; x.beginPath(); x.arc(m, m, m - 46, 0, Math.PI * 2); x.stroke();
  x.fillStyle = "#F3E3BC"; x.textAlign = "center"; x.textBaseline = "middle";
  const fit = (txt, font, size, max) => { let s = size; do { x.font = font.replace("{s}", s); s -= 4; } while (x.measureText(txt).width > max && s > 20); };
  fit(`${n1} & ${n2}`, "400 {s}px 'Pinyon Script', cursive", 104, S * .74); x.fillText(`${n1} & ${n2}`, m, m - 250);
  x.fillStyle = "#E8C77E";
  fit(years, "600 {s}px 'Bodoni Moda', serif", 230, S * .5); x.fillText(years, m, m + 175);
  x.fillStyle = "#F3E3BC"; x.font = "500 38px 'Jost', sans-serif";
  x.save(); x.letterSpacing = "12px"; x.fillText(sub.toUpperCase(), m, m + 330); x.restore();
  x.fillStyle = "#1a0b0e"; x.beginPath(); x.arc(m, m, 22, 0, Math.PI * 2); x.fill(); // spindle hole
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace; t.anisotropy = 8; return t;
}

export async function mountRecord(canvas, { label, small = false } = {}) {
  let renderer;
  try { renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "high-performance" }); }
  catch (e) { return null; }
  let pr = Math.min(devicePixelRatio || 1, small ? 1.6 : 1.75);
  renderer.setPixelRatio(pr);
  renderer.toneMapping = ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new Scene();
  // soft studio reflections, so the gold and the chrome look like metal
  const pmrem = new PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), .04).texture;
  scene.environment = envTex;
  const camera = new PerspectiveCamera(36, 1, .1, 100);
  scene.add(new HemisphereLight(0xfff1e0, 0x2a1014, .55));
  const key = new SpotLight(0xffe2b8, 90, 40, Math.PI / 7, .6, 1.6); key.position.set(-3, 11, 5); key.target.position.set(0, 0, 0); scene.add(key, key.target);
  const fill = new DirectionalLight(0xffd7c0, .7); fill.position.set(6, 4, -4); scene.add(fill);

  const deck = new Group(); scene.add(deck);
  // walnut plinth with a brass edge
  const wood = new MeshStandardMaterial({ color: 0x2e170f, roughness: .72, metalness: 0, envMapIntensity: .35 });
  const plinth = new Mesh(new BoxGeometry(8.4, .7, 6.6), wood); plinth.position.y = -.35; deck.add(plinth);
  const trim = new Mesh(new BoxGeometry(8.46, .08, 6.66), new MeshStandardMaterial({ color: 0xc9a25a, roughness: .3, metalness: 1 })); trim.position.y = -.1; deck.add(trim); // a thin brass line just below the top edge
  const platter = new Mesh(new CylinderGeometry(3.15, 3.15, .2, 96), new MeshStandardMaterial({ color: 0x9a9fa6, roughness: .25, metalness: 1 }));
  platter.position.set(-.9, .12, 0); deck.add(platter);

  // the record: gold, with grooves; the label spins with it
  const disc = new Group(); disc.position.set(-.9, .25, 0); deck.add(disc);
  const grooves = grooveTexture();
  const gold = new MeshPhysicalMaterial({ color: 0xd9b25f, metalness: 1, roughness: .28, bumpMap: grooves, bumpScale: .6, clearcoat: .6, clearcoatRoughness: .2 });
  const edge = new MeshStandardMaterial({ color: 0x8a6a2c, metalness: 1, roughness: .35 });
  const record = new Mesh(new CylinderGeometry(3, 3, .05, 128), [edge, gold, edge]); disc.add(record);
  const lab = new Mesh(new CircleGeometry(1.02, 96), new MeshStandardMaterial({ map: await labelTexture(label), roughness: .6 }));
  lab.rotation.x = -Math.PI / 2; lab.position.y = .031; disc.add(lab);
  const spindle = new Mesh(new CylinderGeometry(.05, .05, .32, 16), new MeshStandardMaterial({ color: 0xe8e8e8, metalness: 1, roughness: .2 })); spindle.position.y = .12; disc.add(spindle);

  // the tonearm, pivoting from the right
  const chrome = new MeshStandardMaterial({ color: 0xd9dde2, metalness: 1, roughness: .18 });
  const arm = new Group(); arm.position.set(2.9, .55, -2.2); deck.add(arm);
  const base = new Mesh(new CylinderGeometry(.42, .5, .5, 40), chrome); base.position.y = -.25; arm.add(base);
  const ring = new Mesh(new TorusGeometry(.42, .05, 12, 40), new MeshStandardMaterial({ color: 0xc9a25a, metalness: 1, roughness: .3 })); ring.rotation.x = Math.PI / 2; ring.position.y = -.02; arm.add(ring);
  const tube = new Mesh(new CylinderGeometry(.055, .055, 4.4, 16), chrome); tube.rotation.x = Math.PI / 2; tube.position.set(0, .12, 2.2); arm.add(tube);
  const head = new Mesh(new BoxGeometry(.36, .12, .6), new MeshStandardMaterial({ color: 0x1b1b1d, metalness: .6, roughness: .4 })); head.position.set(-.08, .06, 4.45); arm.add(head);
  const weight = new Mesh(new CylinderGeometry(.2, .2, .45, 24), chrome); weight.rotation.x = Math.PI / 2; weight.position.set(0, .12, -.55); arm.add(weight);
  const REST = .05, PLAY = -.42;
  arm.rotation.y = REST;

  // camera path: from a three-quarter view of the deck to above the spinning label
  const camFrom = { p: new Vector3(4.2, 7.2, 10.5), t: new Vector3(0, -.3, 0) };
  const camTo = { p: new Vector3(-.9, 10.2, 5.2), t: new Vector3(-.9, 0, 1.7) }; // the label sits in the upper part of the screen, the names below
  let fit = 1;
  function resize() {
    const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    fit = Math.max(1, 1.15 / camera.aspect); // pull back on tall phone screens so the deck fits
  }
  resize();
  const ro = new ResizeObserver(resize); ro.observe(canvas);

  let spin = 0, spinV = 0, spinTarget = .06, camK = 0, armK = 0, scroll = 0, last = performance.now(), slow = 0, dropT0 = 0;
  const onVis = () => { if (document.hidden) renderer.setAnimationLoop(null); else { last = performance.now(); renderer.setAnimationLoop(frame); } };
  document.addEventListener("visibilitychange", onVis);
  canvas.addEventListener("webglcontextlost", e => { e.preventDefault(); renderer.setAnimationLoop(null); canvas.dispatchEvent(new CustomEvent("record-lost", { bubbles: true })); });
  const camP = new Vector3(), camT = new Vector3();
  function frame(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    slow = dt > .028 ? slow + dt : Math.max(0, slow - dt * .5);
    if (slow > 1.5 && pr > 1) { pr = 1; renderer.setPixelRatio(pr); resize(); slow = 0; }
    if (dropT0) {
      const k = (now - dropT0) / 1000;
      armK = ease(Math.min(1, k / 1.1));
      camK = ease(Math.max(0, Math.min(1, (k - .6) / 2.4)));
    }
    arm.rotation.y = REST + (PLAY - REST) * armK;
    arm.rotation.x = -.04 * Math.sin(Math.min(1, armK) * Math.PI); // lift, swing, lower
    spinV += (spinTarget - spinV) * Math.min(1, dt * 1.6);
    spin += spinV * dt * 60; disc.rotation.y = -spin;
    camT.lerpVectors(camFrom.t, camTo.t, camK);
    // on tall screens the camera starts further back, and comes in to the same close-up
    camP.lerpVectors(camFrom.p, camTo.p, camK).sub(camT).multiplyScalar(fit + (1 - fit) * camK).add(camT);
    camera.position.copy(camP); camera.position.y += scroll * 3; camera.lookAt(camT);
    renderer.render(scene, camera);
  }
  renderer.setAnimationLoop(frame);

  return {
    // the guest drops the needle: the arm swings over, the record spins up to 33⅓ and the camera glides in
    drop(reduced) {
      return new Promise(res => {
        spinTarget = .58;
        if (reduced) { armK = 1; camK = 1; return res(); }
        dropT0 = performance.now(); setTimeout(res, 2600);
      });
    },
    played() { spinTarget = .58; spinV = .58; armK = 1; camK = 1; },
    setScroll(p) { scroll = Math.max(0, Math.min(1, p)); },
    destroy() {
      renderer.setAnimationLoop(null); ro.disconnect(); document.removeEventListener("visibilitychange", onVis);
      scene.traverse(o => { if (o.isMesh) { o.geometry.dispose(); [].concat(o.material).forEach(m => { m.map && m.map.dispose(); m.bumpMap && m.bumpMap.dispose(); m.dispose(); }); } });
      envTex.dispose(); pmrem.dispose(); renderer.dispose();
    }
  };
}
