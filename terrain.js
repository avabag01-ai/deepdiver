// terrain.js — 구역별 지형(원경/근경 2계층)
// 근경(전경) 지형은 충돌이 있고 폭 최대 화면의 40%, 좌우 벽에 붙어 번갈아 배치되어
// 항상 통로가 확보된다. 원경(배경)은 충돌 없이 장식용으로만 스크롤된다.
//
// 텍스처 캐싱: 절차적 표면 텍스처(균열/얼룩/이끼/지터 외곽선)는 조각이 스폰될 때
// 딱 한 번 오프스크린 캔버스에 구워서 chunk.tex에 저장해두고, 매 프레임에는
// drawImage 한 번으로만 그린다 — 매 프레임 수십 개의 도형을 다시 계산하지 않음.

import { CANVAS_W, CANVAS_H, INK, STROKE, shade, hilite, rgba, glow, stairStack, hash2, lerpColor, clamp } from './utils.js';

const FG_MAX_WIDTH_RATIO = 0.3;
const FG_MAX_WIDTH = CANVAS_W * FG_MAX_WIDTH_RATIO;

// 지형은 짧은 덩어리가 아니라 벽처럼 세로로 길게 이어진 형태여야 한다
// (화면 세로 길이의 1.5~3배)
const FG_HEIGHT_MIN = CANVAS_H * 1.5;
const FG_HEIGHT_MAX = CANVAS_H * 3.0;
const BG_HEIGHT_MIN = CANVAS_H * 1.3;
const BG_HEIGHT_MAX = CANVAS_H * 2.4;

const TERRAIN_STYLE = {
  shallow: { fg: '#2fae86', bg: '#1c8f9e', accent: '#e8d24a' },   // 산호초
  twilight: { fg: '#4a5568', bg: '#2f3b52', accent: '#6b7a94' },  // 회색 암반
  deepsea: { fg: '#2a3346', bg: '#1a2236', accent: '#3a4560' },   // 심해언덕
  vent: { fg: '#3a2f2a', bg: '#241d1a', accent: '#ff7a3c' },      // 열수구 굴뚝
};

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w));
  c.height = Math.max(1, Math.ceil(h));
  return c;
}

// 곶(promontory)이 벽의 나머지 폭보다 훨씬 더 통로 쪽으로 튀어나올 수 있어서,
// 오프스크린 캔버스를 nominal width보다 좌우로 더 넉넉하게 잡아 잘리지 않게 한다.
// bake 시 tctx.translate(WALL_PAD,0)으로 좌표계를 옮기고, 합성 시 그만큼 되돌려 그린다.
const WALL_PAD = 90;

// 지형 조각 하나를 생성. side: 'left' | 'right'
// spawnY는 조각의 "위쪽(top)" 기준. 조각은 화면 아래에서 나타나 위로 흘러가므로
// 항상 화면 바닥 부근에서 스폰되고, 세로로 길게(화면의 1.5~3배) 뻗어 벽처럼 보인다.
export function createTerrainChunk(zoneId, side, spawnY) {
  const width = FG_MAX_WIDTH * (0.65 + Math.random() * 0.35);
  const height = FG_HEIGHT_MIN + Math.random() * (FG_HEIGHT_MAX - FG_HEIGHT_MIN);
  const chunk = {
    zoneId,
    side,
    x: side === 'left' ? 0 : CANVAS_W - width,
    y: spawnY,
    width,
    height,
    seed: Math.random() * 1000,
    layer: 'fg',
  };
  chunk.tex = bakeTexture(chunk);
  return chunk;
}

export function createBgChunk(zoneId, side, spawnY) {
  const width = CANVAS_W * (0.3 + Math.random() * 0.25);
  const height = BG_HEIGHT_MIN + Math.random() * (BG_HEIGHT_MAX - BG_HEIGHT_MIN);
  const chunk = {
    zoneId,
    side,
    x: side === 'left' ? -width * 0.3 : CANVAS_W - width * 0.7,
    y: spawnY,
    width,
    height,
    seed: Math.random() * 1000,
    layer: 'bg',
  };
  chunk.tex = bakeTexture(chunk);
  return chunk;
}

// 극원경(distant) 조각 — bg보다 더 흐릿하고 어둡게, 스크롤도 더 느리게(game.js에서 0.3배 적용).
// 목업처럼 "저 뒤에 뭔가 있다"는 깊이감만 주는 용도라 디테일은 거의 없이 실루엣만.
export function createDistantChunk(zoneId, side, spawnY) {
  const width = CANVAS_W * (0.4 + Math.random() * 0.3);
  const height = BG_HEIGHT_MIN + Math.random() * (BG_HEIGHT_MAX - BG_HEIGHT_MIN);
  const chunk = {
    zoneId,
    side,
    x: side === 'left' ? -width * 0.4 : CANVAS_W - width * 0.6,
    y: spawnY,
    width,
    height,
    seed: Math.random() * 1000,
    layer: 'distant',
  };
  chunk.tex = bakeTexture(chunk);
  return chunk;
}

