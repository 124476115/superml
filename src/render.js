// AC-6 渲染：Canvas 2D 绘制（通过参数注入 ctx，便于 mock 测试）
// 像素风格：Mario / Goomba / Coin / Brick / Question / Flag

import { TILE_SIZE } from './engine/physics.js';
import { VIEW_W, VIEW_H, screenX } from './engine/camera.js';
import { coinPopOffset, COIN_POP_TOTAL } from './engine/game.js';

// 颜色调色板（贴近 NES Mario）
const C = {
  sky: '#5c94fc',
  cloud: '#ffffff',
  hill: '#00a800',
  hillDark: '#007800',
  groundTop: '#d09040',
  groundBody: '#a05020',
  brick: '#c84c0c',
  brickDark: '#7a2c00',
  brickLine: '#000000',
  question: '#ffcc00',
  questionDark: '#cc8800',
  questionUsed: '#9a6a30',
  coin: '#ffdd00',
  coinDark: '#cc8800',
  coinShine: '#ffffaa',
  goombaBody: '#8b4513',
  goombaDark: '#5a2d0a',
  goombaFoot: '#3a1a05',
  marioRed: '#e00000',
  marioRedDark: '#a00000',
  marioSkin: '#ffcc99',
  marioBlue: '#0044dd',
  marioBrown: '#aa5500',
  marioYellow: '#ffdd00',
  flagPole: '#cccccc',
  flagPoleDark: '#888888',
  flag: '#00cc00',
  flagDark: '#008800',
  hud: '#ffffff',
  hudShadow: '#000000',
  overlay: 'rgba(0,0,0,0.6)',
};

/**
 * 绘制完整游戏画面
 * @param {boolean} debug 是否绘制调试命中框（按 H 切换）
 */
export function drawGame(ctx, game, level, debug = false) {
  const cam = game.cameraX;

  // 背景天空
  ctx.fillStyle = C.sky;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  // 远景：云朵和山（视差，相机 0.3 倍）
  drawBackground(ctx, cam, level);

  // 实心瓦片（地面/墙）
  for (let ty = 0; ty < level.height; ty++) {
    for (let tx = 0; tx < level.width; tx++) {
      const tile = level.tiles[ty * level.width + tx];
      if (tile !== 1) continue;
      const wx = tx * TILE_SIZE;
      const sx = screenX(wx, cam);
      if (sx + TILE_SIZE < 0 || sx > VIEW_W) continue;
      drawGroundTile(ctx, sx, ty * TILE_SIZE, ty, level, tx);
    }
  }

  // 问号块（已用 → 灰色已用块，未用 → 金色问号块）
  for (const q of level.questionTiles || []) {
    const sx = screenX(q.tx * TILE_SIZE, cam);
    if (sx + TILE_SIZE < 0 || sx > VIEW_W) continue;
    if (q.used) drawUsedBlock(ctx, sx, q.ty * TILE_SIZE);
    else drawQuestionBlock(ctx, sx, q.ty * TILE_SIZE);
  }

  // 金币（顶出金币带弹出动画：上升后落回）
  for (const coin of game.coins) {
    if (coin.taken) continue;
    const sx = screenX(coin.x, cam);
    if (sx + coin.w < 0 || sx > VIEW_W) continue;
    const dy = (coin.popT !== undefined && coin.popT < COIN_POP_TOTAL)
      ? coinPopOffset(coin.popT)
      : 0;
    drawCoin(ctx, sx, coin.y + dy, coin.w, coin.h);
  }

  // 敌人（被踩扁后保留扁平形象，直至展示计时结束）
  for (const enemy of game.enemies) {
    if (!enemy.alive && enemy.squashed && enemy.squashTimer <= 0) continue;
    const sx = screenX(enemy.x, cam);
    if (sx + enemy.w < 0 || sx > VIEW_W) continue;
    drawGoomba(ctx, sx, enemy.y, enemy.w, enemy.h, enemy.squashed);
  }

  // 玩家（无敌时闪烁）
  if (game.player.alive) {
    const sx = screenX(game.player.x, cam);
    const blink = game.invincibleTimer > 0 &&
      Math.floor(performance.now() / 80) % 2 === 0;
    if (!blink) {
      drawMario(ctx, sx, game.player.y, game.player.w, game.player.h,
        game.player.facing, game.player.onGround, game.player.vx, game.player.vy);
    }
  }

  // 旗杆
  if (level.flag) {
    const sx = screenX(level.flag.x, cam);
    drawFlag(ctx, sx, 0, level.height * TILE_SIZE);
  }

  // HUD
  drawHUD(ctx, game);

  // 状态覆盖层
  drawStateOverlay(ctx, game);

  // 调试命中框（叠加在最上层）
  if (debug) drawDebugHitboxes(ctx, game, level);
}

