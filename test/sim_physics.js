// 模拟输入事件序列，验证玩家跳跃与碰撞物理效果
// 运行：node test/sim_physics.js

import { parseLevel } from '../src/engine/level.js';
import { Game } from '../src/engine/game.js';
import { Input } from '../src/engine/input.js';
import {
  GRAVITY, MAX_FALL, JUMP_VELOCITY, JUMP_HOLD_FACTOR,
  MOVE_SPEED, TILE_SIZE, PLAYER_HEIGHT,
} from '../src/engine/physics.js';

const DT = 1 / 60; // 模拟 60 FPS

// 构造测试关卡（7 行 × 28 列）：
//   第 0 行：天花板（第 9-11 列留缺口，其他列实心用于测试顶撞截断）
//   第 4 行：悬空平台（第 15-17 列，用于落台测试）
//   第 5 行：P 出生点（第 0 列）+ 问号块（第 7 列，用于顶撞出金币测试）
//   第 6 行：完整地面（无深渊）
const levelText = [
  '#########...################', // 0 天花板（第9-11列有缺口）
  '............................', // 1
  '............................', // 2
  '............................', // 3
  '...............###..........', // 4 悬空平台（第15-17列）
  'P......?....................', // 5 P 出生点 + 问号块（第7列）
  '############################', // 6 完整地面
].join('\n');

const level = parseLevel(levelText);

// 辅助：创建并启动游戏
function newGame() {
  const g = new Game(level);
  g.start();
  return g;
}

// 辅助：让玩家稳定落地（出生后 onGround=false，需空跑几帧落到地面）
function settleOnGround(game, input) {
  for (let i = 0; i < 10; i++) {
    game.update(DT, input);
    input.resetFrame();
    if (game.player.onGround) return true;
  }
  return false;
}

// 辅助：模拟单帧输入并记录玩家状态
function step(game, input, label) {
  game.update(DT, input);
  const p = game.player;
  const rec = {
    label,
    x: p.x.toFixed(1),
    y: p.y.toFixed(1),
    vx: p.vx.toFixed(1),
    vy: p.vy.toFixed(1),
    onGround: p.onGround,
  };
  input.resetFrame();
  return rec;
}

// 输入事件快捷构造
function press(input, key) { input.keydown(key); }
function release(input, key) { input.keyup(key); }

let pass = 0;
let fail = 0;
function check(name, cond, detail) {
  if (cond) {
    pass++;
    console.log(`  ✔ ${name}`);
  } else {
    fail++;
    console.log(`  ✖ ${name}  ${detail || ''}`);
  }
}

console.log('=== 关卡布局 ===');
console.log(levelText);
console.log(`玩家出生点: x=${level.playerStart.x}, y=${level.playerStart.y}`);
console.log(`DT=${DT.toFixed(4)}s, GRAVITY=${GRAVITY}, JUMP_VELOCITY=${JUMP_VELOCITY}`);
console.log('');

// 地面顶面 Y 坐标（第 6 行顶面 = 6*32 = 192；玩家高 30 → 站立时 y=162）
const GROUND_TOP_Y = 6 * TILE_SIZE;
const STAND_Y = GROUND_TOP_Y - PLAYER_HEIGHT;

// ---------- 场景 1：原地短跳（按下立刻松开） ----------
console.log('【场景 1】原地短跳：按下跳跃后立即松开，应迅速截断上升速度');
{
  const game = newGame();
  const input = new Input();
  const p = game.player;

  // 先让玩家落到地面（onGround=true）
  const settled = settleOnGround(game, input);
  console.log(`  预热落地: onGround=${p.onGround}, y=${p.y.toFixed(1)}`);
  check('玩家能稳定落地', settled && p.onGround, `onGround=${p.onGround}`);

  // 起跳帧：按下跳跃
  press(input, ' ');
  const f0 = step(game, input, '按下跳跃');
  console.log(`  f0: vy=${f0.vy}, onGround=${f0.onGround}`);
  // 起跳后 vy = JUMP_VELOCITY + GRAVITY*dt（重力在同一帧内已作用）
  const expectedVy0 = JUMP_VELOCITY + GRAVITY * DT;
  check('起跳后 vy 接近 JUMP_VELOCITY（含一帧重力）',
    Math.abs(p.vy - expectedVy0) < 1, `vy=${p.vy} expected=${expectedVy0}`);

  // 下一帧：立刻松开跳跃 → cutJump 应生效
  release(input, ' ');
  const f1 = step(game, input, '松开跳跃');
  // 顺序：applyGravity 先 → cutJump 后
  // f1: vy = (f0.vy + GRAVITY*dt) * JUMP_HOLD_FACTOR
  const expectedVy1 = (expectedVy0 + GRAVITY * DT) * JUMP_HOLD_FACTOR;
  console.log(`  f1: vy=${f1.vy} (应为约 ${expectedVy1.toFixed(1)})`);
  check('松开后 vy 被截断（cutJump 生效）',
    Math.abs(p.vy - expectedVy1) < 1, `vy=${p.vy} expected=${expectedVy1}`);

  // 持续松开，等待落地
  let landed = false;
  let landFrame = -1;
  for (let i = 0; i < 60; i++) {
    const f = step(game, input, `下落 ${i}`);
    if (p.onGround && !landed) {
      landed = true;
      landFrame = i;
      console.log(`  f${i + 2}: 落地, vy=${f.vy}, y=${f.y}`);
      check('落地后 vy = 0', Math.abs(p.vy) < 0.001, `vy=${p.vy}`);
      check('落地后 onGround = true', p.onGround);
      check('落地 y 对齐到地面顶面',
        Math.abs(p.y - STAND_Y) < 1, `y=${p.y} vs standY=${STAND_Y}`);
      break;
    }
  }
  check('短跳后能落地', landed, '60 帧内未落地');
  if (landFrame >= 0) console.log(`  落地耗时: ${(landFrame + 2) * DT * 1000 | 0}ms`);
}
console.log('');

