// AC-4 实体
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PLAYER_WIDTH, PLAYER_HEIGHT, ENEMY_WIDTH, ENEMY_HEIGHT,
  TILE_SIZE, GRAVITY, JUMP_VELOCITY, BOUNCE_VELOCITY, ENEMY_SPEED,
} from '../src/engine/physics.js';
import { moveWithCollision } from '../src/engine/collision.js';
import {
  createPlayer, createGoomba, updatePlayer,
  enemyCollisionType, squashEnemy, bouncePlayer,
  collectCoin, takeCoin, updateGoomba,
} from '../src/engine/entities.js';

function noInput() {
  return { left: false, right: false, jumpHeld: false, jumpPressed: false };
}

test('AC-4.1a 玩家更新：重力持续生效、水平加速', () => {
  const p = createPlayer(0, 0);
  updatePlayer(p, noInput(), 0.1);
  assert.equal(p.vy, GRAVITY * 0.1);

  const q = createPlayer(0, 0);
  updatePlayer(q, { ...noInput(), left: true }, 0.1);
  assert.equal(q.vx, -160); // 1600 * 0.1
  assert.equal(q.facing, -1);

  const r = createPlayer(0, 0);
  updatePlayer(r, { ...noInput(), right: true }, 0.1);
  assert.equal(r.vx, 160);
  assert.equal(r.facing, 1);
});

test('AC-4.1b 速度叠加到位移（自由空间经 moveWithCollision）', () => {
  const level = { width: 20, height: 10, tiles: new Array(200).fill(0) };
  const p = createPlayer(100, 100);
  p.vx = 100;
  p.vy = 50;
  moveWithCollision(p, 0.5, level);
  assert.equal(p.x, 150);
  assert.equal(p.y, 125);
});

test('AC-4.2 玩家仅在 onGround 时能起跳', () => {
  // 空中：按跳无效
  const air = createPlayer(0, 0);
  air.onGround = false;
  updatePlayer(air, { ...noInput(), jumpPressed: true, jumpHeld: true }, 0.1);
  assert.ok(air.vy >= 0, '空中按跳不应起跳');

  // 地面：按跳生效（dt=0 时精确为 JUMP_VELOCITY）
  const ground = createPlayer(0, 0);
  ground.onGround = true;
  updatePlayer(ground, { ...noInput(), jumpPressed: true, jumpHeld: true }, 0);
  assert.equal(ground.vy, JUMP_VELOCITY);
});

test('AC-4.2b 松开跳跃键后上升速度被截断（可变跳跃）', () => {
  const p = createPlayer(0, 0);
  p.vy = -300;
  updatePlayer(p, noInput(), 0); // jumpHeld=false
  assert.equal(p.vy, -300 * 0.55);
});

test('AC-4.3a 踩中敌人分类为 stomp', () => {
  const p = createPlayer(100, 180); // 脚部 = 210
  p.vy = 200;
  const e = createGoomba(100, 200);
  e.w = ENEMY_WIDTH; e.h = ENEMY_HEIGHT;
  assert.equal(enemyCollisionType(p, e), 'stomp');
});

test('AC-4.3b 侧面接触分类为 hurt', () => {
  const p = createPlayer(100, 185); // 脚部 = 215，位于敌人下半部
  p.vy = 0;
  const e = createGoomba(100, 200);
  e.w = ENEMY_WIDTH; e.h = ENEMY_HEIGHT;
  assert.equal(enemyCollisionType(p, e), 'hurt');
});

test('AC-4.3c 无重叠返回 null；死亡的敌人返回 null', () => {
  const p = createPlayer(0, 0);
  const e = createGoomba(300, 300);
  e.w = ENEMY_WIDTH; e.h = ENEMY_HEIGHT;
  assert.equal(enemyCollisionType(p, e), null);
  e.alive = false;
  // 即使重叠也返回 null
  p.x = 300; p.y = 300; p.vy = 100;
  assert.equal(enemyCollisionType(p, e), null);
});

test('AC-4.3d 踩敌人后：敌人死亡 + 玩家反弹', () => {
  const e = createGoomba(0, 0);
  squashEnemy(e);
  assert.equal(e.alive, false);
  assert.equal(e.squashed, true);

  const p = createPlayer(0, 0);
  bouncePlayer(p);
  assert.equal(p.vy, BOUNCE_VELOCITY);
});

test('AC-4.5 接触金币：金币标记已取', () => {
  const coin = { x: 100, y: 100, w: 20, h: 24, taken: false };
  const p = createPlayer(100, 100);
  assert.equal(collectCoin(p, coin), true);
  assert.equal(coin.taken, true);
  // 再次接触不再收集
  assert.equal(collectCoin(p, coin), false);

  const far = createPlayer(0, 0);
  const coin2 = { x: 500, y: 500, w: 20, h: 24, taken: false };
  assert.equal(collectCoin(far, coin2), false);
  assert.equal(coin2.taken, false);
  takeCoin(coin2);
  assert.equal(coin2.taken, true);
});

