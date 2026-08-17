// game.js — 메인 루프, 물리, 충돌 판정, HUD 업데이트, 진입점
// 중요: 델타타임은 반드시 초 단위(dtSec = dt/1000)로 정규화해서 사용한다.
// (이전 프로토타입에서 ms를 초처럼 잘못 써서 속도가 폭주하는 버그가 있었음 — 재발 금지)

import { CANVAS_W, CANVAS_H, clamp, weightedPick, randRange, glow } from './utils.js';
import { zoneAt, drawBackground, drawDepthVeil, drawHeadlampDarkness, drawPostProcess } from './zones.js';
import { speciesById, SPECIES, pickSpeciesForZone, speciesGlowSpots } from './species.js';
import { createTerrainChunk, createBgChunk, createDistantChunk, drawTerrainChunk, collidesWithTerrain } from './terrain.js';
import { createPlayer, attachPlayerInput, updatePlayer, drawPlayer, PLAYER_ANCHOR_Y, PLAYER_RADIUS } from './player.js';
import { ITEM_TYPES, createItem, drawItem, createBurst, updateBurst, drawBurst } from './item.js';
import {
  createGlobeState, drawGlobe, attachGlobeDrag, updateGlobeIdleSpin, drawSpaceBackground,
  DIVE_SITES, projectSites, drawPins, hitTestPins,
  loadClearedSet, saveClearedSet, isSiteUnlocked,
} from './globe.js';

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
const DISTANT_SILHOUETTE_BY_ZONE = { shallow: 'reefshark', twilight: 'reefshark' };

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const hudEl = document.getElementById('hud');
const touchControlsEl = document.getElementById('touchControls');
const hudDepth = document.getElementById('depthReadout');
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
const GLOBE_CY = globeCanvas.height * 0.46;
const GLOBE_R = Math.min(globeCanvas.width, globeCanvas.height) * 0.37;

const globeState = createGlobeState();
let clearedSet = loadClearedSet();
let selectedPin = null;   // 카드에 표시 중인 핀 (projectSites 결과 원소)
let currentSite = null;   // 지금 다이빙 중인 스팟 (devAutoStart로 진입하면 null)
let screen = 'globe';     // 'globe' | 'diving'
let lastProjectedPins = [];

attachGlobeDrag(globeCanvas, globeState);

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
  const hit = hitTestPins(lastProjectedPins, p.x, p.y);
  selectedPin = hit || null;
  updateSiteCardUI();
});

function renderGlobeScreen() {
  globeCtx.clearRect(0, 0, globeCanvas.width, globeCanvas.height);
  drawSpaceBackground(globeCtx, globeCanvas.width, globeCanvas.height, state.timeSec);
  drawGlobe(globeCtx, GLOBE_CX, GLOBE_CY, GLOBE_R, globeState);
  lastProjectedPins = projectSites(GLOBE_CX, GLOBE_CY, GLOBE_R, globeState, DIVE_SITES);
  drawPins(globeCtx, lastProjectedPins, clearedSet, DIVE_SITES);
}

function showGlobeScreen() {
  screen = 'globe';
  globeScreen.classList.remove('hide');
  hudEl.style.display = 'none';
  touchControlsEl.style.display = 'none';
  overlay.classList.remove('show');
}