// ---------- 场景 2：长跳（按住跳跃键）比短跳更高 ----------
console.log('【场景 2】长跳：按住跳跃键不放，上升速度未被截断，跳得更高');
{
  const game = newGame();
  const input = new Input();
  const p = game.player;
  settleOnGround(game, input);

  const startY = p.y;

  // 短跳：按下立即松开
  press(input, ' ');
  step(game, input, '短跳起跳');
  release(input, ' ');
  let maxRiseShort = 0;
  for (let i = 0; i < 30 && !p.onGround; i++) {
    step(game, input, '短跳下落');
    maxRiseShort = Math.min(maxRiseShort, p.y - startY);
  }
  console.log(`  短跳最高上升: ${(-maxRiseShort).toFixed(1)}px`);

  // 长跳：重新起跳并按住，直到到达最高点（vy>=0）才松开
  game.restart();
  game.start();
  settleOnGround(game, input);
  const startY2 = p.y;
  let maxRiseLong = 0;

  press(input, ' ');
  let released = false;
  for (let i = 0; i < 60; i++) {
    step(game, input, `长跳 ${i}`);
    // 到达最高点（vy 由负转正）才松开，确保获得最大上升
    if (!released && p.vy >= 0) {
      release(input, ' ');
      released = true;
    }
    maxRiseLong = Math.min(maxRiseLong, p.y - startY2);
    if (p.onGround && i > 2) break;
  }
  console.log(`  长跳最高上升: ${(-maxRiseLong).toFixed(1)}px`);
  check('长跳比短跳更高', maxRiseLong < maxRiseShort,
    `long=${-maxRiseLong} short=${-maxRiseShort}`);
}
console.log('');

// ---------- 场景 3：顶撞问号块 ----------
console.log('【场景 3】顶撞问号块：跳起顶到 ? 块时 vy 归零并生成金币');
{
  const game = newGame();
  const input = new Input();
  const p = game.player;

  // 把玩家移到问号块正下方（第 7 列瓦片中心 = (7+0.5)*32 = 240）
  // 玩家宽 24，中心对齐瓦片中心：x = 240 - 12 = 228
  p.x = 228;
  p.y = STAND_Y;
  p.vx = 0; p.vy = 0;
  p.onGround = true; // 模拟已落地

  // 问号块在第 5 行第 7 列，y 范围 [160, 192)，底面 y=192
  // 玩家顶面 y = STAND_Y = 162，需跳起 192-162=30px 才能顶到
  const coinsBefore = game.coins.length;
  console.log(`  起始: x=${p.x}, y=${p.y}, coins=${coinsBefore}`);

  press(input, ' ');
  let bumped = false;
  for (let i = 0; i < 30; i++) {
    const f = step(game, input, `顶撞 ${i}`);
    if (game.coins.length > coinsBefore && !bumped) {
      bumped = true;
      console.log(`  f${i}: 顶到问号块, vy=${f.vy}, coins=${game.coins.length}`);
      check('顶撞后 vy = 0', Math.abs(p.vy) < 0.001, `vy=${p.vy}`);
      check('生成新金币', game.coins.length === coinsBefore + 1,
        `coins=${game.coins.length}`);
      const newCoin = game.coins[game.coins.length - 1];
      // 问号块在第 7 列第 5 行 → 上方金币 x 应在 (7+0.5)*32=240
      check('金币生成在问号块上方',
        Math.abs(newCoin.x - 240) < 1, `coin.x=${newCoin.x}`);
      break;
    }
  }
  check('成功顶撞问号块', bumped, '30 帧内未顶到');
}
console.log('');