test('AC-4.6a 敌人平地向右巡逻', () => {
  const level = { width: 20, height: 10, tiles: new Array(200).fill(0) };
  for (let x = 0; x < 20; x++) level.tiles[8 * 20 + x] = 1;
  const g = createGoomba(5 * TILE_SIZE, 8 * TILE_SIZE - ENEMY_HEIGHT);
  updateGoomba(g, level, 0.1);
  assert.equal(g.dir, 1);
  assert.equal(g.vx, ENEMY_SPEED);
  assert.ok(g.x > 5 * TILE_SIZE, '应向右移动');
  assert.equal(g.y, 8 * TILE_SIZE - ENEMY_HEIGHT, '应保持在地面上');
});

test('AC-4.6b 敌人撞墙转向', () => {
  const level = { width: 20, height: 10, tiles: new Array(200).fill(0) };
  for (let x = 0; x < 20; x++) level.tiles[8 * 20 + x] = 1;
  for (let y = 5; y < 8; y++) level.tiles[y * 20 + 10] = 1; // 墙在列 10
  const g = createGoomba(10 * TILE_SIZE - ENEMY_HEIGHT - 1, 8 * TILE_SIZE - ENEMY_HEIGHT);
  assert.equal(g.dir, 1);
  updateGoomba(g, level, 0.1);
  assert.equal(g.dir, -1);
  assert.equal(g.vx, -ENEMY_SPEED);
});

test('AC-4.6c 敌人遇悬崖边缘转向', () => {
  const level = { width: 20, height: 10, tiles: new Array(200).fill(0) };
  for (let x = 0; x <= 8; x++) level.tiles[8 * 20 + x] = 1; // 地面到列 8
  const g = createGoomba(9 * TILE_SIZE - ENEMY_HEIGHT - 1, 8 * TILE_SIZE - ENEMY_HEIGHT);
  updateGoomba(g, level, 0.1);
  assert.equal(g.dir, -1);
  assert.equal(g.vx, -ENEMY_SPEED);
});

test('AC-4.6e 悬空敌人受重力落到地面并继续巡逻', () => {
  const level = { width: 20, height: 10, tiles: new Array(200).fill(0) };
  for (let x = 0; x < 20; x++) level.tiles[8 * 20 + x] = 1; // 地面在行 8
  const groundY = 8 * TILE_SIZE - ENEMY_HEIGHT;
  // 敌人出生在行 4（悬空 4 行），应落到地面
  const g = createGoomba(5 * TILE_SIZE, 4 * TILE_SIZE);

  // 持续更新直至落地（最多 600 帧）
  let frames = 0;
  while (g.y < groundY - 1 && frames < 600) {
    updateGoomba(g, level, 1 / 60);
    frames++;
  }
  assert.equal(g.y, groundY, `敌人应落到地面 (y=${groundY})，实际 ${g.y}`);
  assert.equal(g.onGround, true, '落地后 onGround 应为 true');

  // 落地后继续向右巡逻（水平移动）
  const x0 = g.x;
  for (let i = 0; i < 10; i++) updateGoomba(g, level, 1 / 60);
  assert.ok(g.x > x0, '落地后应继续水平巡逻');
});

test('AC-4.6d 被踩扁的敌人不再移动', () => {
  const level = { width: 20, height: 10, tiles: new Array(200).fill(0) };
  for (let x = 0; x < 20; x++) level.tiles[8 * 20 + x] = 1;
  const g = createGoomba(5 * TILE_SIZE, 8 * TILE_SIZE - ENEMY_HEIGHT);
  squashEnemy(g);
  const before = g.x;
  updateGoomba(g, level, 0.1);
  assert.equal(g.x, before);
});

test('AC-4.3e 被踩扁的敌人保留扁平形象一段时间后计时归零（便于渲染展示）', () => {
  const level = { width: 20, height: 10, tiles: new Array(200).fill(0) };
  for (let x = 0; x < 20; x++) level.tiles[8 * 20 + x] = 1;
  const g = createGoomba(5 * TILE_SIZE, 8 * TILE_SIZE - ENEMY_HEIGHT);
  squashEnemy(g);
  assert.ok(g.squashTimer > 0, '被踩扁后应有展示计时器');
  const t0 = g.squashTimer;
  updateGoomba(g, level, 0.1);
  assert.ok(g.squashTimer < t0, '计时器应随时间递减');
  // 计时期间始终保持静止
  assert.equal(g.x, 5 * TILE_SIZE);
  for (let i = 0; i < 10; i++) updateGoomba(g, level, 0.1);
  assert.ok(g.squashTimer <= 0, '计时结束后应归零');
});

test('createPlayer / createGoomba 初始状态符合 SPEC', () => {
  const p = createPlayer(123, 45);
  assert.deepEqual(
    { x: p.x, y: p.y, w: p.w, h: p.h, vx: p.vx, vy: p.vy, onGround: p.onGround, facing: p.facing, alive: p.alive },
    { x: 123, y: 45, w: PLAYER_WIDTH, h: PLAYER_HEIGHT, vx: 0, vy: 0, onGround: false, facing: 1, alive: true },
  );
  const g = createGoomba(10, 20);
  assert.equal(g.w, ENEMY_WIDTH);
  assert.equal(g.h, ENEMY_HEIGHT);
  assert.equal(g.vx, ENEMY_SPEED);
  assert.equal(g.dir, 1);
  assert.equal(g.alive, true);
  assert.equal(g.squashed, false);
});
