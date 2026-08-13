// AC-7/AC-8 游戏入口：初始化 Canvas、绑定输入、运行主循环（浏览器端，不参与单元测试）

import { parseLevel } from './engine/level.js';
import { Game } from './engine/game.js';
import { Input } from './engine/input.js';
import { drawGame } from './render.js';
import { VIEW_W, VIEW_H } from './engine/camera.js';
import { levels } from './levels/index.js';

const canvas = document.getElementById('game');
canvas.width = VIEW_W;
canvas.height = VIEW_H;
const ctx = canvas.getContext('2d');

// 关卡循环：level1 → … → level5 → level1 → …（通关后循环）
const LEVELS = levels;
let levelIndex = 0;
let level = parseLevel(LEVELS[levelIndex]);
let game = new Game(level);
const input = new Input();
let debugHitbox = false; // H 键开关：调试命中框

function loadLevel(idx) {
  levelIndex = ((idx % LEVELS.length) + LEVELS.length) % LEVELS.length;
  level = parseLevel(LEVELS[levelIndex]);
  game = new Game(level);
}

// ---- 键盘事件 ----
window.addEventListener('keydown', (e) => {
  // READY：Enter 或 Space 开始游戏
  if ((e.key === 'Enter' || e.key === ' ') && game.state === 'READY') {
    game.start();
    e.preventDefault();
    return;
  }
  // WON：Enter 进入下一关（最后一关后回到第一关）
  if (e.key === 'Enter' && game.state === 'WON') {
    loadLevel(levelIndex + 1);
    game.start();
    e.preventDefault();
    return;
  }
  // GAME_OVER：Enter 重开当前关
  if (e.key === 'Enter' && game.state === 'GAME_OVER') {
    game.restart();
    e.preventDefault();
    return;
  }
  // 暂停：仅 PLAYING 时可暂停/恢复
  if ((e.key === 'p' || e.key === 'P' || e.key === 'Escape') && game.state === 'PLAYING') {
    game.togglePause();
    e.preventDefault();
    return;
  }
  // 调试命中框开关
  if (e.key === 'h' || e.key === 'H') {
    debugHitbox = !debugHitbox;
    e.preventDefault();
    return;
  }
  input.keydown(e.key);
  // 游戏按键阻止浏览器默认行为（滚动/刷新等）
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', ' ', 'a', 'd', 'w'].includes(e.key)) {
    e.preventDefault();
  }
});

window.addEventListener('keyup', (e) => {
  input.keyup(e.key);
});

// ---- 主循环 ----
let lastTime = performance.now();

function loop(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;

  game.update(dt, input);
  input.resetFrame();

  drawGame(ctx, game, level, debugHitbox);

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