// ============= 背景层 =============
function drawBackground(ctx, cam, level) {
  // 视差 0.3
  const par = cam * 0.3;

  // 云朵（固定位置模式）
  const clouds = [
    { x: 100, y: 60, s: 1.0 },
    { x: 400, y: 90, s: 0.7 },
    { x: 700, y: 50, s: 1.2 },
    { x: 1100, y: 80, s: 0.9 },
    { x: 1500, y: 60, s: 1.1 },
    { x: 1900, y: 90, s: 0.8 },
  ];
  ctx.fillStyle = C.cloud;
  for (const c of clouds) {
    const sx = c.x - (par % 2200);
    if (sx + 80 > 0 && sx < VIEW_W) {
      drawCloud(ctx, sx, c.y, c.s);
    }
    // 循环
    const sx2 = sx + 2200;
    if (sx2 + 80 > 0 && sx2 < VIEW_W) {
      drawCloud(ctx, sx2, c.y, c.s);
    }
  }

  // 远山
  const hills = [
    { x: 50, y: 400, s: 1.3 },
    { x: 450, y: 400, s: 1.0 },
    { x: 900, y: 400, s: 1.5 },
    { x: 1400, y: 400, s: 1.1 },
    { x: 1900, y: 400, s: 1.4 },
  ];
  for (const h of hills) {
    const sx = h.x - (par % 2200);
    if (sx + 120 > 0 && sx < VIEW_W) drawHill(ctx, sx, h.y, h.s);
    const sx2 = sx + 2200;
    if (sx2 + 120 > 0 && sx2 < VIEW_W) drawHill(ctx, sx2, h.y, h.s);
  }
}

function drawCloud(ctx, x, y, s) {
  ctx.fillStyle = C.cloud;
  ctx.beginPath();
  ctx.arc(x, y, 14 * s, 0, Math.PI * 2);
  ctx.arc(x + 18 * s, y - 6 * s, 16 * s, 0, Math.PI * 2);
  ctx.arc(x + 36 * s, y, 14 * s, 0, Math.PI * 2);
  ctx.arc(x + 18 * s, y + 4 * s, 12 * s, 0, Math.PI * 2);
  ctx.fill();
}

function drawHill(ctx, x, y, s) {
  ctx.fillStyle = C.hillDark;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + 60 * s, y - 70 * s);
  ctx.lineTo(x + 120 * s, y);
  ctx.fill();
  ctx.fillStyle = C.hill;
  ctx.beginPath();
  ctx.moveTo(x + 12 * s, y);
  ctx.lineTo(x + 60 * s, y - 56 * s);
  ctx.lineTo(x + 108 * s, y);
  ctx.fill();
}

// ============= 地面/砖块 =============
function drawGroundTile(ctx, x, y, ty, level, tx) {
  // 上方是否为空 → 顶部画草地色
  const above = ty > 0 ? level.tiles[(ty - 1) * level.width + tx] : 0;
  if (above !== 1) {
    // 顶面：亮色草地
    ctx.fillStyle = C.groundTop;
    ctx.fillRect(x, y, TILE_SIZE, 8);
    ctx.fillStyle = C.groundBody;
    ctx.fillRect(x, y + 8, TILE_SIZE, TILE_SIZE - 8);
    // 顶面小草纹
    ctx.fillStyle = C.hill;
    ctx.fillRect(x + 4, y + 4, 3, 2);
    ctx.fillRect(x + 14, y + 4, 3, 2);
    ctx.fillRect(x + 24, y + 4, 3, 2);
  } else {
    // 内部砖块
    ctx.fillStyle = C.brick;
    ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
    ctx.fillStyle = C.brickDark;
    // 砖缝
    ctx.fillRect(x, y + 15, TILE_SIZE, 2);
    ctx.fillRect(x, y + 30, TILE_SIZE, 2);
    ctx.fillRect(x + 15, y, 2, 15);
    ctx.fillRect(x + 7, y + 17, 2, 13);
    ctx.fillRect(x + 23, y + 17, 2, 13);
  }
}

