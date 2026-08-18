// globe.js — 레벨 선택용 2D 근사 3D 지구본 (Canvas 2D, WebGL 아님)
// 정투영(orthographic projection) 근사로 구체감을 낸다: 위/경도 좌표를 시점 회전각
// 기준으로 x,y,z(정면 방향 깊이)로 변환하고, z<0(뒷면)인 점은 숨긴다.
// 핀은 z값에 비례해 크기를 줄여 "뒤로 갈수록 작아지는" 원근감을 흉내낸다.

import { clamp, hash2 } from './utils.js';
import { WORLD } from './worlddata.js';
import { FLAGS, drawFlag } from './flagspecs.js';

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
// 다이빙 스팟 8곳 — 실제 위/경도 기반, 난이도(목표 수심) 순.
// zone은 기존 zones.js 4구역과 매핑(레벨 진행 시 배경/생물 스폰에 사용 예정).
// 각 스팟의 theme: 기존 zone 룩 위에 얹는 스팟 고유 분위기 레이어.
// { tint/tintK: 물 색조(zone 그라디언트 색과 lerp), wall: 벽 팔레트/장식 오버라이드,
//   signature: 특수 연출 키('current'|'shipwreck'|'volcano'|'void'),
//   driftX: 해류 드리프트(px/s), lampColor: 헤드램프 글로우 색,
//   spawnBias: 종별 스폰 가중 배율, terrainGapMul/spawnSlowMul: 밀도 계수 }
// ?depth= 개발 모드는 theme 없이 기존 zone 룩 그대로 동작한다.
export const DIVE_SITES = [
  {
    id: 'jeju', name: '제주 문섬', place: '대한민국', lat: 33.22, lon: 126.57, targetDepth: 40, zone: 'shallow',
    theme: { // 연산호의 바다 — 분홍/보라 연산호 군락, 온화한 청록
      tint: '#3fa8c0', tintK: 0.15,
      wall: {
        decorDensity: 1.6,
        decor: {
          anemones: [
            { base: '#c94a8e', tentacle: '#f08ac0', tip: '#ffd8ec' },
            { base: '#8a4ac0', tentacle: '#b88ae8', tip: '#e8d8ff' },
          ],
          coral: { branch: '#d05a92', tip: '#f0a0c8' },
          starfish: ['#e0566a', '#c04ab0'],
        },
      },
      spawnBias: { damselfish: 2, softcoral: 1.5 },
    },
  },
  {
    id: 'okinawa', name: '케라마 제도', place: '일본 오키나와', lat: 26.2, lon: 127.3, targetDepth: 50, zone: 'shallow',
    theme: { // 투명한 열대 산호초 — 밝고 화사한 물빛
      tint: '#4fd0d8', tintK: 0.15,
      wall: { decorDensity: 1.4 },
      spawnBias: { napoleonfish: 2, clownfish: 2, ribboneel: 1.5 },
    },
  },
  {
    id: 'silfra', name: '실프라 협곡', place: '아이슬란드', lat: 64.26, lon: -21.12, targetDepth: 60, zone: 'shallow',
    theme: { // 대륙판 틈새의 빙하수 — 수정처럼 투명, 창백한 암벽, 한적함
      tint: '#9fe8ff', tintK: 0.35,
      wall: { fg: '#7da8b8', bg: '#4a6a78', accent: '#d8f4ff', decorDensity: 0.25 },
      spawnSlowMul: 1.5,
      spawnBias: { arcticchar: 3 },
    },
  },
  {
    id: 'similan', name: '시밀란 제도', place: '태국', lat: 8.65, lon: 97.64, targetDepth: 70, zone: 'shallow',
    theme: { // 화강암 바위산과 거북의 바다
      tint: '#3fc0a8', tintK: 0.18,
      wall: { fg: '#8a8ea0', bg: '#5a5e70', accent: '#e8c05a', decorDensity: 1.2 },
      spawnBias: { seaturtle: 3, reefshark: 2 },
    },
  },
  {
    id: 'maldives', name: '몰디브 환초', place: '몰디브', lat: 3.2, lon: 73.0, targetDepth: 80, zone: 'shallow',
    theme: { // 만타의 활공로 — 쪽빛 환초
      tint: '#2f9ed8', tintK: 0.2,
      wall: { decorDensity: 1.2 },
      spawnBias: { mantaray: 2.5, whaleshark: 2 },
    },
  },
  {
    id: 'rajaampat', name: '라자암팟', place: '인도네시아', lat: -0.5, lon: 130.5, targetDepth: 100, zone: 'twilight',
    theme: { // 세계 최고 생물다양성 — 산호 최대 밀도
      tint: '#3fb890', tintK: 0.2,
      wall: {
        decorDensity: 2.2,
        decor: {
          anemones: [
            { base: '#c93f7e', tentacle: '#ff7fc4', tip: '#ffe0f0' },
            { base: '#2f9e6a', tentacle: '#6ad8a0', tip: '#d0ffe8' },
            { base: '#d9762a', tentacle: '#ffb15c', tip: '#ffe9c8' },
          ],
          coral: { branch: '#e05a3a', tip: '#ffb08a' },
          starfish: ['#e8452f', '#3f7ee0', '#e0862f'],
        },
      },
      spawnBias: { mandarinfish: 2, pygmyseahorse: 1.5, clownfish: 1.5, bluetang: 1.5 },
    },
  },
  {
    id: 'cenote', name: '유카탄 세노테', place: '멕시코', lat: 20.2, lon: -87.5, targetDepth: 120, zone: 'twilight',
    theme: { // 석회암 동굴 담수 — 종유석 줄무늬 벽 + 투명한 민물 청록
      tint: '#40e0c8', tintK: 0.32,
      wall: { fg: '#cfc0a0', bg: '#8a7a5e', accent: '#e8dcc0', stripes: true, decorDensity: 0.2 },
      spawnBias: { blindcavefish: 3 },
    },
  },
  {
    id: 'galapagos', name: '갈라파고스', place: '에콰도르', lat: -0.6, lon: -90.8, targetDepth: 180, zone: 'twilight',
    theme: { // 고유종의 천국 — 살짝 서늘한 훔볼트 해류빛
      tint: '#2a6a8a', tintK: 0.25,
      wall: { fg: '#5a5248', bg: '#38322c', accent: '#7a9e5a', decorDensity: 0.9 },
      spawnBias: { marineiguana: 2.5, galapagosshark: 2.5 },
    },
  },
  {
    id: 'gbr', name: '그레이트배리어리프', place: '호주', lat: -18.28, lon: 147.70, targetDepth: 200, zone: 'shallow',
    theme: { // 산호의 낙원 — 현행 표층 룩 유지 + 산호 장식 최대 밀도, 밝은 청록 기운
      tint: '#7fe8e0', tintK: 0.12,
      wall: { decorDensity: 1.9 },
      spawnBias: { clownfish: 3, seaturtle: 2.5, bluetang: 2 },
    },
  },
  {
    id: 'bluehole', name: '블루홀', place: '벨리즈', lat: 17.32, lon: -87.53, targetDepth: 400, zone: 'twilight',
    theme: { // 원형 석회암 싱크홀 — 창백한 석회암 벽 + 단층 줄무늬 + 코발트 블루 물
      tint: '#0d2f9e', tintK: 0.42,
      wall: { fg: '#cfc4a4', bg: '#7d7864', accent: '#b0a480', stripes: true, decorDensity: 0.6 },
      spawnBias: { reefshark: 4 },
    },
  },
  {
    id: 'palau', name: '저먼 채널 · 블루코너', place: '팔라우', lat: 7.13, lon: 134.22, targetDepth: 700, zone: 'twilight',
    theme: { // 해류의 통로 — 청록-보라 색조 + 부유물/기포가 한쪽으로 흐르는 조류 드리프트
      tint: '#4a3f9e', tintK: 0.28,
      wall: { decorDensity: 1.4 },
      signature: 'current', driftX: 26,
      spawnBias: { reefshark: 2.5, flyingfish: 2 },
    },
  },
  {
    id: 'redsea', name: '홍해', place: '이집트', lat: 27.73, lon: 34.25, targetDepth: 1000, zone: 'deepsea',
    theme: { // 난파선의 바다 — 따뜻한 기운의 남색 + 침몰선 실루엣 + 홍해 특유의 붉은 산호 장식
      tint: '#3a2a5e', tintK: 0.3,
      wall: {
        accent: '#e0566a',
        decor: {
          anemones: [
            { base: '#c93f5e', tentacle: '#ff7f9a', tip: '#ffe0e8' },
            { base: '#d95a3a', tentacle: '#ff9a6a', tip: '#ffe4d0' },
          ],
          coral: { branch: '#a04a5a', tip: '#e08a9a' },
          starfish: ['#e0455a', '#c73a50', '#e0662f'],
        },
        decorDensity: 1.3,
      },
      signature: 'shipwreck',
    },
  },
  {
    id: 'philtrench', name: '필리핀 해구', place: '필리핀', lat: 10.0, lon: 126.6, targetDepth: 1600, zone: 'deepsea',
    theme: { // 발광 생물의 바다 — 푸른 기운의 헤드램프 + 발광 종 스폰 대폭 가중
      tint: '#0a1430', tintK: 0.3,
      lampColor: '#cfe0ff',
      spawnBias: {
        lanternfish: 2.5, hatchetfish: 2, moonjelly: 2, barreleye: 2,
        anglerfish: 2.5, pelicaneel: 2, dragonfish: 2,
      },
    },
  },
  {
    id: 'tongatrench', name: '통가 해구', place: '통가', lat: -23.0, lon: -174.75, targetDepth: 3000, zone: 'deepsea',
    theme: { // 해저 화산호 — 검정+옅은 자주 색조, 극원경 하단의 희미한 붉은 화산 글로우
      tint: '#170a18', tintK: 0.45,
      signature: 'volcano',
    },
  },
  {
    id: 'prtrench', name: '푸에르토리코 해구', place: '대서양', lat: 19.8, lon: -66.75, targetDepth: 5000, zone: 'vent',
    theme: { // 대서양의 차가움 — 차가운 청록빛 암흑, 열수구 글로우도 청록으로
      tint: '#04222a', tintK: 0.5,
      wall: { fg: '#2a3438', bg: '#141c20', accent: '#4ad8d0' },
    },
  },
  {
    id: 'mariana', name: '마리아나 해구 · 챌린저 딥', place: '태평양', lat: 11.35, lon: 142.2, targetDepth: 10935, zone: 'vent',
    theme: { // 최심해 무(無)의 공간 — 가장 완전한 암흑, 지형/생물이 드문 고독한 최종 레벨
      tint: '#02030a', tintK: 0.6,
      signature: 'void',
      terrainGapMul: 2.4,  // 벽 간격 2.4배 — 허허벌판
      spawnSlowMul: 1.9,   // 생물 스폰 주기 1.9배 — 발광 생물조차 희귀
    },
  },
];