// 벽처럼 세로로 긴 지형의 안쪽(통로쪽) 가장자리를 그릴 때 쓰는 공용 헬퍼.
// 진폭을 조각 전체 높이에 비례시키지 않고 "고정 픽셀 값"으로 둬서, 조각이 아무리
// 길어져도 하나의 거대한 굴곡이 아니라 일정한 리듬으로 반복되는 요철이 되게 한다.
//
// jitterAmp>0이면 매끈한 사인 곡선 위에 결정적 해시 노이즈를 더해 손그림 같은
// 매끈함 대신 자연물다운 미세한 요철을 만든다(같은 seed+localY엔 항상 같은 값).
// 추가로 "chunky" 항은 굵은 단위로 양자화한 해시값을 쓰기 때문에, 그 구간 안의
// 모든 샘플 포인트가 같은 큰 오프셋을 공유하다가 다음 구간에서 갑자기 값이
// 바뀌는 계단식 턱을 만든다 — 로우폴리 암석처럼 각진 돌출/함몰을 표현한다.
// 격자점에 해시값을 두고 부드러운 보간(smoothstep)으로 잇는 1D 값 노이즈.
// 사인파와 달리 봉우리/골짜기 간격이 불규칙해서 "자연 지형" 느낌이 난다.
function valueNoise1D(x, seed, gridSize) {
  const gx = x / gridSize;
  const i0 = Math.floor(gx);
  const i1 = i0 + 1;
  const f = gx - i0;
  const t = f * f * (3 - 2 * f); // smoothstep
  const v0 = hash2(i0, seed) * 2 - 1;
  const v1 = hash2(i1, seed) * 2 - 1;
  return v0 + (v1 - v0) * t;
}

// ---------------------------------------------------------------------------
// 벽 실루엣 폭 결정 로직 — 3단 구조.
// 이전 버전은 좁은 고정폭(amp) 주변에서만 노이즈가 진동해 "기둥에 털 난" 모양이
// 되는 문제가 있었다. 이번엔 벽의 "기저 폭 자체"가 조각 안에서 크게(30~150px대)
// 출렁이는 저주파 곡선을 먼저 깔고, 그 위에 중간 굴곡+미세 디테일+곶/만을 얹는다.

// 1단: 매우 저주파의 큰 진폭 곡선 — 벽 폭 자체가 페이지를 내려가며 크게 출렁임
function baseWidthEnvelope(localY, seed) {
  const w1 = valueNoise1D(localY, seed + 500.1, 260);
  const w2 = valueNoise1D(localY, seed + 700.7, 128);
  return w1 * 1.0 + w2 * 0.55; // 대략 [-1.55, 1.55]
}

// 2단: 중간 굴곡 + 미세 디테일 (기존 프랙탈 능선, 진폭은 1단보다 작게)
function ridgeNoise(localY, seed) {
  const mid = valueNoise1D(localY, seed + 47.3, 54);
  const fine = valueNoise1D(localY, seed + 133.1, 17);
  return mid * 0.6 + fine * 0.3; // 대략 [-0.9, 0.9]
}

// 3단: 낮은 확률로 통로 쪽으로 크게 튀어나온 뾰족한 곶(promontory), 또는 깊게
// 파인 만(cove)을 섞는다 — 실제 해저 절벽 단면처럼 급격한 굴곡을 만드는 핵심.
function promontoryNoise(localY, seed) {
  const cellSize = 230;
  const cell = Math.floor(localY / cellSize);
  if (hash2(cell, seed + 911.3) > 0.72) return 0; // ~28% 확률로만 발생
  const centerPos = cell * cellSize + hash2(cell, seed + 912.7) * cellSize;
  const dist = Math.abs(localY - centerPos);
  const width = 40 + hash2(cell, seed + 913.1) * 55;
  if (dist > width) return 0;
  const shape = Math.cos((dist / width) * (Math.PI / 2)); // 완만하게 솟았다 가라앉는 종모양
  const sign = hash2(cell, seed + 914.5) > 0.5 ? 1 : -1; // 곶(+, 튀어나옴) 또는 만(-, 파임)
  const magnitude = 1.2 + hash2(cell, seed + 915.9) * 0.85;
  return shape * shape * sign * magnitude;
}

// 폭 계산은 세 노이즈를 정규화된 가중치로 합성한 뒤 한 번에 mid±swing 범위로 매핑한다
// (성분별로 각각 크게 부풀려 더했다가 클램프하면, 클램프 상한/하한에 오래 눌러붙는
// "평평한 구간"이 생겨 오히려 다시 기둥처럼 보인다 — 실제로 이 버그가 있었음).
// 수치 검증: 여러 시드에 걸쳐 1px 단위로 샘플링했을 때 변화량이 거의 없는(평평한)
// 구간이 150px(화면 높이 1/4) 이상 나오지 않는지 확인 완료.
function innerEdgeX(innerX, dir, localY, seed, amp, freq, jitterAmp) {
  const roughness = jitterAmp || 1;
  const roughnessScale = clamp(roughness / 6, 0.45, 1);
  const base = baseWidthEnvelope(localY, seed);
  const ridge = ridgeNoise(localY, seed) * roughnessScale;
  const promontory = promontoryNoise(localY, seed) * roughnessScale;
  const composite = base * 0.5 + ridge * 0.38 + promontory * 0.55;
  const midWidth = amp * 3.4;   // 벽의 평균적인 폭
  const swingRange = amp * 2.7; // 그 위에 출렁이는 폭의 크기
  const fineDetail = jitterAmp ? (hash2(Math.round(localY * 0.5), seed + 19.4) - 0.5) * 2 * jitterAmp * 0.4 : 0;
  const width = clamp(midWidth + composite * swingRange + fineDetail, 8, amp * 7.5);
  return innerX + dir * width;
}

