// AC-7/AC-8 游戏入口：初始化 Canvas、绑定输入、运行主循环

import { parseLevel } from './engine/level.js';
import { Game } from './engine/game.js';
import { Input } from './engine/input.js';
import { drawGame } from './render.js';
import { level1Text } from './levels/level1.js';

const CANVAS_W = 800;
const CANVAS_H = 480;

const canvas = document.getElementById('game');
canvas.width = CANVAS_W;
canvas.height = CANVAS_H;
const ctx = canvas.getContext('2d');

const level = parseLevel(level1Text);
const game = new Game(level);
const input = new Input();

// ---- 键盘事件 ----
window.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && game.state === 'READY') {
    game.start();
    e.preventDefault();
    return;
  }
  if ((e.key === 'r' || e.key === 'R') &&
      (game.state === 'WON' || game.state === 'GAME_OVER')) {
    game.restart();
    e.preventDefault();
    return;
  }
  input.keydown(e.key);
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(e.key)) {
    e.preventDefault();
  }
});

window.addEventListener('keyup', (e) => {
  input.keyup(e.key);
});

// ---- 主循环 ----
let lastTime = performance.now();

function loop(now) {
  let dt = (now - lastTime) / 1000;
  lastTime = now;
  if (dt > 0.05) dt = 0.05; // 防止切换标签后大步进

  game.update(dt, input);
  input.resetFrame();

  drawGame(ctx, game, level);

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
