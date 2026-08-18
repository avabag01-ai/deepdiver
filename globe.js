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
    rotLat: GLOBE_TILT, // 고정 틸트 (변경 금지 — LUT/project와 결합)
    spinVel: 0.15 * DEG, // 유휴 상태에서 천천히 자동 회전 (초당 라디안)
    zoom: 1,            // 1.0 ~ 2.5 (핀치/휠)
    zoomChangedAt: 0,   // LUT 재계산 디바운스 기준 시각
  };
}

// 고정 틸트(내려다보는 시점) — "책상 위 지구본" 느낌. 드래그는 경도 회전만.
// LUT가 이 값 기준으로 사전 계산되므로 런타임에 바꾸면 안 됨.
export const GLOBE_TILT = 20 * DEG;

// 위/경도 → 화면 좌표 + 깊이(z) + 크기 배율. 진짜 정투영(orthographic):
//   x = R·cosφ·sin(Δλ),  y = R·(cosφ0·sinφ − sinφ0·cosφ·cosΔλ)
// 아래 픽셀 LUT 역투영과 정확히 같은 공식 — 핀 정합을 위해 한쪽만 바꾸지 말 것.
export function project(lon, lat, rotLon, rotLat, R, cx, cy) {
  const phi0 = GLOBE_TILT; // rotLat 파라미터는 호환용 — 틸트는 고정
  const lambda = lon * DEG - rotLon;
  const phi = lat * DEG;
  const cosPhi = Math.cos(phi), sinPhi = Math.sin(phi);
  const cosL = Math.cos(lambda), sinL = Math.sin(lambda);
  const cosT = Math.cos(phi0), sinT = Math.sin(phi0);
  const x = cosPhi * sinL;
  const y = cosT * sinPhi - sinT * cosPhi * cosL;
  const z = sinT * sinPhi + cosT * cosPhi * cosL;
  return { x: cx + R * x, y: cy - R * y, z, scale: 0.5 + 0.5 * Math.max(0, z) };
}

// ---------------------------------------------------------------------------
// 세계지도 텍스처 — 로드 시 1회, 등장방형(2048x1024)에 바다+전 국가 국기 채움+국경 베이크.
const TEX_W = 4096, TEX_H = 2048; // 줌 2.5x에서도 뭉개지지 않게 상향 (RGBA 32MB)
let equiTexture = null;   // 등장방형 원본 (1회 베이크)

// 실제 지형 음영기복 + 해저 지형 (Natural Earth GRAY_50M_SR_OB 다운샘플, 퍼블릭 도메인).
// 육지 hillshade(북서광)와 바다 수심 셰이딩(해구=어두운 골)이 한 장에 담겨 있다.
// 비동기 로드라 첫 베이크에 늦으면 릴리프 없이 굽고, 로드 완료 시 재베이크한다.
const reliefImg = new Image();
reliefImg.src = 'relief.jpg';
reliefImg.onload = () => {
  if (equiTexture) {
    equiTexture = buildGlobeTexture();
    refreshSrcPixels();
  }
};

function refreshSrcPixels() {
  if (!equiTexture || typeof srcPixels === 'undefined' || srcPixels === null) return;
  const sc = equiTexture.getContext('2d');
  srcPixels = new Uint32Array(sc.getImageData(0, 0, TEX_W, TEX_H).data.buffer);
}

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

  // 바다 수심 셰이딩: 릴리프를 multiply로 강하게 — 대륙붕 밝고 해구는 거의 검은 골.
  // (육지 부분은 다음 단계의 불투명 국기가 덮으므로 여기선 바다만 영향)
  const reliefReady = reliefImg.complete && reliefImg.naturalWidth > 0;
  if (reliefReady) {
    c.save();
    c.globalCompositeOperation = 'multiply';
    c.globalAlpha = 0.62;
    c.drawImage(reliefImg, 0, 0, TEX_W, TEX_H);
    // 2차 패스: 해구의 어두운 골을 한 번 더 눌러 심도 대비 강조
    // (밝은 대륙붕은 거의 영향 없고, 검은 크리즈만 뚜렷해짐)
    c.globalAlpha = 0.45;
    c.drawImage(reliefImg, 0, 0, TEX_W, TEX_H);
    c.restore();
  }

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

  // 육지 음영기복: 국기 위에 저알파 합성 — 국기 가독성이 우선이라 약하게.
  // multiply(어두운 골) + overlay(밝은 능선) 조합으로 히말라야·안데스·로키가
  // 명암 굴곡으로 읽히게 한다.
  if (reliefReady) {
    c.save();
    c.globalCompositeOperation = 'multiply';
    c.globalAlpha = 0.28;
    c.drawImage(reliefImg, 0, 0, TEX_W, TEX_H);
    c.globalCompositeOperation = 'overlay';
    c.globalAlpha = 0.3;
    c.drawImage(reliefImg, 0, 0, TEX_W, TEX_H);
    c.restore();
  }

  // 국경선 (살짝 어둡게) — 채도 다운 이후에 그려 또렷하게
  c.strokeStyle = 'rgba(8,18,28,0.55)';
  c.lineWidth = 2; // 4096px 텍스처 기준
  c.lineJoin = 'round';
  for (const iso of Object.keys(WORLD)) {
    pathCountry(WORLD[iso]);
    c.stroke();
  }

  // 위선/경선 (희미하게, 텍스처에 베이크 — 매 프레임 비용 0)
  c.strokeStyle = 'rgba(255,255,255,0.1)';
  c.lineWidth = 1.6;
  for (let lon = -150; lon <= 180; lon += 30) {
    c.beginPath(); c.moveTo(lonToTx(lon), 0); c.lineTo(lonToTx(lon), TEX_H); c.stroke();
  }
  for (let lat = -60; lat <= 60; lat += 30) {
    c.beginPath(); c.moveTo(0, latToTy(lat)); c.lineTo(TEX_W, latToTy(lat)); c.stroke();
  }
  return cnv;
}

