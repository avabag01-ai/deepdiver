// game.js — 메인 루프, 물리, 충돌 판정, HUD 업데이트, 진입점
// 중요: 델타타임은 반드시 초 단위(dtSec = dt/1000)로 정규화해서 사용한다.
// (이전 프로토타입에서 ms를 초처럼 잘못 써서 속도가 폭주하는 버그가 있었음 — 재발 금지)

import { CANVAS_W, CANVAS_H, clamp, weightedPick, randRange, glow } from './utils.js';
import { zoneAt, drawBackground, drawDepthVeil, drawHeadlampDarkness, drawPostProcess } from './zones.js';
import { speciesById, SPECIES, pickSpeciesForZone, speciesGlowSpots } from './species.js';
import { createTerrainChunk, createBgChunk, createDistantChunk, drawTerrainChunk, collidesWithTerrain, drawSeafloor, drawShipwreck } from './terrain.js';
import { createPlayer, attachPlayerInput, updatePlayer, drawPlayer, PLAYER_ANCHOR_Y, PLAYER_RADIUS } from './player.js';
import { ITEM_TYPES, createItem, drawItem, createBurst, updateBurst, drawBurst, createBubbleColumn, createBreathBubbles, updateBubbles, drawBubbles } from './item.js';
import {
  createGlobeState, drawGlobe, attachGlobeDrag, updateGlobeIdleSpin, drawSpaceBackground,
  DIVE_SITES, projectSites, drawPins, hitTestPins,
  loadClearedSet, saveClearedSet, isSiteUnlocked,
} from './globe.js';
import * as sound from './sound.js';
import { UPGRADES, MAGNET_RADII, loadPearls, savePearls, loadUpgrades, saveUpgrades } from './shop.js';
import {
  DEX_INFO, rarityOf, ZONE_LABELS, speciesInZone,
  COUNTRIES, speciesInCountry, speciesGlobal,
  loadObservedSet, saveObservedSet, loadDexBonuses, saveDexBonuses, renderSpeciesThumb,
} from './dex.js';

const PX_PER_METER = 20;
const MAX_ENTITIES_ON_SCREEN = 7;
const TOTAL_SPECIES = SPECIES.length;
const MAX_HEALTH = 3;
const INVULN_DURATION = 1.3; // 피격 후 무적 시간(초)
const SHAKE_DURATION = 0.35;
const SHAKE_MAG = 7;
const HEART_FULL = '❤️';
const HEART_EMPTY = '🖤';

// 극원경(distant) 레이어에 가끔 스쳐가는 거대 해양생물 실루엣 (충돌 없음, 순수 연출).
// 헤드램프 암전 구역(deepsea/vent)은 이미 어둠 연출이 있으므로 밝은 구역에서만 배치.
const DISTANT_SILHOUETTE_BY_ZONE = {
  shallow: ['reefshark', 'seaturtle', 'orca'],
  twilight: ['reefshark', 'orca'],
};

// 열린 바다를 유영하며 화면을 가로질러 지나갈 수 있는 종 — 매복형(바이퍼피시/앵글러 등)이나
// 고정형 장식(말미잘/산호 등은 애초에 creatures가 아니라 terrain에 구워짐)은 제외.
const CROSSING_SPECIES = new Set([
  'reefshark', 'orca', 'flyingfish', 'bluetang', 'clownfish', 'seaturtle',
  'lanternfish', 'hatchetfish', 'deepoctopus', 'dumbooctopus',
  // 나라별 고유종 중 유영형
  'mantaray', 'whaleshark', 'galapagosshark', 'arcticchar', 'napoleonfish', 'marineiguana',
]);
const CROSS_CHANCE = 0.4; // 스폰될 때 가로지르기 패턴이 될 확률 (좌→우/우→좌 균등)

// ---- 행동 레퍼토리 (종 성격별 배정 — 매복형/고정형은 어디에도 안 들어가 기존 유지) ----
// 회유(U턴): 가로지르다 완만한 호를 그리며 방향을 되돌리는 유영 생물
const UTURN_SPECIES = new Set(['seaturtle', 'bluetang', 'lanternfish', 'hatchetfish', 'deepoctopus', 'mantaray', 'arcticchar']);
const UTURN_CHANCE = 0.4;
// 호버링: 산호 주변에 사는 소형 어류 — 한 지점 주변에서 작은 8자를 그리며 맴돎
const HOVER_SPECIES = new Set(['clownfish', 'bluetang', 'damselfish', 'mandarinfish', 'pygmyseahorse']);
const HOVER_CHANCE = 0.6;
// 가속-활공(burst & glide): 꼬리 킥에 맞춰 훅 가속했다가 관성으로 미끄러지는 대형 유영어
const BURST_GLIDE_SPECIES = new Set(['reefshark', 'orca', 'flyingfish']);
// 도망 반응: 다이버 접근 시 은은하게 멀어지는 관상용 소형 어류
const FLEE_SPECIES = new Set(['clownfish', 'bluetang', 'hatchetfish', 'lanternfish', 'dumbooctopus', 'damselfish', 'mandarinfish', 'blindcavefish']);
const FLEE_RADIUS = 85;

// 지나갈 때 가끔 기포를 흘리는 대형 생물 (범고래/상어/거북 등 덩치 큰 종)
const BIG_BUBBLE_SPECIES = new Set(['orca', 'reefshark', 'seaturtle', 'deepoctopus', 'giantisopod', 'whaleshark', 'mantaray', 'napoleonfish', 'galapagosshark']);
const MAX_BUBBLES = 30;

// 네이티브 햅틱 브리지 — iOS 래퍼(WKWebView)에서만 동작, 브라우저에선 무해한 no-op.
// kind: 'hit'(피격, heavy) | 'pickup'(아이템, light) | 'success'(발견/클리어, notification)
function haptic(kind) {
  try { window.webkit?.messageHandlers?.haptic?.postMessage(kind); } catch (e) { /* 브라우저 */ }
}

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const hudEl = document.getElementById('hud');
const hudDepth = document.getElementById('depthReadout');
const hudPhase = document.getElementById('phaseReadout');
const hudScore = document.getElementById('scoreReadout');
const hudDex = document.getElementById('dexReadout');
const hudHealth = document.getElementById('healthReadout');
const overlay = document.getElementById('overlay');
const overlayTitleEl = document.getElementById('overlayTitle');
const finalDepthEl = document.getElementById('finalDepth');
const finalScoreEl = document.getElementById('finalScore');
const finalDexEl = document.getElementById('finalDex');
const btnRestart = document.getElementById('btnRestart');
const btnGlobeFromOver = document.getElementById('btnGlobeFromOver');

// ---- 지구본(레벨 선택) 화면 ----
const globeScreen = document.getElementById('globeScreen');
const globeCanvas = document.getElementById('globeCanvas');
const globeCtx = globeCanvas.getContext('2d');
const siteCard = document.getElementById('siteCard');
const siteNameEl = document.getElementById('siteName');
const sitePlaceEl = document.getElementById('sitePlace');
const siteDepthEl = document.getElementById('siteDepth');
const siteStatusEl = document.getElementById('siteStatus');
const btnDiveStart = document.getElementById('btnDiveStart');

const GLOBE_CX = globeCanvas.width / 2;
const GLOBE_CY = globeCanvas.height * 0.5;
// 기본 지름 = 화면 폭의 ~110% (좌우 살짝 잘리는 구도 — 사용자 승인), 줌 1.0~2.5x
const GLOBE_BASE_R = globeCanvas.width * 0.55;
const globeR = () => GLOBE_BASE_R * (globeState.zoom || 1);

const globeState = createGlobeState();
let clearedSet = loadClearedSet();

// ---- 도감: 영구 관찰 기록 + 발견/완성 보상 ----
const OBSERVE_DIST = 75; // 이 거리 안으로 지나가면 "관찰"로 기록 (충돌 불필요)
let observedSet = loadObservedSet();
let dexBonuses = loadDexBonuses();

const toastEl = document.getElementById('toast');
let toastTimer = null;
const toastQueue = [];
function showToast(msg) {
  toastQueue.push(msg);
  if (!toastTimer) nextToast();
}
function nextToast() {
  const msg = toastQueue.shift();
  if (!msg) { toastTimer = null; return; }
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  toastTimer = setTimeout(() => {
    toastEl.classList.remove('show');
    toastTimer = setTimeout(nextToast, 300);
  }, 2100);
}

