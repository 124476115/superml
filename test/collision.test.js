// AC-2 碰撞
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TILE_SIZE } from '../src/engine/physics.js';
import { aabbOverlap, tileAt, moveWithCollision, solidTilesOverlap } from '../src/engine/collision.js';

// 构造一个简单关卡：宽 20、高 10，地面在 y=8 行
function makeGroundLevel(width = 20, height = 10, groundRow = 8) {
  const tiles = new Array(width * height).fill(0);
  for (let x = 0; x < width; x++) tiles[groundRow * width + x] = 1;
  return { width, height, tiles };
}

function rect(x, y, w, h) {
  return { x, y, w, h };
}

test('AC-2.1 aabbOverlap 判断两 AABB 是否重叠', () => {
  const a = rect(0, 0, 24, 30);
  assert.equal(aabbOverlap(a, rect(10, 10, 24, 30)), true);
  assert.equal(aabbOverlap(a, rect(50, 0, 24, 30)), false);
  // 边界相切不算重叠
  assert.equal(aabbOverlap(a, rect(24, 0, 24, 30)), false);
  assert.equal(aabbOverlap(a, rect(0, 30, 24, 30)), false);
});

test('AC-2.2 向右撞墙被阻挡：x 对齐、vx=0、hitX', () => {
  const level = makeGroundLevel();
  // 在 x=8 列加一堵墙，从地面延伸到空中
  for (let y = 4; y < 8; y++) level.tiles[y * level.width + 8] = 1;
  const wallLeft = 8 * TILE_SIZE;
  const player = rect(wallLeft - TILE_SIZE, 7 * TILE_SIZE - 30, 24, 30);
  player.vx = 200;
  player.vy = 0;
  const info = moveWithCollision(player, 0.5, level);
  assert.equal(player.x, wallLeft - player.w);
  assert.equal(player.vx, 0);
  assert.equal(info.hitX, true);
});

test('AC-2.3 从上方落到地面：y 对齐、vy=0、onGround', () => {
  const level = makeGroundLevel();
  const groundTop = 8 * TILE_SIZE;
  const player = rect(5 * TILE_SIZE, groundTop - 30 - 50, 24, 30);
  player.vx = 0;
  player.vy = 300;
  const info = moveWithCollision(player, 0.5, level);
  assert.equal(player.y, groundTop - player.h);
  assert.equal(player.vy, 0);
  assert.equal(info.onGround, true);
});

test('AC-2.4 从下方顶撞瓦片底面：vy=0（上升被截断）', () => {
  const level = makeGroundLevel();
  // 在玩家头顶上方放一块砖
  const brickX = 5 * TILE_SIZE;
  const brickTop = 4 * TILE_SIZE;
  level.tiles[4 * level.width + 5] = 1;
  const player = rect(brickX, brickTop + TILE_SIZE + 10, 24, 30);
  player.vx = 0;
  player.vy = -300;
  const info = moveWithCollision(player, 0.5, level);
  assert.equal(player.y, brickTop + TILE_SIZE);
  assert.equal(player.vy, 0);
  assert.equal(info.hitY, true);
  assert.equal(info.onGround, false);
});

test('AC-2.5 水平先、垂直后；角落不卡死（移动后不与实心瓦片重叠）', () => {
  const level = makeGroundLevel();
  // 一个角落：左侧地面 + 右侧墙体
  for (let y = 5; y < 8; y++) level.tiles[y * level.width + 10] = 1;
  const wallLeft = 10 * TILE_SIZE;
  const groundTop = 8 * TILE_SIZE;
  // 玩家正向右冲且同时在向下落，撞进角落
  const player = rect(wallLeft - 20, groundTop - 30 - 10, 24, 30);
  player.vx = 300;
  player.vy = 200;
  moveWithCollision(player, 0.5, level);
  // 不重叠任何实心瓦片
  assert.equal(solidTilesOverlap(player, level), false);
  // 水平方向被阻挡
  assert.ok(player.x + player.w <= wallLeft);
  // 落在角落地上
  assert.equal(player.y + player.h, groundTop);
});

test('AC-2.6 顶撞问号块：碰撞信息包含被顶瓦片', () => {
  const level = makeGroundLevel();
  const qx = 5, qy = 4;
  level.tiles[qy * level.width + qx] = 1; // 问号块也是实心瓦片
  const player = rect(qx * TILE_SIZE, qy * TILE_SIZE + TILE_SIZE + 10, 24, 30);
  player.vx = 0;
  player.vy = -300;
  const info = moveWithCollision(player, 0.5, level);
  assert.equal(player.vy, 0);
  assert.ok(Array.isArray(info.bumpedTiles), '应返回 bumpedTiles');
  const bumped = info.bumpedTiles.find((t) => t.tx === qx && t.ty === qy);
  assert.ok(bumped, 'bumpedTiles 应包含被顶的问号块坐标');
});

test('tileAt 越界返回 null，实心判断正确', () => {
  const level = makeGroundLevel();
  assert.equal(tileAt(level, -1, 0), null);
  assert.equal(tileAt(level, 0, -1), null);
  assert.equal(tileAt(level, 0, 20), null);
  assert.equal(tileAt(level, 0, level.height), null);
  assert.equal(tileAt(level, 5, 8).solid, true);
  assert.equal(tileAt(level, 5, 7).solid, false);
});
