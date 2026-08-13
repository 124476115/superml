// AC-5 游戏流程
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  TILE_SIZE, BOUNCE_VELOCITY, COIN_SCORE, ENEMY_SCORE,
} from '../src/engine/physics.js';
import { parseLevel } from '../src/engine/level.js';
import { Game, coinPopOffset, COIN_POP_RISE, COIN_POP_RISE_TIME, COIN_POP_FALL_TIME } from '../src/engine/game.js';
import { createGoomba } from '../src/engine/entities.js';

function noInput() {
  return { left: false, right: false, jumpHeld: false, jumpPressed: false };
}

// 手动构造关卡：宽 w、高 h，地面在 h-2 行
function makeLevel(opts = {}) {
  const w = opts.w || 40;
  const h = opts.h || 10;
  const groundRow = h - 2;
  const tiles = new Array(w * h).fill(0);
  for (let x = 0; x < w; x++) tiles[groundRow * w + x] = 1;
  return {
    width: w,
    height: h,
    tiles,
    playerStart: opts.playerStart || { x: 3 * TILE_SIZE, y: groundRow * TILE_SIZE - 30 },
    questionTiles: [],
    coins: opts.coins || [],
    enemies: opts.enemies || [],
    flag: null,
    flagBox: null,
  };
}

test('AC-5.1a 状态机：READY → PLAYING', () => {
  const game = new Game(makeLevel());
  assert.equal(game.state, 'READY');
  game.start();
  assert.equal(game.state, 'PLAYING');
  // READY 状态下 update 不推进
  game.state = 'READY';
  const x0 = game.player.x;
  game.update(0.1, noInput());
  assert.equal(game.player.x, x0);
});

test('AC-5.2 初始命数 = 3、初始分 = 0', () => {
  const game = new Game(makeLevel());
  assert.equal(game.lives, 3);
  assert.equal(game.score, 0);
  assert.equal(game.paused, false);
});

test('AC-5.3 掉入深渊损失一条命并重生', () => {
  const level = makeLevel();
  const game = new Game(level);
  game.start();
  game.player.y = level.height * TILE_SIZE + 100;
  game.update(0.1, noInput());
  assert.equal(game.lives, 2);
  assert.equal(game.player.x, level.playerStart.x);
  assert.equal(game.player.y, level.playerStart.y);
});

test('AC-5.4 命数减为 0 → GAME_OVER', () => {
  const game = new Game(makeLevel());
  game.lives = 1;
  game.onHurt();
  assert.equal(game.lives, 0);
  assert.equal(game.state, 'GAME_OVER');
});

test('AC-5.1b 触旗 → WON', () => {
  const W = 33;
  const row = (markers) => {
    const arr = new Array(W).fill('.');
    for (const [i, c] of Object.entries(markers)) arr[+i] = c;
    return arr.join('');
  };
  const rows = [row({ 5: 'P', 32: 'F' })];
  for (let i = 1; i < 8; i++) rows.push(row({}));
  rows.push('#'.repeat(W));
  const level = parseLevel(rows.join('\n'));
  const game = new Game(level);
  game.start();
  // 把玩家放到旗杆脚下
  game.player.x = level.flag.x - level.flagBox.w;
  game.player.y = level.flagBox.y + level.flagBox.h - 30;
  game.update(0.01, noInput());
  assert.equal(game.state, 'WON');
});

test('AC-5.5 restart 恢复初始状态', () => {
  const level = makeLevel({
    coins: [{ x: 100, y: 100, w: 20, h: 24, taken: false }],
    enemies: [{ x: 300, y: 300 }],
  });
  const game = new Game(level);
  game.start();
  // 制造一些游玩痕迹
  game.score = 500;
  game.lives = 1;
  game.enemies[0].alive = false;
  game.enemies[0].squashed = true;
  game.coins[0].taken = true;
  game.player.x = 999;
  game.questionBump(0, 0); // 触发一个问号块金币逻辑也不应残留
  game.restart();
  assert.equal(game.score, 0);
  assert.equal(game.lives, 3);
  assert.equal(game.state, 'READY');
  assert.equal(game.paused, false);
  assert.equal(game.player.x, level.playerStart.x);
  assert.equal(game.player.y, level.playerStart.y);
  assert.equal(game.enemies.length, 1);
  assert.equal(game.enemies[0].alive, true);
  assert.equal(game.enemies[0].squashed, false);
  assert.equal(game.coins.length, 1);
  assert.equal(game.coins[0].taken, false);
});

test('AC-5.6 暂停：仅 PLAYING 可暂停，暂停期间 update 不推进', () => {
  const game = new Game(makeLevel());
  // READY 状态暂停无效
  assert.equal(game.togglePause(), false);
  assert.equal(game.paused, false);

  game.start();
  assert.equal(game.togglePause(), true);
  assert.equal(game.paused, true);
  game.player.x = 100;
  game.player.vx = 100;
  game.player.vy = 0;
  game.update(0.1, noInput());
  assert.equal(game.player.x, 100, '暂停时不应移动');

  game.togglePause();
  assert.equal(game.paused, false);
  game.update(0.1, noInput());
  assert.ok(game.player.x !== 100, '恢复后应继续移动');
});