// 종을 처음 관찰하면 기록·보상하고, 구역/전체 완성 보너스도 여기서 판정한다
function recordObservation(sp) {
  if (observedSet.has(sp.id)) return;
  observedSet.add(sp.id);
  saveObservedSet(observedSet);
  pearlBalance += 5; // 첫 발견 보너스
  savePearls(pearlBalance);
  sound.playPearl();
  haptic('success');
  showToast(`📖 새로운 종 발견! ${sp.name} (+5🦪)`);
  // 구역 완성 체크
  const zoneSpecies = speciesInZone(sp.zone);
  if (!dexBonuses[sp.zone] && zoneSpecies.every(z => observedSet.has(z.id))) {
    dexBonuses[sp.zone] = true;
    pearlBalance += 50;
    const zl = ZONE_LABELS.find(z => z.id === sp.zone);
    showToast(`🏅 ${zl ? zl.label : sp.zone} 도감 완성! (+50🦪)`);
    sound.playChest();
  }
  // 전체 완성 체크
  if (!dexBonuses.all && observedSet.size >= TOTAL_SPECIES) {
    dexBonuses.all = true;
    pearlBalance += 200;
    showToast('👑 도감 28종 전체 완성! (+200🦪)');
    sound.playLevelClearFanfare();
  }
  saveDexBonuses(dexBonuses);
  savePearls(pearlBalance);
  updatePearlUI();
}

// ---- 메타 진행: 진주 재화 + 영구 업그레이드 (localStorage) ----
let pearlBalance = loadPearls();
let upgrades = loadUpgrades();
const maxHealth = () => MAX_HEALTH + (upgrades.oxygen || 0);
const invulnDuration = () => INVULN_DURATION + 0.4 * (upgrades.suit || 0);
const lampMul = () => 1 + 0.2 * (upgrades.lamp || 0);
const finSpeedMul = () => 1 + 0.1 * (upgrades.fins || 0);
const magnetRadius = () => MAGNET_RADII[upgrades.magnet || 0];
let selectedPin = null;   // 카드에 표시 중인 핀 (projectSites 결과 원소)
let currentSite = null;   // 지금 다이빙 중인 스팟 (devAutoStart로 진입하면 null)
let currentTheme = null;  // currentSite.theme — 스팟 고유 분위기 레이어 (?depth= 개발 모드는 null)
let screen = 'globe';     // 'globe' | 'diving'
let lastProjectedPins = [];

attachGlobeDrag(globeCanvas, globeState);

// 폴백: 어떤 경로로 진입하든(예: ?depth= 개발 모드) 첫 포인터 입력에서 오디오 컨텍스트를
// 확실히 초기화한다. initAudio()는 멱등이라 여러 번 호출해도 안전하다.
window.addEventListener('pointerdown', () => sound.initAudio(), { once: true });

function updateSiteCardUI() {
  if (!selectedPin) { siteCard.classList.remove('show'); return; }
  const { site, index } = selectedPin;
  const unlocked = isSiteUnlocked(index, clearedSet, DIVE_SITES);
  const cleared = clearedSet.has(site.id);
  siteNameEl.textContent = `${index + 1}. ${site.name}`;
  sitePlaceEl.textContent = site.place;
  siteDepthEl.textContent = `목표 수심 ${site.targetDepth.toLocaleString()} m`;
  if (!unlocked) {
    siteStatusEl.textContent = '🔒 이전 스팟을 클리어하면 열립니다';
    siteStatusEl.className = 'siteStatus locked';
    btnDiveStart.style.display = 'none';
  } else {
    siteStatusEl.textContent = cleared ? '✓ 클리어 완료 — 다시 도전할 수 있어요' : '도전 가능';
    siteStatusEl.className = 'siteStatus' + (cleared ? ' cleared' : '');
    btnDiveStart.style.display = 'inline-block';
  }
  siteCard.classList.add('show');
}

// 드래그(회전)와 탭(핀 선택)을 구분: 포인터다운~업 사이 이동거리가 작을 때만 탭으로 인정
let pinDownX = 0, pinDownY = 0, pinMoved = false;
function globeLocalXY(e) {
  const rect = globeCanvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (globeCanvas.width / rect.width),
    y: (e.clientY - rect.top) * (globeCanvas.height / rect.height),
  };
}
globeCanvas.addEventListener('pointerdown', (e) => {
  sound.initAudio(); // 첫 사용자 제스처 — iOS Safari 자동재생 정책 대응
  const p = globeLocalXY(e);
  pinDownX = p.x; pinDownY = p.y; pinMoved = false;
});
globeCanvas.addEventListener('pointermove', (e) => {
  const p = globeLocalXY(e);
  if (Math.hypot(p.x - pinDownX, p.y - pinDownY) > 6) pinMoved = true;
});
globeCanvas.addEventListener('pointerup', (e) => {
  if (pinMoved) return; // 드래그였으면 탭으로 취급하지 않음
  const p = globeLocalXY(e);
  const hit = hitTestPins(lastProjectedPins, p.x, p.y, globeState.zoom || 1);
  if (hit) sound.playClick();
  selectedPin = hit || null;
  updateSiteCardUI();
});

// ---- 장비 상점 UI ----
const shopPanel = document.getElementById('shopPanel');
const shopList = document.getElementById('shopList');
const shopBalanceEl = document.getElementById('shopBalance');
const pearlBalanceEl = document.getElementById('pearlBalance');
const btnShop = document.getElementById('btnShop');
const btnShopClose = document.getElementById('btnShopClose');
const btnShopFromOver = document.getElementById('btnShopFromOver');

function updatePearlUI() {
  pearlBalanceEl.textContent = `🦪 ${pearlBalance}`;
  shopBalanceEl.textContent = `🦪 ${pearlBalance}`;
}

function renderShop() {
  updatePearlUI();
  shopList.innerHTML = '';
  for (const u of UPGRADES) {
    const lv = upgrades[u.id] || 0;
    const maxed = lv >= u.maxLevel;
    const price = maxed ? null : u.prices[lv];
    const row = document.createElement('div');
    row.className = 'shopRow';
    const dots = '●'.repeat(lv) + '○'.repeat(u.maxLevel - lv);
    row.innerHTML = `
      <div class="icon">${u.icon}</div>
      <div class="info">
        <div class="name">${u.name}</div>
        <div class="desc">${u.desc} — 현재: ${u.levelDesc(lv)}</div>
        <div class="lvl">${dots} Lv.${lv}/${u.maxLevel}</div>
      </div>`;
    const btn = document.createElement('button');
    if (maxed) {
      btn.textContent = 'MAX';
      btn.className = 'maxed';
      btn.disabled = true;
    } else if (pearlBalance < price) {
      btn.textContent = `🦪 ${price}`;
      btn.className = 'cantAfford';
      btn.disabled = true;
    } else {
      btn.textContent = `🦪 ${price}`;
      btn.addEventListener('click', () => {
        if (pearlBalance < price || (upgrades[u.id] || 0) >= u.maxLevel) return;
        pearlBalance -= price;
        upgrades[u.id] = (upgrades[u.id] || 0) + 1;
        savePearls(pearlBalance);
        saveUpgrades(upgrades);
        sound.playChest(); // 구매 확정음
        renderShop();
      });
    }
    row.appendChild(btn);
    shopList.appendChild(row);
  }
}

// ---- 도감 UI ----
const dexPanel = document.getElementById('dexPanel');
const dexGridWrap = document.getElementById('dexGridWrap');
const dexProgressEl = document.getElementById('dexProgress');
const btnDex = document.getElementById('btnDex');
const btnDexClose = document.getElementById('btnDexClose');
const dexCard = document.getElementById('dexCard');
const dexCardArt = document.getElementById('dexCardArt');
const btnDexCardClose = document.getElementById('btnDexCardClose');

// 썸네일 캐시: 관찰 여부가 바뀌면 다시 그려야 하므로 "id:observed" 키로 캐시
const thumbCache = new Map();
function getThumb(spId, observed) {
  const key = `${spId}:${observed ? 1 : 0}`;
  if (!thumbCache.has(key)) thumbCache.set(key, renderSpeciesThumb(spId, 56, observed));
  return thumbCache.get(key);
}

function openDexCard(spId) {
  const sp = speciesById(spId);
  const info = DEX_INFO[spId] || {};
  const rar = rarityOf(spId);
  // 상세 일러스트: 카드 아트 캔버스에 크게 렌더
  const actx = dexCardArt.getContext('2d');
  actx.clearRect(0, 0, dexCardArt.width, dexCardArt.height);
  actx.save();
  actx.translate(dexCardArt.width / 2, dexCardArt.height / 2);
  const s = 2.6 / sp.size;
  actx.scale(s, s);
  sp.draw(actx, 0, 0, 1.7, sp.size);
  actx.restore();
  document.getElementById('dexCardName').textContent = sp.name;
  document.getElementById('dexCardEn').textContent = info.en || '';
  const rarEl = document.getElementById('dexCardRarity');
  rarEl.textContent = `★ ${rar.label}`;
  rarEl.style.color = rar.color;
  document.getElementById('dexCardDepth').textContent = info.depth || '?';
  document.getElementById('dexCardSize').textContent = info.size || '?';
  document.getElementById('dexCardFact').textContent = info.fact || '';
  dexCard.classList.add('show');
}