// chunk: {x,y,width,height,seed,side} — 로컬 좌표로 구울 때는 x=0,y=0인 사본을 넘긴다.
// 위/아래 캡(조각의 시작/끝 가로선)도 일직선 대신 잘게 꺾어서, 조각이 이어지거나
// 스폰/소멸하는 지점이 "딱 떨어지는 사각형"처럼 보이지 않게 한다.
function buildWallPath(ctx, chunk, amp, freq, sampleStep, jitterAmp = 0) {
  const { x, y, width, height, seed, side } = chunk;
  const dir = side === 'left' ? 1 : -1;
  const innerX = side === 'left' ? x + width : x; // 통로에 접한 안쪽 경계
  const outerX = side === 'left' ? x : x + width;  // 화면 벽에 붙은 바깥 경계
  const capJit = jitterAmp || 2;

  ctx.beginPath();
  ctx.moveTo(outerX, y);
  const capSteps = 3;
  for (let i = 1; i <= capSteps; i++) {
    const cx = outerX + dir * (width * (i / capSteps));
    const cy = y + (hash2(seed + i * 2.3, 401) - 0.5) * capJit * 2.4;
    ctx.lineTo(cx, cy);
  }
  const steps = Math.max(4, Math.round(height / sampleStep));
  for (let i = 1; i <= steps; i++) {
    const localY = (height * i) / steps; // 조각 기준 상대 위치 — chunk.y와 무관, 스크롤해도 고정된 모양 유지
    const sy = y + localY;
    const sx = innerEdgeX(innerX, dir, localY, seed, amp, freq, jitterAmp);
    ctx.lineTo(sx, sy);
  }
  for (let i = 1; i <= capSteps; i++) {
    const cx = innerX - dir * (width * (i / capSteps));
    const cy = y + height + (hash2(seed + i * 3.7, 402) - 0.5) * capJit * 2.4;
    ctx.lineTo(cx, cy);
  }
  ctx.closePath();
}

// 불규칙 다각형 블롭 하나를 그린다 (원 대신 각 꼭짓점을 해시로 흔들어 자연스러운 얼룩 모양)
function blob(ctx, cx, cy, r, seed, sides = 6, squashY = 0.85) {
  ctx.beginPath();
  for (let s = 0; s < sides; s++) {
    const ang = (Math.PI * 2 * s) / sides;
    const rr = r * (0.55 + hash2(seed + s * 3.7, s) * 0.85);
    const qx = cx + Math.cos(ang) * rr;
    const qy = cy + Math.sin(ang) * rr * squashY;
    if (s === 0) ctx.moveTo(qx, qy); else ctx.lineTo(qx, qy);
  }
  ctx.closePath();
}

// ---------------------------------------------------------------------------
// 생태계 장식 — 말미잘 / 불가사리 / 미니 산호 군락. "바다 생태계를 배우는 느낌"을
// 주기 위해 구역별로 색감을 다르게(표층=화사, 심해/열수구=창백·발광) 구성한다.
// 전부 오프스크린 캐시(bake) 단계에서 한 번만 그려 성능 부담이 없다.
const DECOR_PALETTE = {
  shallow: {
    anemones: [
      { base: '#c93f7e', tentacle: '#ff7fc4', tip: '#ffe0f0' },
      { base: '#d9762a', tentacle: '#ffb15c', tip: '#ffe9c8' },
    ],
    starfish: ['#e8452f', '#ff7a3c', '#e0862f'],
  },
  twilight: {
    anemones: [{ base: '#6a4a94', tentacle: '#a888e0', tip: '#e4d8ff' }],
    coral: { branch: '#7b8aa4', tip: '#aebfdc' },
    starfish: ['#c96b4a', '#b8583c'],
  },
  deepsea: {
    anemones: [{ base: '#3e2f5c', tentacle: '#7a5aa0', tip: '#c4a8ff' }],
    coral: { branch: '#3a4560', tip: '#5f70a0' },
    starfish: ['#8a4a3a', '#6a3a30'],
    glow: '#bfa0ff',
  },
  vent: {
    anemones: [{ base: '#8a7862', tentacle: '#f0dab0', tip: '#fff2d8' }],
    starfish: ['#d99a5a', '#e8b878'],
    glow: '#ffcf8a',
  },
};

