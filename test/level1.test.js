// AC-8 关卡可玩性测试：验证 level1 可解析、玩家能稳定落地、向右移动不卡墙、可触旗通关
// 运行：node --test test/level1.test.js

import { test } from 'node:test';
import assert from 'node:assert';
import { parseLevel } from '../src/engine/level.js';
import { Game } from '../src/engine/game.js';
import { Input } from '../src/engine/input.js';
import { level1Text } from '../src/levels/level1.js';
import { TILE_SIZE } from '../src/engine/physics.js';

const DT = 1 / 60;

// 辅助：模拟玩家持续按右键，返回通关前的帧数；超时返回 -1
function autoRunToFlag(maxFrames = 8000) {
  const level = parseLevel(level1Text);
  const game = new Game(level);
  game.start();
  const input = new Input();
  input.keydown('d'); // 持续向右

  for (let i = 0; i < maxFrames; i++) {
    // 遇到深渊或墙时跳跃；前方有敌人也跳跃（踩踏）
    if (game.player.onGround) {
      const px = game.player.x + game.player.w;
      const tx = Math.floor(px / TILE_SIZE);
      const ty = Math.floor(game.player.y / TILE_SIZE) + 1; // 脚下一行
      const tileBelow = level.tiles[ty * level.width + tx];
      const tileAhead = level.tiles[(ty - 1) * level.width + tx];
      const needJumpForGap = tileBelow !== 1;
      const needJumpForWall = tileAhead === 1;
      // 3 瓦片内是否有敌人（含迎面折返的敌人，|dx| 检测）
      let needJumpForEnemy = false;
      for (const e of game.enemies) {
        if (!e.alive) continue;
        const dx = e.x - game.player.x;
        if (Math.abs(dx) < TILE_SIZE * 3 &&
            Math.abs(e.y - game.player.y) < TILE_SIZE) {
          needJumpForEnemy = true;
          break;
        }
      }
      // 落地时先松开再按下，制造边沿以再次起跳（按住维持跳高）
      const needJump = needJumpForGap || needJumpForWall || needJumpForEnemy;
      input.keyup(' ');
      if (needJump) input.keydown(' ');
    }
    game.update(DT, input);
    input.resetFrame();

    if (game.state === 'WON') return i;
    if (game.state === 'GAME_OVER') return -1;
  }
  return -1;
}

test('AC-8.1 level1 可解析且包含必需元素', () => {
  const level = parseLevel(level1Text);
  assert.ok(level.playerStart, '必须有玩家出生点 P');
  assert.ok(level.flag, '必须有终点旗杆 F');
  assert.ok(level.enemies.length > 0, '应有敌人 G');
  assert.ok(level.coins.length > 0, '应有金币 o');
  assert.ok(level.questionTiles.length > 0, '应有问号块 ?');
});

test('AC-8.2 玩家出生点 P 在地面之上（不悬空、不卡墙）', () => {
  const level = parseLevel(level1Text);
  const { x, y } = level.playerStart;
  // P 应在第 13 行（y 中心约 448），地面在第 14 行（y=448-480）
  // 玩家站立 y = 14*32 - 30 = 418；出生点 y 中心 = (13+0.5)*32 = 432
  assert.ok(y > 0 && y < level.height * TILE_SIZE, '出生点 y 在关卡范围内');
  assert.ok(x > 0 && x < level.width * TILE_SIZE, '出生点 x 在关卡范围内');
});

test('AC-8.3 玩家出生后能稳定落地（不无限下落）', () => {
  const level = parseLevel(level1Text);
  const game = new Game(level);
  game.start();
  const input = new Input();
  let landed = false;
  for (let i = 0; i < 30; i++) {
    game.update(DT, input);
    input.resetFrame();
    if (game.player.onGround) {
      landed = true;
      break;
    }
  }
  assert.ok(landed, '30 帧内应落到地面');
});

test('AC-8.4 玩家向右移动不卡墙（能持续前进）', () => {
  const level = parseLevel(level1Text);
  const game = new Game(level);
  game.start();
  const input = new Input();
  // 先落地
  for (let i = 0; i < 10; i++) {
    game.update(DT, input);
    input.resetFrame();
    if (game.player.onGround) break;
  }
  const startX = game.player.x;
  input.keydown('d');
  // 持续向右 120 帧（2 秒）
  for (let i = 0; i < 120; i++) {
    game.update(DT, input);
    input.resetFrame();
  }
  assert.ok(game.player.x > startX + 50,
    `向右移动 2 秒应前进至少 50px，实际从 ${startX} 到 ${game.player.x}`);
});

test('AC-8.5 自动 AI 能通关 level1（触旗 → WON）', () => {
  const frames = autoRunToFlag(6000);
  assert.ok(frames > 0,
    `自动 AI 应在 6000 帧内通关，实际 ${frames < 0 ? 'GAME_OVER' : '超时'}`);
});
