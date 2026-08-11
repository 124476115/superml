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

// 构造测试关卡：
//  - 第 0 行：天花板（在第 4-6 列留出空隙用于测试顶撞）
//  - 第 6 行：地面（在第 10-12 列留出深渊，第 13 列是高台）
//  - 第 5 行第 8 列：问号块（顶撞出金币）
//  - 第 4 行第 14-16 列：悬空平台（用于落台测试）
const levelText = [
  '#########...################', // 0 天花板（第9-11列有缺口）
  '............................', // 1
  '............................', // 2
  '............................', // 3
  '...............###..........', // 4 悬空平台（第15-17列）
  '.......?....................', // 5 问号块（第7列）
  '###################.########', // 6 地面（第19列有深渊）
].join('\n');

const level = parseLevel(levelText);

// 辅助：创建并启动游戏
function newGame() {
  const g = new Game(level);
  g.start();
  return g;
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

// ---------- 场景 1：原地短跳（按下立刻松开） ----------
console.log('【场景 1】原地短跳：按下跳跃后立即松开，应迅速截断上升速度');
{
  const game = newGame();
  const input = new Input();
  const p0 = game.player;
  const startY = p0.y;

  // 第 0 帧：按下跳跃
  press(input, ' ');
  const f0 = step(game, input, '按下跳跃');
  console.log(`  f0: vy=${f0.vy}, onGround=${f0.onGround}`);
  check('起跳后 vy = JUMP_VELOCITY', Math.abs(p0.vy - JUMP_VELOCITY) < 0.001, `vy=${p0.vy}`);

  // 第 1 帧：立刻松开跳跃 → cutJump 应生效
  release(input, ' ');
  const f1 = step(game, input, '松开跳跃');
  console.log(`  f1: vy=${f1.vy} (应为 ${JUMP_VELOCITY * JUMP_HOLD_FACTOR})`);
  check('松开后 vy 被截断为 JUMP_VELOCITY * HOLD_FACTOR',
    Math.abs(p0.vy - JUMP_VELOCITY * JUMP_HOLD_FACTOR) < 1, `vy=${p0.vy}`);

  // 持续松开，等待落地
  let landed = false;
  let landFrame = -1;
  for (let i = 0; i < 60; i++) {
    const f = step(game, input, `下落 ${i}`);
    if (p0.onGround && !landed) {
      landed = true;
      landFrame = i;
      console.log(`  f${i + 2}: 落地, vy=${f.vy}, y=${f.y}`);
      check('落地后 vy = 0', Math.abs(p0.vy) < 0.001, `vy=${p0.vy}`);
      check('落地后 onGround = true', p0.onGround);
      check('落地 y 与起点一致（回到地面顶面）',
        Math.abs(p0.y - startY) < 0.001, `y=${p0.y} vs startY=${startY}`);
      break;
    }
  }
  check('短跳后能落地', landed, '60 帧内未落地');
  if (landed >= 0) console.log(`  落地耗时: ${(landFrame + 2) * DT * 1000 | 0}ms`);
}
console.log('');

// ---------- 场景 2：长跳（按住跳跃键） ----------
console.log('【场景 2】长跳：按住跳跃键不放，上升速度未被截断，跳得更高');
{
  const game = newGame();
  const input = new Input();
  const p = game.player;
  const startY = p.y;

  press(input, ' ');
  step(game, input, '按下跳跃');
  let maxRiseShort = 0;

  // 短跳参照：立刻松开
  release(input, ' ');
  for (let i = 0; i < 30 && !p.onGround; i++) {
    step(game, input, '短跳下落');
    maxRiseShort = Math.min(maxRiseShort, p.y - startY);
  }
  console.log(`  短跳最高上升: ${(-maxRiseShort).toFixed(1)}px`);

  // 长跳：重新起跳并按住
  game.restart();
  game.start();
  const p2 = game.player;
  const startY2 = p2.y;
  let maxRiseLong = 0;

  press(input, ' ');
  // 按住不放直到下落
  let released = false;
  for (let i = 0; i < 60; i++) {
    if (!released && p2.vy > 0) {
      release(input, ' ');
      released = true;
    }
    step(game, input, `长跳 ${i}`);
    maxRiseLong = Math.min(maxRiseLong, p2.y - startY2);
    if (p2.onGround && i > 2) break;
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

  // 把玩家移到问号块正下方（第 7 列 = x=224，瓦片中心 = 240）
  // 玩家宽 24，让其中心对齐瓦片中心：x = 240 - 12 = 228
  p.x = 228;
  p.y = level.height * TILE_SIZE - TILE_SIZE - PLAYER_HEIGHT; // 站在地面
  p.vx = 0; p.vy = 0;

  // 问号块在第 5 行第 7 列（y=160），玩家顶面在 y=6*32-30=162，差距很小
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
  // 用一个简单关卡：玩家在空地，右侧紧邻一面墙
  const wallLevel = parseLevel([
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '#####.####', // 第 6 列是深渊，右侧是墙
  ].join('\n'));
  const game = new Game(wallLevel);
  game.start();
  const input = new Input();
  const p = game.player;

  // 把玩家放在深渊左侧地面上，向右走会撞到第 6 列的墙（但那里是深渊）
  // 改为：直接测试撞右墙 — 用另一个关卡
  const wallLevel2 = parseLevel([
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '..........',
    '########.#', // 第 8 列是空，第 9 列是墙
  ].join('\n'));
  const g2 = new Game(wallLevel2);
  g2.start();
  const p2 = g2.player;
  // 玩家出生在 P 位置，把 P 放在第 0 列
  // 实际出生点由 parseLevel 决定，这里直接移动玩家
  p2.x = 0;
  p2.y = 6 * TILE_SIZE - PLAYER_HEIGHT;
  p2.vx = 0; p2.vy = 0;

  press(input, 'd');
  let hitWall = false;
  for (let i = 0; i < 120; i++) {
    const f = step(g2, input, `右移 ${i}`);
    if (p2.vx === 0 && p2.x > 0 && !hitWall) {
      hitWall = true;
      // 玩家右边界应 = 第 9 列墙的左边界 = 9*32 = 288
      console.log(`  f${i}: 撞墙, x=${f.x}, vx=${f.vx}`);
      check('撞墙后 vx = 0', p2.vx === 0);
      check('玩家右边界对齐到墙左边',
        Math.abs((p2.x + p2.w) - 9 * TILE_SIZE) < 0.001,
        `right=${p2.x + p2.w} vs wallLeft=${9 * TILE_SIZE}`);
      break;
    }
  }
  check('成功撞到右墙', hitWall, '120 帧内未撞墙');
}
console.log('');

// ---------- 场景 5：重力下落不超过 MAX_FALL ----------
console.log('【场景 5】自由下落：vy 不超过 MAX_FALL');
{
  // 玩家从高处下落
  const fallLevel = parseLevel([
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
    '..........',
  ].join('\n'));
  // 加一个底部地面（在更下方）防止坠崖判定
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
  // 平台在第 4 行第 15-17 列（y=128）
  const game = newGame();
  const input = new Input();
  const p = game.player;

  // 把玩家移到平台下方左侧
  p.x = 14 * TILE_SIZE;
  p.y = 6 * TILE_SIZE - PLAYER_HEIGHT;
  p.vx = 0; p.vy = 0;

  press(input, ' ');
  press(input, 'd');
  let landedOnPlatform = false;
  for (let i = 0; i < 60; i++) {
    const f = step(game, input, `跳台 ${i}`);
    // 平台顶面 y = 4*32 = 128
    if (p.onGround && p.y <= 4 * TILE_SIZE + 1 && p.y >= 4 * TILE_SIZE - 1) {
      landedOnPlatform = true;
      console.log(`  f${i}: 落到平台, y=${f.y}, vy=${f.vy}`);
      check('落到平台顶面 y = 4*TILE_SIZE - PLAYER_HEIGHT',
        Math.abs(p.y - (4 * TILE_SIZE - PLAYER_HEIGHT)) < 1, `y=${p.y}`);
      check('落地后 onGround = true', p.onGround);
      check('落地后 vy = 0', Math.abs(p.vy) < 0.001, `vy=${p.vy}`);
      break;
    }
  }
  check('成功跳上悬空平台', landedOnPlatform, '60 帧内未落上');
}
console.log('');

// ---------- 汇总 ----------
console.log('=========================================');
console.log(`汇总: ${pass} 通过, ${fail} 失败`);
process.exit(fail > 0 ? 1 : 0);