let dexMode = 'zone'; // 'zone'(수심별) | 'country'(나라별)

function appendDexSection(label, list) {
  const seen = list.filter(sp => observedSet.has(sp.id)).length;
  const title = document.createElement('div');
  title.className = 'dexZoneTitle';
  const done = seen === list.length && list.length > 0;
  title.innerHTML = `<span>${label}</span><span class="zoneCount${done ? ' zoneDone' : ''}">${done ? '완성! 🏅' : `${seen}/${list.length}`}</span>`;
  dexGridWrap.appendChild(title);
  const grid = document.createElement('div');
  grid.className = 'dexGrid';
  for (const sp of list) {
    const observed = observedSet.has(sp.id);
    const cell = document.createElement('div');
    cell.className = 'dexCell ' + (observed ? 'observed' : 'unobserved');
    cell.appendChild(getThumb(sp.id, observed));
    const nm = document.createElement('div');
    nm.className = 'cellName';
    nm.textContent = observed ? sp.name : '???';
    cell.appendChild(nm);
    if (observed) {
      cell.addEventListener('click', () => { sound.playClick(); openDexCard(sp.id); });
    }
    grid.appendChild(cell);
  }
  dexGridWrap.appendChild(grid);
}

function renderDex() {
  dexProgressEl.textContent = `${observedSet.size}/${TOTAL_SPECIES} 관찰`;
  dexGridWrap.innerHTML = '';
  if (dexMode === 'zone') {
    for (const zone of ZONE_LABELS) appendDexSection(zone.label, speciesInZone(zone.id));
  } else {
    // 나라별: 국가 고유종 섹션들 + 전 해역(기존 공통종)
    for (const c of COUNTRIES) {
      const list = speciesInCountry(c.id);
      if (list.length) appendDexSection(`${c.flag} ${c.label}`, list);
    }
    appendDexSection('🌊 전 해역', speciesGlobal());
  }
}

const btnDexByZone = document.getElementById('btnDexByZone');
const btnDexByCountry = document.getElementById('btnDexByCountry');
function setDexMode(mode) {
  dexMode = mode;
  btnDexByZone.classList.toggle('on', mode === 'zone');
  btnDexByCountry.classList.toggle('on', mode === 'country');
  renderDex();
}
btnDexByZone.addEventListener('click', () => { sound.playClick(); setDexMode('zone'); });
btnDexByCountry.addEventListener('click', () => { sound.playClick(); setDexMode('country'); });

function openDex() {
  renderDex();
  dexPanel.classList.add('show');
}

btnDex.addEventListener('click', () => { sound.initAudio(); sound.playClick(); openDex(); });
btnDexClose.addEventListener('click', () => { sound.playClick(); dexPanel.classList.remove('show'); });
btnDexCardClose.addEventListener('click', () => { sound.playClick(); dexCard.classList.remove('show'); });
dexCard.addEventListener('click', (e) => { if (e.target === dexCard) dexCard.classList.remove('show'); });

function openShop() {
  renderShop();
  shopPanel.classList.add('show');
}

btnShop.addEventListener('click', () => { sound.initAudio(); sound.playClick(); openShop(); });
btnShopClose.addEventListener('click', () => { sound.playClick(); shopPanel.classList.remove('show'); });
btnShopFromOver.addEventListener('click', () => {
  sound.initAudio();
  sound.playClick();
  selectedPin = null;
  updateSiteCardUI();
  showGlobeScreen();
  openShop();
});

function renderGlobeScreen() {
  globeCtx.clearRect(0, 0, globeCanvas.width, globeCanvas.height);
  drawSpaceBackground(globeCtx, globeCanvas.width, globeCanvas.height, state.timeSec);
  const R = globeR();
  drawGlobe(globeCtx, GLOBE_CX, GLOBE_CY, R, globeState);
  lastProjectedPins = projectSites(GLOBE_CX, GLOBE_CY, R, globeState, DIVE_SITES);
  drawPins(globeCtx, lastProjectedPins, clearedSet, DIVE_SITES, state.timeSec, globeState.zoom || 1);
}

function showGlobeScreen() {
  screen = 'globe';
  globeScreen.classList.remove('hide');
  hudEl.style.display = 'none';
  overlay.classList.remove('show');
  sound.stopAmbience();
}

function showDivingScreen() {
  screen = 'diving';
  globeScreen.classList.add('hide');
  hudEl.style.display = 'flex';
  siteCard.classList.remove('show');
}

function scrollSpeedForDepth(depthM) {
  // 초반 60px/s, 깊어질수록 완만히 증가해 최대 160px/s
  return clamp(60 + depthM * 0.05, 60, 160);
}

function creatureVisualRadius(sp) {
  return 15 * sp.size;
}

function makeInitialState() {
  const params = new URLSearchParams(window.location.search);
  const devDepth = parseFloat(params.get('depth'));
  const startDepthM = isFinite(devDepth) && devDepth >= 0 ? devDepth : 0;

  return {
    running: false,
    over: false,
    cleared: false,
    targetDepthM: null, // 선택한 다이빙 스팟의 목표 수심 — 지구본 없이 진입 시 null
    phase: 'descending', // 'descending' | 'ascending' — 바닥의 보물을 얻으면 ascending으로 전환
    scrollDir: 1,         // 1=하강(월드가 위로 흐름), -1=상승(월드가 아래로 흐름)
    floorReached: false,  // 바닥(보물) 스폰 여부 — 한 레벨에 한 번만
    floorY: null,         // 바닥이 스크롤되는 화면상 y좌표 (floorReached일 때만 사용)
    maxDepthM: startDepthM, // 클리어 결과 화면에 "최고 도달 깊이"로 표시(상승 중엔 depthM이 줄어들므로 별도 추적)
    totalScrollPx: startDepthM * PX_PER_METER,
    score: 0,
    health: maxHealth(),
    invulnUntil: -1,
    shakeUntil: -1,
    shakeSeed: Math.random() * 1000,
    creatures: [],
    items: [],
    terrainFg: [],
    terrainBg: [],
    terrainDistant: [],
    distantCreatures: [],
    distantCreatureTimer: randRange(4, 8),
    fishSchools: [],
    fishSchoolTimer: randRange(3, 7),
    wrecks: [],                      // 홍해 테마: 극원경 침몰선 실루엣
    wreckTimer: randRange(6, 12),
    bursts: [],
    bubbles: [],
    ambientBubbleTimer: randRange(1.2, 2.4),
    breathSoundTimer: randRange(1.4, 2.2),
    creatureHintCooldown: randRange(2, 4),
    creatureSpawnTimer: randRange(0.65, 1.4),
    itemSpawnTimer: randRange(2.2, 3.6),
    potionSpawnTimer: randRange(8, 15),
    // 지형이 이제 화면의 1.5~3배로 길게 이어지므로, 다음 조각 스폰까지의 간격도
    // 그에 맞춰 크게 잡아 같은 벽이 계속 겹쳐 나오지 않고 자연스러운 리듬을 만든다.
    terrainFgGap: randRange(CANVAS_H * 1.8, CANVAS_H * 3.2), // 첫 벽 스폰 후 spawnTerrainFg에서 실제 벽 길이 기준으로 재계산됨
    terrainFgSide: Math.random() < 0.5 ? 'left' : 'right',
    // 시작하자마자 한참 빈 화면만 보이지 않도록 진행도를 살짝 앞당겨서 시작
    terrainFgProgress: randRange(CANVAS_H * 0.3, CANVAS_H * 0.7),
    terrainBgGap: randRange(CANVAS_H * 0.8, CANVAS_H * 1.5),
    terrainBgSide: Math.random() < 0.5 ? 'left' : 'right',
    terrainBgProgress: randRange(CANVAS_H * 0.2, CANVAS_H * 0.6),
    // 극원경: 더 크고 드문드문하게 (3단 패럴랙스의 가장 느린 레이어, 0.3배속으로 스크롤)
    terrainDistantGap: randRange(CANVAS_H * 1.2, CANVAS_H * 2.2),
    terrainDistantSide: Math.random() < 0.5 ? 'left' : 'right',
    terrainDistantProgress: randRange(CANVAS_H * 0.1, CANVAS_H * 0.4),
    timeSec: 0,
    devAutoStart: isFinite(devDepth),
    // 종 다양성 보정용: 최근 스폰 시각 / 직전 스폰 종
    speciesLastSpawn: {},
    lastSpeciesId: null,
  };
}