test('AC-4.3 踩敌人得分：+100、敌人死亡、玩家反弹（经 update 集成）', () => {
  const level = makeLevel({ enemies: [{ x: 200, y: 8 * TILE_SIZE - 26 }] });
  const game = new Game(level);
  game.start();
  game.invincibleTimer = 0; // 测试中跳过无敌时间
  const e = game.enemies[0];
  // 玩家贴着敌人顶部下落
  game.player.x = e.x;
  game.player.y = e.y - 30;
  game.player.vx = 0;
  game.player.vy = 300;
  game.update(0.01, noInput());
  assert.equal(e.squashed, true);
  assert.equal(e.alive, false);
  assert.equal(game.score, ENEMY_SCORE);
  assert.equal(game.player.vy, BOUNCE_VELOCITY);
});

test('AC-4.4 侧面接触敌人：损失一条命并重生（经 update 集成）', () => {
  const level = makeLevel({ enemies: [{ x: 200, y: 8 * TILE_SIZE - 26 }] });
  const game = new Game(level);
  game.start();
  game.invincibleTimer = 0; // 测试中跳过无敌时间
  const e = game.enemies[0];
  game.player.x = e.x - 10;
  game.player.y = 8 * TILE_SIZE - 30; // 与敌人同高度（侧面接触）
  game.player.vx = 0;
  game.player.vy = 0;
  game.update(0.01, noInput());
  assert.equal(game.lives, 2);
  assert.equal(game.player.x, level.playerStart.x);
  assert.equal(game.player.y, level.playerStart.y);
});

test('AC-4.5 吃金币得分：+100（经 update 集成）', () => {
  const level = makeLevel({ coins: [{ x: 200, y: 100, w: 20, h: 24, taken: false }] });
  const game = new Game(level);
  game.start();
  game.player.x = 200;
  game.player.y = 100;
  game.update(0.01, noInput());
  assert.equal(game.coins[0].taken, true);
  assert.equal(game.score, COIN_SCORE);
});

test('AC-2.6 顶撞问号块：生成金币并标记已用（经 game.questionBump）', () => {
  const level = makeLevel();
  level.questionTiles = [{ tx: 5, ty: 4, used: false }];
  const game = new Game(level);
  const before = game.coins.length;
  game.questionBump(5, 4);
  assert.equal(level.questionTiles[0].used, true);
  assert.equal(game.coins.length, before + 1);
  // 再次顶撞已用的问号块不再生成
  game.questionBump(5, 4);
  assert.equal(game.coins.length, before + 1);
});

test('相机在 PLAYING 时跟随玩家（cameraX 右移）', () => {
  const level = makeLevel({ w: 100 });
  const game = new Game(level);
  game.start();
  game.player.x = 60 * TILE_SIZE;
  game.update(0.1, noInput());
  assert.ok(game.cameraX > 0, `cameraX 应跟随：${game.cameraX}`);
});

test('AC-5.7 coinPopOffset：顶出金币先上升后回落、动画结束后静止', () => {
  const total = COIN_POP_RISE_TIME + COIN_POP_FALL_TIME;
  // 起始静止
  assert.equal(coinPopOffset(0), 0);
  // 上升段：偏移为负（向上），高度 ≤ 2 格
  const halfRise = coinPopOffset(COIN_POP_RISE_TIME / 2);
  assert.ok(halfRise < 0, `上升中途应在方块上方：${halfRise}`);
  assert.ok(halfRise >= -COIN_POP_RISE, '上升高度不超过 COIN_POP_RISE');
  // 峰值 = 上升段结束
  assert.equal(coinPopOffset(COIN_POP_RISE_TIME), -COIN_POP_RISE);
  // 回落段：逐渐回到 0，且从不低于初始位置
  const fallHalf = coinPopOffset(COIN_POP_RISE_TIME + COIN_POP_FALL_TIME / 2);
  assert.ok(fallHalf < 0 && fallHalf > -COIN_POP_RISE, `回落中途仍在上升段之上：${fallHalf}`);
  // 动画结束 → 静止在初始位置
  assert.equal(coinPopOffset(total), 0);
  assert.equal(coinPopOffset(total + 1), 0);
});

test('AC-5.8 顶撞问号块：新金币带弹出动画计时，update 推进并回落静止', () => {
  const level = makeLevel();
  level.questionTiles = [{ tx: 5, ty: 4, used: false }];
  const game = new Game(level);
  game.start();
  game.questionBump(5, 4);
  const coin = game.coins[game.coins.length - 1];
  assert.equal(coin.taken, false);
  assert.equal(coin.popT, 0, '新顶出金币应从 popT=0 开始');
  const restY = coin.y;

  // 前进一半上升时间 → 金币应位于初始位置之上
  const dt = 0.01;
  const stepsToMidRise = Math.round(COIN_POP_RISE_TIME / 2 / dt);
  for (let i = 0; i < stepsToMidRise; i++) game.update(dt, noInput());
  assert.ok(coin.y + coinPopOffset(coin.popT) < restY, '上升段应显示在方块上方');
  assert.ok(coin.popT > 0, 'popT 应被推进');

  // 一直更新到动画结束 → 金币落回初始位置
  const stepsToEnd = Math.round((COIN_POP_RISE_TIME + COIN_POP_FALL_TIME) / dt) + 1;
  for (let i = 0; i < stepsToEnd; i++) game.update(dt, noInput());
  assert.equal(coin.y, restY);
  assert.ok(coin.popT >= COIN_POP_RISE_TIME + COIN_POP_FALL_TIME, '动画计时器已走完');
});