// ---------------------------------------------------------------------------
export function createGlobeState() {
  return {
    rotLon: 145 * DEG, // 태평양 다이빙 스팟들이 잘 보이는 초기 시점
    rotLat: 16 * DEG,
    spinVel: 0.15 * DEG, // 유휴 상태에서 천천히 자동 회전 (초당 라디안)
  };
}

// 위/경도 → 화면 좌표 + 깊이(z) + 크기 배율.
// 중요: 이 투영은 아래 스트립 워핑(정투영-y 텍스처 + 세로 슬라이스)과 완전히 같은
// 수식이어야 핀이 나라 위에 정확히 선다 — 절대 한쪽만 바꾸지 말 것.
// 모델: x = cx + R·sin(Δλ), y = cy − R·sin(φ − φ0) — 위도 곡률(sin) 반영,
// 틸트(φ0=rotLat)는 뷰 중심 위도로 처리(텍스처도 같은 기준으로 리샘플됨).
export function project(lon, lat, rotLon, rotLat, R, cx, cy) {
  let dLon = lon * DEG - rotLon;
  dLon = ((dLon + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  const cosd = Math.cos(dLon);
  const visible = Math.abs(dLon) < Math.PI / 2;
  const x = cx + R * Math.sin(dLon);
  const y = cy - R * Math.sin(lat * DEG - rotLat);
  return { x, y, z: visible ? cosd : -1, scale: 0.5 + 0.5 * Math.max(0, cosd) };
}

// ---------------------------------------------------------------------------
// 세계지도 텍스처 — 로드 시 1회, 등장방형(2048x1024)에 바다+전 국가 국기 채움+국경 베이크.
const TEX_W = 2048, TEX_H = 1024;
let equiTexture = null;   // 등장방형 원본 (1회 베이크)
let orthoTexture = null;  // 정투영-y 리샘플 결과 (틸트 변경 시 재생성)
let orthoBuiltForLat = null;

function lonToTx(lon) { return ((lon + 180) / 360) * TEX_W; }
function latToTy(lat) { return ((90 - lat) / 180) * TEX_H; }

function buildGlobeTexture() {
  const cnv = document.createElement('canvas');
  cnv.width = TEX_W; cnv.height = TEX_H;
  const c = cnv.getContext('2d');

  // 바다 — 위도에 따른 그라데이션 (적도 청록 → 고위도 짙은 남색)
  const ocean = c.createLinearGradient(0, 0, 0, TEX_H);
  ocean.addColorStop(0, '#123a5e');
  ocean.addColorStop(0.28, '#1c5e8e');
  ocean.addColorStop(0.5, '#2578a8');
  ocean.addColorStop(0.72, '#1c5e8e');
  ocean.addColorStop(1, '#10324f');
  c.fillStyle = ocean;
  c.fillRect(0, 0, TEX_W, TEX_H);

  // 각 나라: 폴리곤 경로 → 클리핑 → 국기 채움(나라 전체 bbox 기준) → 이후 국경선
  const pathCountry = (rings) => {
    c.beginPath();
    for (const ring of rings) {
      for (let i = 0; i < ring.length; i += 2) {
        const px = lonToTx(ring[i] / 10);
        const py = latToTy(ring[i + 1] / 10);
        if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.closePath();
    }
  };

  for (const iso of Object.keys(WORLD)) {
    const rings = WORLD[iso];
    // 나라 전체 bbox (군도도 국기 레이아웃 공유)
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const ring of rings) {
      for (let i = 0; i < ring.length; i += 2) {
        const px = lonToTx(ring[i] / 10), py = latToTy(ring[i + 1] / 10);
        if (px < minX) minX = px; if (px > maxX) maxX = px;
        if (py < minY) minY = py; if (py > maxY) maxY = py;
      }
    }
    c.save();
    pathCountry(rings);
    c.clip();
    drawFlag(c, FLAGS[iso], minX, minY, Math.max(1, maxX - minX), Math.max(1, maxY - minY));
    c.restore();
  }

  // 채도 살짝 다운 — 국기 모자이크가 원거리에서 노이즈처럼 보이지 않게 톤 통일
  c.fillStyle = 'rgba(120,150,175,0.14)';
  c.fillRect(0, 0, TEX_W, TEX_H);

  // 국경선 (살짝 어둡게) — 채도 다운 이후에 그려 또렷하게
  c.strokeStyle = 'rgba(8,18,28,0.55)';
  c.lineWidth = 1.1;
  c.lineJoin = 'round';
  for (const iso of Object.keys(WORLD)) {
    pathCountry(WORLD[iso]);
    c.stroke();
  }

  // 위선/경선 (희미하게, 텍스처에 베이크 — 매 프레임 비용 0)
  c.strokeStyle = 'rgba(255,255,255,0.1)';
  c.lineWidth = 1;
  for (let lon = -150; lon <= 180; lon += 30) {
    c.beginPath(); c.moveTo(lonToTx(lon), 0); c.lineTo(lonToTx(lon), TEX_H); c.stroke();
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    c.beginPath(); c.moveTo(0, latToTy(lat)); c.lineTo(TEX_W, latToTy(lat)); c.stroke();
  }
  return cnv;
}

// 정투영-y 리샘플: 출력 행 y'가 화면 y_norm = 1 − 2y'/H = sin(φ − φ0)에 대응하는
// 등장방형 소스 행에서 오도록 세로만 다시 매핑한다 — 위도 곡률(극지방 수축)이
// 여기서 생기고, 매 프레임 스트립은 가로 워핑만 하면 된다.
// φ0(뷰 중심 위도)가 바뀌면 재생성해야 하므로 임계값(0.75°)으로 스로틀.
const ORTHO_BAND = 2; // 리샘플 세로 밴드(px) — 512회 drawImage, 수 ms
function ensureOrthoTexture(rotLat) {
  const latDeg = rotLat / DEG;
  if (orthoTexture && orthoBuiltForLat !== null && Math.abs(latDeg - orthoBuiltForLat) < 0.75) return;
  if (!equiTexture) equiTexture = buildGlobeTexture();
  if (!orthoTexture) {
    orthoTexture = document.createElement('canvas');
    orthoTexture.width = TEX_W;
    orthoTexture.height = TEX_H;
  }
  const c = orthoTexture.getContext('2d');
  c.clearRect(0, 0, TEX_W, TEX_H);
  for (let ty = 0; ty < TEX_H; ty += ORTHO_BAND) {
    const yNorm = 1 - (2 * (ty + ORTHO_BAND / 2)) / TEX_H; // 화면 위 +1 … 아래 -1
    const phiDeg = latDeg + Math.asin(clamp(yNorm, -1, 1)) / DEG;
    // 극 너머(|φ|>90)는 극 가장자리 행을 그대로 늘려 극지 색으로 채움
    const sy = clamp(((90 - phiDeg) / 180) * TEX_H, 0, TEX_H - 1);
    c.drawImage(equiTexture, 0, sy, TEX_W, 1, 0, ty, TEX_W, ORTHO_BAND);
  }
  orthoBuiltForLat = latDeg;
}

// 스트립 워핑 — 구체를 세로 슬라이스로 근사해 텍스처를 입힌다 (고전 fake-3D spin).
// 세로는 정투영-y 텍스처가 이미 맞으므로 모든 스트립이 전체 높이 2R로 그려지고,
// 구체 원 클리핑이 가장자리를 잘라 구면 실루엣을 만든다.
// 슬라이스를 "화면 x 2px 간격"으로 잡아 가장자리에서도 높이 변화가 매끄럽다
// (균등 Δλ 슬라이스는 가장자리에서 계단이 생김). R=153 기준 ~153회 drawImage.
const SLICE_PX = 2;
function drawGlobeTextureWarped(ctx, cx, cy, R, rotLon, rotLat) {
  ensureOrthoTexture(rotLat);
  const rotLonDeg = rotLon / DEG;
  const dy = cy - R;
  const h = 2 * R;
  for (let sx = -R; sx < R; sx += SLICE_PX) {
    const a0 = Math.asin(clamp(sx / R, -1, 1)) / DEG;
    const a1 = Math.asin(clamp((sx + SLICE_PX) / R, -1, 1)) / DEG;
    const x0 = cx + sx;
    // 소스 경도 → 텍스처 u (랩어라운드: 심 걸치면 두 번에 나눠 그림)
    const lon0 = rotLonDeg + a0;
    const u0 = ((lon0 + 180) % 360 + 360) % 360 / 360 * TEX_W;
    const uw = Math.max(0.5, ((a1 - a0) / 360) * TEX_W);
    if (u0 + uw <= TEX_W) {
      ctx.drawImage(orthoTexture, u0, 0, uw, TEX_H, x0, dy, SLICE_PX, h);
    } else {
      const w1 = TEX_W - u0;
      const frac = w1 / uw;
      ctx.drawImage(orthoTexture, u0, 0, w1, TEX_H, x0, dy, SLICE_PX * frac, h);
      ctx.drawImage(orthoTexture, 0, 0, uw - w1, TEX_H, x0 + SLICE_PX * frac - 0.3, dy, SLICE_PX * (1 - frac) + 0.3, h);
    }
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

  // 구체 베이스 — 텍스처가 못 덮는 극지 틈을 채우는 바다색
  const base = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.1, cx, cy, R * 1.02);
  base.addColorStop(0, '#2578a8');
  base.addColorStop(1, '#0a3247');
  ctx.fillStyle = base;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();

  // 표면: 세계지도 텍스처(국기 모자이크) 스트립 워핑 — 구체 원으로 클리핑
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
  drawGlobeTextureWarped(ctx, cx, cy, R, rotLon, rotLat);

  // 구면 셰이딩 1: 좌상단 광원 하이라이트 (은은한 스페큘러)
  const lightG = ctx.createRadialGradient(cx - R * 0.42, cy - R * 0.46, R * 0.05, cx - R * 0.2, cy - R * 0.2, R * 1.0);
  lightG.addColorStop(0, 'rgba(255,255,255,0.32)');
  lightG.addColorStop(0.35, 'rgba(255,255,255,0.1)');
  lightG.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = lightG;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();

  // 구면 셰이딩 2: 우하단 그림자 (조명 반대쪽 감쇠)
  const shadow = ctx.createRadialGradient(cx + R * 0.45, cy + R * 0.5, R * 0.1, cx, cy, R * 1.1);
  shadow.addColorStop(0, 'rgba(0,0,0,0.34)');
  shadow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = shadow;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();

  // 구면 셰이딩 3: 가장자리 감쇠(구형 볼륨감) — 가장자리로 갈수록 어둡게
  const edge = ctx.createRadialGradient(cx, cy, R * 0.62, cx, cy, R);
  edge.addColorStop(0, 'rgba(0,0,0,0)');
  edge.addColorStop(0.8, 'rgba(4,10,20,0.18)');
  edge.addColorStop(1, 'rgba(4,10,20,0.44)');
  ctx.fillStyle = edge;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();

  ctx.restore(); // 클리핑 해제

  // 테두리 림 라이트 (구체 윤곽을 또렷하게)
  ctx.strokeStyle = 'rgba(220,245,255,0.6)';
  ctx.lineWidth = 1.6;
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
    globeState.rotLat = clamp(globeState.rotLat + dy * ROT_SPEED, -45 * DEG, 45 * DEG);
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
// 추가 규칙(1.1에서 중간에 새 스팟이 끼어든 것 대비): 본인 또는 더 뒤의 스팟을 이미
// 클리어했다면 그 앞은 전부 열린 것으로 본다 — 기존 진행자가 퇴행하지 않게.
export function isSiteUnlocked(index, clearedSet, sites) {
  if (index <= 0) return true;
  if (clearedSet.has(sites[index - 1].id) || clearedSet.has(sites[index].id)) return true;
  for (let i = index + 1; i < sites.length; i++) {
    if (clearedSet.has(sites[i].id)) return true;
  }
  return false;
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

// 핀 머리(원형 부분) 중심의 로컬 y 오프셋 — 물방울 핀의 꼭지점이 스팟 좌표에 닿고
// 머리는 그 위에 떠 있는 구조. 그리기와 히트테스트가 같은 값을 써야 한다.
const PIN_HEAD_R = 9;
const PIN_HEAD_DY = -15;

// 핀 마커 그리기 — 구글맵식 물방울(teardrop) 핀, 3상태:
// 잠김(회색+자물쇠) / 도전 가능(노랑+레벨 번호+펄스 글로우) / 클리어(초록+체크).
// timeSec은 도전 가능 핀의 펄스 애니메이션용 (생략 시 정적).
export function drawPins(ctx, projected, clearedSet, sites, timeSec = 0) {
  for (const p of projected) {
    if (!p.visible) continue;
    const unlocked = isSiteUnlocked(p.index, clearedSet, sites);
    const cleared = clearedSet.has(p.site.id);
    const s = Math.max(0.5, p.scale);
    const headR = PIN_HEAD_R * s;
    const headY = PIN_HEAD_DY * s;
    ctx.save();
    ctx.translate(p.x, p.y);

    if (unlocked && !cleared) {
      // 도전 가능한 핀: 펄스 발광 링으로 시선 유도
      const pulse = 1 + Math.sin(timeSec * 3 + p.index) * 0.18;
      const glowR = headR * 2 * pulse;
      const g = ctx.createRadialGradient(0, headY, 0, 0, headY, glowR);
      g.addColorStop(0, 'rgba(255,224,120,0.55)');
      g.addColorStop(1, 'rgba(255,224,120,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, headY, glowR, 0, Math.PI * 2); ctx.fill();
    }

    const color = !unlocked ? '#7a8593' : cleared ? '#3fe08a' : '#ffd34d';
    // 물방울 핀: 원형 머리 + 스팟 좌표(0,0)로 모이는 꼬리
    ctx.beginPath();
    ctx.arc(0, headY, headR, Math.PI * 0.82, Math.PI * 0.18, false);
    ctx.quadraticCurveTo(headR * 0.55, headY + headR * 0.9, 0, 0); // 오른쪽 → 꼭지점
    ctx.quadraticCurveTo(-headR * 0.55, headY + headR * 0.9, -headR * Math.cos(Math.PI * 0.18), headY + headR * Math.sin(Math.PI * 0.18));
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#16233B';
    ctx.lineWidth = 1.6 * s;
    ctx.stroke();

    // 머리 안 흰 원판 + 상태 표시(레벨 번호/자물쇠/체크)
    ctx.beginPath();
    ctx.arc(0, headY, headR * 0.62, 0, Math.PI * 2);
    ctx.fillStyle = !unlocked ? 'rgba(230,235,242,0.85)' : '#ffffff';
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (!unlocked) {
      ctx.font = `${9 * s}px sans-serif`;
      ctx.fillText('🔒', 0, headY + 0.5 * s);
    } else if (cleared) {
      ctx.fillStyle = '#1d7a4c';
      ctx.font = `700 ${10 * s}px sans-serif`;
      ctx.fillText('✓', 0, headY + 0.5 * s);
    } else {
      ctx.fillStyle = '#16233B';
      ctx.font = `700 ${9.5 * s}px sans-serif`;
      ctx.fillText(String(p.index + 1), 0, headY + 0.5 * s);
    }
    ctx.restore();
  }
}

// 탭 좌표(캔버스 로컬 px)에 가장 가까운 핀을 찾는다. 못 찾으면 null.
// 물방울 핀의 "머리" 중심 기준으로 판정하고, 손가락 탭 여유를 넉넉히 준다.
export function hitTestPins(projected, x, y) {
  let best = null, bestD = Infinity;
  for (const p of projected) {
    if (!p.visible) continue;
    const s = Math.max(0.5, p.scale);
    const r = PIN_HEAD_R * s + 10;
    const d = Math.hypot(x - p.x, y - (p.y + PIN_HEAD_DY * s));
    if (d < r && d < bestD) { bestD = d; best = p; }
  }
  return best;
}
