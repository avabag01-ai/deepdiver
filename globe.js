// globe.js — 레벨 선택용 2D 근사 3D 지구본 (Canvas 2D, WebGL 아님)
// 정투영(orthographic projection) 근사로 구체감을 낸다: 위/경도 좌표를 시점 회전각
// 기준으로 x,y,z(정면 방향 깊이)로 변환하고, z<0(뒷면)인 점은 숨긴다.
// 핀은 z값에 비례해 크기를 줄여 "뒤로 갈수록 작아지는" 원근감을 흉내낸다.

import { clamp, hash2 } from './utils.js';

export const DEG = Math.PI / 180;

// ---------------------------------------------------------------------------
// 우주 배경: 별 + 배경 행성. 지구본 화면 뒤에 깔리는 장식 레이어로, 별밭은
// 오프스크린 캔버스에 한 번만 굽고(고정 별) 트윙클(반짝임)만 소수만 매 프레임
// 다시 그린다. 행성도 각각 작은 캔버스에 한 번만 그려서 재사용한다.
const STAR_COUNT = 110;
const TWINKLE_COUNT = 18;
let starCache = null; // { w, h, canvas, twinkle }

function buildStars(w, h) {
  const cnv = document.createElement('canvas');
  cnv.width = w; cnv.height = h;
  const c = cnv.getContext('2d');
  const twinkle = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    const x = hash2(i, 11.7) * w;
    const y = hash2(i, 53.3) * h;
    const r = 0.4 + hash2(i, 7.1) * 1.3;
    const alpha = 0.2 + hash2(i, 3.9) * 0.5;
    c.fillStyle = `rgba(255,255,255,${alpha})`;
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    if (i < TWINKLE_COUNT) {
      twinkle.push({ x, y, r: r + 0.5, phase: hash2(i, 91.3) * Math.PI * 2, speed: 1.1 + hash2(i, 17.2) * 1.8 });
    }
  }
  return { w, h, canvas: cnv, twinkle };
}

