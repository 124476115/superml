// AC-6 渲染：Canvas 2D 绘制（通过参数注入 ctx，便于 mock 测试）

import { TILE_SIZE } from './engine/physics.js';
import { VIEW_W, VIEW_H, screenX } from './engine/camera.js';

// 颜色常量
const COLORS = {
  sky: '#5c94fc',
  ground: '#c07040',
  brick: '#d09040',
  question: '#ffcc00',
  coin: '#ffdd00',
  enemy: '#8b4513',
  enemySquashed: '#6b3410',
  player: '#e00000',
  flag: '#00cc00',
  flagPole: '#aaaaaa',
  hud: '#ffffff',
  overlay: 'rgba(0,0,0,0.5)',
};

/**
 * 绘制完整游戏画面
 * @param {CanvasRenderingContext2D} ctx
 * @param {Game} game
 * @param {Level} level
 */
export function drawGame(ctx, game, level) {
  const cam = game.cameraX;

  // 背景天空
  ctx.fillStyle = COLORS.sky;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  // 实心瓦片
  for (let ty = 0; ty < level.height; ty++) {
    for (let tx = 0; tx < level.width; tx++) {
      const tile = level.tiles[ty * level.width + tx];
      if (tile !== 1) continue;
      const wx = tx * TILE_SIZE;
      const sx = screenX(wx, cam);
      if (sx + TILE_SIZE < 0 || sx > VIEW_W) continue;
      ctx.fillStyle = COLORS.brick;
      ctx.fillRect(sx, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
  }

  // 问号块（未使用）
  for (const q of level.questionTiles || []) {
    if (q.used) continue;
    const sx = screenX(q.tx * TILE_SIZE, cam);
    if (sx + TILE_SIZE < 0 || sx > VIEW_W) continue;
    ctx.fillStyle = COLORS.question;
    ctx.fillRect(sx, q.ty * TILE_SIZE, TILE_SIZE, TILE_SIZE);
  }

  // 金币
  for (const coin of game.coins) {
    if (coin.taken) continue;
    const sx = screenX(coin.x, cam);
    if (sx + coin.w < 0 || sx > VIEW_W) continue;
    ctx.fillStyle = COLORS.coin;
    ctx.fillRect(sx, coin.y, coin.w, coin.h);
  }

  // 敌人
  for (const enemy of game.enemies) {
    if (!enemy.alive && enemy.squashed) continue;
    const sx = screenX(enemy.x, cam);
    if (sx + enemy.w < 0 || sx > VIEW_W) continue;
    ctx.fillStyle = enemy.squashed ? COLORS.enemySquashed : COLORS.enemy;
    ctx.fillRect(sx, enemy.y, enemy.w, enemy.h);
  }

  // 玩家
  if (game.player.alive) {
    const sx = screenX(game.player.x, cam);
    ctx.fillStyle = COLORS.player;
    ctx.fillRect(sx, game.player.y, game.player.w, game.player.h);
  }

  // 旗杆
  if (level.flag) {
    const sx = screenX(level.flag.x, cam);
    ctx.fillStyle = COLORS.flagPole;
    ctx.fillRect(sx - 2, 0, 4, level.height * TILE_SIZE);
    ctx.fillStyle = COLORS.flag;
    ctx.fillRect(sx - 16, 0, 16, 24);
  }

  // HUD：得分与命数
  ctx.fillStyle = COLORS.hud;
  ctx.font = '16px monospace';
  ctx.fillText(`SCORE ${game.score}`, 10, 22);
  ctx.fillText(`LIVES ${game.lives}`, 10, 44);

  // 状态覆盖层
  drawStateOverlay(ctx, game);
}

function drawStateOverlay(ctx, game) {
  if (game.state === 'PLAYING' && !game.paused) return;

  ctx.fillStyle = COLORS.overlay;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  ctx.fillStyle = COLORS.hud;
  ctx.font = '32px monospace';

  let text = '';
  if (game.state === 'READY') text = 'PRESS ENTER TO START';
  else if (game.state === 'WON') text = 'YOU WIN! PRESS R TO RESTART';
  else if (game.state === 'GAME_OVER') text = 'GAME OVER. PRESS R TO RESTART';
  else if (game.paused) text = 'PAUSED';

  if (text) {
    ctx.fillText(text, VIEW_W / 2 - text.length * 8, VIEW_H / 2);
  }
}