function showDivingScreen() {
  screen = 'diving';
  globeScreen.classList.add('hide');
  hudEl.style.display = 'flex';
  touchControlsEl.style.display = 'flex';
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
    targetDepthM: null, // 선택한 다이빙 스팟의 목표 수심(도달하면 클리어) — 지구본 없이 진입 시 null
    totalScrollPx: startDepthM * PX_PER_METER,
    score: 0,
    dex: new Set(),
    health: MAX_HEALTH,
    invulnUntil: -1,
    shakeUntil: -1,
    shakeSeed: Math.random() * 1000,
    creatures: [],
    items: [],
    terrainFg: [],
    terrainBg: [],
    terrainDistant: [],
    distantCreatures: [],
    distantCreatureTimer: randRange(6, 12),
    bursts: [],
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
function spawnCreature(depthM) {
  if (state.creatures.length >= MAX_ENTITIES_ON_SCREEN) return;
  const zoneId = zoneAt(depthM).id;
  const sp = pickSpeciesForZone(zoneId, state.speciesLastSpawn, state.lastSpeciesId, state.timeSec);
  if (!sp) return;
  const r = creatureVisualRadius(sp);
  const margin = r + 6;
  const x = randRange(margin, CANVAS_W - margin);
  state.creatures.push({
    speciesId: sp.id,
    baseX: x,
    y: CANVAS_H + r + 10,
    phase: Math.random() * Math.PI * 2,
    spawnT: Math.random() * 10,
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
  state.items.push(createItem(type, x, CANVAS_H + r + 10));
}

// 회복 아이템은 다른 수집 아이템보다 훨씬 드물게, 별도 타이머로 스폰된다.
function spawnPotion() {
  const totalOnScreen = state.creatures.length + state.items.length;
  if (totalOnScreen >= MAX_ENTITIES_ON_SCREEN) return;
  const r = ITEM_TYPES.potion.radius;
  const margin = r + 10;
  const x = randRange(margin, CANVAS_W - margin);
  state.items.push(createItem('potion', x, CANVAS_H + r + 10));
}

function spawnTerrainFg(depthM) {
  const zoneId = zoneAt(depthM).id;
  const chunk = createTerrainChunk(zoneId, state.terrainFgSide, CANVAS_H);
  state.terrainFg.push(chunk);
  state.terrainFgSide = state.terrainFgSide === 'left' ? 'right' : 'left';
  // 다음 벽(반대쪽)은 이번 벽의 "길이"만큼 스크롤이 지나간 뒤에야 스폰한다.
  // 벽 높이가 화면의 1.5~3배로 길기 때문에, 예전처럼 화면 높이 기준 고정 간격을
  // 쓰면 이전 벽이 채 사라지기도 전에 반대쪽 벽이 겹쳐 나타나 "양쪽이 동시에
  // 좁게" 보이는 문제가 있었다 — 한 번에 한쪽 벽만 보이도록 간격을 벽 길이에 맞춘다.
  state.terrainFgGap = chunk.height + randRange(70, 200);
}

function spawnTerrainBg(depthM) {
  const zoneId = zoneAt(depthM).id;
  const chunk = createBgChunk(zoneId, state.terrainBgSide, CANVAS_H);
  state.terrainBg.push(chunk);
  state.terrainBgSide = Math.random() < 0.5 ? 'left' : 'right';
  state.terrainBgGap = randRange(CANVAS_H * 0.8, CANVAS_H * 1.5);
}

function spawnTerrainDistant(depthM) {
  const zoneId = zoneAt(depthM).id;
  const chunk = createDistantChunk(zoneId, state.terrainDistantSide, CANVAS_H);
  state.terrainDistant.push(chunk);
  state.terrainDistantSide = Math.random() < 0.5 ? 'left' : 'right';
  state.terrainDistantGap = randRange(CANVAS_H * 1.2, CANVAS_H * 2.2);
}

// 목업 참조: 헤드램프 뒤쪽 원경에 흐릿하게 스쳐가는 거대 해양생물 실루엣 (충돌 없음)
function spawnDistantCreature(depthM) {
  const zoneId = zoneAt(depthM).id;
  const spId = DISTANT_SILHOUETTE_BY_ZONE[zoneId];
  if (!spId) return;
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

function endGame() {
  state.over = true;
  state.running = false;
  overlayTitleEl.textContent = '조난';
  btnRestart.textContent = '다시 하강';
  finalDepthEl.textContent = `도달 깊이 ${Math.floor(currentDepthM())} m`;
  finalScoreEl.textContent = `수집 점수 ${state.score}`;
  finalDexEl.textContent = `관찰한 종 ${state.dex.size}/${TOTAL_SPECIES}`;
  overlay.classList.add('show');
}

// 목표 수심에 도달하면 레벨 클리어 — 진행상황을 localStorage에 저장하고 다음 스팟을 잠금해제한다.
function clearLevel() {
  state.cleared = true;
  state.running = false;
  if (currentSite) {
    clearedSet.add(currentSite.id);
    saveClearedSet(clearedSet);
  }
  overlayTitleEl.textContent = '레벨 클리어! 🎉';
  btnRestart.textContent = '다시 도전';
  finalDepthEl.textContent = `도달 깊이 ${Math.floor(currentDepthM())} m`;
  finalScoreEl.textContent = `수집 점수 ${state.score}`;
  finalDexEl.textContent = `관찰한 종 ${state.dex.size}/${TOTAL_SPECIES}`;
  overlay.classList.add('show');
}

// 즉사 대신 데미지 누적 방식. 피격 후 일정 시간 무적이라 같은 장애물에 연속으로
// 부딪혀 순식간에 체력이 다 깎이는 억울한 상황을 방지한다.
function damagePlayer() {
  if (state.over || state.cleared) return;
  if (state.timeSec < state.invulnUntil) return; // 무적 시간 중이면 무시
  state.health -= 1;
  state.invulnUntil = state.timeSec + INVULN_DURATION;
  state.shakeUntil = state.timeSec + SHAKE_DURATION;
  if (state.health <= 0) {
    state.health = 0;
    endGame();
  }
}

function healPlayer() {
  if (state.health < MAX_HEALTH) {
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
  const scrollSpeed = scrollSpeedForDepth(depthM);
  const scrollPx = scrollSpeed * dtSec;
  state.totalScrollPx += scrollPx;

  // 목표 수심(선택한 다이빙 스팟)에 도달하면 즉시 클리어 처리하고 이번 프레임의
  // 나머지 스폰/충돌 로직은 건너뛴다 (막 클리어한 순간에 피격당하는 억울함 방지).
  if (state.targetDepthM != null && !state.over && !state.cleared && currentDepthM() >= state.targetDepthM) {
    clearLevel();
    updateHud(currentDepthM());
    return;
  }

  updatePlayer(player, dtSec, state.timeSec);

  // ---- 스폰 타이머 (시간 기반, 프레임 기반 절대 금지) ----
  state.creatureSpawnTimer -= dtSec;
  if (state.creatureSpawnTimer <= 0) {
    spawnCreature(depthM);
    state.creatureSpawnTimer = randRange(0.65, 1.4);
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
    state.distantCreatureTimer = randRange(9, 18);
  }

  // ---- 생물 갱신 + 충돌 ----
  // 다이버가 하강할수록 생물은 화면 아래에서 나타나 위로 흘러가 사라진다 (지형과 동일 방향).
  for (let i = state.creatures.length - 1; i >= 0; i--) {
    const c = state.creatures[i];
    c.y -= scrollPx;
    const sp = speciesById(c.speciesId);
    const swayFreq = (Math.PI * 2) / sp.swayPeriod;
    const t = state.timeSec + c.spawnT;
    c.curX = c.baseX + Math.sin(t * swayFreq + c.phase) * sp.swayAmp;
    c.curY = c.y;

    const r = creatureVisualRadius(sp) * 0.6;
    const pr = PLAYER_RADIUS * 0.6;
    const dx = c.curX - player.x;
    const dy = c.curY - player.y;
    if (!state.over && dx * dx + dy * dy < (r + pr) * (r + pr)) {
      state.dex.add(sp.id);
      damagePlayer();
    }

    if (c.y + creatureVisualRadius(sp) < -20) {
      state.creatures.splice(i, 1);
    }
  }

  // ---- 아이템 갱신 + 획득 ----
  for (let i = state.items.length - 1; i >= 0; i--) {
    const it = state.items[i];
    it.y -= scrollPx;
    const r = it.radius * 0.85;
    const pr = PLAYER_RADIUS * 0.6;
    const dx = it.x - player.x;
    const dy = it.y - player.y;
    if (!state.over && dx * dx + dy * dy < (r + pr) * (r + pr)) {
      const def = ITEM_TYPES[it.type];
      if (def.kind === 'heal') {
        healPlayer();
        state.bursts.push(createBurst(it.x, it.y, '#7dffb0'));
      } else {
        state.score += def.points;
        state.bursts.push(createBurst(it.x, it.y, it.type === 'chest' ? '#ffe27a' : '#bfe8ff'));
      }
      state.items.splice(i, 1);
      continue;
    }
    if (it.y + it.radius < -20) {
      state.items.splice(i, 1);
    }
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
    if (ch.y + ch.height < -20) state.terrainFg.splice(i, 1);
  }
  for (let i = state.terrainBg.length - 1; i >= 0; i--) {
    const ch = state.terrainBg[i];
    ch.y -= scrollPx * 0.6; // 중원경은 시차감을 위해 느리게
    if (ch.y + ch.height < -20) state.terrainBg.splice(i, 1);
  }
  for (let i = state.terrainDistant.length - 1; i >= 0; i--) {
    const ch = state.terrainDistant[i];
    ch.y -= scrollPx * 0.3; // 극원경: 3단 패럴랙스 중 가장 느리게
    if (ch.y + ch.height < -20) state.terrainDistant.splice(i, 1);
  }
  for (let i = state.distantCreatures.length - 1; i >= 0; i--) {
    const c = state.distantCreatures[i];
    c.y -= scrollPx * 0.3;
    if (c.y < -150) state.distantCreatures.splice(i, 1);
  }

  // ---- 파티클 버스트 ----
  for (let i = state.bursts.length - 1; i >= 0; i--) {
    updateBurst(state.bursts[i], dtSec);
    if (state.bursts[i].done) state.bursts.splice(i, 1);
  }

  updateHud(depthM);
}

function updateHud(depthM) {
  hudDepth.textContent = `${Math.floor(depthM)} m`;
  hudScore.textContent = `점수 ${state.score}`;
  hudDex.textContent = `도감 ${state.dex.size}/${TOTAL_SPECIES}`;
  hudHealth.textContent = HEART_FULL.repeat(state.health) + HEART_EMPTY.repeat(MAX_HEALTH - state.health);
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

  drawBackground(ctx, depthM, state.timeSec);

  // 극원경: 가장 뒤쪽 레이어 — 흐릿한 큰 실루엣 + 가끔 스쳐가는 거대 생물 그림자
  for (const ch of state.terrainDistant) drawTerrainChunk(ctx, ch, state.timeSec);
  if (state.distantCreatures.length) {
    ctx.save();
    ctx.globalAlpha = 0.15;
    for (const c of state.distantCreatures) {
      const sp = speciesById(c.speciesId);
      sp.draw(ctx, c.x, c.y, state.timeSec + c.spawnT, sp.size * c.scale);
    }
    ctx.restore();
  }

  for (const ch of state.terrainBg) drawTerrainChunk(ctx, ch, state.timeSec);

  for (const c of state.creatures) {
    const sp = speciesById(c.speciesId);
    sp.draw(ctx, c.curX ?? c.baseX, c.curY ?? c.y, state.timeSec + c.spawnT, sp.size);
  }

  for (const it of state.items) drawItem(ctx, it, state.timeSec);

  for (const ch of state.terrainFg) drawTerrainChunk(ctx, ch, state.timeSec);

  // 미드나이트존/헤달존: 화면을 거의 새까맣게 덮고 다이버 헤드램프 주변만 보이게 하는
  // 조명 마스크를 씌운다. 발광 생물은 어둠 속에서도 발광 지점만 먼저 빛나 보이도록
  // 마스크 위에 별도로 그려 서스펜스를 만든다 (비발광 생물/지형은 조명 안에서만 보임).
  const zone = zoneAt(depthM);
  if (zone.pitchBlack) {
    drawHeadlampDarkness(ctx, player.x, player.y);
    for (const c of state.creatures) {
      const sp = speciesById(c.speciesId);
      if (!sp.glowing) continue;
      const spots = speciesGlowSpots(sp.id);
      if (!spots) continue;
      const wx = c.curX ?? c.baseX;
      const wy = c.curY ?? c.y;
      for (const spot of spots) {
        glow(ctx, wx + spot.dx * sp.size, wy + spot.dy * sp.size, spot.r * sp.size, spot.color, spot.alpha);
      }
    }
  } else {
    drawDepthVeil(ctx, depthM);
  }

  // 무적 시간 동안 다이버를 깜빡여서 피격 후 보호 상태임을 알림
  if (invulnerable) {
    const blinkOn = Math.floor(state.timeSec * 10) % 2 === 0;
    ctx.save();
    ctx.globalAlpha = blinkOn ? 1 : 0.35;
    drawPlayer(ctx, player);
    ctx.restore();
  } else {
    drawPlayer(ctx, player);
  }

  for (const b of state.bursts) drawBurst(ctx, b);

  ctx.restore();

  // 화면 전체 후처리 (비네팅+색조 보정+마린 스노) — 흔들림 오프셋과 무관하게 항상
  // 화면 전체를 고정 좌표로 덮어야 하므로 위 ctx.restore() 이후, 맨 마지막에 그린다.
  drawPostProcess(ctx, depthM, state.timeSec);
}

let lastTs = null;
function loop(ts) {
  if (lastTs === null) lastTs = ts;
  const dtMs = ts - lastTs;
  lastTs = ts;
  const dtSec = dtMs / 1000; // 밀리초 → 초 정규화 (필수)

  if (screen === 'globe') {
    updateGlobeIdleSpin(globeState, dtSec);
    state.timeSec += dtSec; // 별 트윙클/행성 시차용 시계는 계속 흐르게 함
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
}

btnDiveStart.addEventListener('click', () => {
  if (!selectedPin) return;
  if (!isSiteUnlocked(selectedPin.index, clearedSet, DIVE_SITES)) return;
  startDive(selectedPin.site);
});

btnRestart.addEventListener('click', () => startDive(currentSite));
btnGlobeFromOver.addEventListener('click', () => {
  selectedPin = null;
  updateSiteCardUI();
  showGlobeScreen();
});

if (state.devAutoStart) {
  // 개발용 ?depth= 파라미터가 있으면 지구본을 건너뛰고 바로 시작 (구역 검증 편의)
  startDive(null);
} else {
  showGlobeScreen();
}

requestAnimationFrame(loop);