let state = makeInitialState();
const player = createPlayer();
attachPlayerInput(player, canvas);

function currentDepthM() {
  return state.totalScrollPx / PX_PER_METER;
}

// 생물/아이템/지형 전부 화면 "아래"에서 나타나 위로 흘러가다 화면 위로 빠지면 제거된다.
// (다이버가 하강 = 화면 기준으로는 세상이 위로 스크롤되는 것과 동치)
// 하강 중엔 항상 화면 아래(다이버가 나아가는 방향의 반대편)에서 스폰돼 위로 흘러가고,
// 상승 중엔 반대로 화면 위(다이버가 올라가는 방향의 앞쪽)에서 스폰돼 아래로 흘러가야
// "그 방향으로 다가오는" 느낌이 난다.
function spawnEdgeY(r) {
  return state.scrollDir > 0 ? CANVAS_H + r + 10 : -r - 10;
}

// 방향에 따라 "이제 화면 밖으로 완전히 벗어났는지" 판정 — 하강 중엔 위로, 상승 중엔 아래로 나간다.
function isOffscreenY(y, r) {
  return state.scrollDir > 0 ? (y + r < -20) : (y - r > CANVAS_H + 20);
}

// 스폰 후보 좌표가 기존 생물들과 충분히 떨어져 있는지 — 겹쳐 스폰되면 두 스프라이트가
// 포개져 "합성 괴물"처럼 보이는 비주얼 버그가 있었다.
const SPAWN_MIN_DIST = 60;
function farFromOtherCreatures(x, y) {
  return state.creatures.every((o) => {
    const ox = o.curX ?? o.baseX;
    const oy = o.curY ?? o.y;
    return (ox - x) * (ox - x) + (oy - y) * (oy - y) >= SPAWN_MIN_DIST * SPAWN_MIN_DIST;
  });
}

function spawnCreature(depthM) {
  if (state.creatures.length >= MAX_ENTITIES_ON_SCREEN) return;
  const zoneId = zoneAt(depthM).id;
  let sp = pickSpeciesForZone(zoneId, state.speciesLastSpawn, state.lastSpeciesId, state.timeSec, currentSite?.id ?? null);
  if (!sp) return;
  // 스팟 테마의 종 가중치: 일정 확률로 바이어스 종 중 하나로 교체 (현재 구역 종만)
  if (currentTheme?.spawnBias && Math.random() < 0.45) {
    const cands = Object.entries(currentTheme.spawnBias)
      .filter(([id]) => speciesById(id)?.zone === zoneId);
    if (cands.length) {
      const total = cands.reduce((s, [, w]) => s + w, 0);
      let roll = Math.random() * total;
      for (const [id, w] of cands) {
        roll -= w;
        if (roll <= 0) { sp = speciesById(id); break; }
      }
    }
  }
  const r = creatureVisualRadius(sp);
  const margin = r + 6;
  const spawnY = spawnEdgeY(r);
  let crossDir = 0, crossSpeed = 0;
  let x;
  const extra = {};
  // 유영성 어류/생물 일부는 제자리 sway 대신 화면을 대각선으로 가로지르며 지나가게 한다
  // (고정형/매복형 생물은 CROSSING_SPECIES에 없으므로 항상 기존처럼 제자리 유지)
  if (CROSSING_SPECIES.has(sp.id) && Math.random() < CROSS_CHANCE) {
    crossDir = Math.random() < 0.5 ? 1 : -1; // 좌→우 / 우→좌 균등
    crossSpeed = randRange(16, 38);
    x = crossDir === 1 ? -r : CANVAS_W + r; // 화면 밖에서 시작해 가로질러 등장 (x 고정)
    if (!farFromOtherCreatures(x, spawnY)) return; // 겹치면 이번 스폰은 건너뜀
    // 회유: 일부는 화면 중간쯤에서 완만한 호를 그리며 되돌아간다
    if (UTURN_SPECIES.has(sp.id) && Math.random() < UTURN_CHANCE) {
      extra.turnAt = randRange(1.5, 4.0);   // 스폰 후 몇 초 뒤 턴 시작
      extra.turnDur = randRange(1.8, 2.8);  // 턴에 걸리는 시간 (부드러운 반원)
    }
    if (BURST_GLIDE_SPECIES.has(sp.id)) extra.burstGlide = true;
  } else {
    // 겹치지 않는 x가 나올 때까지 몇 번 재추첨, 전부 실패하면 스폰 스킵
    let found = false;
    for (let attempt = 0; attempt < 6; attempt++) {
      const cand = randRange(margin, CANVAS_W - margin);
      if (farFromOtherCreatures(cand, spawnY)) { x = cand; found = true; break; }
    }
    if (!found) return;
    // 호버링: 소형 어류는 한 지점 주변에서 작은 8자를 그리며 맴돈다
    if (HOVER_SPECIES.has(sp.id) && Math.random() < HOVER_CHANCE) {
      extra.hoverR = randRange(5, 11);
      extra.hoverW = randRange(1.2, 2.2);
    }
  }
  state.creatures.push({
    speciesId: sp.id,
    baseX: x,
    y: spawnY,
    phase: Math.random() * Math.PI * 2,
    spawnT: Math.random() * 10,
    crossDir, crossSpeed,
    t: 0,        // 개체 수명 시계 (행동 타이밍용)
    face: crossDir === -1 ? -1 : 1, // 스프라이트 좌우(수평) 반전 방향 — 이동 방향을 따라감
    tilt: 0,     // 회유 턴 중 몸 기울기(rad)
    ...extra,
  });
  state.speciesLastSpawn[sp.id] = state.timeSec;
  state.lastSpeciesId = sp.id;
}

function spawnItem(depthM) {
  const totalOnScreen = state.creatures.length + state.items.length;
  if (totalOnScreen >= MAX_ENTITIES_ON_SCREEN) return;
  const roll = Math.random();
  const type = roll < 0.42 ? 'pearl' : roll < 0.84 ? 'oxygen' : 'chest';
  const r = ITEM_TYPES[type].radius;
  const margin = r + 10;
  const x = randRange(margin, CANVAS_W - margin);
  state.items.push(createItem(type, x, spawnEdgeY(r)));
}

// 회복 아이템은 다른 수집 아이템보다 훨씬 드물게, 별도 타이머로 스폰된다.
function spawnPotion() {
  const totalOnScreen = state.creatures.length + state.items.length;
  if (totalOnScreen >= MAX_ENTITIES_ON_SCREEN) return;
  const r = ITEM_TYPES.potion.radius;
  const margin = r + 10;
  const x = randRange(margin, CANVAS_W - margin);
  state.items.push(createItem('potion', x, spawnEdgeY(r)));
}

function spawnTerrainFg(depthM) {
  const zoneId = zoneAt(depthM).id;
  const chunk = createTerrainChunk(zoneId, state.terrainFgSide, CANVAS_H, currentTheme?.wall || null);
  state.terrainFg.push(chunk);
  state.terrainFgSide = state.terrainFgSide === 'left' ? 'right' : 'left';
  // 다음 벽(반대쪽)은 이번 벽의 "길이"만큼 스크롤이 지나간 뒤에야 스폰한다.
  // 벽 높이가 화면의 1.5~3배로 길기 때문에, 예전처럼 화면 높이 기준 고정 간격을
  // 쓰면 이전 벽이 채 사라지기도 전에 반대쪽 벽이 겹쳐 나타나 "양쪽이 동시에
  // 좁게" 보이는 문제가 있었다 — 한 번에 한쪽 벽만 보이도록 간격을 벽 길이에 맞춘다.
  state.terrainFgGap = (chunk.height + randRange(70, 200)) * (currentTheme?.terrainGapMul || 1);
}

function spawnTerrainBg(depthM) {
  const zoneId = zoneAt(depthM).id;
  const chunk = createBgChunk(zoneId, state.terrainBgSide, CANVAS_H, currentTheme?.wall || null);
  state.terrainBg.push(chunk);
  state.terrainBgSide = Math.random() < 0.5 ? 'left' : 'right';
  state.terrainBgGap = randRange(CANVAS_H * 0.8, CANVAS_H * 1.5) * (currentTheme?.terrainGapMul || 1);
}

function spawnTerrainDistant(depthM) {
  const zoneId = zoneAt(depthM).id;
  const chunk = createDistantChunk(zoneId, state.terrainDistantSide, CANVAS_H, currentTheme?.wall || null);
  state.terrainDistant.push(chunk);
  state.terrainDistantSide = Math.random() < 0.5 ? 'left' : 'right';
  state.terrainDistantGap = randRange(CANVAS_H * 1.2, CANVAS_H * 2.2) * (currentTheme?.terrainGapMul || 1);
}