function buildPlanet(kind) {
  const size = kind === 'saturn' ? 46 : 30;
  const cnv = document.createElement('canvas');
  cnv.width = size; cnv.height = size;
  const c = cnv.getContext('2d');
  const cx = size / 2, cy = size / 2;
  if (kind === 'mars') {
    const r = size * 0.32;
    const g = c.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
    g.addColorStop(0, '#e8a06a'); g.addColorStop(1, '#a8482a');
    c.fillStyle = g; c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(90,40,20,0.35)';
    c.beginPath(); c.ellipse(cx - r * 0.2, cy + r * 0.1, r * 0.35, r * 0.2, 0.3, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(cx + r * 0.35, cy - r * 0.25, r * 0.18, r * 0.12, -0.2, 0, Math.PI * 2); c.fill();
  } else if (kind === 'jupiter') {
    const r = size * 0.4;
    c.save();
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.clip();
    const bands = ['#d9b382', '#c89a68', '#e8caa0', '#b8825a', '#dcb890', '#c8a074', '#e0c090'];
    const bh = (r * 2) / bands.length;
    bands.forEach((col, i) => { c.fillStyle = col; c.fillRect(cx - r, cy - r + i * bh, r * 2, bh + 0.6); });
    c.restore();
    c.strokeStyle = 'rgba(80,50,30,0.3)'; c.lineWidth = 1;
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.stroke();
  } else if (kind === 'saturn') {
    const r = size * 0.24;
    c.save();
    c.translate(cx, cy); c.rotate(-0.35);
    c.strokeStyle = 'rgba(224,204,155,0.85)'; c.lineWidth = size * 0.085;
    c.beginPath(); c.ellipse(0, 0, size * 0.46, size * 0.15, 0, 0, Math.PI * 2); c.stroke();
    c.restore();
    const g = c.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
    g.addColorStop(0, '#f4e3b0'); g.addColorStop(1, '#c9a668');
    c.fillStyle = g; c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.fill();
  }
  return cnv;
}

let planetCache = null;
const PLANET_LAYOUT = [
  { kind: 'saturn', xr: 0.82, yr: 0.14, parallax: 6 },
  { kind: 'mars', xr: 0.13, yr: 0.74, parallax: 3 },
  { kind: 'jupiter', xr: 0.86, yr: 0.8, parallax: 9 },
];

function ensurePlanets() {
  if (planetCache) return planetCache;
  planetCache = { mars: buildPlanet('mars'), jupiter: buildPlanet('jupiter'), saturn: buildPlanet('saturn') };
  return planetCache;
}

// 배경 우주(별+행성)를 화면 전체에 그린다 — 지구본을 그리기 전, 맨 먼저 호출.
export function drawSpaceBackground(ctx, w, h, timeSec) {
  ctx.fillStyle = '#04070d';
  ctx.fillRect(0, 0, w, h);

  if (!starCache || starCache.w !== w || starCache.h !== h) starCache = buildStars(w, h);
  ctx.drawImage(starCache.canvas, 0, 0);
  for (const s of starCache.twinkle) {
    const a = 0.25 + 0.5 * (0.5 + 0.5 * Math.sin(timeSec * s.speed + s.phase));
    ctx.fillStyle = `rgba(255,255,255,${a})`;
    ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
  }

  const planets = ensurePlanets();
  for (const p of PLANET_LAYOUT) {
    const cnv = planets[p.kind];
    const drift = Math.sin(timeSec * 0.05 + p.parallax) * p.parallax;
    const x = w * p.xr - cnv.width / 2 + drift;
    const y = h * p.yr - cnv.height / 2;
    ctx.drawImage(cnv, x, y);
  }
}

// ---------------------------------------------------------------------------
// 대륙 실루엣 — 정치적/지리적 정확도보다 "알아볼 수 있는 형태"를 우선한
// 결정적(hand-authored) 위경도 좌표 폴리곤. [lon, lat] 순서.
const CONTINENTS = [
  // 북아메리카
  [[-165,68],[-152,70],[-130,70],[-95,68],[-80,50],[-70,45],[-65,45],[-75,35],
   [-81,25],[-97,26],[-97,18],[-105,20],[-115,30],[-124,40],[-124,48],[-130,55],[-140,60],[-165,68]],
  // 남아메리카
  [[-80,10],[-77,5],[-70,-5],[-70,-18],[-72,-30],[-70,-40],[-68,-50],[-65,-55],
   [-58,-52],[-53,-35],[-45,-23],[-40,-10],[-50,2],[-60,8],[-72,12],[-80,10]],
  // 아프리카
  [[-17,15],[-10,5],[9,4],[9,-5],[12,-18],[18,-34],[26,-34],[33,-25],
   [40,-15],[43,-2],[51,10],[43,12],[35,15],[32,22],[25,31],[10,37],[0,35],[-10,30],[-17,15]],
  // 유럽
  [[-9,43],[-5,48],[2,51],[10,54],[20,55],[30,60],[40,66],[35,55],
   [30,50],[28,45],[20,42],[14,40],[10,44],[0,44],[-9,43]],
  // 아시아
  [[30,45],[40,50],[55,55],[70,60],[90,70],[110,73],[135,73],[150,65],
   [142,45],[130,40],[122,32],[110,20],[100,10],[95,5],[85,10],[75,10],[68,25],[60,30],[50,30],[35,32],[30,45]],
  // 동남아/인도
  [[68,25],[78,8],[80,7],[88,22],[93,20],[98,10],[104,10],[100,20],[92,25],[80,20],[68,25]],
  // 호주
  [[113,-22],[122,-18],[130,-12],[137,-12],[142,-11],[145,-17],[150,-22],
   [153,-28],[150,-34],[145,-38],[140,-38],[135,-35],[129,-32],[122,-34],[115,-33],[113,-26],[113,-22]],
];

// ---------------------------------------------------------------------------
// 다이빙 스팟 8곳 — 실제 위/경도 기반, 난이도(목표 수심) 순.
// zone은 기존 zones.js 4구역과 매핑(레벨 진행 시 배경/생물 스폰에 사용 예정).
export const DIVE_SITES = [
  { id: 'gbr', name: '그레이트배리어리프', place: '호주', lat: -18.28, lon: 147.70, targetDepth: 200, zone: 'shallow' },
  { id: 'bluehole', name: '블루홀', place: '벨리즈', lat: 17.32, lon: -87.53, targetDepth: 400, zone: 'twilight' },
  { id: 'palau', name: '저먼 채널 · 블루코너', place: '팔라우', lat: 7.13, lon: 134.22, targetDepth: 700, zone: 'twilight' },
  { id: 'redsea', name: '홍해', place: '이집트', lat: 27.73, lon: 34.25, targetDepth: 1000, zone: 'deepsea' },
  { id: 'philtrench', name: '필리핀 해구', place: '필리핀', lat: 10.0, lon: 126.6, targetDepth: 1600, zone: 'deepsea' },
  { id: 'tongatrench', name: '통가 해구', place: '통가', lat: -23.0, lon: -174.75, targetDepth: 3000, zone: 'deepsea' },
  { id: 'prtrench', name: '푸에르토리코 해구', place: '대서양', lat: 19.8, lon: -66.75, targetDepth: 5000, zone: 'vent' },
  { id: 'mariana', name: '마리아나 해구 · 챌린저 딥', place: '태평양', lat: 11.35, lon: 142.2, targetDepth: 10935, zone: 'vent' },
];

// ---------------------------------------------------------------------------
export function createGlobeState() {
  return {
    rotLon: 145 * DEG, // 태평양 다이빙 스팟들이 잘 보이는 초기 시점
    rotLat: 16 * DEG,
    spinVel: 0.15 * DEG, // 유휴 상태에서 천천히 자동 회전 (초당 라디안)
  };
}

// 위/경도 → 화면 좌표 + 깊이(z, 정면일수록 1에 가까움) + 크기 배율
export function project(lon, lat, rotLon, rotLat, R, cx, cy) {
  const lambda = lon * DEG - rotLon;
  const phi = lat * DEG;
  const cosPhi = Math.cos(phi), sinPhi = Math.sin(phi);
  const cosL = Math.cos(lambda), sinL = Math.sin(lambda);
  const cosT = Math.cos(rotLat), sinT = Math.sin(rotLat);
  const x = cosPhi * sinL;
  const y = cosT * sinPhi - sinT * cosPhi * cosL;
  const z = sinT * sinPhi + cosT * cosPhi * cosL;
  return { x: cx + R * x, y: cy - R * y, z, scale: 0.5 + 0.5 * Math.max(0, z) };
}

function drawGraticuleLine(ctx, kind, value, rotLon, rotLat, R, cx, cy) {
  ctx.beginPath();
  let started = false;
  const steps = 48;
  for (let i = 0; i <= steps; i++) {
    let lon, lat;
    if (kind === 'meridian') { lat = -90 + (180 * i) / steps; lon = value; }
    else { lon = -180 + (360 * i) / steps; lat = value; }
    const p = project(lon, lat, rotLon, rotLat, R, cx, cy);
    if (p.z > 0.015) {
      if (!started) { ctx.moveTo(p.x, p.y); started = true; } else ctx.lineTo(p.x, p.y);
    } else {
      started = false;
    }
  }
  ctx.stroke();
}

function drawContinentPolygons(ctx, rotLon, rotLat, R, cx, cy) {
  ctx.fillStyle = '#3f9760';
  ctx.strokeStyle = 'rgba(20,50,25,0.55)';
  ctx.lineWidth = 1;
  for (const poly of CONTINENTS) {
    const pts = poly
      .map(([lon, lat]) => project(lon, lat, rotLon, rotLat, R, cx, cy))
      .filter(p => p.z > 0.02);
    if (pts.length < 3) continue;
    ctx.beginPath();
    pts.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

// 지구본 전체를 그린다 — 구체 셰이딩(라디얼 그라디언트) + 경위선 + 대륙 실루엣 + 림 하이라이트.
// opts.dimUnvisited 등은 이후 단계(핀 상태 표시)에서 확장 예정.
export function drawGlobe(ctx, cx, cy, R, globeState) {
  const { rotLon, rotLat } = globeState;

  ctx.save();

  // 구체 뒤 은은한 아우라(대기광)
  const aura = ctx.createRadialGradient(cx, cy, R * 0.92, cx, cy, R * 1.22);
  aura.addColorStop(0, 'rgba(120, 210, 255, 0.35)');
  aura.addColorStop(1, 'rgba(120, 210, 255, 0)');
  ctx.fillStyle = aura;
  ctx.beginPath(); ctx.arc(cx, cy, R * 1.22, 0, Math.PI * 2); ctx.fill();

  // 구체 베이스 (좌상단 광원 가정 라디얼 그라디언트로 입체감)
  const grad = ctx.createRadialGradient(cx - R * 0.38, cy - R * 0.42, R * 0.08, cx, cy, R * 1.05);
  grad.addColorStop(0, '#cdf3ff');
  grad.addColorStop(0.45, '#5fb8d9');
  grad.addColorStop(0.8, '#1c6e8f');
  grad.addColorStop(1, '#0a3247');
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();

  // 이후 그리는 모든 표면 요소(경위선/대륙)는 구체 원 밖으로 새어나가지 않도록 클리핑
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();

  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 1;
  for (let lon = -150; lon <= 180; lon += 30) drawGraticuleLine(ctx, 'meridian', lon, rotLon, rotLat, R, cx, cy);
  for (let lat = -60; lat <= 60; lat += 30) drawGraticuleLine(ctx, 'parallel', lat, rotLon, rotLat, R, cx, cy);

  drawContinentPolygons(ctx, rotLon, rotLat, R, cx, cy);

  // 구체 그림자(우하단이 살짝 어둡게, 조명 방향과 반대쪽)
  const shadow = ctx.createRadialGradient(cx + R * 0.45, cy + R * 0.5, R * 0.1, cx, cy, R * 1.1);
  shadow.addColorStop(0, 'rgba(0,0,0,0.28)');
  shadow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = shadow;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();

  ctx.restore(); // 클리핑 해제

  // 테두리 림 라이트 (구체 윤곽을 또렷하게)
  ctx.strokeStyle = 'rgba(220,245,255,0.55)';
  ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();

  ctx.restore();
}

// ---------------------------------------------------------------------------
// 드래그로 경도(좌우)/위도(상하, 제한적) 회전. 손을 떼면 관성 없이 정지(단순화).
export function attachGlobeDrag(canvasEl, globeState, opts = {}) {
  const ROT_SPEED = opts.rotSpeed ?? 0.0062;
  let dragging = false;
  let lastX = 0, lastY = 0;

  function toLocal(e) {
    const rect = canvasEl.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvasEl.width / rect.width),
      y: (e.clientY - rect.top) * (canvasEl.height / rect.height),
    };
  }

  const onDown = (e) => {
    dragging = true;
    globeState.dragging = true;
    lastX = e.clientX; lastY = e.clientY;
    canvasEl.setPointerCapture(e.pointerId);
  };
  const onMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX; lastY = e.clientY;
    globeState.rotLon -= dx * ROT_SPEED;
    globeState.rotLat = clamp(globeState.rotLat + dy * ROT_SPEED, -70 * DEG, 70 * DEG);
  };
  const onUp = () => { dragging = false; globeState.dragging = false; };

  canvasEl.addEventListener('pointerdown', onDown);
  canvasEl.addEventListener('pointermove', onMove);
  canvasEl.addEventListener('pointerup', onUp);
  canvasEl.addEventListener('pointercancel', onUp);
  canvasEl.addEventListener('pointerleave', onUp);

  return { toLocal };
}