// ============= 问号块 =============
function drawQuestionBlock(ctx, x, y) {
  // 主体
  ctx.fillStyle = C.question;
  ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
  // 边框
  ctx.fillStyle = C.questionDark;
  ctx.fillRect(x, y, TILE_SIZE, 3);
  ctx.fillRect(x, y + TILE_SIZE - 3, TILE_SIZE, 3);
  ctx.fillRect(x, y, 3, TILE_SIZE);
  ctx.fillRect(x + TILE_SIZE - 3, y, 3, TILE_SIZE);
  // 角落小方块
  ctx.fillStyle = C.questionDark;
  ctx.fillRect(x + 4, y + 4, 3, 3);
  ctx.fillRect(x + TILE_SIZE - 7, y + 4, 3, 3);
  ctx.fillRect(x + 4, y + TILE_SIZE - 7, 3, 3);
  ctx.fillRect(x + TILE_SIZE - 7, y + TILE_SIZE - 7, 3, 3);
  // 问号
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('?', x + TILE_SIZE / 2, y + TILE_SIZE / 2 + 1);
  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
}

// 已顶过的问号块：灰色砖块（经典马里奥「已用」块）
function drawUsedBlock(ctx, x, y) {
  ctx.fillStyle = C.questionUsed;
  ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
  // 深色边框
  ctx.fillStyle = '#6a4a20';
  ctx.fillRect(x, y, TILE_SIZE, 3);
  ctx.fillRect(x, y + TILE_SIZE - 3, TILE_SIZE, 3);
  ctx.fillRect(x, y, 3, TILE_SIZE);
  ctx.fillRect(x + TILE_SIZE - 3, y, 3, TILE_SIZE);
  // 内部砖缝
  ctx.fillStyle = '#7a5228';
  ctx.fillRect(x, y + 15, TILE_SIZE, 2);
  ctx.fillRect(x + 15, y, 2, 15);
  ctx.fillRect(x + 7, y + 17, 2, 13);
  ctx.fillRect(x + 23, y + 17, 2, 13);
}

// ============= 金币 =============
function drawCoin(ctx, x, y, w, h) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const r = Math.min(w, h) / 2 - 1;
  // 外圈
  ctx.fillStyle = C.coinDark;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  // 内圈
  ctx.fillStyle = C.coin;
  ctx.beginPath();
  ctx.arc(cx, cy, r - 2, 0, Math.PI * 2);
  ctx.fill();
  // 高光
  ctx.fillStyle = C.coinShine;
  ctx.fillRect(cx - 2, cy - r + 4, 2, r * 2 - 8);
}

// ============= Goomba 敌人 =============
function drawGoomba(ctx, x, y, w, h, squashed) {
  if (squashed) {
    // 被踩扁：扁平棕色块
    ctx.fillStyle = C.goombaDark;
    ctx.fillRect(x + 2, y + h - 8, w - 4, 8);
    ctx.fillStyle = C.goombaBody;
    ctx.fillRect(x + 4, y + h - 6, w - 8, 4);
    return;
  }
  const cx = x + w / 2;
  // 身体（半圆头）
  ctx.fillStyle = C.goombaBody;
  ctx.beginPath();
  ctx.arc(cx, y + h / 2, w / 2, Math.PI, 0);
  ctx.fill();
  ctx.fillRect(x, y + h / 2, w, h / 2 - 4);
  // 底部脚
  ctx.fillStyle = C.goombaFoot;
  ctx.fillRect(x + 1, y + h - 4, w / 2 - 2, 4);
  ctx.fillRect(x + w / 2 + 1, y + h - 4, w / 2 - 2, 4);
  // 眼睛白
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x + 5, y + 8, 6, 7);
  ctx.fillRect(x + w - 11, y + 8, 6, 7);
  // 瞳孔
  ctx.fillStyle = '#000000';
  ctx.fillRect(x + 8, y + 10, 3, 4);
  ctx.fillRect(x + w - 9, y + 10, 3, 4);
  // 眉毛
  ctx.fillStyle = C.goombaDark;
  ctx.fillRect(x + 4, y + 6, 8, 2);
  ctx.fillRect(x + w - 12, y + 6, 8, 2);
}