// 픽셀 LUT 역정투영 — 매 프레임 삼각함수 없이 진짜 정투영 지구본을 그린다.
// 틸트 φ0가 고정이므로 "화면 픽셀 → (위도 행, 상대 경도)" 매핑은 회전과 무관한 상수.
// 로드 시 1회 LUT를 만들고, 매 프레임은 경도 오프셋 덧셈 + 픽셀 복사만 한다.
// 성능 가드: 내부 해상도를 표시 지름의 절반으로 렌더 후 drawImage 업스케일.
const LON_STEPS = 4096; // 상대 경도 양자화 — TEX_W와 1:1 (& 마스크용 2^n)
let lut = null; // { size, texRowLut: Int32Array, lonLut: Uint16Array }
let srcPixels = null;   // 등장방형 텍스처의 Uint32 픽셀 버퍼
let outCanvas = null, outCtx = null, outImage = null, outPixels = null;

export let lutBuildMs = 0; // LUT 재계산 시간 실측 (성능 보고용)
function ensureLut(internalR) {
  const size = internalR * 2;
  if (lut && lut.size === size) return;
  const tBuild = performance.now();
  if (!equiTexture) equiTexture = buildGlobeTexture();
  // 소스 픽셀 버퍼 1회 추출
  const sc = equiTexture.getContext('2d');
  srcPixels = new Uint32Array(sc.getImageData(0, 0, TEX_W, TEX_H).data.buffer);

  const texRowLut = new Int32Array(size * size);
  const lonLut = new Uint16Array(size * size);
  const sinT = Math.sin(GLOBE_TILT), cosT = Math.cos(GLOBE_TILT);
  for (let iy = 0; iy < size; iy++) {
    const ny = (iy + 0.5 - internalR) / internalR; // 화면 아래 +
    const yUp = -ny;
    for (let ix = 0; ix < size; ix++) {
      const i = iy * size + ix;
      const nx = (ix + 0.5 - internalR) / internalR;
      const rho2 = nx * nx + yUp * yUp;
      if (rho2 > 1) { texRowLut[i] = -1; continue; }
      // 정투영 역변환 (단위구, sin c = ρ, cos c = sqrt(1-ρ²))
      const cosc = Math.sqrt(1 - rho2);
      const phi = Math.asin(clamp(cosc * sinT + yUp * cosT, -1, 1));
      const lamRel = Math.atan2(nx, cosc * cosT - yUp * sinT); // λ − λ0
      const texY = clamp(Math.round(((90 - phi / DEG) / 180) * (TEX_H - 1)), 0, TEX_H - 1);
      texRowLut[i] = texY * TEX_W;
      const lonFrac = (lamRel / (Math.PI * 2)) + 0.5; // 0..1 (λ0 기준 -180..180)
      lonLut[i] = Math.round(((lonFrac % 1) + 1) % 1 * LON_STEPS) & (LON_STEPS - 1);
    }
  }
  lut = { size, internalR, texRowLut, lonLut };
  lutBuildMs = performance.now() - tBuild;
  outCanvas = document.createElement('canvas');
  outCanvas.width = size; outCanvas.height = size;
  outCtx = outCanvas.getContext('2d');
  outImage = outCtx.createImageData(size, size);
  outPixels = new Uint32Array(outImage.data.buffer);
}

