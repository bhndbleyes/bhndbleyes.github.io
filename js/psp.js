/* ============================================================
   THE MACHINE — a real-time PSP you can actually operate.
   ============================================================ */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const WORKS = window.SK_WORKS || [];
const SK = window.SK || { fireReady() {}, onReady(f) { f(); } };
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const canvas = document.getElementById('pspCanvas');
const stage = document.querySelector('.machine__stage');
const section = document.querySelector('.machine');
const loadingEl = document.getElementById('pspLoading');

const railIdx = document.getElementById('railIdx');
const railTot = document.getElementById('railTot');
const railOpen = document.getElementById('railOpen');
const railEl = document.getElementById('rail');

if (canvas && WORKS.length) init();

function init() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 400);
  camera.position.set(0, 0, 30);

  const root = new THREE.Group();          
  const model = new THREE.Group();         
  root.add(model);
  scene.add(root);

  const hemi = new THREE.HemisphereLight(0x2a3a4d, 0x05070a, 0.55);
  scene.add(hemi);

  const keyLight = new THREE.DirectionalLight(0xbcd4e8, 0.85);
  keyLight.position.set(-8, 9, 12);
  scene.add(keyLight);

  const rimIce = new THREE.DirectionalLight(0x7fe3ff, 1.15);
  rimIce.position.set(11, 4, -9);
  scene.add(rimIce);

  const rimHot = new THREE.DirectionalLight(0xff2e7e, 0.75);
  rimHot.position.set(-12, -5, -7);
  scene.add(rimHot);

  const spillA = new THREE.PointLight(0xffffff, 0, 26, 2);
  const spillB = new THREE.PointLight(0xffffff, 0, 20, 2);
  const spillC = new THREE.PointLight(0xffffff, 0, 20, 2);
  scene.add(spillA, spillB, spillC);

  const pressLight = new THREE.PointLight(0x7fe3ff, 0, 9, 2);
  scene.add(pressLight);

  const SW = 960, SH = 544;                       
  const sc = document.createElement('canvas');
  sc.width = SW; sc.height = SH;
  const sctx = sc.getContext('2d', { willReadFrequently: false });
  sctx.fillStyle = '#05070a';
  sctx.fillRect(0, 0, SW, SH);

  const screenTex = new THREE.CanvasTexture(sc);
  screenTex.colorSpace = THREE.SRGBColorSpace;
  screenTex.minFilter = THREE.LinearFilter;
  screenTex.magFilter = THREE.LinearFilter;
  screenTex.generateMipmaps = false;

  const av = document.createElement('canvas');
  av.width = 8; av.height = 5;
  const avctx = av.getContext('2d', { willReadFrequently: true });

  const crtMat = new THREE.ShaderMaterial({
    uniforms: {
      uTex:     { value: screenTex },
      uTime:    { value: 0 },
      uPower:   { value: 0 },        
      uWarp:    { value: 0 },        
      uGrid:    { value: new THREE.Vector2(240, 136) },
      uBright:  { value: 0.92 }
    },
    transparent: false,
    toneMapped: false,
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main(){
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      }`,
    fragmentShader: /* glsl */`
      precision highp float;
      uniform sampler2D uTex;
      uniform float uTime, uPower, uWarp, uBright;
      uniform vec2 uGrid;
      varying vec2 vUv;

      float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }

      void main(){
        vec2 uv = vUv;
        vec2 c = uv - 0.5;
        float r2 = dot(c, c);
        uv = 0.5 + c * (1.0 + 0.032 * r2);

        float band = step(0.5, hash(vec2(floor(uv.y * 26.0), floor(uTime * 22.0))));
        uv.x += uWarp * (band - 0.5) * 0.09;

        if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
          gl_FragColor = vec4(0.005, 0.008, 0.013, 1.0);
          return;
        }

        vec2 g = uGrid;
        vec2 quv = (floor(uv * g) + 0.5) / g;

        float ab = (0.0005 + 0.0035 * r2) * (1.0 + uWarp * 6.0);
        float rr = texture2D(uTex, vec2(quv.x + ab, quv.y)).r;
        float gg = texture2D(uTex, quv).g;
        float bb = texture2D(uTex, quv).b;
        vec3 col = vec3(rr, gg, bb);

        float sub = mod(floor(uv.x * g.x * 3.0), 3.0);
        vec3 mask = vec3(sub < 1.0 ? 1.0 : 0.90, (sub >= 1.0 && sub < 2.0) ? 1.0 : 0.90, sub >= 2.0 ? 1.0 : 0.90);
        col *= mask;

        float scan = 0.93 + 0.07 * cos(uv.y * g.y * 6.28318);
        col *= scan;

        col += vec3(0.05, 0.075, 0.10) * pow(1.0 - uv.y, 3.0) * 0.45;
        col *= 1.0 - 0.30 * pow(r2 * 1.55, 1.6);
        col += (hash(quv * 620.0) - 0.5) * 0.012;

        float open = smoothstep(0.0, 1.0, uPower);
        float slit = smoothstep(open * 0.62 + 0.002, 0.0, abs(uv.y - 0.5));
        col = mix(vec3(0.55, 0.85, 1.0) * slit * 2.4, col, open);
        col *= open;

        gl_FragColor = vec4(col * uBright, 1.0);
      }`
  });

  let screenMesh = null;
  const buttons = {};
  const pressable = [];
  let modelReady = false;

  new GLTFLoader().load(
    'assets/models/psp.glb',
    (gltf) => { setup(gltf.scene); },
    undefined,
    (err) => {
      console.error('[psp] model failed', err);
      if (loadingEl) loadingEl.textContent = 'HARDWARE UNAVAILABLE';
      SK.fireReady();
    }
  );

  function setup(src) {
    model.add(src);
    src.updateWorldMatrix(true, true);

    const parts = {};
    const bin = [];
    src.traverse((o) => {
      if (!o.isMesh) return;
      o.frustumCulled = false;
      const n = o.name.toLowerCase();
      if (n.indexOf('ground') === 0) { bin.push(o); return; }
      if (n.indexOf('screen') === 0) screenMesh = o;
      const m = n.match(/^button(\d+)/);
      if (m) parts['b' + m[1]] = o;
      if (o.material) {
        o.material = o.material.clone();
        o.material.envMapIntensity = 1.25;
      }
    });

    bin.forEach((o) => { o.parent && o.parent.remove(o); });
    if (!screenMesh) { SK.fireReady(); return; }

    const nrm = largestFaceNormal(screenMesh);
    const centreOf = (o) => new THREE.Box3().setFromObject(o).getCenter(new THREE.Vector3());
    const centre = centreOf(src);
    const sCentre = centreOf(screenMesh);
    if (nrm.dot(sCentre.clone().sub(centre)) < 0) nrm.negate();

    const rowKeys = ['b9', 'b10', 'b11', 'b12', 'b13', 'b14', 'b15'];
    const row = new THREE.Vector3();
    let rowN = 0;
    rowKeys.forEach((k) => { if (parts[k]) { row.add(centreOf(parts[k])); rowN++; } });

    let up;
    if (rowN) {
      row.divideScalar(rowN);
      const down = row.sub(sCentre).projectOnPlane(nrm).normalize();
      up = down.negate();
    } else {
      up = new THREE.Vector3(0, 1, 0).projectOnPlane(nrm).normalize();
    }
    const right = new THREE.Vector3().crossVectors(up, nrm).normalize();
    up.crossVectors(nrm, right).normalize();

    const basis = new THREE.Matrix4().makeBasis(right, up, nrm);
    model.quaternion.setFromRotationMatrix(basis).invert();
    model.updateWorldMatrix(true, true);

    const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3());
    model.scale.setScalar(10 / Math.max(size.x, size.y, size.z));
    model.updateWorldMatrix(true, true);
    model.position.sub(new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3()));
    model.updateWorldMatrix(true, true);

    const sNrm = largestFaceNormal(screenMesh);
    if (sNrm.z < 0) sNrm.negate();
    buildScreenUVs(screenMesh, sNrm, new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0));
    screenMesh.material = crtMat;
    screenMesh.renderOrder = 2;

    modelReady = true;
    if (loadingEl) loadingEl.classList.add('is-off');
    SK.fireReady();
    select(0, true);
    setTimeout(() => { powerTarget = 1; }, 260);
  }

  function largestFaceNormal(mesh) {
    const geo = mesh.geometry;
    const pos = geo.getAttribute('position');
    const idx = geo.getIndex();
    const count = idx ? idx.count : pos.count;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    const ab = new THREE.Vector3(), ac = new THREE.Vector3(), cr = new THREE.Vector3();
    let best = -1;
    const out = new THREE.Vector3(0, 0, 1);
    for (let i = 0; i < count; i += 3) {
      const i0 = idx ? idx.getX(i) : i;
      const i1 = idx ? idx.getX(i + 1) : i + 1;
      const i2 = idx ? idx.getX(i + 2) : i + 2;
      a.fromBufferAttribute(pos, i0);
      b.fromBufferAttribute(pos, i1);
      c.fromBufferAttribute(pos, i2);
      ab.subVectors(b, a); ac.subVectors(c, a);
      cr.crossVectors(ab, ac);
      const area = cr.lengthSq();
      if (area > best) { best = area; out.copy(cr).normalize(); }
    }
    return out.applyMatrix3(new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld)).normalize();
  }

  function buildScreenUVs(mesh, nrm, right, up) {
    const geo = mesh.geometry;
    const p = geo.getAttribute('position');
    const mw = mesh.matrixWorld;
    const wp = [];
    const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(mw);
      wp.push(v.clone());
    }

    const e1 = right.clone().projectOnPlane(nrm).normalize();
    const e2 = new THREE.Vector3().crossVectors(nrm, e1).normalize();

    const a = [], b = [];
    let ma = 0, mb = 0;
    for (let i = 0; i < wp.length; i++) {
      const x = wp[i].dot(e1), y = wp[i].dot(e2);
      a.push(x); b.push(y); ma += x; mb += y;
    }
    ma /= a.length; mb /= b.length;

    let Saa = 0, Sbb = 0, Sab = 0;
    for (let i = 0; i < a.length; i++) {
      const da = a[i] - ma, db = b[i] - mb;
      Saa += da * da; Sbb += db * db; Sab += da * db;
    }
    const th = 0.5 * Math.atan2(2 * Sab, Saa - Sbb);
    const cs = Math.cos(th), sn = Math.sin(th);

    const U = e1.clone().multiplyScalar(cs).addScaledVector(e2, sn).normalize();
    const V = e1.clone().multiplyScalar(-sn).addScaledVector(e2, cs).normalize();
    if (U.dot(right) < 0) U.negate();
    if (V.dot(up) < 0) V.negate();

    let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
    const us = [], vs = [];
    for (let i = 0; i < wp.length; i++) {
      const u = wp[i].dot(U), w = wp[i].dot(V);
      us.push(u); vs.push(w);
      if (u < minU) minU = u; if (u > maxU) maxU = u;
      if (w < minV) minV = w; if (w > maxV) maxV = w;
    }
    const du = (maxU - minU) || 1, dv = (maxV - minV) || 1;
    const uv = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) {
      uv[i * 2] = (us[i] - minU) / du;
      uv[i * 2 + 1] = (vs[i] - minV) / dv;
    }
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  }

  const cache = new Map();
  function getImage(src) {
    if (cache.has(src)) return cache.get(src);
    const p = new Promise((res) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => res(null);
      im.src = src;
    });
    cache.set(src, p);
    return p;
  }

  let current = 0;
  let powerT = 0, powerTarget = 0, warpT = 0;
  const bg = document.createElement('canvas');
  bg.width = SW; bg.height = SH;
  const bgctx = bg.getContext('2d');

  function paintBackdrop(img) {
    bgctx.setTransform(1, 0, 0, 1, 0, 0);
    bgctx.fillStyle = '#04070b';
    bgctx.fillRect(0, 0, SW, SH);
    if (!img || !img.width) return;
    const ar = img.width / img.height, sar = SW / SH;
    bgctx.save();
    try { bgctx.filter = 'blur(34px) saturate(1.5) brightness(0.62)'; } catch (e) {}
    let cw, ch;
    if (ar > sar) { ch = SH * 1.28; cw = ch * ar; } else { cw = SW * 1.28; ch = cw / ar; }
    bgctx.drawImage(img, (SW - cw) / 2, (SH - ch) / 2, cw, ch);
    bgctx.restore();
    bgctx.filter = 'none';
  }

  function drawFrame(work, img) {
    sctx.save();
    sctx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.drawImage(bg, 0, 0);

    if (img && img.width) {
      const ar = img.width / img.height;
      const sar = SW / SH;
      let fw, fh;
      const pad = 0.90;
      if (ar > sar) { fw = SW * pad; fh = fw / ar; } else { fh = SH * pad; fw = fh * ar; }
      const fx = (SW - fw) / 2, fy = (SH - fh) / 2;
      sctx.save();
      sctx.shadowColor = 'rgba(0,0,0,.75)';
      sctx.shadowBlur = 26;
      sctx.drawImage(img, fx, fy, fw, fh);
      sctx.restore();

      sctx.strokeStyle = 'rgba(230,242,252,.35)';
      sctx.lineWidth = 2;
      sctx.strokeRect(fx + 1, fy + 1, fw - 2, fh - 2);
    }

    sctx.textBaseline = 'middle';
    sctx.font = '30px "VT323", monospace';
    sctx.fillStyle = 'rgba(127,227,255,.92)';
    sctx.fillText(String(current + 1).padStart(2, '0'), 26, 32);
    sctx.fillStyle = 'rgba(154,169,187,.55)';
    sctx.fillText('/ ' + String(WORKS.length).padStart(2, '0'), 62, 32);

    const px0 = SW - 26;
    for (let i = 0; i < WORKS.length; i++) {
      const on = i === current;
      const w = on ? 20 : 7;
      const x = px0 - (WORKS.length - i) * 24;
      sctx.fillStyle = on ? '#7fe3ff' : 'rgba(154,169,187,.38)';
      sctx.fillRect(x, SH - 30, w, 3);
    }

    sctx.restore();
    screenTex.needsUpdate = true;
  }

  async function select(i, instant) {
    current = ((i % WORKS.length) + WORKS.length) % WORKS.length;
    const w = WORKS[current];

    if (railIdx) railIdx.textContent = String(current + 1).padStart(2, '0');
    if (railTot) railTot.textContent = '/' + String(WORKS.length).padStart(2, '0');
    if (railOpen) railOpen.href = w.link;

    const token = ++selectToken;
    const img = await getImage(w.img);
    if (token !== selectToken) return;
    paintBackdrop(img);
    drawFrame(w, img);
  }

  let selectToken = 0;

  const composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  renderPass.clearColor = new THREE.Color(0x000000);
  renderPass.clearAlpha = 0;
  composer.addPass(renderPass);
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.42, 0.45, 0.55);
  composer.addPass(bloom);
  const outputPass = new OutputPass();
  composer.addPass(outputPass);

  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  let inView = false;
  new IntersectionObserver((entries) => {
    inView = entries[0].isIntersecting;
  }, { threshold: 0.05 }).observe(section);

  let lastT = 0;
  function animate(t) {
    requestAnimationFrame(animate);
    const dt = Math.min((t - lastT) * 0.001, 0.1);
    lastT = t;

    if (!inView) return;

    powerT += (powerTarget - powerT) * dt * 3.5;
    crtMat.uniforms.uPower.value = powerT;
    crtMat.uniforms.uTime.value = t * 0.001;
    if (warpT > 0) {
      warpT -= dt * 1.8;
      crtMat.uniforms.uWarp.value = Math.max(0, warpT);
    }

    renderer.clear();
    composer.render();
  }
  requestAnimationFrame(animate);
}