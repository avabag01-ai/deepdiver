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


// ---------------------------------------------------------------------------
// 다이빙 스팟이 있는 나라의 국기 표현 — 간략화된 나라 경계 폴리곤을 구면 투영해
// 그리고 내부를 국기 디자인으로 클리핑 채움. "아 저기가 그 나라구나" 수준의
// 단순화(요철 5~12점). 아주 작은 섬나라(몰디브·벨리즈·팔라우·통가)는 생략하고
// 핀으로만 표시한다.
// fill(ctx, b): b = 투영된 폴리곤의 화면 bbox {x,y,w,h} — 클리핑된 상태에서 호출됨.
const COUNTRY_FLAGS = [
  {
    id: 'KR', // 태극기 (흰 바탕 + 태극 원 단순화)
    poly: [[126.2, 37.8], [127.6, 38.3], [129.0, 38.6], [129.5, 36.5], [129.3, 35.2], [127.8, 34.6], [126.3, 34.5], [126.1, 36.2]],
    fill(ctx, b) {
      ctx.fillStyle = '#f2f2f2'; ctx.fillRect(b.x, b.y, b.w, b.h);
      const cxm = b.x + b.w / 2, cym = b.y + b.h / 2, r = Math.min(b.w, b.h) * 0.28;
      ctx.fillStyle = '#c8102e';
      ctx.beginPath(); ctx.arc(cxm, cym, r, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#003478';
      ctx.beginPath(); ctx.arc(cxm, cym, r, 0, Math.PI); ctx.fill();
    },
  },
  {
    id: 'JP', // 일장기
    poly: [[130.0, 31.3], [131.8, 33.2], [135.0, 34.2], [138.0, 34.8], [140.6, 35.4], [141.6, 39.0], [140.6, 41.5], [139.4, 38.2], [136.2, 36.2], [132.6, 35.0], [129.8, 33.0]],
    fill(ctx, b) {
      ctx.fillStyle = '#f2f2f2'; ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = '#bc002d';
      ctx.beginPath(); ctx.arc(b.x + b.w / 2, b.y + b.h / 2, Math.min(b.w, b.h) * 0.24, 0, Math.PI * 2); ctx.fill();
    },
  },
  {
    id: 'IS', // 아이슬란드 (파랑 + 흰/빨강 북유럽 십자)
    poly: [[-24.5, 65.5], [-22.0, 66.4], [-18.0, 66.5], [-14.5, 65.8], [-13.8, 64.6], [-16.5, 63.5], [-20.5, 63.4], [-22.7, 64.1]],
    fill(ctx, b) {
      ctx.fillStyle = '#02529c'; ctx.fillRect(b.x, b.y, b.w, b.h);
      const vx = b.x + b.w * 0.38, hy = b.y + b.h * 0.5;
      ctx.fillStyle = '#f2f2f2';
      ctx.fillRect(vx - b.w * 0.1, b.y, b.w * 0.2, b.h);
      ctx.fillRect(b.x, hy - b.h * 0.1, b.w, b.h * 0.2);
      ctx.fillStyle = '#dc1e35';
      ctx.fillRect(vx - b.w * 0.05, b.y, b.w * 0.1, b.h);
      ctx.fillRect(b.x, hy - b.h * 0.05, b.w, b.h * 0.1);
    },
  },
  {
    id: 'TH', // 태국 (빨-흰-파-흰-빨 가로줄)
    poly: [[98.4, 19.8], [100.8, 20.3], [101.2, 18.0], [102.6, 16.4], [102.2, 14.5], [100.6, 13.6], [99.2, 10.8], [98.6, 8.4], [98.2, 11.8], [99.4, 13.6], [98.0, 15.2], [97.8, 18.2]],
    fill(ctx, b) {
      const rows = [['#a51931', 0.17], ['#f4f5f8', 0.17], ['#2d2a4a', 0.32], ['#f4f5f8', 0.17], ['#a51931', 0.17]];
      let y = b.y;
      for (const [c, f] of rows) { ctx.fillStyle = c; ctx.fillRect(b.x, y, b.w, b.h * f + 1); y += b.h * f; }
    },
  },
  {
    id: 'ID', // 인도네시아 (위 빨강, 아래 흰색) — 군도라 큰 섬 두 개로 표현
    poly: [[95.5, 5.5], [102.5, 1.5], [106.0, -3.0], [110.5, -7.5], [115.0, -8.5], [114.0, -6.5], [108.5, -5.0], [104.5, -1.0], [98.5, 4.0]],
    fill(ctx, b) {
      ctx.fillStyle = '#ce1126'; ctx.fillRect(b.x, b.y, b.w, b.h / 2);
      ctx.fillStyle = '#f2f2f2'; ctx.fillRect(b.x, b.y + b.h / 2, b.w, b.h / 2);
    },
  },
  {
    id: 'MX', // 멕시코 (초-흰-빨 세로 3분할)
    poly: [[-117.0, 32.5], [-110.0, 31.2], [-104.0, 29.6], [-97.5, 26.0], [-97.2, 22.0], [-94.0, 18.4], [-90.4, 21.0], [-86.8, 21.4], [-89.2, 17.6], [-94.8, 16.2], [-104.8, 19.6], [-114.4, 27.6]],
    fill(ctx, b) {
      ctx.fillStyle = '#006847'; ctx.fillRect(b.x, b.y, b.w / 3, b.h);
      ctx.fillStyle = '#f2f2f2'; ctx.fillRect(b.x + b.w / 3, b.y, b.w / 3, b.h);
      ctx.fillStyle = '#ce1126'; ctx.fillRect(b.x + (b.w * 2) / 3, b.y, b.w / 3, b.h);
    },
  },
  {
    id: 'EC', // 에콰도르 (노-파-빨 가로, 노랑이 절반)
    poly: [[-80.9, 1.2], [-78.0, 1.3], [-75.4, -0.5], [-75.6, -3.5], [-79.6, -4.5], [-81.0, -2.4]],
    fill(ctx, b) {
      ctx.fillStyle = '#ffd100'; ctx.fillRect(b.x, b.y, b.w, b.h * 0.5);
      ctx.fillStyle = '#0072ce'; ctx.fillRect(b.x, b.y + b.h * 0.5, b.w, b.h * 0.25);
      ctx.fillStyle = '#ef3340'; ctx.fillRect(b.x, b.y + b.h * 0.75, b.w, b.h * 0.25);
    },
  },
  {
    id: 'AU', // 호주 (남색 + 남십자성 별 몇 개로 단순화)
    poly: [[113.5, -22.0], [114.5, -26.5], [118.0, -32.0], [124.0, -33.5], [129.5, -32.0], [135.5, -34.8], [138.5, -35.5], [141.0, -38.2], [146.5, -39.0], [150.0, -37.2], [153.0, -31.0], [152.5, -26.0], [148.5, -20.0], [145.5, -15.0], [141.5, -13.0], [137.0, -14.5], [132.0, -12.0], [126.5, -14.0], [122.0, -17.5], [117.0, -20.5]],
    fill(ctx, b) {
      ctx.fillStyle = '#00247d'; ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = '#f2f2f2';
      for (const [fx, fy, r] of [[0.72, 0.25, 0.045], [0.78, 0.5, 0.05], [0.68, 0.68, 0.045], [0.55, 0.45, 0.038], [0.3, 0.6, 0.06]]) {
        ctx.beginPath();
        ctx.arc(b.x + b.w * fx, b.y + b.h * fy, Math.max(1.1, Math.min(b.w, b.h) * r), 0, Math.PI * 2);
        ctx.fill();
      }
    },
  },
  {
    id: 'EG', // 이집트 (빨-흰-검 가로 + 금색 점)
    poly: [[25.0, 31.5], [32.0, 31.2], [34.2, 30.8], [34.9, 29.2], [34.2, 22.0], [25.0, 22.0]],
    fill(ctx, b) {
      ctx.fillStyle = '#ce1126'; ctx.fillRect(b.x, b.y, b.w, b.h / 3);
      ctx.fillStyle = '#f2f2f2'; ctx.fillRect(b.x, b.y + b.h / 3, b.w, b.h / 3);
      ctx.fillStyle = '#2b2b2b'; ctx.fillRect(b.x, b.y + (b.h * 2) / 3, b.w, b.h / 3);
      ctx.fillStyle = '#c09300';
      ctx.beginPath(); ctx.arc(b.x + b.w / 2, b.y + b.h / 2, Math.min(b.w, b.h) * 0.08, 0, Math.PI * 2); ctx.fill();
    },
  },
  {
    id: 'PH', // 필리핀 (흰 삼각 + 파랑/빨강 가로) — 루손 중심 단순화
    poly: [[119.8, 18.5], [122.2, 18.4], [123.8, 13.5], [126.2, 7.2], [122.2, 5.8], [119.6, 10.5], [120.2, 14.5]],
    fill(ctx, b) {
      ctx.fillStyle = '#0038a8'; ctx.fillRect(b.x, b.y, b.w, b.h / 2);
      ctx.fillStyle = '#ce1126'; ctx.fillRect(b.x, b.y + b.h / 2, b.w, b.h / 2);
      ctx.fillStyle = '#f2f2f2';
      ctx.beginPath();
      ctx.moveTo(b.x, b.y); ctx.lineTo(b.x + b.w * 0.45, b.y + b.h / 2); ctx.lineTo(b.x, b.y + b.h);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#fcd116';
      ctx.beginPath(); ctx.arc(b.x + b.w * 0.14, b.y + b.h / 2, Math.min(b.w, b.h) * 0.07, 0, Math.PI * 2); ctx.fill();
    },
  },
];

function drawCountryFlags(ctx, rotLon, rotLat, R, cx, cy) {
  for (const country of COUNTRY_FLAGS) {
    const pts = country.poly
      .map(([lon, lat]) => project(lon, lat, rotLon, rotLat, R, cx, cy))
      .filter(p => p.z > 0.02);
    if (pts.length < 3) continue;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    }
    const b = { x: minX, y: minY, w: Math.max(1, maxX - minX), h: Math.max(1, maxY - minY) };
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    pts.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
    ctx.closePath();
    ctx.clip();
    country.fill(ctx, b);
    ctx.restore();
    // 윤곽선 (국기 경계 또렷하게)
    ctx.save();
    ctx.strokeStyle = 'rgba(15,30,20,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    pts.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
}

function drawContinentPolygons(ctx, rotLon, rotLat, R, cx, cy) {
  const tracePath = (pts, shrink = 1, ox = 0, oy = 0) => {
    ctx.beginPath();
    pts.forEach((p, i) => {
      const x = ox + (p.x - ox) * shrink;
      const y = oy + (p.y - oy) * shrink;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.closePath();
  };
  for (const poly of CONTINENTS) {
    const pts = poly
      .map(([lon, lat]) => project(lon, lat, rotLon, rotLat, R, cx, cy))
      .filter(p => p.z > 0.02);
    if (pts.length < 3) continue;
    // 본체
    ctx.fillStyle = '#3f9760';
    tracePath(pts);
    ctx.fill();
    // 내륙 음영: 센트로이드 쪽으로 수축한 폴리곤을 어두운 톤으로 겹쳐
    // 플랫한 단색 대신 고도감/입체감을 준다 (2단계)
    let mx = 0, my = 0;
    for (const p of pts) { mx += p.x; my += p.y; }
    mx /= pts.length; my /= pts.length;
    ctx.fillStyle = 'rgba(34,102,58,0.55)';
    tracePath(pts, 0.66, mx, my);
    ctx.fill();
    ctx.fillStyle = 'rgba(22,74,42,0.45)';
    tracePath(pts, 0.36, mx, my);
    ctx.fill();
    // 해안선: 어두운 윤곽 + 그 위 밝은 하이라이트 림 (물과 만나는 경계 강조)
    tracePath(pts);
    ctx.strokeStyle = 'rgba(20,50,25,0.6)';
    ctx.lineWidth = 1.7;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(214,255,226,0.45)';
    ctx.lineWidth = 0.8;
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
  drawCountryFlags(ctx, rotLon, rotLat, R, cx, cy);

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