// ============= Mario 玩家 =============
function drawMario(ctx, x, y, w, h, facing, onGround, vx, vy) {
  // 像素艺术风格：8x12 网格映射
  const px = w / 8;
  const py = h / 12;
  // facing = -1 时水平翻转
  ctx.save();
  if (facing < 0) {
    ctx.translate(x + w, y);
    ctx.scale(-1, 1);
  } else {
    ctx.translate(x, y);
  }

  const R = C.marioRed, RD = C.marioRedDark, S = C.marioSkin,
    B = C.marioBlue, BR = C.marioBrown, Y = C.marioYellow;

  // 简化像素图（行号从上到下）
  // 0: 帽子顶
  // 1: 帽子下沿 + 头发
  // 2-3: 脸
  // 4: 衣领
  // 5-7: 上身（红衣+蓝裤+扣子）
  // 8-9: 手
  // 10-11: 脚

  // 帽子
  ctx.fillStyle = R;
  ctx.fillRect(2 * px, 0, 4 * px, py);
  ctx.fillRect(1 * px, py, 6 * px, py);
  // 帽子边
  ctx.fillStyle = RD;
  ctx.fillRect(1 * px, py, 6 * px, 1);
  // 头发
  ctx.fillStyle = BR;
  ctx.fillRect(1 * px, 2 * py, px, 2 * py);
  ctx.fillRect(6 * px, 2 * py, px, 2 * py);
  // 脸
  ctx.fillStyle = S;
  ctx.fillRect(2 * px, 2 * py, 4 * px, 2 * py);
  // 眼睛
  ctx.fillStyle = '#000';
  ctx.fillRect(4 * px, 2 * py, px, 2 * py);
  // 胡子
  ctx.fillStyle = BR;
  ctx.fillRect(3 * px, 4 * py, 3 * px, py);
  // 嘴
  ctx.fillStyle = S;
  ctx.fillRect(4 * px, 4 * py, px, 1);

  // 上身：红衣
  ctx.fillStyle = R;
  ctx.fillRect(1 * px, 5 * py, 6 * px, 2 * py);
  // 蓝裤
  ctx.fillStyle = B;
  ctx.fillRect(1 * px, 7 * py, 6 * px, py);
  // 扣子
  ctx.fillStyle = Y;
  ctx.fillRect(3 * px, 5 * py, px, py);
  ctx.fillRect(4 * px, 5 * py, px, py);
  ctx.fillRect(3 * px, 6 * py, px, py);
  ctx.fillRect(4 * px, 6 * py, px, py);

  // 手
  ctx.fillStyle = S;
  ctx.fillRect(0, 5 * py, px, 3 * py);
  ctx.fillRect(7 * px, 5 * py, px, 3 * py);

  // 腿/脚 — 走路时交替
  ctx.fillStyle = BR;
  if (onGround && Math.abs(vx) > 5) {
    // 走路动画（基于 vx）
    const phase = Math.floor(performance.now() / 100) % 2;
    if (phase === 0) {
      ctx.fillRect(1 * px, 8 * py, 2 * px, 3 * py);
      ctx.fillRect(5 * px, 8 * py, 2 * py, 2 * py);
    } else {
      ctx.fillRect(1 * px, 8 * py, 2 * px, 2 * py);
      ctx.fillRect(5 * px, 8 * py, 2 * px, 3 * py);
    }
  } else if (!onGround) {
    // 跳跃姿势：一条腿前一条腿后
    ctx.fillRect(2 * px, 8 * py, 2 * px, 3 * py);
    ctx.fillRect(4 * px, 8 * py, 2 * px, 3 * py);
  } else {
    // 站立
    ctx.fillRect(1 * px, 8 * py, 2 * px, 3 * py);
    ctx.fillRect(5 * px, 8 * py, 2 * px, 3 * py);
  }
  // 鞋
  ctx.fillStyle = '#3a1a05';
  ctx.fillRect(0, 11 * py, 3 * px, py);
  ctx.fillRect(5 * px, 11 * py, 3 * px, py);

  ctx.restore();
}

