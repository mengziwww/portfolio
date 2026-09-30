import {
  AmbientLight,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  FrontSide,
  Group,
  LinearMipmapLinearFilter,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  PCFShadowMap,
  PerspectiveCamera,
  Plane,
  PlaneGeometry,
  Raycaster,
  RepeatWrapping,
  Scene,
  SRGBColorSpace,
  Texture,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three';

export type BookSource = { sm: string; lg: string };
export type BookStatus = { kind: 'cover' | 'spread' | 'end' | 'back'; pages: number[] };

type BookOptions = {
  stage: HTMLElement;
  canvas: HTMLCanvasElement;
  sources: BookSource[];
  reduced: boolean;
  calm: boolean;
  onReady: () => void;
  onStatus: (status: BookStatus) => void;
};

type FaceKind = 'board' | 'endpaper' | 'blank' | 'backcover';
type Face = { kind: FaceKind; board: number };

type Sheet = {
  k: number;
  front: Face;
  back: Face;
  stiff: boolean;
  w: number;
  h: number;
  pos: BufferAttribute;
  frontGeo: BufferGeometry;
  backGeo: BufferGeometry;
  frontMat: MeshLambertMaterial;
  backMat: MeshLambertMaterial;
  frontMesh: Mesh;
  backMesh: Mesh;
  rim: Mesh | null;
};

type Turn = {
  k: number;
  dir: 1 | -1;
  theta: number;
  vel: number;
  target: number;
  dragging: boolean;
  bend: number;
  lean: number;
  grabV: number;
};

type Press = {
  id: number;
  type: string;
  x0: number;
  y0: number;
  t0: number;
  book: Vector3 | null;
  mode: 'pending' | 'turn' | 'pan' | 'none';
  lastX: number;
  lastT: number;
  panVel: number;
  grabR: number;
  grabX: number;
  lastTheta: number;
  thetaVel: number;
};

const PI = Math.PI;
const PAGE_W = 1;
const PAGE_H = 4230 / 3031;
const T = 0.015;
const GUTTER = 0.13;
const HINGE = 0.045;
const SX = 36;
const SY = 14;
const TILT = 0.26;
const FOV = 24;
const COVER_SCALE = 1.025;
const CONTACT = 0.7;
const FAN = 0.45;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const smooth = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

function edgeShade(shader: { fragmentShader: string }) {
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <map_fragment>',
    `#include <map_fragment>
    vec2 mbEdge = min(vMapUv, 1.0 - vMapUv) * vec2(1.0, ${(PAGE_H / PAGE_W).toFixed(3)});
    float mbE = smoothstep(0.0, 0.028, min(mbEdge.x, mbEdge.y));
    diffuseColor.rgb *= mix(vec3(0.58, 0.5, 0.42), vec3(1.0), 0.35 + 0.65 * mbE);`,
  );
}

function paperCanvas(draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, w = 512, h = 714) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (ctx) draw(ctx, w, h);
  const tex = new CanvasTexture(c);
  tex.colorSpace = SRGBColorSpace;
  tex.flipY = false;
  return tex;
}

function speckle(ctx: CanvasRenderingContext2D, w: number, h: number, color: string, count: number, alpha: number) {
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    ctx.globalAlpha = Math.random() * alpha;
    ctx.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 1.5, 1);
  }
  ctx.globalAlpha = 1;
}

async function decode(url: string): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    const res = await fetch(url);
    const blob = await res.blob();
    return createImageBitmap(blob);
  }
  const img = new Image();
  img.decoding = 'async';
  img.src = url;
  await img.decode();
  return img;
}