// 말미잘: 짧은 촉수 다발이 faceDir(벽면→통로) 방향으로 부채꼴로 펼쳐진 모습.
// 정적 이미지라 실제로 흔들리진 않지만, 살짝 휘어진 촉수 곡선으로 "살랑거리는
// 중간 한 컷"을 흉내낸다.
function drawAnemone(tctx, cx, cy, faceDir, seed, palette, scale = 1) {
  tctx.save();
  tctx.translate(cx, cy);
  const n = 7;
  for (let i = 0; i < n; i++) {
    const spread = (i / (n - 1) - 0.5) * Math.PI * 0.95;
    const dx = Math.cos(spread) * faceDir;
    const dy = Math.sin(spread);
    const len = (6 + hash2(seed + i, 7) * 5) * scale;
    const bend = (hash2(seed + i, 11) - 0.5) * 5 * scale;
    tctx.strokeStyle = palette.tentacle;
    tctx.lineWidth = 1.3 * scale;
    tctx.lineCap = 'round';
    tctx.beginPath();
    tctx.moveTo(0, 0);
    tctx.quadraticCurveTo(dx * len * 0.55 + bend * 0.4, dy * len * 0.55 - 1.5 * scale, dx * len + bend, dy * len - 2 * scale);
    tctx.stroke();
    tctx.fillStyle = palette.tip;
    tctx.beginPath(); tctx.arc(dx * len + bend, dy * len - 2 * scale, 0.9 * scale, 0, Math.PI * 2); tctx.fill();
  }
  // 밑동
  tctx.fillStyle = palette.base;
  tctx.strokeStyle = rgba(INK, 0.4);
  tctx.lineWidth = 0.6 * scale;
  tctx.beginPath(); tctx.ellipse(0, 0, 3.2 * scale, 2 * scale, 0, 0, Math.PI * 2); tctx.fill(); tctx.stroke();
  tctx.restore();
}

// 불가사리: 5각 별 모양, 표면에 붙어 있는 정적 장식
function drawStarfish(tctx, cx, cy, seed, color, scale = 1) {
  tctx.save();
  tctx.translate(cx, cy);
  tctx.rotate(hash2(seed, 5) * Math.PI * 2);
  tctx.fillStyle = color;
  tctx.strokeStyle = rgba(INK, 0.4);
  tctx.lineWidth = 0.7 * scale;
  const spikes = 5, outerR = 5 * scale, innerR = 2.1 * scale;
  tctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const ang = (Math.PI * i) / spikes - Math.PI / 2;
    const px = Math.cos(ang) * r, py = Math.sin(ang) * r;
    if (i === 0) tctx.moveTo(px, py); else tctx.lineTo(px, py);
  }
  tctx.closePath();
  tctx.fill(); tctx.stroke();
  tctx.fillStyle = 'rgba(255,255,255,0.28)';
  for (let i = 0; i < spikes; i++) {
    const ang = (Math.PI * 2 * i) / spikes - Math.PI / 2 + hash2(seed + i, 9) * 0.3;
    const r = 2.4 * scale;
    tctx.beginPath(); tctx.arc(Math.cos(ang) * r, Math.sin(ang) * r, 0.5 * scale, 0, Math.PI * 2); tctx.fill();
  }
  tctx.restore();
}

// 미니 산호 군락 (일반 암반 구역용 — 산호초 구역보다 작고 드문 point-of-interest)
function drawMiniCoral(tctx, cx, cy, faceDir, seed, palette, scale = 1) {
  tctx.save();
  tctx.translate(cx, cy);
  for (let i = 0; i < 3; i++) {
    const ang = (i - 1) * 0.55;
    const len = (5 + hash2(seed + i, 3) * 4) * scale;
    const dx = Math.cos(ang) * faceDir;
    const dy = Math.sin(ang) - 0.3;
    tctx.strokeStyle = palette.branch;
    tctx.lineWidth = 1.7 * scale;
    tctx.lineCap = 'round';
    tctx.beginPath();
    tctx.moveTo(0, 0);
    tctx.lineTo(dx * len, dy * len);
    tctx.stroke();
    tctx.fillStyle = palette.tip;
    tctx.beginPath(); tctx.arc(dx * len, dy * len, 1.3 * scale, 0, Math.PI * 2); tctx.fill();
  }
  tctx.restore();
}