// 목업 참조: 헤드램프 뒤쪽 원경에 흐릿하게 스쳐가는 거대 해양생물 실루엣 (충돌 없음)
function spawnDistantCreature(depthM) {
  const zoneId = zoneAt(depthM).id;
  const pool = DISTANT_SILHOUETTE_BY_ZONE[zoneId];
  if (!pool) return;
  const spId = pool[Math.floor(Math.random() * pool.length)];
  const sp = speciesById(spId);
  state.distantCreatures.push({
    speciesId: spId,
    x: randRange(50, CANVAS_W - 50),
    y: CANVAS_H + 80,
    scale: 2.1 + Math.random() * 1.4,
    phase: Math.random() * Math.PI * 2,
    spawnT: Math.random() * 10,
  });
}

// 원경 물고기 떼 — 점 실루엣 무리가 배경을 가로질러 헤엄쳐 지나감 (저비용 배경 채움).
// 밝은 구역(shallow/twilight)에서만; 암전 구역은 어둠 연출이 있어 불필요.
function spawnFishSchool(depthM) {
  const zoneId = zoneAt(depthM).id;
  if (zoneId !== 'shallow' && zoneId !== 'twilight') return;
  const dir = Math.random() < 0.5 ? 1 : -1;
  const count = 8 + Math.floor(Math.random() * 7);
  const seeds = Array.from({ length: count }, (_, i) => ({
    dx: -dir * i * (7 + Math.random() * 6) + (Math.random() - 0.5) * 10,
    dy: (Math.random() - 0.5) * 26,
    r: 1.6 + Math.random() * 1.4,
    phase: Math.random() * Math.PI * 2,
  }));
  state.fishSchools.push({
    x: dir === 1 ? -80 : CANVAS_W + 80,
    y: randRange(CANVAS_H * 0.15, CANVAS_H * 0.75),
    dir,
    speed: randRange(22, 40),
    seeds,
    spawnT: Math.random() * 10,
  });
}

// 환경 기포 — 암벽 틈(근경 지형이 있으면 그 안쪽 가장자리 근처)이나 바다 바닥에서
// 뽀글뽀글 올라오는 기포 기둥. 열수구 구역은 더 크고 활발하게(열수 분출 느낌).
function spawnAmbientBubbles(depthM) {
  if (state.bubbles.length >= MAX_BUBBLES) return;
  const zoneId = zoneAt(depthM).id;
  const vent = zoneId === 'vent';

  let x = randRange(24, CANVAS_W - 24);
  // 화면에 근경 벽이 있으면 그 안쪽 가장자리 근처에서 새어나오는 것처럼 보이게
  const fgOnScreen = state.terrainFg.filter(ch => ch.y < CANVAS_H && ch.y + ch.height > 0);
  if (fgOnScreen.length && Math.random() < 0.7) {
    const ch = fgOnScreen[Math.floor(Math.random() * fgOnScreen.length)];
    x = ch.side === 'left' ? ch.x + ch.width * (0.5 + Math.random() * 0.3) : ch.x + ch.width * (0.2 + Math.random() * 0.3);
  }
  const baseY = (state.floorReached && state.floorY != null && state.floorY < CANVAS_H)
    ? state.floorY + 20 + Math.random() * 30
    : CANVAS_H + 10;

  const count = vent ? 5 + Math.floor(Math.random() * 3) : 3 + Math.floor(Math.random() * 3);
  const sizeScale = vent ? 1.7 : 1;
  const speedScale = vent ? 1.5 : 1;
  const room = MAX_BUBBLES - state.bubbles.length;
  const col = createBubbleColumn(x, baseY, count, sizeScale, speedScale).slice(0, room);
  state.bubbles.push(...col);
}

// 런에서 모은 점수를 진주 잔고에 합산 — 조난이든 클리어든 가져간다(실패해도 전진감)
function bankRunPearls() {
  const gained = state.score;
  pearlBalance += gained;
  savePearls(pearlBalance);
  updatePearlUI();
  const finalPearlsEl = document.getElementById('finalPearls');
  if (finalPearlsEl) finalPearlsEl.textContent = `🦪 이번 런 진주 +${gained} (보유 ${pearlBalance})`;
}

function endGame() {
  state.over = true;
  state.running = false;
  sound.stopAmbience();
  bankRunPearls();
  overlayTitleEl.textContent = '조난';
  btnRestart.textContent = '다시 하강';
  finalDepthEl.textContent = `최고 도달 깊이 ${Math.floor(state.maxDepthM)} m`;
  finalScoreEl.textContent = `수집 점수 ${state.score}`;
  finalDexEl.textContent = `관찰한 종 ${observedSet.size}/${TOTAL_SPECIES}`;
  overlay.classList.add('show');
}

// 목표 수심에 도달하면 레벨 클리어 — 진행상황을 localStorage에 저장하고 다음 스팟을 잠금해제한다.
function clearLevel() {
  state.cleared = true;
  state.running = false;
  haptic('success');
  sound.playLevelClearFanfare();
  sound.stopAmbience();
  bankRunPearls();
  if (currentSite) {
    clearedSet.add(currentSite.id);
    saveClearedSet(clearedSet);
  }
  overlayTitleEl.textContent = '레벨 클리어! 🎉';
  btnRestart.textContent = '다시 도전';
  finalDepthEl.textContent = `최고 도달 깊이 ${Math.floor(state.maxDepthM)} m`;
  finalScoreEl.textContent = `수집 점수 ${state.score}`;
  finalDexEl.textContent = `관찰한 종 ${observedSet.size}/${TOTAL_SPECIES}`;
  overlay.classList.add('show');
}

// 목표 수심(바닥)에 도달 — 해저 지형과 그 레벨을 상징하는 대형 보물을 스폰한다.
// 보물을 먹기 전까지는 계속 하강 방향 그대로 유지(플레이어가 바닥까지 내려가 보물을
// 직접 찾아가게 함).
function reachFloor() {
  state.floorReached = true;
  state.floorY = CANVAS_H + 40;
  const zoneId = zoneAt(state.targetDepthM).id;
  state.items.push(createItem('treasure', CANVAS_W / 2, state.floorY - 40, zoneId));
}

// 보물을 획득하면 하강→상승으로 전환. 이제부터 수면(0m)까지 올라가는 게 목표.
function beginAscent() {
  state.phase = 'ascending';
  state.scrollDir = -1;
}

// 즉사 대신 데미지 누적 방식. 피격 후 일정 시간 무적이라 같은 장애물에 연속으로
// 부딪혀 순식간에 체력이 다 깎이는 억울한 상황을 방지한다.
function damagePlayer() {
  if (state.over || state.cleared) return;
  if (state.timeSec < state.invulnUntil) return; // 무적 시간 중이면 무시
  sound.playHit();
  haptic('hit');
  state.health -= 1;
  state.invulnUntil = state.timeSec + invulnDuration();
  state.shakeUntil = state.timeSec + SHAKE_DURATION;
  if (state.health <= 0) {
    state.health = 0;
    endGame();
  }
}

function healPlayer() {
  if (state.health < maxHealth()) {
    state.health += 1;
  } else {
    // 풀피 상태에서 회복 아이템을 먹으면 보너스 점수로 대체
    state.score += 2;
  }
}