export function createBook(opts: BookOptions) {
  const { stage, canvas, sources, reduced, calm, onReady, onStatus } = opts;

  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFShadowMap;
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV, 1, 0.05, 40);

  const ambient = new AmbientLight(0xe6e9ff, 1.8);
  scene.add(ambient);
  const key = new DirectionalLight(0xfff0da, 1.45);
  key.position.set(1.4, 1.6, 3.4);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -1.5;
  key.shadow.camera.right = 1.5;
  key.shadow.camera.top = 1.15;
  key.shadow.camera.bottom = -1.15;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 10;
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.005;
  key.shadow.radius = 3;
  scene.add(key);
  scene.add(key.target);

  // Everything below is laid out left-to-right and mirrored here so the volume reads right to left;
  // UVs are flipped to match, and pointer/camera x go through the same mirror.
  const book = new Group();
  book.scale.x = -1;
  scene.add(book);

  const paper = paperCanvas((ctx, w, h) => {
    ctx.fillStyle = '#efe9dd';
    ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, '#8a7a62', 900, 0.12);
  }, 64, 90);
  const blank = paperCanvas((ctx, w, h) => {
    ctx.fillStyle = '#f1ebdf';
    ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, '#8a7a62', 2600, 0.1);
  });
  const endpaper = paperCanvas((ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#161a2c');
    g.addColorStop(1, '#0d1020');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, '#c9c2e8', 3000, 0.08);
    ctx.fillStyle = '#e6c27d';
    for (let i = 0; i < 26; i++) {
      ctx.globalAlpha = 0.18 + Math.random() * 0.3;
      const r = Math.random() * 1.3 + 0.4;
      ctx.beginPath();
      ctx.arc(Math.random() * w, Math.random() * h, r, 0, PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  });
  const backcover = paperCanvas((ctx, w, h) => {
    ctx.fillStyle = '#0c0d14';
    ctx.fillRect(0, 0, w, h);
    speckle(ctx, w, h, '#8e88b0', 2200, 0.07);
    ctx.fillStyle = 'rgba(216, 167, 94, 0.55)';
    ctx.fillRect(w * 0.065, 0, 1.5, h);
  });
  [paper, blank, endpaper, backcover].forEach((t) => (t.anisotropy = aniso));

  const stripes = paperCanvas((ctx, w, h) => {
    ctx.fillStyle = '#e2d7c2';
    ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 8) {
      ctx.fillStyle = y % 16 === 0 ? '#9c8a6c' : '#b9a887';
      ctx.fillRect(0, y, w, 2);
    }
  }, 4, 64);
  stripes.wrapS = RepeatWrapping;
  stripes.wrapT = RepeatWrapping;
  const stripeScale = 3 / (8 * T);

  const shadowTex = paperCanvas((ctx, w, h) => {
    ctx.shadowColor = 'rgba(0, 0, 0, 1)';
    ctx.shadowBlur = 34;
    ctx.shadowOffsetX = 2000;
    ctx.fillStyle = '#000';
    ctx.fillRect(-2000 + 36, 36, w - 72, h - 72);
  }, 256, 330);

  // ---- sheets: cover, pairs of boards, back cover ----
  const interior = sources.length - 1;
  const faces: Array<[Face, Face]> = [];
  faces.push([{ kind: 'board', board: 0 }, { kind: 'endpaper', board: -1 }]);
  for (let b = 1; b <= interior; b += 2) {
    const back: Face = b + 1 <= interior ? { kind: 'board', board: b + 1 } : { kind: 'blank', board: -1 };
    faces.push([{ kind: 'board', board: b }, back]);
  }
  faces.push([{ kind: 'endpaper', board: -1 }, { kind: 'backcover', board: -1 }]);
  const N = faces.length;
  const pivot = (N * T) / 2;

  const RIM: number[] = [];
  for (let i = 0; i <= SX; i++) RIM.push(i);
  for (let j = 1; j <= SY; j++) RIM.push(j * (SX + 1) + SX);
  for (let i = SX - 1; i >= 0; i--) RIM.push(SY * (SX + 1) + i);
  const RIM_T = T * 0.85;
  const rimMat = new MeshLambertMaterial({ color: 0xbfb19a, side: DoubleSide });

  function buildSheet(k: number, front: Face, back: Face): Sheet {
    const stiff = k === 0 || k === N - 1;
    const scale = stiff ? COVER_SCALE : 1;
    const w = PAGE_W * scale;
    const h = PAGE_H * scale;
    const count = (SX + 1) * (SY + 1);
    const pos = new BufferAttribute(new Float32Array(count * 3), 3);
    const normal = new BufferAttribute(new Float32Array(count * 3), 3);
    const uvF = new Float32Array(count * 2);
    const uvB = new Float32Array(count * 2);
    for (let j = 0; j <= SY; j++) {
      for (let i = 0; i <= SX; i++) {
        const idx = j * (SX + 1) + i;
        uvF[idx * 2] = 1 - i / SX;
        uvF[idx * 2 + 1] = 1 - j / SY;
        uvB[idx * 2] = i / SX;
        uvB[idx * 2 + 1] = 1 - j / SY;
      }
    }
    const index: number[] = [];
    for (let j = 0; j < SY; j++) {
      for (let i = 0; i < SX; i++) {
        const a = j * (SX + 1) + i;
        const b = a + 1;
        const c = a + SX + 1;
        const d = c + 1;
        index.push(a, b, c, b, d, c);
      }
    }
    const frontGeo = new BufferGeometry();
    frontGeo.setAttribute('position', pos);
    frontGeo.setAttribute('normal', normal);
    frontGeo.setAttribute('uv', new BufferAttribute(uvF, 2));
    frontGeo.setIndex(index);
    const backGeo = new BufferGeometry();
    backGeo.setAttribute('position', pos);
    backGeo.setAttribute('normal', normal);
    backGeo.setAttribute('uv', new BufferAttribute(uvB, 2));
    backGeo.setIndex(frontGeo.getIndex());

    const frontMat = new MeshLambertMaterial({ map: paper, side: FrontSide, color: 0xfbf7ef });
    frontMat.shadowSide = DoubleSide;
    const backMat = new MeshLambertMaterial({ map: paper, side: BackSide, color: 0xfbf7ef });
    frontMat.onBeforeCompile = edgeShade;
    backMat.onBeforeCompile = edgeShade;
    const frontMesh = new Mesh(frontGeo, frontMat);
    const backMesh = new Mesh(backGeo, backMat);
    frontMesh.frustumCulled = false;
    backMesh.frustumCulled = false;
    frontMesh.receiveShadow = true;
    backMesh.receiveShadow = true;
    frontMesh.castShadow = true;
    book.add(frontMesh, backMesh);
    let rim: Mesh | null = null;
    if (stiff) {
      const rimGeo = new BufferGeometry();
      rimGeo.setAttribute('position', new BufferAttribute(new Float32Array(RIM.length * 6), 3));
      const rimIndex: number[] = [];
      for (let q = 0; q < RIM.length - 1; q++) {
        const a = q * 2;
        rimIndex.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
      rimGeo.setIndex(rimIndex);
      rim = new Mesh(rimGeo, rimMat);
      rim.frustumCulled = false;
      rim.receiveShadow = true;
      book.add(rim);
    }
    return { k, front, back, stiff, w, h, pos, frontGeo, backGeo, frontMat, backMat, frontMesh, backMesh, rim };
  }

  const sheets = faces.map(([f, b], k) => buildSheet(k, f, b));

  function shape(sheet: Sheet, theta: number, bend: number, lean: number, grabV: number, peek: number) {
    const { w, h, k } = sheet;
    const arr = sheet.pos.array as Float32Array;
    const dR = (N - k) * T - pivot;
    const dL = (k + 1) * T - pivot;
    const p = clamp(theta / PI, 0, 1);
    const off0 = dR * (1 - p) - dL * p;
    const s0 = Math.sin(theta);
    const b = bend * (sheet.stiff ? 0.12 : 1) * s0;
    const l = lean * (sheet.stiff ? 0.18 : 1) * s0;
    const pk = peek * (sheet.stiff ? 0.45 : 1);
    const gutter = sheet.stiff ? HINGE : GUTTER;
    const leanMean = 1 - (grabV * grabV + (1 - grabV) * (1 - grabV)) / 2;
    const ds = w / SX;
    for (let j = 0; j <= SY; j++) {
      const v = j / SY;
      const y = (v - 0.5) * h;
      const rowTheta = theta + l * (1 - Math.abs(v - grabV) - leanMean);
      const rowPeek = pk * (1 - v) * (1 - v);
      let x = 0;
      let z = 0;
      let prev = 0;
      for (let i = 0; i <= SX; i++) {
        const u = i / SX;
        const s = i * ds;
        const phi = rowTheta + b * u * u + rowPeek * smooth(0.45, 1, u);
        if (i > 0) {
          const m = (prev + phi) / 2;
          x += Math.cos(m) * ds;
          z += Math.sin(m) * ds;
        }
        prev = phi;
        const g = smooth(0, gutter, s) * off0;
        const o = (j * (SX + 1) + i) * 3;
        arr[o] = x - Math.sin(phi) * g;
        arr[o + 1] = y;
        arr[o + 2] = pivot + z + Math.cos(phi) * g;
      }
    }
    sheet.pos.needsUpdate = true;
    sheet.frontGeo.computeVertexNormals();
    if (sheet.rim) {
      const nrm = sheet.frontGeo.getAttribute('normal').array as Float32Array;
      const rimPos = sheet.rim.geometry.getAttribute('position') as BufferAttribute;
      const out = rimPos.array as Float32Array;
      RIM.forEach((v, q) => {
        for (let c = 0; c < 3; c++) {
          out[q * 6 + c] = arr[v * 3 + c];
          out[q * 6 + 3 + c] = arr[v * 3 + c] - nrm[v * 3 + c] * RIM_T;
        }
      });
      rimPos.needsUpdate = true;
      sheet.rim.geometry.computeVertexNormals();
    }
  }

  // ---- page blocks: the visible edges of every sheet resting on a side ----
  const pileMat = new MeshLambertMaterial({ map: stripes, side: DoubleSide, color: 0xf6efe2 });
  function pileGeometry(count: number, side: 1 | -1, gutter: number, fan: number) {
    const top = count * T - 0.0015;
    const xs: number[] = [];
    for (let i = 0; i <= 12; i++) xs.push((gutter * i) / 12);
    for (let i = 1; i <= 10; i++) xs.push(gutter + ((PAGE_W - gutter) * i) / 10);
    const zt = xs.map((s) => pivot + (top - pivot) * smooth(0, gutter, s));
    const zb = xs.map((s) => pivot * (1 - smooth(0, gutter, s)));
    const flare = top * fan;
    const pos: number[] = [];
    const uv: number[] = [];
    const push = (x: number, y: number, z: number, u: number, vv: number) => {
      pos.push(side * x, y, z);
      uv.push(u, vv);
    };
    const hy = PAGE_H / 2;
    const last = xs.length - 1;
    const xb = xs.map((s, i) => (i === last ? s + flare : s));
    for (const y of [-hy, hy]) {
      for (let i = 0; i < xs.length - 1; i++) {
        const a = [xb[i], zb[i]];
        const b = [xb[i + 1], zb[i + 1]];
        const c = [xs[i + 1], zt[i + 1]];
        const d = [xs[i], zt[i]];
        for (const q of [a, b, c, a, c, d]) push(q[0], y, q[1], q[0], q[1] * stripeScale);
      }
    }
    const wall = [
      [xb[last], -hy, zb[last]],
      [xb[last], hy, zb[last]],
      [PAGE_W, hy, zt[last]],
      [PAGE_W, -hy, zt[last]],
    ];
    for (const n of [0, 1, 2, 0, 2, 3]) push(wall[n][0], wall[n][1], wall[n][2], wall[n][1] / PAGE_H, wall[n][2] * stripeScale);
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new Float32BufferAttribute(uv, 2));
    geo.computeVertexNormals();
    return geo;
  }
  const pileR = new Mesh(new BufferGeometry(), pileMat);
  const pileL = new Mesh(new BufferGeometry(), pileMat);
  pileR.receiveShadow = true;
  pileL.receiveShadow = true;
  book.add(pileR, pileL);
  let pileKeyR = '';
  let pileKeyL = '';

  const contactMat = () =>
    new MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false, color: 0x000000, opacity: CONTACT });
  const contactR = new Mesh(new PlaneGeometry(PAGE_W * 1.26, PAGE_H * 1.16), contactMat());
  const contactL = new Mesh(new PlaneGeometry(PAGE_W * 1.26, PAGE_H * 1.16), contactMat());
  contactR.position.set(PAGE_W * 0.54, -0.04, -0.004);
  contactL.position.set(-PAGE_W * 0.46, -0.04, -0.004);
  book.add(contactR, contactL);

  // ---- textures: only the boards around the open spread live on the GPU ----
  type Slot = { tex: Texture | null; source: ImageBitmap | HTMLImageElement | null; loading: boolean };
  const boards = new Map<number, Slot>();
  let useLg = false;
  let destroyed = false;
  let ready = false;

  function faceTex(face: Face): Texture {
    if (face.kind === 'board') return boards.get(face.board)?.tex ?? paper;
    if (face.kind === 'endpaper') return endpaper;
    if (face.kind === 'backcover') return backcover;
    return blank;
  }

  function assignMaps() {
    sheets.forEach((sheet) => {
      sheet.frontMat.map = faceTex(sheet.front);
      sheet.backMat.map = faceTex(sheet.back);
    });
  }

  function load(board: number, first = false) {
    if (boards.has(board)) return;
    const slot: Slot = { tex: null, source: null, loading: true };
    boards.set(board, slot);
    const src = sources[board];
    decode(useLg ? src.lg : src.sm)
      .then((source) => {
        if (destroyed || boards.get(board) !== slot) {
          if ('close' in source) source.close();
          return;
        }
        const tex = new Texture(source);
        tex.flipY = false;
        tex.colorSpace = SRGBColorSpace;
        tex.anisotropy = aniso;
        tex.minFilter = LinearMipmapLinearFilter;
        tex.generateMipmaps = true;
        tex.needsUpdate = true;
        renderer.initTexture(tex);
        slot.tex = tex;
        slot.source = source;
        slot.loading = false;
        assignMaps();
        if (first && !ready) {
          ready = true;
          onReady();
        }
        kick();
      })
      .catch(() => {
        slot.loading = false;
      });
  }

  function boardsOf(k: number): number[] {
    if (k < 0 || k >= N) return [];
    return [sheets[k].front, sheets[k].back].filter((f) => f.kind === 'board').map((f) => f.board);
  }

  function refreshWindow() {
    const keep = new Set<number>();
    const want: number[] = [];
    for (let k = turned - 2; k <= turned + 2; k++) boardsOf(k).forEach((b) => want.push(b));
    for (let k = turned - 3; k <= turned + 3; k++) boardsOf(k).forEach((b) => keep.add(b));
    if (turn) boardsOf(turn.k).forEach((b) => keep.add(b));
    want.sort((a, b) => Math.abs(a - turned * 2) - Math.abs(b - turned * 2)).forEach((b) => load(b));
    boards.forEach((slot, b) => {
      if (keep.has(b)) return;
      slot.tex?.dispose();
      if (slot.source && 'close' in slot.source) slot.source.close();
      boards.delete(b);
    });
    assignMaps();
  }

  // ---- state ----
  let turned = 0;
  let turn: Turn | null = null;
  const queue: number[] = [];
  let narrow = false;
  let focus: 'L' | 'R' | 'both' = 'R';
  let hover: 'next' | 'prev' | null = null;
  let peekR = 0;
  let peekL = 0;
  let pulseAt = -1;
  let rightTop = -1;
  let leftTop = -1;
  let camX = PAGE_W / 2;
  let camVX = 0;
  let camFit = 2.16;
  let camVFit = 0;
  let panX = 0;
  let width = 1;
  let height = 1;

  function has(face: Face | null) {
    return !!face && face.kind === 'board';
  }

  function spread(t = turned) {
    return {
      left: t > 0 ? sheets[t - 1].back : null,
      right: t < N ? sheets[t].front : null,
    };
  }

  function defaultFocus(dir: number): 'L' | 'R' | 'both' {
    const { left, right } = spread();
    if (!left) return 'R';
    if (!right) return 'L';
    const l = has(left);
    const r = has(right);
    if (l && r) return dir > 0 ? 'L' : 'R';
    if (l) return 'L';
    if (r) return 'R';
    return 'both';
  }

  function emitStatus() {
    if (turned === 0) {
      onStatus({ kind: 'cover', pages: [1] });
      return;
    }
    if (turned === N) {
      onStatus({ kind: 'back', pages: [] });
      return;
    }
    const { left, right } = spread();
    const pages = [left, right].filter((f): f is Face => has(f)).map((f) => f.board + 1);
    onStatus({ kind: pages.length ? 'spread' : 'end', pages });
  }

  function layout() {
    const leftRest: number[] = [];
    const rightRest: number[] = [];
    for (let k = 0; k < N; k++) {
      if (turn && turn.k === k) continue;
      (k < turned ? leftRest : rightRest).push(k);
    }
    leftTop = leftRest.length ? leftRest[leftRest.length - 1] : -1;
    rightTop = rightRest.length ? rightRest[0] : -1;
    sheets.forEach((sheet) => {
      const k = sheet.k;
      const turning = !!turn && turn.k === k;
      const visible = turning || k === 0 || k === N - 1 || k === leftTop || k === rightTop;
      sheet.frontMesh.visible = visible;
      sheet.backMesh.visible = visible;
      sheet.frontMesh.castShadow = turning || k === leftTop || k === rightTop;
      if (!turning && visible) {
        const onLeft = k < turned;
        const pk = k === rightTop ? peekR : k === leftTop ? -peekL : 0;
        shape(sheet, onLeft ? PI : 0, 0, 0, 0.5, pk);
      }
    });
    const keyR = `${rightRest.length}:${rightTop === 0 || rightTop === N - 1}`;
    if (keyR !== pileKeyR) {
      pileKeyR = keyR;
      pileR.geometry.dispose();
      pileR.visible = rightRest.length > 0;
      if (rightRest.length)
        pileR.geometry = pileGeometry(rightRest.length, 1, rightTop === 0 ? HINGE : GUTTER, rightTop === 0 ? 0 : FAN);
    }
    const keyL = `${leftRest.length}:${leftTop === 0 || leftTop === N - 1}`;
    if (keyL !== pileKeyL) {
      pileKeyL = keyL;
      pileL.geometry.dispose();
      pileL.visible = leftRest.length > 0;
      if (leftRest.length)
        pileL.geometry = pileGeometry(leftRest.length, -1, leftTop === N - 1 ? HINGE : GUTTER, leftTop === N - 1 ? 0 : FAN);
    }
  }

  function reshapeTops() {
    if (rightTop >= 0 && !(turn && turn.k === rightTop)) shape(sheets[rightTop], 0, 0, 0, 0.5, peekR);
    if (leftTop >= 0 && !(turn && turn.k === leftTop)) shape(sheets[leftTop], PI, 0, 0, 0.5, -peekL);
  }

  function beginTurn(dir: 1 | -1, grabV: number, dragging: boolean): boolean {
    if (turn) return false;
    const k = dir > 0 ? turned : turned - 1;
    if (k < 0 || k >= N) return false;
    turn = {
      k,
      dir,
      theta: dir > 0 ? 0 : PI,
      vel: dragging ? 0 : dir * (reduced ? 9 : 5.4),
      target: dir > 0 ? PI : 0,
      dragging,
      bend: 0,
      lean: reduced ? 0 : dragging ? 0.45 : 0.3,
      grabV,
    };
    layout();
    refreshWindow();
    kick();
    return true;
  }

  function land() {
    if (!turn) return;
    const before = turned;
    const sheet = sheets[turn.k];
    turned = turn.target > PI / 2 ? turn.k + 1 : turn.k;
    turn = null;
    shape(sheet, turned > sheet.k ? PI : 0, 0, 0, 0.5, 0);
    if (turned !== before) {
      focus = defaultFocus(turned > before ? 1 : -1);
      emitStatus();
    }
    layout();
    refreshWindow();
    const next = queue.shift();
    if (next !== undefined) {
      if (next > 0) forward();
      else back();
    }
  }

  function forward() {
    if (turn) {
      if (queue.length < 2) queue.push(1);
      return;
    }
    if (narrow && focus === 'L' && has(spread().right)) {
      focus = 'R';
      kick();
      return;
    }
    beginTurn(1, 0.14, false);
  }

  function back() {
    if (turn) {
      if (queue.length < 2) queue.push(-1);
      return;
    }
    if (narrow && focus === 'R' && has(spread().left)) {
      focus = 'L';
      kick();
      return;
    }
    beginTurn(-1, 0.14, false);
  }

  // ---- camera ----
  function cameraTarget(): [number, number] {
    if (narrow) {
      if (turned === 0 && !turn) return [PAGE_W / 2, 1.12];
      if (turned === N && !turn) return [-PAGE_W / 2, 1.12];
      if (focus === 'both') return [0, 2.16];
      return [focus === 'L' ? -PAGE_W / 2 : PAGE_W / 2, 1.12];
    }
    let eff = 0;
    for (let k = 0; k < N; k++) {
      if (turn && turn.k === k) eff += turn.theta / PI;
      else if (k < turned) eff += 1;
    }
    const cx = eff < 1 ? (PAGE_W / 2) * (1 - eff) : eff > N - 1 ? (-PAGE_W / 2) * (eff - (N - 1)) : 0;
    return [cx, 2.16];
  }

  function placeCamera() {
    const aspect = width / Math.max(1, height);
    const t = Math.tan(((FOV / 2) * PI) / 180);
    const fitH = PAGE_H * 1.1;
    const d = Math.max(fitH / 2 / t, camFit / 2 / (t * aspect));
    const x = -camX + panX;
    camera.aspect = aspect;
    camera.position.set(x, -d * Math.sin(TILT), pivot + d * Math.cos(TILT));
    camera.lookAt(x, 0, pivot);
    camera.updateProjectionMatrix();
  }

  function resize() {
    const rect = stage.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    const wasNarrow = narrow;
    narrow = width < 640;
    if (narrow !== wasNarrow) focus = defaultFocus(1);
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(width, height, false);
    const pagePx = (narrow ? width : width / 2) * Math.min(2, window.devicePixelRatio || 1);
    useLg = pagePx > 1100;
    placeCamera();
    kick();
  }

  // ---- frame loop, only while something moves ----
  let raf = 0;
  let last = 0;
  function kick() {
    if (raf || destroyed) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function frame(now: number) {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    const active = step(dt, now);
    renderer.render(scene, camera);
    if (active) kick();
  }

  function step(dt: number, now: number): boolean {
    let active = false;

    if (turn) {
      const tr = turn;
      if (!tr.dragging) {
        const k = reduced ? 320 : 58;
        const c = 2 * Math.sqrt(k) * (reduced ? 1 : 0.94);
        const a = k * (tr.target - tr.theta) - c * tr.vel;
        tr.vel += a * dt;
        tr.theta += tr.vel * dt;
        if (tr.theta > PI || tr.theta < 0) {
          tr.theta = clamp(tr.theta, 0, PI);
          tr.vel *= 0.3;
        }
      }
      const bendTarget = reduced ? 0 : tr.dragging ? 0.5 * tr.dir : clamp(-tr.vel * 0.085, -0.68, 0.68);
      tr.bend += (bendTarget - tr.bend) * Math.min(1, dt * 9);
      if (!tr.dragging) tr.lean += ((reduced ? 0 : 0.24) - tr.lean) * Math.min(1, dt * 3);
      shape(sheets[tr.k], tr.theta, tr.bend, tr.lean, tr.grabV, 0);
      if (!tr.dragging && Math.abs(tr.target - tr.theta) < 0.004 && Math.abs(tr.vel) < 0.06) land();
      else active = true;
    }

    const restPeek = calm ? 0.05 : narrow ? 0.11 : 0.08;
    let pulse = 0;
    if (pulseAt > 0 && !calm) {
      const t = (now - pulseAt) / 1400;
      if (t > 0 && t < 1) {
        pulse = Math.sin(t * PI) * 0.42;
        active = true;
      } else if (t >= 1) pulseAt = -1;
      else active = true;
    }
    const tR = hover === 'next' ? 0.34 : restPeek + pulse;
    const tL = hover === 'prev' ? 0.3 : restPeek * 0.5;
    const nR = peekR + (tR - peekR) * Math.min(1, dt * 10);
    const nL = peekL + (tL - peekL) * Math.min(1, dt * 10);
    if (Math.abs(nR - peekR) > 1e-4 || Math.abs(nL - peekL) > 1e-4) {
      peekR = nR;
      peekL = nL;
      reshapeTops();
      active = true;
    }

    const [tx, tfit] = cameraTarget();
    const ck = reduced ? 400 : 34;
    const cc = 2 * Math.sqrt(ck);
    camVX += (ck * (tx - camX) - cc * camVX) * dt;
    camX += camVX * dt;
    camVFit += (ck * (tfit - camFit) - cc * camVFit) * dt;
    camFit += camVFit * dt;
    if (!press || press.mode !== 'pan') panX += (0 - panX) * Math.min(1, dt * 12);
    if (Math.abs(tx - camX) > 1e-4 || Math.abs(camVX) > 1e-4 || Math.abs(tfit - camFit) > 1e-4 || Math.abs(panX) > 1e-4) {
      active = true;
    } else {
      camX = tx;
      camFit = tfit;
      camVX = 0;
      camVFit = 0;
      panX = 0;
    }
    placeCamera();

    const eff = turned + (turn ? turn.theta / PI - (turn.k < turned ? 1 : 0) : 0);
    (contactL.material as MeshBasicMaterial).opacity = CONTACT * clamp(eff, 0, 1);
    (contactR.material as MeshBasicMaterial).opacity = CONTACT * clamp(N - eff, 0, 1);
    return active;
  }

  // ---- input ----
  const ray = new Raycaster();
  const ndc = new Vector2();
  const plane = new Plane(new Vector3(0, 0, 1), -pivot);
  const hit = new Vector3();

  function toBook(clientX: number, clientY: number): Vector3 | null {
    const rect = canvas.getBoundingClientRect();
    ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectPlane(plane, hit)) return null;
    return new Vector3(-hit.x, hit.y, hit.z);
  }

  function zoneAt(p: Vector3 | null): 'next' | 'prev' | null {
    if (!p || Math.abs(p.y) > PAGE_H * 0.53) return null;
    if (turned < N && p.x > 0.74 && p.x < 1.07) return 'next';
    if (turned > 0 && p.x < -0.74 && p.x > -1.07) return 'prev';
    return null;
  }

  let press: Press | null = null;

  function setCursor() {
    const value = press && press.mode === 'turn' ? 'grabbing' : hover ? 'grab' : '';
    if (value) canvas.style.setProperty('cursor', value, 'important');
    else canvas.style.removeProperty('cursor');
  }

  function onDown(e: PointerEvent) {
    if (e.button !== 0 || turn) return;
    press = {
      id: e.pointerId,
      type: e.pointerType,
      x0: e.clientX,
      y0: e.clientY,
      t0: performance.now(),
      book: toBook(e.clientX, e.clientY),
      mode: 'pending',
      lastX: e.clientX,
      lastT: performance.now(),
      panVel: 0,
      grabR: 0.5,
      grabX: 0,
      lastTheta: 0,
      thetaVel: 0,
    };
    if (e.pointerType === 'mouse') e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
  }

  function startTurnDrag(pr: Press, dir: 1 | -1): boolean {
    const p = pr.book;
    const grabV = p ? clamp((p.y + PAGE_H / 2) / PAGE_H, 0, 1) : 0.5;
    if (!beginTurn(dir, grabV, true) || !turn) return false;
    pr.mode = 'turn';
    pr.grabX = p ? p.x : dir > 0 ? 0.8 : -0.8;
    pr.grabR = Math.max(Math.abs(pr.grabX), 0.45);
    pr.lastTheta = turn.theta;
    return true;
  }

  function onMove(e: PointerEvent) {
    if (!press || e.pointerId !== press.id) {
      if (e.pointerType === 'mouse' && !narrow && !turn) {
        const z = zoneAt(toBook(e.clientX, e.clientY));
        if (z !== hover) {
          hover = z;
          setCursor();
          kick();
        }
      }
      return;
    }
    const pr = press;
    const dx = e.clientX - pr.x0;
    const dy = e.clientY - pr.y0;
    const now = performance.now();

    if (pr.mode === 'pending') {
      if (Math.hypot(dx, dy) < 7) return;
      if (Math.abs(dx) < Math.abs(dy) * 1.1) {
        pr.mode = 'none';
        return;
      }
      const dir: 1 | -1 = dx > 0 ? 1 : -1;
      if (narrow) {
        const { left, right } = spread();
        const canPan = dir > 0 ? focus === 'L' && has(right) : focus === 'R' && has(left);
        if (canPan) pr.mode = 'pan';
        else if (!startTurnDrag(pr, dir)) pr.mode = 'none';
      } else {
        const x = pr.book ? pr.book.x : 0;
        const onPage = pr.book && Math.abs(pr.book.y) < PAGE_H * 0.53 && Math.abs(x) < 1.07;
        if (!onPage || (dir > 0 && x < 0.03) || (dir < 0 && x > -0.03) || !startTurnDrag(pr, dir)) pr.mode = 'none';
      }
      hover = null;
      setCursor();
    }

    if (pr.mode === 'turn' && turn) {
      const p = toBook(e.clientX, e.clientY);
      if (p) {
        const travel = turn.dir > 0 ? pr.grabX - p.x : p.x - pr.grabX;
        const c = turn.dir > 0 ? 1 - travel / pr.grabR : -1 + travel / pr.grabR;
        const theta = Math.acos(clamp(c, -1, 1));
        const dt = Math.max(0.001, (now - pr.lastT) / 1000);
        pr.thetaVel = pr.thetaVel * 0.6 + ((theta - pr.lastTheta) / dt) * 0.4;
        pr.lastTheta = theta;
        turn.theta = theta;
        turn.grabV = p ? clamp((p.y + PAGE_H / 2) / PAGE_H, 0, 1) * 0.3 + turn.grabV * 0.7 : turn.grabV;
      }
      pr.lastT = now;
      kick();
    } else if (pr.mode === 'pan') {
      const perPx = camFit / width;
      const dt = Math.max(0.001, (now - pr.lastT) / 1000);
      pr.panVel = pr.panVel * 0.6 + ((e.clientX - pr.lastX) / dt) * 0.4;
      pr.lastX = e.clientX;
      pr.lastT = now;
      panX = -dx * perPx;
      kick();
    }
  }

  function onUp(e: PointerEvent, cancelled: boolean) {
    if (!press || e.pointerId !== press.id) return;
    const pr = press;
    press = null;
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);

    if (pr.mode === 'turn' && turn) {
      const vel = cancelled ? 0 : clamp(pr.thetaVel, -14, 14);
      const projected = turn.theta + vel * 0.22;
      turn.dragging = false;
      turn.vel = vel;
      turn.target = projected > PI / 2 ? PI : 0;
    } else if (pr.mode === 'pan') {
      const dx = e.clientX - pr.x0;
      const flick = Math.abs(pr.panVel) > 500;
      if (!cancelled && (Math.abs(dx) > width * 0.18 || flick)) {
        const was = focus;
        if (dx > 0 && focus === 'L') focus = 'R';
        else if (dx < 0 && focus === 'R') focus = 'L';
        if (focus !== was) {
          camX -= panX;
          panX = 0;
        }
      }
    } else if (pr.mode === 'pending' && !cancelled && performance.now() - pr.t0 < 400) {
      if (narrow) {
        const rect = canvas.getBoundingClientRect();
        const fx = (e.clientX - rect.left) / rect.width;
        if (fx < 0.24) forward();
        else if (fx > 0.76) back();
      } else {
        const z = zoneAt(pr.book);
        if (z === 'next') forward();
        else if (z === 'prev') back();
      }
    }
    setCursor();
    kick();
  }

  const down = (e: PointerEvent) => onDown(e);
  const move = (e: PointerEvent) => onMove(e);
  const up = (e: PointerEvent) => onUp(e, false);
  const cancel = (e: PointerEvent) => onUp(e, true);
  const leave = () => {
    if (hover && !press) {
      hover = null;
      setCursor();
      kick();
    }
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'ArrowLeft' || e.key === 'PageDown' || e.key === ' ') {
      e.preventDefault();
      forward();
    } else if (e.key === 'ArrowRight' || e.key === 'PageUp') {
      e.preventDefault();
      back();
    }
  };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', cancel);
  canvas.addEventListener('pointerleave', leave);
  stage.addEventListener('keydown', onKey);

  const ro = new ResizeObserver(() => resize());
  ro.observe(stage);
  const io = new IntersectionObserver(
    (entries) => {
      if (entries.some((en) => en.isIntersecting && en.intersectionRatio > 0.45)) {
        io.disconnect();
        if (!calm) {
          pulseAt = performance.now() + 500;
          kick();
        }
      }
    },
    { threshold: [0.45] },
  );
  io.observe(stage);

  resize();
  focus = defaultFocus(1);
  camX = cameraTarget()[0];
  camFit = cameraTarget()[1];
  peekR = calm ? 0.05 : 0.08;
  layout();
  load(0, true);
  refreshWindow();
  emitStatus();
  kick();

  return {
    forward,
    back,
    destroy() {
      destroyed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', move);
      canvas.removeEventListener('pointerup', up);
      canvas.removeEventListener('pointercancel', cancel);
      canvas.removeEventListener('pointerleave', leave);
      stage.removeEventListener('keydown', onKey);
      boards.forEach((slot) => {
        slot.tex?.dispose();
        if (slot.source && 'close' in slot.source) slot.source.close();
      });
      boards.clear();
      sheets.forEach((s) => {
        s.frontGeo.dispose();
        s.backGeo.dispose();
        s.frontMat.dispose();
        s.backMat.dispose();
      });
      [paper, blank, endpaper, backcover, stripes, shadowTex].forEach((t) => t.dispose());
      pileR.geometry.dispose();
      pileL.geometry.dispose();
      pileMat.dispose();
      sheets.forEach((s) => s.rim?.geometry.dispose());
      rimMat.dispose();
      [contactL, contactR].forEach((m) => {
        m.geometry.dispose();
        (m.material as MeshBasicMaterial).dispose();
      });
      renderer.dispose();
    },
  };
}