// ---------------------------------------------------------------------------
// 암반 (twilight/deepsea) — 균열, 명암 얼룩, 이끼, 마모 하이라이트, 지터 외곽선
function bakeRock(chunk, zoneId) {
  const { width, height, seed, side, layer } = chunk;
  const isFg = layer === 'fg';
  const style = TERRAIN_STYLE[zoneId];
  const cnv = makeCanvas(width + WALL_PAD * 2, height);
  const tctx = cnv.getContext('2d');
  tctx.translate(WALL_PAD, 0);
  const local = { x: 0, y: 0, width, height, seed, side };
  const innerX = side === 'left' ? width : 0;
  const dir = side === 'left' ? 1 : -1;

  // 방향성 광원 다단 그라디언트 (바깥쪽이 밝고 안쪽 통로가 어둡게 — 단일 플랫 대신)
  const outerX = side === 'left' ? 0 : width;
  const grad = tctx.createLinearGradient(outerX, 0, innerX, 0);
  grad.addColorStop(0, lerpColor(style.fg, '#ffffff', isFg ? 0.16 : 0.08));
  grad.addColorStop(0.55, style.fg);
  grad.addColorStop(1, lerpColor(style.fg, '#000000', isFg ? 0.26 : 0.14));
  tctx.fillStyle = isFg ? grad : style.bg;
  if (isFg) { tctx.strokeStyle = INK; tctx.lineWidth = STROKE.silhouette; }

  const sampleStep = isFg ? 15 : 46;
  const jitter = isFg ? 8.5 : 1.4;
  buildWallPath(tctx, local, 22, 0.014, sampleStep, jitter);
  tctx.fill();
  if (isFg) tctx.stroke();

  if (!isFg) {
    // 원경은 저비용 실루엣 + 큰 뭉툭한 그림자 얼룩 두어개만 (블러된 느낌)
    const bshade = 'rgba(0,0,0,0.12)';
    tctx.fillStyle = bshade;
    for (let i = 0; i < 3; i++) {
      const py = hash2(seed, i * 2 + 1) * height;
      const px = innerX - dir * (10 + hash2(seed + 5, i) * width * 0.5);
      blob(tctx, px, py, 28 + hash2(seed + 9, i) * 18, seed + i * 11);
      tctx.fill();
    }
    return cnv;
  }

  // 안쪽 가장자리 그림자
  shade(tctx, () => buildWallPath(tctx, local, 22, 0.014, sampleStep, jitter), 0.2);

  // 다중 톤 명암 얼룩 (표면 거칠기 — 결정적 노이즈로 흩뿌린 밝은/어두운 다각형 패치)
  const patchCount = Math.max(10, Math.round(height / 24));
  for (let i = 0; i < patchCount; i++) {
    const py = hash2(seed, i) * height;
    const px = innerX - dir * (6 + hash2(seed + 7, i) * (width * 0.62));
    const r = 4 + hash2(seed + 13, i) * 8;
    const dark = hash2(seed + 19, i) > 0.42;
    tctx.fillStyle = dark ? rgba(INK, 0.2 + hash2(seed + 23, i) * 0.14) : 'rgba(255,255,255,0.13)';
    blob(tctx, px, py, r, seed + i * 4.1, 6, 0.8);
    tctx.fill();
  }

  // 균열선: 꺾인 여러 세그먼트로 잔금처럼
  const crackCount = Math.max(4, Math.round(height / 95));
  tctx.strokeStyle = rgba(INK, 0.48);
  tctx.lineWidth = STROKE.detail;
  tctx.lineJoin = 'round'; tctx.lineCap = 'round';
  for (let i = 0; i < crackCount; i++) {
    let cx = innerX - dir * hash2(seed + 31, i) * width * 0.35;
    let cy = 16 + hash2(seed + 37, i) * (height - 32);
    tctx.beginPath();
    tctx.moveTo(cx, cy);
    const segs = 3 + Math.floor(hash2(seed + 41, i) * 3);
    for (let s = 0; s < segs; s++) {
      cx += -dir * (6 + hash2(seed + i * 5.3, s) * 9);
      cy += (hash2(seed + i * 7.1, s + 20) - 0.5) * 24;
      tctx.lineTo(cx, cy);
    }
    tctx.stroke();
  }

  // 이끼/조류 얼룩 (짙은 녹색~갈색 반점, 절차적으로 흩뿌림)
  const mossCount = Math.max(5, Math.round(height / 72));
  for (let i = 0; i < mossCount; i++) {
    const my = hash2(seed + 51, i) * height;
    const mx = innerX - dir * (4 + hash2(seed + 57, i) * width * 0.55);
    const mr = 5 + hash2(seed + 61, i) * 6.5;
    const mossColor = hash2(seed + 63, i) > 0.5 ? 'rgba(98,132,56,0.36)' : 'rgba(88,66,38,0.32)';
    tctx.fillStyle = mossColor;
    blob(tctx, mx, my, mr, seed + i * 6.7, 5, 1);
    tctx.fill();
  }

  // 모서리 마모 하이라이트 (안쪽 가장자리를 따라 끊어진 밝은 선 조각들)
  tctx.strokeStyle = 'rgba(255,255,255,0.32)';
  tctx.lineWidth = STROKE.detail * 0.95;
  const wearCount = Math.max(4, Math.round(height / 130));
  for (let i = 0; i < wearCount; i++) {
    const wy = 10 + hash2(seed + 71, i) * (height - 20);
    const wx = innerX - dir * 1.5;
    tctx.beginPath();
    tctx.moveTo(wx, wy);
    tctx.lineTo(wx - dir * (8 + hash2(seed + 75, i) * 8), wy + 6 + hash2(seed + 77, i) * 6);
    tctx.stroke();
  }

  // 생태계 장식: 말미잘 + 불가사리 + 미니 산호 군락 (구역별 색감)
  const palette = DECOR_PALETTE[zoneId];
  const decorCount = Math.max(4, Math.round(height / 150));
  for (let i = 0; i < decorCount; i++) {
    const dy = 40 + hash2(seed + 141, i) * (height - 80);
    const dx = innerX - dir * (2 + hash2(seed + 143, i) * 5);
    const kind = hash2(seed + 145, i);
    const dscale = 0.75 + hash2(seed + 147, i) * 0.4;
    if (kind < 0.38) {
      const an = palette.anemones[i % palette.anemones.length];
      drawAnemone(tctx, dx, dy, dir, seed + i * 3, an, dscale);
      if (palette.glow) glow(tctx, dx, dy, 9, palette.glow, 0.22);
    } else if (kind < 0.7) {
      drawStarfish(tctx, dx, dy, seed + i * 5, palette.starfish[i % palette.starfish.length], dscale);
    } else {
      drawMiniCoral(tctx, dx, dy, dir, seed + i * 7, palette.coral, dscale);
    }
  }

  return cnv;
}