function update(dtSecRaw) {
  // dtSec은 항상 초 단위. 탭 전환 등으로 인한 과도한 점프 방지를 위해 클램프.
  const dtSec = clamp(dtSecRaw, 0, 0.05);
  state.timeSec += dtSec;

  const depthM = currentDepthM();
  const zone = zoneAt(depthM);
  sound.updateAmbience(depthM, zone.id);
  const scrollSpeed = scrollSpeedForDepth(depthM);
  // 부호 있는 스크롤량 — 하강(1)이면 기존과 동일, 상승(-1)이면 부호만 뒤집혀
  // totalScrollPx(=깊이)가 줄어들고, 아래에 있는 "-= scrollPx" 코드들도 그대로
  // 방향이 반전되어 지형/생물이 반대로(아래로) 흐르는 것처럼 보인다.
  const scrollPx = scrollSpeed * dtSec * state.scrollDir;
  state.totalScrollPx += scrollPx;
  state.maxDepthM = Math.max(state.maxDepthM, currentDepthM());

  // 상승 중 수면(0m)에 도달하면 진짜 레벨 클리어 — 단, 같은 프레임에 체력이 이미
  // 0이 되어 실패 처리(endGame)됐다면 클리어로 덮어쓰지 않는다.
  if (state.scrollDir < 0 && !state.over && !state.cleared && state.totalScrollPx <= 0) {
    state.totalScrollPx = 0;
    clearLevel();
    updateHud(0);
    return;
  }

  // 하강 중 목표 수심에 도달하면 바로 끝내는 대신, 바닥 지형+보물을 스폰해서
  // "바닥에 도달했다"는 걸 실제로 보여준다. 보물을 먹어야 상승으로 전환된다.
  if (state.phase === 'descending' && state.targetDepthM != null && !state.floorReached
    && !state.over && !state.cleared && currentDepthM() >= state.targetDepthM) {
    reachFloor();
  }

  updatePlayer(player, dtSec, state.timeSec, finSpeedMul());

  // ---- 스폰 타이머 (시간 기반, 프레임 기반 절대 금지) ----
  state.creatureSpawnTimer -= dtSec;
  if (state.creatureSpawnTimer <= 0) {
    spawnCreature(depthM);
    // 무(無)의 공간 테마(마리아나)는 생물 스폰 주기가 길어져 고독한 밀도가 된다
    state.creatureSpawnTimer = randRange(0.65, 1.4) * (currentTheme?.spawnSlowMul || 1);
  }
  state.itemSpawnTimer -= dtSec;
  if (state.itemSpawnTimer <= 0) {
    spawnItem(depthM);
    state.itemSpawnTimer = randRange(2.2, 3.6);
  }
  state.potionSpawnTimer -= dtSec;
  if (state.potionSpawnTimer <= 0) {
    spawnPotion();
    state.potionSpawnTimer = randRange(8, 15);
  }
  state.terrainFgProgress += scrollPx;
  if (state.terrainFgProgress >= state.terrainFgGap) {
    state.terrainFgProgress = 0;
    spawnTerrainFg(depthM);
  }
  state.terrainBgProgress += scrollPx;
  if (state.terrainBgProgress >= state.terrainBgGap) {
    state.terrainBgProgress = 0;
    spawnTerrainBg(depthM);
  }
  state.terrainDistantProgress += scrollPx;
  if (state.terrainDistantProgress >= state.terrainDistantGap) {
    state.terrainDistantProgress = 0;
    spawnTerrainDistant(depthM);
  }
  state.distantCreatureTimer -= dtSec;
  if (state.distantCreatureTimer <= 0) {
    spawnDistantCreature(depthM);
    state.distantCreatureTimer = randRange(6, 11); // 배경 허전함 완화 — 더 자주
  }
  state.fishSchoolTimer -= dtSec;
  if (state.fishSchoolTimer <= 0) {
    spawnFishSchool(depthM);
    state.fishSchoolTimer = randRange(7, 13);
  }
  for (let i = state.fishSchools.length - 1; i >= 0; i--) {
    const fs = state.fishSchools[i];
    fs.x += fs.dir * fs.speed * dtSec;
    fs.y -= scrollPx * 0.45; // 중경보다 살짝 뒤 시차
    if (fs.x < -220 || fs.x > CANVAS_W + 220 || fs.y < -120 || fs.y > CANVAS_H + 120) {
      state.fishSchools.splice(i, 1);
    }
  }

  // 홍해 테마: 극원경에 침몰선 실루엣이 가끔 지나감
  if (currentTheme?.signature === 'shipwreck') {
    state.wreckTimer -= dtSec;
    if (state.wreckTimer <= 0 && state.wrecks.length < 2) {
      state.wrecks.push({
        x: randRange(70, CANVAS_W - 70),
        y: spawnEdgeY(90),
        scale: 0.8 + Math.random() * 0.7,
      });
      state.wreckTimer = randRange(14, 24);
    }
  }
  for (let i = state.wrecks.length - 1; i >= 0; i--) {
    const w = state.wrecks[i];
    w.y -= scrollPx * 0.3; // 극원경 시차
    if (state.scrollDir > 0 ? w.y < -160 : w.y > CANVAS_H + 160) state.wrecks.splice(i, 1);
  }

  state.ambientBubbleTimer -= dtSec;
  if (state.ambientBubbleTimer <= 0) {
    spawnAmbientBubbles(depthM);
    sound.playBubble(0.8 + Math.random() * 0.3, 0.05); // 환경 기포는 아주 은은하게
    state.ambientBubbleTimer = randRange(1.4, 2.8);
  }
  // 다이버 호흡 리듬: 2~3초마다 마스크/호흡기 위치에서 기포 뭉치가 뿜어져 나와
  // 화면 위로 또렷하게 상승한다 (소리도 같은 타이밍에)
  state.breathSoundTimer -= dtSec;
  if (state.breathSoundTimer <= 0) {
    if (state.bubbles.length < MAX_BUBBLES) {
      const room = MAX_BUBBLES - state.bubbles.length;
      state.bubbles.push(...createBreathBubbles(player.x + player.facing * 7, player.y - 16).slice(0, room));
    }
    sound.playBubble(1 + Math.random() * 0.4, 0.14);
    state.breathSoundTimer = randRange(2.0, 3.0);
  }
  state.creatureHintCooldown -= dtSec;

  // ---- 생물 갱신 + 충돌 ----
  // 다이버가 하강할수록 생물은 화면 아래에서 나타나 위로 흘러가 사라진다 (지형과 동일 방향).
  for (let i = state.creatures.length - 1; i >= 0; i--) {
    const c = state.creatures[i];
    c.y -= scrollPx;
    c.t += dtSec;
    const sp = speciesById(c.speciesId);

    // ---- 가로지르기 / 회유(U턴) / 가속-활공 ----
    if (c.crossDir) {
      let dirF = c.crossDir; // 연속적인 진행 방향 계수 (턴 중엔 +1↔-1 사이를 지남)
      if (c.turnAt != null && c.t >= c.turnAt) {
        const prog = Math.min(1, (c.t - c.turnAt) / c.turnDur);
        dirF = c.crossDir * Math.cos(prog * Math.PI); // 급격한 스냅 없이 완만한 호로 반전
        c.tilt = Math.sin(prog * Math.PI) * 0.26 * c.crossDir; // 턴 중 몸이 살짝 기울어짐(roll)
        if (prog >= 1) { c.crossDir = -c.crossDir; c.turnAt = null; c.tilt = 0; }
      }
      let speed = c.crossSpeed;
      if (c.burstGlide) {
        // 꼬리 킥에 맞춰 훅 가속 → 관성 활공 (일정 속도 대신 사인 리듬)
        const kick = Math.max(0, Math.sin((c.t + c.spawnT) * 2.4));
        speed *= 0.5 + kick * kick * 1.1;
      }
      c.baseX += dirF * speed * dtSec;
      if (Math.abs(dirF) > 0.12) c.face = dirF > 0 ? 1 : -1; // 이동 방향을 보며 헤엄침 (수평 반전)
    }

    // ---- 호버링 (작은 8자 리사주 — 산호 주변에 사는 느낌) ----
    let hoverDX = 0, hoverDY = 0;
    if (c.hoverR) {
      const ht = (c.t + c.spawnT) * c.hoverW;
      hoverDX = Math.sin(ht) * c.hoverR;
      hoverDY = Math.sin(ht * 2) * c.hoverR * 0.45;
      c.face = Math.cos(ht) >= 0 ? 1 : -1; // 8자 진행 방향을 따라 좌우 전환
    }

    // ---- 도망 반응 (관상용 소형 어류만, 은은하게) ----
    if (FLEE_SPECIES.has(sp.id) && !state.over) {
      const fdx = (c.curX ?? c.baseX) - player.x;
      const fdy = (c.curY ?? c.y) - player.y;
      const fd = Math.hypot(fdx, fdy);
      if (fd < FLEE_RADIUS && fd > 1) {
        const push = (1 - fd / FLEE_RADIUS) * 55; // 가까울수록 살짝 빨라짐
        c.baseX += (fdx / fd) * push * dtSec;
        c.fleeY = (c.fleeY || 0) + (fdy / fd) * push * dtSec * 0.5;
      }
    }

    // 제자리형(비가로지르기) 생물이 도망/호버로 화면 밖까지 밀려나지 않게 클램프
    if (!c.crossDir) {
      const rr = creatureVisualRadius(sp);
      c.baseX = clamp(c.baseX, rr + 4, CANVAS_W - rr - 4);
    }

    const swayFreq = (Math.PI * 2) / sp.swayPeriod;
    const t = state.timeSec + c.spawnT;
    c.curX = c.baseX + Math.sin(t * swayFreq + c.phase) * sp.swayAmp + hoverDX;
    c.curY = c.y + hoverDY + (c.fleeY || 0);

    const r = creatureVisualRadius(sp) * 0.6;
    const pr = PLAYER_RADIUS * 0.6;
    const dx = c.curX - player.x;
    const dy = c.curY - player.y;
    const distSq = dx * dx + dy * dy;
    // 근접 관찰: 부딪히지 않아도 가까이 지나가면 도감에 기록된다
    // (관찰이 목적인데 충돌해야만 기록되는 모순 제거)
    if (!state.over && !state.cleared && distSq < OBSERVE_DIST * OBSERVE_DIST) {
      recordObservation(sp);
    }
    if (!state.over && distSq < (r + pr) * (r + pr)) {
      damagePlayer();
    }

    // 큰 생물이 지나갈 때 가끔 기포를 흘린다 (아주 낮은 확률로, 매 프레임 체크)
    if (BIG_BUBBLE_SPECIES.has(sp.id) && state.bubbles.length < MAX_BUBBLES && Math.random() < 0.02) {
      state.bubbles.push(...createBubbleColumn(c.curX, c.curY, 1 + Math.floor(Math.random() * 2), 0.8, 0.9));
      sound.playBubble(0.7, 0.07);
    }

    // 심해 암전 구역에서 발광 생물이 가까이 오면 아주 은은한 톤 힌트로 긴장감을 준다
    // (쿨다운으로 스팸 방지, 거리가 가까울수록 살짝 또렷하게)
    if (zone.pitchBlack && sp.glowing && state.creatureHintCooldown <= 0) {
      const hdx = c.curX - player.x, hdy = c.curY - player.y;
      const dist = Math.hypot(hdx, hdy);
      if (dist < 100) {
        sound.playCreatureHint(clamp(1 - dist / 100, 0, 1));
        state.creatureHintCooldown = randRange(3, 6);
      }
    }

    const crossedOff = c.crossDir && (c.curX < -80 || c.curX > CANVAS_W + 80);
    if (isOffscreenY(c.y, creatureVisualRadius(sp)) || crossedOff) {
      state.creatures.splice(i, 1);
    }
  }

  // ---- 아이템 갱신 + 획득 ----
  const magR = magnetRadius();
  for (let i = state.items.length - 1; i >= 0; i--) {
    const it = state.items[i];
    it.y -= scrollPx;
    // 진주 자석: 흡인 반경 안의 수집 아이템이 다이버 쪽으로 빨려온다 (레벨 보물 제외)
    if (magR > 0 && ITEM_TYPES[it.type].kind !== 'levelGoal' && !state.over && !state.cleared) {
      const mdx = player.x - it.x, mdy = player.y - it.y;
      const md = Math.hypot(mdx, mdy);
      if (md < magR && md > 1) {
        const pull = 90 + 260 * (1 - md / magR); // 가까울수록 강하게
        it.x += (mdx / md) * pull * dtSec;
        it.y += (mdy / md) * pull * dtSec;
      }
    }
    const r = it.radius * 0.85;
    const pr = PLAYER_RADIUS * 0.6;
    const dx = it.x - player.x;
    const dy = it.y - player.y;
    if (!state.over && dx * dx + dy * dy < (r + pr) * (r + pr)) {
      const def = ITEM_TYPES[it.type];
      haptic(def.kind === 'levelGoal' ? 'success' : 'pickup');
      if (def.kind === 'heal') {
        healPlayer();
        sound.playPotion();
        state.bursts.push(createBurst(it.x, it.y, '#7dffb0'));
      } else if (def.kind === 'levelGoal') {
        state.score += def.points;
        sound.playTreasureFanfare();
        state.bursts.push(createBurst(it.x, it.y, '#ffe27a'));
        beginAscent();
      } else {
        state.score += def.points;
        if (it.type === 'chest') sound.playChest();
        else if (it.type === 'oxygen') sound.playOxygen();
        else sound.playPearl();
        state.bursts.push(createBurst(it.x, it.y, it.type === 'chest' ? '#ffe27a' : '#bfe8ff'));
      }
      state.items.splice(i, 1);
      continue;
    }
    if (isOffscreenY(it.y, it.radius)) {
      state.items.splice(i, 1);
    }
  }

  // ---- 바다 바닥 스크롤 (목표 수심에 도달한 뒤에만 존재) ----
  if (state.floorReached && state.floorY != null) {
    state.floorY -= scrollPx;
  }

  // ---- 지형 갱신 + 충돌 (근경만) ----
  for (let i = state.terrainFg.length - 1; i >= 0; i--) {
    const ch = state.terrainFg[i];
    ch.y -= scrollPx;
    if (!state.over && collidesWithTerrain(ch, player.x, player.y, PLAYER_RADIUS * 0.6)) {
      const wasInvuln = state.timeSec < state.invulnUntil;
      damagePlayer();
      // 지형에 스친 순간 돌가루 파편이 튀는 연출 (무적시간 중 연속 판정은 중복 방지)
      if (!wasInvuln) {
        state.bursts.push(createBurst(player.x, player.y, '#b8a488'));
      }
    }
    if (state.scrollDir > 0 ? (ch.y + ch.height < -20) : (ch.y > CANVAS_H + 20)) state.terrainFg.splice(i, 1);
  }
  for (let i = state.terrainBg.length - 1; i >= 0; i--) {
    const ch = state.terrainBg[i];
    ch.y -= scrollPx * 0.6; // 중원경은 시차감을 위해 느리게
    if (state.scrollDir > 0 ? (ch.y + ch.height < -20) : (ch.y > CANVAS_H + 20)) state.terrainBg.splice(i, 1);
  }
  for (let i = state.terrainDistant.length - 1; i >= 0; i--) {
    const ch = state.terrainDistant[i];
    ch.y -= scrollPx * 0.3; // 극원경: 3단 패럴랙스 중 가장 느리게
    if (state.scrollDir > 0 ? (ch.y + ch.height < -20) : (ch.y > CANVAS_H + 20)) state.terrainDistant.splice(i, 1);
  }
  for (let i = state.distantCreatures.length - 1; i >= 0; i--) {
    const c = state.distantCreatures[i];
    c.y -= scrollPx * 0.3;
    if (state.scrollDir > 0 ? c.y < -150 : c.y > CANVAS_H + 150) state.distantCreatures.splice(i, 1);
  }

  // ---- 파티클 버스트 + 기포 ----
  for (let i = state.bursts.length - 1; i >= 0; i--) {
    updateBurst(state.bursts[i], dtSec);
    if (state.bursts[i].done) state.bursts.splice(i, 1);
  }
  updateBubbles(state.bubbles, dtSec);
  if (currentTheme?.driftX) {
    for (const b of state.bubbles) b.x += currentTheme.driftX * dtSec; // 조류 드리프트
  }

  updateHud(depthM);
}

