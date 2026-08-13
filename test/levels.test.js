// AC-8.6+ 多关卡可玩性测试：全部 5 关都可解析、可出生、自动 AI 可通关
// 运行：node --test test/levels.test.js

import { test } from 'node:test';
import assert from 'node:assert';
import { parseLevel } from '../src/engine/level.js';
import { Game } from '../src/engine/game.js';
import { Input } from '../src/engine/input.js';
import { levels } from '../src/levels/index.js';
import { TILE_SIZE } from '../src/engine/physics.js';

const DT = 1 / 60;

// 辅助：模拟玩家持续按右键，返回通关前的帧数；超时/死亡返回 -1
function autoRunToFlag(text, maxFrames = 10000) {
  const level = parseLevel(text);
  const game = new Game(level);
  game.start();
  const input = new Input();
  input.keydown('d'); // 持续向右

  for (let i = 0; i < maxFrames; i++) {
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

for (let i = 0; i < levels.length; i++) {
  const text = levels[i];
  const name = `level${i + 1}`;

  test(`AC-8.6 ${name} 可解析且包含必需元素`, () => {
    const level = parseLevel(text);
    assert.ok(level.playerStart, `${name} 必须有玩家出生点 P`);
    assert.ok(level.flag, `${name} 必须有终点旗杆 F`);
    assert.ok(level.enemies.length > 0, `${name} 应有敌人 G`);
    assert.ok(level.questionTiles.length > 0, `${name} 应有问号块 ?`);
  });

  test(`AC-8.7 ${name} 玩家出生后能稳定落地`, () => {
    const level = parseLevel(text);
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
    assert.ok(landed, `${name} 30 帧内应落到地面`);
  });

  test(`AC-8.8 ${name} 自动 AI 能通关（触旗 → WON）`, () => {
    const frames = autoRunToFlag(text);
    assert.ok(frames > 0,
      `${name} 应在 10000 帧内通关，实际 ${frames < 0 ? 'GAME_OVER' : '超时'}`);
  });
}