// 유휴 상태(드래그 중이 아닐 때) 천천히 자동 회전 — game.js/globe 화면 루프에서 dtSec과 함께 호출
export function updateGlobeIdleSpin(globeState, dtSec) {
  if (globeState.dragging) return;
  globeState.rotLon += globeState.spinVel * dtSec;
}

// ---------------------------------------------------------------------------
// 진행 상황 저장(localStorage) — 클리어한 다이빙 스팟 id 집합
const STORAGE_KEY = 'deepdiver.progress.v1';

export function loadClearedSet() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return new Set(arr);
  } catch (e) {
    // 손상된 저장값/프라이빗 모드 등은 조용히 빈 진행상황으로 대체
  }
  return new Set();
}

export function saveClearedSet(clearedSet) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(clearedSet)));
  } catch (e) {
    // localStorage를 쓸 수 없는 환경(프라이빗 모드 등) — 진행은 메모리상으로만 유지됨
  }
}

// 인덱스 0(첫 레벨)은 항상 열려 있고, 이후는 "바로 앞 레벨을 클리어했는가"로 잠금 해제된다.
export function isSiteUnlocked(index, clearedSet, sites) {
  if (index <= 0) return true;
  return clearedSet.has(sites[index - 1].id);
}

// ---------------------------------------------------------------------------
// 다이빙 스팟들을 현재 회전각 기준으로 투영해 좌표/깊이/가시성을 계산.
// 그리기(drawPins)와 탭 히트테스트(hitTestPins)가 같은 투영 결과를 재사용한다.
export function projectSites(cx, cy, R, globeState, sites) {
  return sites.map((site, index) => {
    const p = project(site.lon, site.lat, globeState.rotLon, globeState.rotLat, R, cx, cy);
    return { site, index, x: p.x, y: p.y, z: p.z, scale: p.scale, visible: p.z > 0.02 };
  });
}