// 매 프레임: 경도 오프셋만 더해 텍스처 픽셀 복사 (픽셀당 덧셈+마스크+복사)
export let globeFrameMs = 0; // 성능 계측 (renderGlobeScreen에서 참조 가능)
function renderGlobePixels(rotLon) {
  const t0 = performance.now();
  const { size, texRowLut, lonLut } = lut;
  // λ0 오프셋: lonLut은 (λ−λ0) 기준이므로 λ = rel + λ0
  const lonOff = Math.round(((rotLon / (Math.PI * 2)) % 1 + 1) % 1 * LON_STEPS) & (LON_STEPS - 1);
  const n = size * size;
  for (let i = 0; i < n; i++) {
    const row = texRowLut[i];
    if (row < 0) { outPixels[i] = 0; continue; }
    const texX = (lonLut[i] + lonOff) & (LON_STEPS - 1); // TEX_W와 1:1
    outPixels[i] = srcPixels[row + texX];
  }
  outCtx.putImageData(outImage, 0, 0);
  globeFrameMs = performance.now() - t0;
}

function drawGlobeTextureWarped(ctx, cx, cy, R, rotLon, zoomChangedAt = 0) {
  const targetInternal = Math.max(60, Math.round(R * 0.65)); // 0.65배 해상도 → 업스케일
  // 줌 제스처 중(마지막 변경 후 120ms 이내)에는 LUT 재계산을 미루고
  // 기존 렌더 결과를 그냥 확대해서 그린다(약간 흐림 OK) — 끊김 없는 줌.
  const settled = performance.now() - zoomChangedAt > 120;
  if (!lut || (lut.internalR !== targetInternal && settled)) ensureLut(targetInternal);
  renderGlobePixels(rotLon);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(outCanvas, cx - R, cy - R, R * 2, R * 2);
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
  drawGlobeTextureWarped(ctx, cx, cy, R, rotLon, globeState.zoomChangedAt || 0);

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

  // 림 스트로크 없음 — 흰 외곽선이 구체감을 죽여서 제거, 가장자리 감쇠(셰이딩 3)가 윤곽을 대신함

  ctx.restore();
}

// ---------------------------------------------------------------------------
// 드래그로 경도(좌우)/위도(상하, 제한적) 회전. 손을 떼면 관성 없이 정지(단순화).
export function attachGlobeDrag(canvasEl, globeState, opts = {}) {
  const ROT_SPEED = opts.rotSpeed ?? 0.0062;
  const pointers = new Map(); // pointerId → {x,y}
  let lastX = 0;
  let pinchDist = 0;

  const setZoom = (z) => {
    globeState.zoom = clamp(z, 1, 2.5);
    globeState.zoomChangedAt = performance.now();
  };

  function toLocal(e) {
    const rect = canvasEl.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (canvasEl.width / rect.width),
      y: (e.clientY - rect.top) * (canvasEl.height / rect.height),
    };
  }

  canvasEl.addEventListener('pointerdown', (e) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      globeState.dragging = true;
      lastX = e.clientX;
    } else if (pointers.size === 2) {
      // 핀치 시작 — 회전 드래그 중단
      const [a, b] = [...pointers.values()];
      pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      globeState.dragging = false;
    }
    canvasEl.setPointerCapture(e.pointerId);
  });

  canvasEl.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    p.x = e.clientX; p.y = e.clientY;
    if (pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDist > 0 && d > 0) setZoom((globeState.zoom || 1) * (d / pinchDist));
      pinchDist = d;
    } else if (globeState.dragging) {
      const dx = e.clientX - lastX;
      lastX = e.clientX;
      // 줌 상태에선 화면상 같은 거리가 더 좁은 경도라 감도를 줌으로 나눔
      globeState.rotLon -= (dx * ROT_SPEED) / (globeState.zoom || 1);
      // 위도 틸트는 고정(GLOBE_TILT) — 픽셀 LUT가 틸트 기준 사전 계산이라 회전은 경도만
    }
  });

  const onUp = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchDist = 0;
    if (pointers.size === 1) {
      lastX = [...pointers.values()][0].x; // 남은 손가락 기준으로 회전 이어가기
      globeState.dragging = true;
    } else if (pointers.size === 0) {
      globeState.dragging = false;
    }
  };
  canvasEl.addEventListener('pointerup', onUp);
  canvasEl.addEventListener('pointercancel', onUp);
  canvasEl.addEventListener('pointerleave', onUp);

  // 데스크톱: 마우스 휠/트랙패드 줌
  canvasEl.addEventListener('wheel', (e) => {
    e.preventDefault();
    setZoom((globeState.zoom || 1) * Math.exp(-e.deltaY * 0.0018));
  }, { passive: false });

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

