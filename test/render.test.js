// AC-6 渲染（相机数学 + drawGame 烟雾测试）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TILE_SIZE, CAMERA_SPEED } from '../src/engine/physics.js';
import {
  VIEW_W, screenX, maxCameraX, clampCamera, followCamera,
} from '../src/engine/camera.js';
import { parseLevel } from '../src/engine/level.js';
import { Game } from '../src/engine/game.js';
import { drawGame } from '../src/render.js';

test('AC-6.1 世界坐标 -> 屏幕坐标：screenX = worldX - cameraX', () => {
  assert.equal(screenX(100, 40), 60);
  assert.equal(screenX(0, 0), 0);
  assert.equal(screenX(800, 100), 700);
});

test('AC-6.2 相机夹紧在关卡边界内（0 ≤ cameraX ≤ maxCameraX）', () => {
  const level = { width: 40, height: 15 };
  assert.equal(maxCameraX(level), 40 * TILE_SIZE - VIEW_W);
  assert.equal(clampCamera(-10, level), 0);
  assert.equal(clampCamera(9999, level), 40 * TILE_SIZE - VIEW_W);
  assert.equal(clampCamera(200, level), 200);
});

test('AC-6.3 相机平滑跟随玩家（目标 = 玩家X - 半屏宽，有最大追速）', () => {
  const level = { width: 100, height: 15 };
  // 目标远在右侧：以最大追速 CAMERA_SPEED*dt 靠近
  const c0 = followCamera(0, 2000, level, 0.1);
  assert.equal(c0, CAMERA_SPEED * 0.1);
  // 已到位则不再越过目标
  const desired = 2000 - VIEW_W / 2;
  const c1 = followCamera(desired, 2000, level, 0.1);
  assert.equal(c1, desired);
  // 不超过右边界
  const max = 100 * TILE_SIZE - VIEW_W;
  const c2 = followCamera(0, 100000, level, 1);
  assert.equal(c2, max);
  // 玩家向左退，相机也跟随（不越过目标）
  const c3 = followCamera(desired, 2000, level, 1);
  assert.equal(c3, desired);
});

test('AC-6.4 drawGame 用 mock ctx 不抛错并执行绘制调用', () => {
  const level = parseLevel([
    '....P......o..G..F',
    '..................',
    '..........#?......',
    '..................',
    '..................',
    '.....###########.',
    '##################',
  ].join('\n'));
  const game = new Game(level);
  game.start();

  const calls = [];
  const ctx = new Proxy({}, {
    get(_t, prop) {
      if (prop === 'canvas') return { width: 800, height: 480 };
      return (...args) => { calls.push(String(prop)); };
    },
    set() { return true; },
  });

  assert.doesNotThrow(() => drawGame(ctx, game, level));
  assert.ok(calls.includes('fillRect'), '应调用 fillRect 进行绘制');
  assert.ok(calls.length > 5, '应进行多次绘制调用');
});

test('AC-6.5 drawGame 调试命中框模式（debug=true）不抛错并描边', () => {
  const level = parseLevel([
    '....P......o..G..F',
    '..................',
    '..........#?......',
    '..................',
    '..................',
    '.....###########.',
    '##################',
  ].join('\n'));
  const game = new Game(level);
  game.start();

  const calls = [];
  const ctx = new Proxy({}, {
    get(_t, prop) {
      if (prop === 'canvas') return { width: 800, height: 480 };
      return (...args) => { calls.push(String(prop)); };
    },
    set() { return true; },
  });

  assert.doesNotThrow(() => drawGame(ctx, game, level, true));
  assert.ok(calls.includes('strokeRect'), '调试模式应调用 strokeRect 描边');
  assert.ok(calls.includes('setLineDash'), '应绘制虚线跳高提示');
});

test('AC-6.6 已顶问号块绘制为灰色已用块，顶出金币带弹出动画可正常绘制', () => {
  const level = parseLevel([
    '....P...............',
    '..................',
    '..........#?......',
    '..................',
    '..................',
    '.....###########.',
    '##################',
  ].join('\n'));
  const game = new Game(level);
  game.start();
  // 顶撞 (11,2) 问号块 → used=true，并生成一枚带弹出动画的金币
  game.questionBump(11, 2);
  const popped = game.coins[game.coins.length - 1];
  assert.ok(popped.popT !== undefined, '顶出金币应带 popT');
  popped.popT = 0.15; // 上升中途（显示在方块上方）

  const calls = [];
  const ctx = new Proxy({}, {
    get(_t, prop) {
      if (prop === 'canvas') return { width: 800, height: 480 };
      return (...args) => { calls.push([String(prop), ...args]); };
    },
    set() { return true; },
  });

  assert.doesNotThrow(() => drawGame(ctx, game, level, true));
  // 已用块：在 (11*32 - cam, 2*32) 位置有 fillRect 主体绘制
  const cam = game.cameraX;
  const usedX = 11 * TILE_SIZE - cam;
  const usedY = 2 * TILE_SIZE;
  const drawnUsed = calls.some((c) => c[0] === 'fillRect'
    && Math.abs(c[1] - usedX) < 1 && Math.abs(c[2] - usedY) < 1 && c[3] === TILE_SIZE && c[4] === TILE_SIZE);
  assert.ok(drawnUsed, '已顶问号块应在原位置绘制灰色已用块');
  // 顶出金币：存在 arc 绘制（金币主体）
  assert.ok(calls.some((c) => c[0] === 'arc'), '应绘制顶出金币的圆形');
});