// 핀 마커 그리기 — 잠김(회색+자물쇠) / 도전 가능(발광 핀) / 클리어(초록+체크) 3상태.
export function drawPins(ctx, projected, clearedSet, sites) {
  for (const p of projected) {
    if (!p.visible) continue;
    const unlocked = isSiteUnlocked(p.index, clearedSet, sites);
    const cleared = clearedSet.has(p.site.id);
    const s = Math.max(0.35, p.scale);
    ctx.save();
    ctx.translate(p.x, p.y);

    if (unlocked && !cleared) {
      // 도전 가능한 핀은 은은한 발광 링으로 시선을 끈다
      const glowR = 11 * s;
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, glowR);
      g.addColorStop(0, 'rgba(255,224,120,0.55)');
      g.addColorStop(1, 'rgba(255,224,120,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, 0, glowR, 0, Math.PI * 2); ctx.fill();
    }

    const color = !unlocked ? '#7a8593' : cleared ? '#3fe08a' : '#ffd34d';
    ctx.beginPath();
    ctx.arc(0, 0, 5.2 * s, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#16233B';
    ctx.lineWidth = 1.4 * s;
    ctx.stroke();

    ctx.font = `${8 * s}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (!unlocked) {
      ctx.fillText('🔒', 0, 0.5 * s);
    } else if (cleared) {
      ctx.fillStyle = '#16233B';
      ctx.font = `700 ${7 * s}px sans-serif`;
      ctx.fillText('✓', 0, 0.5 * s);
    }
    ctx.restore();
  }
}

// 탭 좌표(캔버스 로컬 px)에 가장 가까운 핀을 찾는다. 못 찾으면 null.
export function hitTestPins(projected, x, y) {
  let best = null, bestD = Infinity;
  for (const p of projected) {
    if (!p.visible) continue;
    const r = 10 * Math.max(0.35, p.scale) + 6; // 손가락 탭 여유를 위해 실제 반경보다 넉넉하게
    const d = Math.hypot(x - p.x, y - p.y);
    if (d < r && d < bestD) { bestD = d; best = p; }
  }
  return best;
}