// ---------------------------------------------------------------------------
// 수심별 난이도 티어 — 일자 체인 대신 같은 티어 안에서는 자유 선택.
// 다음 티어는 이전 티어에서 need곳 클리어 시 개방(전부 깰 필요 없음, 과반 수준).
export const TIERS = [
  { id: 1, label: '얕은 바다', color: '#3fd0c8', need: 0 },  // 처음부터 전부 개방
  { id: 2, label: '중층',     color: '#3f8ee0', need: 3 },  // 1티어 3곳 클리어 시
  { id: 3, label: '심해',     color: '#5a5ae8', need: 3 },  // 2티어 3곳 클리어 시
  { id: 4, label: '초심해',   color: '#a45ae8', need: 2 },  // 3티어 2곳 클리어 시
];

// 목표 수심 → 티어 (0~100 / ~700 / ~3000 / 3000+)
export function tierOfSite(site) {
  const d = site.targetDepth;
  if (d <= 100) return 1;
  if (d <= 700) return 2;
  if (d <= 3000) return 3;
  return 4;
}

export function tierClearCount(tierId, clearedSet, sites) {
  return sites.filter(s => tierOfSite(s) === tierId && clearedSet.has(s.id)).length;
}

export function tierSiteCount(tierId, sites) {
  return sites.filter(s => tierOfSite(s) === tierId).length;
}

export function isTierUnlocked(tierId, clearedSet, sites) {
  if (tierId <= 1) return true;
  // 호환 규칙: 그 티어(또는 더 깊은 티어)를 이미 클리어한 기록이 있으면 개방 유지
  // — 구버전 일자 체인 저장에서 퇴행하지 않게.
  for (const s of sites) {
    if (tierOfSite(s) >= tierId && clearedSet.has(s.id)) return true;
  }
  const need = TIERS[tierId - 1].need;
  return tierClearCount(tierId - 1, clearedSet, sites) >= need;
}

export function isSiteUnlocked(index, clearedSet, sites) {
  return isTierUnlocked(tierOfSite(sites[index]), clearedSet, sites);
}

// 잠긴 스팟 안내: "○티어에서 △곳 더 클리어하면 열려요"
export function unlockHintFor(site, clearedSet, sites) {
  const t = tierOfSite(site);
  const prev = TIERS[t - 2]; // 이전 티어 정의
  const have = tierClearCount(t - 1, clearedSet, sites);
  const remain = Math.max(0, TIERS[t - 1].need - have);
  return { tier: TIERS[t - 1], prevTier: prev, remain };
}

// 다음 잠긴 티어 기준 진행 요약 (상단 표시용)
export function tierProgressSummary(clearedSet, sites) {
  for (let t = 2; t <= TIERS.length; t++) {
    if (!isTierUnlocked(t, clearedSet, sites)) {
      const prev = TIERS[t - 2];
      const have = tierClearCount(t - 1, clearedSet, sites);
      const remain = TIERS[t - 1].need - have;
      return `${prev.label} ${have}/${tierSiteCount(t - 1, sites)} 클리어 · ${TIERS[t - 1].label}까지 ${remain}곳`;
    }
  }
  return '모든 수심 개방됨 — 어디든 잠수하세요';
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
export function drawPins(ctx, projected, clearedSet, sites, timeSec = 0, zoom = 1) {
  for (const p of projected) {
    if (!p.visible) continue;
    const unlocked = isSiteUnlocked(p.index, clearedSet, sites);
    const cleared = clearedSet.has(p.site.id);
    const s = Math.max(0.5, p.scale) * Math.sqrt(zoom || 1); // 줌에 0.5 지수로만 비례
    const headR = PIN_HEAD_R * s;
    const headY = PIN_HEAD_DY * s;
    ctx.save();
    ctx.translate(p.x, p.y);

    const tier = TIERS[tierOfSite(p.site) - 1];
    if (unlocked && !cleared) {
      // 도전 가능한 핀: 티어 색 펄스 발광 링
      const pulse = 1 + Math.sin(timeSec * 3 + p.index) * 0.18;
      const glowR = headR * 2 * pulse;
      const g = ctx.createRadialGradient(0, headY, 0, 0, headY, glowR);
      g.addColorStop(0, tier.color + '99');
      g.addColorStop(1, tier.color + '00');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(0, headY, glowR, 0, Math.PI * 2); ctx.fill();
    }

    // 핀 색 = 티어 색 (잠김은 회색) — 수심 등급이 색만으로 읽히게
    const color = !unlocked ? '#7a8593' : tier.color;
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
export function hitTestPins(projected, x, y, zoom = 1) {
  let best = null, bestD = Infinity;
  for (const p of projected) {
    if (!p.visible) continue;
    const s = Math.max(0.5, p.scale) * Math.sqrt(zoom || 1);
    const r = PIN_HEAD_R * s + 10;
    const d = Math.hypot(x - p.x, y - (p.y + PIN_HEAD_DY * s));
    if (d < r && d < bestD) { bestD = d; best = p; }
  }
  return best;
}