// ============= 旗杆 =============
function drawFlag(ctx, x, yTop, height) {
  // 杆
  ctx.fillStyle = C.flagPoleDark;
  ctx.fillRect(x - 2, yTop, 4, height);
  ctx.fillStyle = C.flagPole;
  ctx.fillRect(x - 2, yTop, 2, height);
  // 顶部球
  ctx.fillStyle = C.coin;
  ctx.beginPath();
  ctx.arc(x, yTop + 4, 5, 0, Math.PI * 2);
  ctx.fill();
  // 旗子（三角）
  ctx.fillStyle = C.flag;
  ctx.beginPath();
  ctx.moveTo(x - 3, yTop + 12);
  ctx.lineTo(x - 28, yTop + 24);
  ctx.lineTo(x - 3, yTop + 36);
  ctx.fill();
  ctx.fillStyle = C.flagDark;
  ctx.fillRect(x - 3, yTop + 12, 2, 24);
}

// ============= 调试命中框 =============
function drawDebugHitboxes(ctx, game, level) {
  const cam = game.cameraX;
  const outline = (x, y, w, h, color) => {
    const sx = screenX(x, cam);
    if (sx + w < 0 || sx > VIEW_W) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(sx, y, w, h);
  };

  // 实心瓦片（砖块/地面）碰撞盒：半透明白描边
  for (let ty = 0; ty < level.height; ty++) {
    for (let tx = 0; tx < level.width; tx++) {
      if (level.tiles[ty * level.width + tx] !== 1) continue;
      outline(tx * TILE_SIZE, ty * TILE_SIZE, TILE_SIZE, TILE_SIZE, 'rgba(255,255,255,0.35)');
    }
  }
  // 问号块
  for (const q of level.questionTiles || []) {
    if (q.used) continue;
    outline(q.tx * TILE_SIZE, q.ty * TILE_SIZE, TILE_SIZE, TILE_SIZE, 'rgba(255,170,0,0.95)');
  }
  // 金币（含顶出的金币，弹出动画跟随显示位置）
  for (const coin of game.coins) {
    if (coin.taken) continue;
    const dy = (coin.popT !== undefined && coin.popT < COIN_POP_TOTAL)
      ? coinPopOffset(coin.popT)
      : 0;
    outline(coin.x, coin.y + dy, coin.w || 20, coin.h || 24, 'rgba(255,221,0,0.95)');
  }
  // 敌人
  for (const enemy of game.enemies) {
    if (!enemy.alive) continue;
    outline(enemy.x, enemy.y, enemy.w, enemy.h, 'rgba(255,60,60,0.95)');
  }
  // 玩家碰撞盒 + 最大跳高示意
  if (game.player.alive) {
    const p = game.player;
    outline(p.x, p.y, p.w, p.h, '#00ff66');
    // 站立点跳起后头顶最高位置（约 87px 跳高）的虚线框
    ctx.strokeStyle = 'rgba(0,255,102,0.45)';
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(screenX(p.x, cam), p.y - 87, p.w, p.h);
    ctx.setLineDash([]);
  }
  // 提示文字
  ctx.font = 'bold 13px monospace';
  ctx.fillStyle = '#00ff66';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText('HITBOXES [H]', VIEW_W - 10, 10);
  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
}

// ============= HUD =============
function drawHUD(ctx, game) {
  ctx.font = 'bold 16px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  // 阴影
  ctx.fillStyle = C.hudShadow;
  ctx.fillText(`SCORE ${game.score}`, 11, 11);
  ctx.fillText(`LIVES ${game.lives}`, 11, 33);
  ctx.fillStyle = C.hud;
  ctx.fillText(`SCORE ${game.score}`, 10, 10);
  ctx.fillText(`LIVES ${game.lives}`, 10, 32);
}

function drawStateOverlay(ctx, game) {
  if (game.state === 'PLAYING' && !game.paused) return;

  ctx.fillStyle = C.overlay;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  ctx.font = 'bold 32px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  let text = '';
  if (game.state === 'READY') text = 'PRESS ENTER TO START';
  else if (game.state === 'WON') text = 'YOU WIN! PRESS ENTER';
  else if (game.state === 'GAME_OVER') text = 'GAME OVER. PRESS ENTER';
  else if (game.paused) text = 'PAUSED';

  if (text) {
    ctx.fillStyle = C.hudShadow;
    ctx.fillText(text, VIEW_W / 2 + 2, VIEW_H / 2 + 2);
    ctx.fillStyle = C.hud;
    ctx.fillText(text, VIEW_W / 2, VIEW_H / 2);
  }
  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
}