// ---------- 场景 4：向右移动并撞墙 ----------
console.log('【场景 4】向右移动撞墙：vx 归零，x 对齐到墙边');
{
  // 独立关卡：地面无深渊，右侧第 9 列是一面贯穿到玩家高度的墙
  // 玩家在第 5 行活动（y≈162-192），墙在第 4-6 行（确保与玩家碰撞盒重叠）
  const wallLevel = parseLevel([
    '..........',
    '..........',
    '..........',
    '..........',
    '.........#', // 4 墙顶
    'P........#', // 5 P 出生点 + 墙（玩家行）
    '##########', // 6 完整地面（第 9 列也是地面）
  ].join('\n'));
  const game = new Game(wallLevel);
  game.start();
  const input = new Input();
  const p = game.player;
  settleOnGround(game, input);

  // 把玩家移到地面左侧，向右走会撞到第 9 列墙（左边界 x=9*32=288）
  p.x = 100;
  p.vx = 0;

  press(input, 'd');
  let hitWall = false;
  for (let i = 0; i < 120; i++) {
    const f = step(game, input, `右移 ${i}`);
    // 撞墙判定：vx 归零且玩家右边界接近墙左边界
    if (p.vx === 0 && p.x > 200) {
      hitWall = true;
      console.log(`  f${i}: 撞墙, x=${f.x}, vx=${f.vx}`);
      check('撞墙后 vx = 0', p.vx === 0);
      check('玩家右边界对齐到墙左边',
        Math.abs((p.x + p.w) - 9 * TILE_SIZE) < 0.001,
        `right=${p.x + p.w} vs wallLeft=${9 * TILE_SIZE}`);
      break;
    }
  }
  check('成功撞到右墙', hitWall, '120 帧内未撞墙');
}
console.log('');

// ---------- 场景 5：重力下落不超过 MAX_FALL ----------
console.log('【场景 5】自由下落：vy 不超过 MAX_FALL');
{
  // 高耸关卡：P 在顶部，下方全空，足够长距离自由下落
  const fallLevel = parseLevel([
    'P.........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
  ].join('\n'));
  const game = new Game(fallLevel);
  game.start();
  const input = new Input();
  const p = game.player;

  let maxVy = 0;
  for (let i = 0; i < 120; i++) {
    step(game, input, `下落 ${i}`);
    if (p.vy > maxVy) maxVy = p.vy;
    if (game.state !== 'PLAYING') break;
  }
  console.log(`  最大 vy = ${maxVy.toFixed(1)} (MAX_FALL=${MAX_FALL})`);
  check('vy 不超过 MAX_FALL', maxVy <= MAX_FALL + 0.001, `maxVy=${maxVy}`);
}
console.log('');

// ---------- 场景 6：跳跃落到悬空平台 ----------
console.log('【场景 6】跳上悬空平台：起跳后落到平台顶面，onGround=true');
{
  // 平台在第 4 行第 15-17 列（顶面 y=4*32=128）
  const game = newGame();
  const input = new Input();
  const p = game.player;

  // 把玩家移到平台下方偏左，向右跳能落上平台
  p.x = 14 * TILE_SIZE;
  p.y = STAND_Y;
  p.vx = 0; p.vy = 0;
  p.onGround = true;

  // 同时按跳跃和右移
  press(input, ' ');
  press(input, 'd');

  let landedOnPlatform = false;
  for (let i = 0; i < 60; i++) {
    const f = step(game, input, `跳台 ${i}`);
    // 平台顶面 y = 4*32 = 128，玩家站立 y = 128 - 30 = 98
    const platformStandY = 4 * TILE_SIZE - PLAYER_HEIGHT;
    if (p.onGround && Math.abs(p.y - platformStandY) < 1) {
      landedOnPlatform = true;
      console.log(`  f${i}: 落到平台, y=${f.y}, vy=${f.vy}, x=${f.x}`);
      check('落到平台顶面 y = 4*TILE_SIZE - PLAYER_HEIGHT',
        Math.abs(p.y - platformStandY) < 1, `y=${p.y}`);
      check('落地后 onGround = true', p.onGround);
      check('落地后 vy = 0', Math.abs(p.vy) < 0.001, `vy=${p.vy}`);
      break;
    }
  }
  check('成功跳上悬空平台', landedOnPlatform, '60 帧内未落上');
}
console.log('');

// ---------- 场景 7：水平加速到达 MOVE_SPEED ----------
console.log('【场景 7】水平加速：持续按右键，vx 收敛到 MOVE_SPEED');
{
  const game = newGame();
  const input = new Input();
  const p = game.player;
  settleOnGround(game, input);

  press(input, 'd');
  let reachedMax = false;
  for (let i = 0; i < 60; i++) {
    step(game, input, `加速 ${i}`);
    if (Math.abs(p.vx - MOVE_SPEED) < 0.5) {
      reachedMax = true;
      console.log(`  f${i}: vx=${p.vx.toFixed(1)} (MOVE_SPEED=${MOVE_SPEED})`);
      check('vx 收敛到 MOVE_SPEED', Math.abs(p.vx - MOVE_SPEED) < 0.5, `vx=${p.vx}`);
      break;
    }
  }
  check('能加速到最大速度', reachedMax, '60 帧内未达到');
}
console.log('');

// ---------- 汇总 ----------
console.log('=========================================');
console.log(`汇总: ${pass} 通过, ${fail} 失败`);
process.exit(fail > 0 ? 1 : 0);