function updateHud(depthM) {
  hudDepth.textContent = `${Math.max(0, Math.floor(depthM))} m`;
  hudScore.textContent = `🦪 ${state.score}`;
  hudDex.textContent = `도감 ${observedSet.size}/${TOTAL_SPECIES}`;
  hudHealth.textContent = HEART_FULL.repeat(state.health) + HEART_EMPTY.repeat(Math.max(0, maxHealth() - state.health));
  if (hudPhase) {
    if (state.targetDepthM == null) {
      hudPhase.style.display = 'none';
    } else if (state.phase === 'ascending') {
      hudPhase.style.display = 'block';
      hudPhase.textContent = `⬆️ 수면까지 ${Math.max(0, Math.ceil(depthM))} m`;
    } else {
      hudPhase.style.display = 'block';
      const remain = Math.max(0, Math.ceil(state.targetDepthM - depthM));
      hudPhase.textContent = state.floorReached ? '⬇️ 보물을 찾아라!' : `⬇️ 목표까지 ${remain} m`;
    }
  }
}

function render() {
  const depthM = currentDepthM();
  const invulnerable = state.timeSec < state.invulnUntil;
  const shaking = state.timeSec < state.shakeUntil;

  ctx.save();
  if (shaking) {
    // 피격 화면 흔들림: 짧게 감쇠하는 랜덤 오프셋
    const remain = (state.shakeUntil - state.timeSec) / SHAKE_DURATION;
    const mag = SHAKE_MAG * remain;
    const sx = Math.sin(state.timeSec * 47 + state.shakeSeed) * mag;
    const sy = Math.cos(state.timeSec * 53 + state.shakeSeed) * mag;
    ctx.translate(sx, sy);
  }

  drawBackground(ctx, depthM, state.timeSec, currentTheme);

  // 통가 테마: 화면 하단의 희미한 붉은 화산 글로우 (플리커)
  if (currentTheme?.signature === 'volcano') {
    const flicker = 0.22 + Math.sin(state.timeSec * 1.7) * 0.05 + Math.sin(state.timeSec * 4.3) * 0.025;
    const gx = CANVAS_W * 0.5 + Math.sin(state.timeSec * 0.11) * 60;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter'; // 어두운 배경/색보정에 눌리지 않게 가산 합성
    const g = ctx.createRadialGradient(gx, CANVAS_H + 60, 20, gx, CANVAS_H + 60, 320);
    g.addColorStop(0, `rgba(255,80,28,${flicker})`);
    g.addColorStop(0.55, `rgba(190,45,20,${flicker * 0.5})`);
    g.addColorStop(1, 'rgba(120,20,10,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    ctx.restore();
  }

  // 극원경: 가장 뒤쪽 레이어 — 흐릿한 큰 실루엣 + 가끔 스쳐가는 거대 생물 그림자
  for (const ch of state.terrainDistant) drawTerrainChunk(ctx, ch, state.timeSec);
  for (const w of state.wrecks) drawShipwreck(ctx, w.x, w.y, w.scale);
  if (state.distantCreatures.length) {
    ctx.save();
    ctx.globalAlpha = 0.18;
    for (const c of state.distantCreatures) {
      const sp = speciesById(c.speciesId);
      sp.draw(ctx, c.x, c.y, state.timeSec + c.spawnT, sp.size * c.scale);
    }
    ctx.restore();
  }

  // 원경 물고기 떼 (점 실루엣 무리 — 배경 허전함 완화)
  if (state.fishSchools.length) {
    ctx.save();
    ctx.fillStyle = 'rgba(16,30,48,0.4)';
    for (const fs of state.fishSchools) {
      const t = state.timeSec + fs.spawnT;
      for (const sd of fs.seeds) {
        const wob = Math.sin(t * 2.2 + sd.phase) * 3;
        ctx.beginPath();
        ctx.ellipse(fs.x + sd.dx, fs.y + sd.dy + wob, sd.r * 1.7, sd.r, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  for (const ch of state.terrainBg) drawTerrainChunk(ctx, ch, state.timeSec);

  for (const c of state.creatures) {
    const sp = speciesById(c.speciesId);
    const px = c.curX ?? c.baseX, py = c.curY ?? c.y;
    // 기본 스프라이트는 오른쪽을 향함 — 이동 방향(face)에 맞춰 수평 반전하고,
    // 회유 턴 중에는 몸 기울기(tilt)를 살짝 준다. 수직 반전은 절대 하지 않음.
    const face = c.face ?? 1;
    if (face === -1 || c.tilt) {
      ctx.save();
      ctx.translate(px, py);
      if (c.tilt) ctx.rotate(c.tilt);
      if (face === -1) ctx.scale(-1, 1);
      sp.draw(ctx, 0, 0, state.timeSec + c.spawnT, sp.size);
      ctx.restore();
    } else {
      sp.draw(ctx, px, py, state.timeSec + c.spawnT, sp.size);
    }
  }

  // 목표 수심의 바다 바닥 (보물을 아직 안 먹었을 때만 — 상승 시작하면 서서히 아래로 사라짐)
  if (state.floorReached && state.floorY != null && state.floorY < CANVAS_H + 260) {
    drawSeafloor(ctx, state.floorY, zoneAt(state.targetDepthM).id);
  }

  for (const it of state.items) drawItem(ctx, it, state.timeSec);

  for (const ch of state.terrainFg) drawTerrainChunk(ctx, ch, state.timeSec);

  // 미드나이트존/헤달존: 화면을 거의 새까맣게 덮고 다이버 헤드램프 주변만 보이게 하는
  // 조명 마스크를 씌운다. 발광 생물은 어둠 속에서도 발광 지점만 먼저 빛나 보이도록
  // 마스크 위에 별도로 그려 서스펜스를 만든다 (비발광 생물/지형은 조명 안에서만 보임).
  const zone = zoneAt(depthM);
  if (zone.pitchBlack) {
    drawHeadlampDarkness(ctx, player.x, player.y, { rx: 100 * lampMul(), ry: 225 * lampMul() });
    for (const c of state.creatures) {
      const sp = speciesById(c.speciesId);
      if (!sp.glowing) continue;
      const spots = speciesGlowSpots(sp.id);
      if (!spots) continue;
      const wx = c.curX ?? c.baseX;
      const wy = c.curY ?? c.y;
      const flip = c.face ?? 1;
      for (const spot of spots) {
        glow(ctx, wx + spot.dx * flip * sp.size, wy + spot.dy * sp.size, spot.r * sp.size, spot.color, spot.alpha);
      }
    }
  } else {
    drawDepthVeil(ctx, depthM);
  }

  // 헤드램프 글로우는 밝은 표층에선 안 보이고, 어두워질수록 서서히 켜진다
  const lampT = clamp((depthM - 60) / 240, 0, 1);
  // 무적 시간 동안 다이버를 깜빡여서 피격 후 보호 상태임을 알림
  if (invulnerable) {
    const blinkOn = Math.floor(state.timeSec * 10) % 2 === 0;
    ctx.save();
    ctx.globalAlpha = blinkOn ? 1 : 0.35;
    drawPlayer(ctx, player, lampT, currentTheme?.lampColor);
    ctx.restore();
  } else {
    drawPlayer(ctx, player, lampT, currentTheme?.lampColor);
  }

  for (const b of state.bursts) drawBurst(ctx, b);
  drawBubbles(ctx, state.bubbles);

  ctx.restore();

  // 화면 전체 후처리 (비네팅+색조 보정+마린 스노) — 흔들림 오프셋과 무관하게 항상
  // 화면 전체를 고정 좌표로 덮어야 하므로 위 ctx.restore() 이후, 맨 마지막에 그린다.
  drawPostProcess(ctx, depthM, state.timeSec, currentTheme?.driftX || 0);
}

let lastTs = null;
function loop(ts) {
  if (lastTs === null) lastTs = ts;
  const dtMs = ts - lastTs;
  lastTs = ts;
  const dtSec = dtMs / 1000; // 밀리초 → 초 정규화 (필수)

  if (screen === 'globe') {
    // 탭이 백그라운드였다 돌아오면 dt가 수 초로 튀어 지구본이 훌쩍 돌아가 버림 — 클램프
    const dtG = clamp(dtSec, 0, 0.05);
    updateGlobeIdleSpin(globeState, dtG);
    state.timeSec += dtG; // 별 트윙클/행성 시차용 시계는 계속 흐르게 함
    renderGlobeScreen();
  } else {
    if (state.running && !state.over && !state.cleared) {
      update(dtSec);
    } else {
      // 정지 상태에서도 파티클/배경 애니메이션은 자연스럽게 유지하지 않고 정지된 프레임 유지
    }
    render();
  }
  requestAnimationFrame(loop);
}

// site: DIVE_SITES 원소 또는 null(지구본 없이 진입하는 개발용 ?depth= 모드)
function startDive(site) {
  currentSite = site;
  currentTheme = site?.theme ?? null;
  state = makeInitialState();
  state.running = true;
  state.targetDepthM = site ? site.targetDepth : null;
  player.x = CANVAS_W / 2;
  player.y = PLAYER_ANCHOR_Y;
  player.vx = 0;
  player.vy = 0;
  overlay.classList.remove('show');
  lastTs = null;
  showDivingScreen();
  sound.startAmbience();
}

btnDiveStart.addEventListener('click', () => {
  sound.initAudio(); // 첫 사용자 제스처 보장 지점 — iOS Safari 자동재생 정책 대응
  sound.playClick();
  if (!selectedPin) return;
  if (!isSiteUnlocked(selectedPin.index, clearedSet, DIVE_SITES)) return;
  startDive(selectedPin.site);
});

btnRestart.addEventListener('click', () => {
  sound.initAudio();
  sound.playClick();
  startDive(currentSite);
});
btnGlobeFromOver.addEventListener('click', () => {
  sound.initAudio();
  sound.playClick();
  selectedPin = null;
  updateSiteCardUI();
  showGlobeScreen();
});

updatePearlUI();

const devSiteId = new URLSearchParams(window.location.search).get('site');
const devSite = devSiteId ? DIVE_SITES.find(s => s.id === devSiteId) : null;
if (devSite) {
  // 개발용 ?site=<id>: 지구본 건너뛰고 해당 스팟 테마로 바로 진입 (테마 검증 편의)
  startDive(devSite);
} else if (state.devAutoStart) {
  // 개발용 ?depth= 파라미터가 있으면 지구본을 건너뛰고 바로 시작 (테마 없이 기존 zone 룩)
  startDive(null);
} else {
  showGlobeScreen();
}


requestAnimationFrame(loop);