// ---------------------------------------------------------------------------
// 산호초 (shallow) — 유기적 가지 + 폴립 점묘 + 다단 그라디언트
function bakeCoral(chunk) {
  const { width, height, seed, side, layer } = chunk;
  const isFg = layer === 'fg';
  const style = TERRAIN_STYLE.shallow;
  const cnv = makeCanvas(width + WALL_PAD * 2, height);
  const tctx = cnv.getContext('2d');
  tctx.translate(WALL_PAD, 0);
  const local = { x: 0, y: 0, width, height, seed, side };
  const innerX = side === 'left' ? width : 0;
  const outerX = side === 'left' ? 0 : width;
  const dir = side === 'left' ? 1 : -1;

  const grad = tctx.createLinearGradient(outerX, 0, innerX, 0);
  grad.addColorStop(0, lerpColor(style.fg, '#ffffff', isFg ? 0.3 : 0.12));
  grad.addColorStop(0.6, style.fg);
  grad.addColorStop(1, lerpColor(style.fg, '#000000', isFg ? 0.22 : 0.1));
  tctx.fillStyle = isFg ? grad : style.bg;
  if (isFg) { tctx.strokeStyle = INK; tctx.lineWidth = STROKE.silhouette; }

  const sampleStep = isFg ? 24 : 42;
  const jitter = isFg ? 2.2 : 0.8; // 산호는 암석보다 매끈-유기적이므로 지터는 절제
  buildWallPath(tctx, local, 26, 0.02, sampleStep, jitter);
  tctx.fill();
  if (isFg) tctx.stroke();

  if (!isFg) return cnv; // 원경은 실루엣만, 저비용

  shade(tctx, () => buildWallPath(tctx, local, 26, 0.02, sampleStep, jitter), 0.14);

  // 가지 형태 돌출 (유기적 산호 가지)
  const branchCount = Math.max(3, Math.round(height / 100));
  for (let i = 0; i < branchCount; i++) {
    const by = 26 + hash2(seed + 81, i) * (height - 52);
    const blen = 13 + hash2(seed + 83, i) * 15;
    const bend = (hash2(seed + 85, i) - 0.5) * 12;
    tctx.strokeStyle = INK; tctx.lineWidth = STROKE.part;
    tctx.fillStyle = lerpColor(style.fg, '#ffffff', 0.18);
    tctx.beginPath();
    tctx.moveTo(innerX, by - 3);
    tctx.quadraticCurveTo(innerX - dir * blen * 0.6 + bend, by - blen * 0.5, innerX - dir * blen + bend, by - blen);
    tctx.lineTo(innerX - dir * blen * 0.75 + bend, by - blen + 4.5);
    tctx.quadraticCurveTo(innerX - dir * blen * 0.5 + bend, by - blen * 0.35, innerX, by + 4);
    tctx.closePath();
    tctx.fill(); tctx.stroke();
  }

  // 큰 폴립 (기존 앵커 포인트)
  tctx.fillStyle = style.accent;
  const count = Math.max(3, Math.round(height / 90));
  for (let i = 0; i < count; i++) {
    const py = 30 + i * 90 + Math.sin(seed + i) * 12;
    const px = innerX - dir * (14 + Math.sin(seed * 2 + i) * 8);
    tctx.beginPath(); tctx.arc(px, py, 4, 0, Math.PI * 2); tctx.fill();
    tctx.strokeStyle = INK; tctx.lineWidth = STROKE.detail; tctx.stroke();
  }

  // 폴립 점묘 텍스처 (촘촘한 점 무리 — 유기적 질감의 핵심)
  const clusters = Math.max(5, Math.round(height / 55));
  for (let c = 0; c < clusters; c++) {
    const cy = hash2(seed + 91, c) * height;
    const cx = innerX - dir * (8 + hash2(seed + 93, c) * width * 0.55);
    for (let d = 0; d < 9; d++) {
      const ang = hash2(seed + 95, c * 20 + d) * Math.PI * 2;
      const rr = hash2(seed + 97, c * 20 + d + 1) * 9;
      const dx = cx + Math.cos(ang) * rr;
      const dy = cy + Math.sin(ang) * rr * 0.7;
      tctx.globalAlpha = 0.5 + hash2(seed + 99, c * 7 + d) * 0.35;
      tctx.fillStyle = style.accent;
      tctx.beginPath(); tctx.arc(dx, dy, 1.1, 0, Math.PI * 2); tctx.fill();
    }
  }
  tctx.globalAlpha = 1;

  // 생태계 장식: 말미잘 + 불가사리 (산호는 이미 위에서 충분히 다뤘으므로 제외)
  const palette = DECOR_PALETTE.shallow;
  const decorCount = Math.max(3, Math.round(height / 160));
  for (let i = 0; i < decorCount; i++) {
    const dy = 36 + hash2(seed + 161, i) * (height - 72);
    const dx = innerX - dir * (3 + hash2(seed + 163, i) * 6);
    const dscale = 0.85 + hash2(seed + 167, i) * 0.4;
    if (hash2(seed + 165, i) < 0.5) {
      const an = palette.anemones[i % palette.anemones.length];
      drawAnemone(tctx, dx, dy, dir, seed + i * 3, an, dscale);
    } else {
      drawStarfish(tctx, dx, dy, seed + i * 5, palette.starfish[i % palette.starfish.length], dscale);
    }
  }

  return cnv;
}

// ---------------------------------------------------------------------------
// 열수구 굴뚝 몸체 (정적 텍스처만 굽고, 애니메이션 연기/글로우는 매 프레임 별도로 그림)
function bakeVentBody(chunk) {
  const { width, height, seed, side, layer } = chunk;
  const isFg = layer === 'fg';
  const style = TERRAIN_STYLE.vent;
  const cnv = makeCanvas(width + WALL_PAD * 2, height);
  const tctx = cnv.getContext('2d');
  tctx.translate(WALL_PAD, 0);
  const local = { x: 0, y: 0, width, height, seed, side };
  const innerX = side === 'left' ? width : 0;
  const outerX = side === 'left' ? 0 : width;
  const dir = side === 'left' ? 1 : -1;

  const grad = tctx.createLinearGradient(outerX, 0, innerX, 0);
  grad.addColorStop(0, lerpColor(style.fg, '#ff9d5c', isFg ? 0.12 : 0.05));
  grad.addColorStop(0.55, style.fg);
  grad.addColorStop(1, lerpColor(style.fg, '#000000', isFg ? 0.32 : 0.16));
  tctx.fillStyle = isFg ? grad : style.bg;
  if (isFg) { tctx.strokeStyle = INK; tctx.lineWidth = STROKE.silhouette; }

  const sampleStep = isFg ? 17 : 48;
  const jitter = isFg ? 7.2 : 1.2;
  buildWallPath(tctx, local, 20, 0.012, sampleStep, jitter);
  tctx.fill();
  if (isFg) tctx.stroke();

  if (!isFg) return cnv;

  shade(tctx, () => buildWallPath(tctx, local, 20, 0.012, sampleStep, jitter), 0.24);

  // 그을음/광물 침전 얼룩 (짙은 회색~검정 + 드문 주황 광물맥)
  const patchCount = Math.max(8, Math.round(height / 30));
  for (let i = 0; i < patchCount; i++) {
    const py = hash2(seed, i) * height;
    const px = innerX - dir * (6 + hash2(seed + 7, i) * width * 0.6);
    const r = 4 + hash2(seed + 13, i) * 7;
    const mineral = hash2(seed + 19, i) > 0.82;
    tctx.fillStyle = mineral ? 'rgba(255,140,70,0.22)' : rgba(INK, 0.16 + hash2(seed + 23, i) * 0.1);
    blob(tctx, px, py, r, seed + i * 4.3, 6, 0.85);
    tctx.fill();
  }

  // 균열 (열에 갈라진 잔금, 광물 침전 색조)
  const crackCount = Math.max(3, Math.round(height / 110));
  tctx.strokeStyle = 'rgba(255,120,60,0.28)';
  tctx.lineWidth = STROKE.detail;
  for (let i = 0; i < crackCount; i++) {
    let cx = innerX - dir * hash2(seed + 31, i) * width * 0.3;
    let cy = 20 + hash2(seed + 37, i) * (height - 40);
    tctx.beginPath();
    tctx.moveTo(cx, cy);
    const segs = 2 + Math.floor(hash2(seed + 41, i) * 3);
    for (let s = 0; s < segs; s++) {
      cx += -dir * (5 + hash2(seed + i * 5, s) * 8);
      cy += (hash2(seed + i * 7, s + 20) - 0.5) * 22;
      tctx.lineTo(cx, cy);
    }
    tctx.stroke();
  }

  // 생태계 장식: 창백하거나 은은하게 발광하는 말미잘/불가사리 (열수구 특유의 색소 없는 생물상)
  const palette = DECOR_PALETTE.vent;
  const decorCount = Math.max(2, Math.round(height / 210));
  for (let i = 0; i < decorCount; i++) {
    const dy = 50 + hash2(seed + 181, i) * (height - 100);
    const dx = innerX - dir * (2 + hash2(seed + 183, i) * 6);
    const dscale = 0.75 + hash2(seed + 187, i) * 0.3;
    if (hash2(seed + 185, i) < 0.55) {
      drawAnemone(tctx, dx, dy, dir, seed + i * 3, palette.anemones[0], dscale);
      glow(tctx, dx, dy, 8, palette.glow, 0.28);
    } else {
      drawStarfish(tctx, dx, dy, seed + i * 5, palette.starfish[i % palette.starfish.length], dscale);
    }
  }

  return cnv;
}

function bakeTexture(chunk) {
  if (chunk.zoneId === 'shallow') return bakeCoral(chunk);
  if (chunk.zoneId === 'vent') return bakeVentBody(chunk);
  return bakeRock(chunk, chunk.zoneId === 'deepsea' ? 'deepsea' : 'twilight');
}

// ---------------------------------------------------------------------------
function drawVentAnimated(ctx, chunk, timeSec) {
  const { x, y, width, height, seed, side } = chunk;
  const style = TERRAIN_STYLE.vent;
  const innerX = side === 'left' ? x + width : x;
  const dir = side === 'left' ? 1 : -1;
  const count = Math.max(2, Math.round(height / 220));
  for (let i = 0; i < count; i++) {
    const vy = y + 60 + i * 220 + Math.sin(seed + i * 2) * 20;
    const vx = innerX - dir * 6;
    glow(ctx, vx, vy, 34, style.accent, 0.45);
    stairStack(ctx, 6, 0.06, (k) => {
      const rise = (k + 1) * 12 + Math.sin(timeSec * 0.5 + seed + i + k) * 4;
      ctx.fillStyle = '#cfd6e0';
      ctx.beginPath();
      ctx.ellipse(vx + Math.sin(timeSec * 0.3 + i + k) * 4, vy - rise, 10 + k * 2, 8 + k * 1.6, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}

function alphaForLayer(chunk) {
  if (chunk.layer === 'fg') return 1;
  if (chunk.layer === 'distant') return 0.2; // 극원경: 아주 흐릿하게, 실루엣 정도만
  return chunk.zoneId === 'shallow' ? 0.55 : 0.5; // 중원경(bg)
}

// ---------------------------------------------------------------------------
// 바다 바닥 — 레벨 목표 수심에 도달하면 화면 아래에서 스크롤되어 올라오는 해저면.
// 구역 테마에 맞춰 모래바닥/뻘/침전물/열수구 바닥으로 다르게 그린다(정적 draw,
// 캐싱 없이 매 프레임 직접 그려도 화면에 하나뿐이라 비용이 낮다).
const FLOOR_STYLE = {
  shallow: { top: '#e8d9a0', mid: '#cdb875', accent: '#a88f52' },
  twilight: { top: '#6b7488', mid: '#4c5468', accent: '#333a4a' },
  deepsea: { top: '#333a52', mid: '#232838', accent: '#161a26' },
  vent: { top: '#4a3226', mid: '#2e1e16', accent: '#1a0f0a' },
};

export function drawSeafloor(ctx, topY, zoneId) {
  const style = FLOOR_STYLE[zoneId] || FLOOR_STYLE.deepsea;
  const bandBottom = topY + 260; // 화면 아래로 충분히 내려가는 두꺼운 바닥
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(-20, bandBottom);
  const steps = 22;
  for (let i = 0; i <= steps; i++) {
    const x = -20 + ((CANVAS_W + 40) * i) / steps;
    const bump = valueNoise1D(x, 42, 90) * 16 + valueNoise1D(x, 108, 28) * 7;
    ctx.lineTo(x, topY + 30 + bump);
  }
  ctx.lineTo(CANVAS_W + 20, bandBottom);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, topY, 0, bandBottom);
  grad.addColorStop(0, style.top);
  grad.addColorStop(0.35, style.mid);
  grad.addColorStop(1, style.accent);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = STROKE.silhouette;
  ctx.stroke();

  // 표면 자갈/침전물 텍스처
  for (let i = 0; i < 26; i++) {
    const x = hash2(i, 71.3) * CANVAS_W;
    const bump = valueNoise1D(x, 42, 90) * 16 + valueNoise1D(x, 108, 28) * 7;
    const y = topY + 34 + bump + hash2(i, 19.7) * 26;
    const r = 1.4 + hash2(i, 33.1) * 2.6;
    ctx.fillStyle = rgba(INK, 0.16 + hash2(i, 51.2) * 0.12);
    ctx.beginPath(); ctx.ellipse(x, y, r * 1.6, r, 0, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

export function drawTerrainChunk(ctx, chunk, timeSec) {
  const isFg = chunk.layer === 'fg';
  ctx.save();
  ctx.globalAlpha = alphaForLayer(chunk);
  if (chunk.tex) ctx.drawImage(chunk.tex, chunk.x - WALL_PAD, chunk.y);
  ctx.restore();
  if (chunk.zoneId === 'vent' && isFg) drawVentAnimated(ctx, chunk, timeSec);
}

// 근경 지형과 다이버의 원형 충돌 판정 (사각형 근사, 살짝 너그럽게)
export function collidesWithTerrain(chunk, px, py, radius) {
  if (chunk.layer !== 'fg') return false;
  const closestX = Math.max(chunk.x, Math.min(px, chunk.x + chunk.width));
  const closestY = Math.max(chunk.y, Math.min(py, chunk.y + chunk.height));
  const dx = px - closestX;
  const dy = py - closestY;
  return (dx * dx + dy * dy) < radius * radius;
}
