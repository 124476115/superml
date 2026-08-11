// AC-5 游戏状态机与主更新循环

import {
  TILE_SIZE, COIN_SCORE, ENEMY_SCORE, PIT_TOLERANCE,
} from './physics.js';
import { moveWithCollision, aabbOverlap } from './collision.js';
import {
  createPlayer, createGoomba,
  updatePlayerVertical, updatePlayerHorizontal,
  updateGoomba, enemyCollisionType, squashEnemy, bouncePlayer, collectCoin,
} from './entities.js';
import { followCamera } from './camera.js';

const COIN_W = 20;
const COIN_H = 24;

export class Game {
  constructor(level) {
    this.level = level;
    this.player = createPlayer(level.playerStart.x, level.playerStart.y);
    this.enemies = (level.enemies || []).map((e) => createGoomba(e.x, e.y));
    this.coins = (level.coins || []).map((c) => ({
      x: c.x,
      y: c.y,
      w: c.w || COIN_W,
      h: c.h || COIN_H,
      taken: false,
    }));
    // questionTiles 直接引用 level 的数组（questionBump 需修改 level 上的 used 标记）
    this.questionTiles = level.questionTiles || [];
    this.lives = 3;
    this.score = 0;
    this.state = 'READY';
    this.paused = false;
    this.cameraX = 0;
  }

  // AC-5.1 READY → PLAYING
  start() {
    if (this.state === 'READY') this.state = 'PLAYING';
  }

  // AC-5.5 重置全部状态
  restart() {
    this.lives = 3;
    this.score = 0;
    this.state = 'READY';
    this.paused = false;
    this.cameraX = 0;
    this.player.x = this.level.playerStart.x;
    this.player.y = this.level.playerStart.y;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.onGround = false;
    this.player.alive = true;
    this.enemies = (this.level.enemies || []).map((e) => createGoomba(e.x, e.y));
    this.coins = (this.level.coins || []).map((c) => ({
      x: c.x,
      y: c.y,
      w: c.w || COIN_W,
      h: c.h || COIN_H,
      taken: false,
    }));
    for (const q of this.questionTiles) q.used = false;
  }

  // AC-5.6 仅 PLAYING 可暂停/恢复
  togglePause() {
    if (this.state !== 'PLAYING') return false;
    this.paused = !this.paused;
    return true;
  }

  // AC-5.4 损失一条命：命数为 0 → GAME_OVER，否则重生
  onHurt() {
    this.lives -= 1;
    if (this.lives <= 0) {
      this.lives = 0;
      this.state = 'GAME_OVER';
    } else {
      this.respawnPlayer();
    }
  }

  respawnPlayer() {
    this.player.x = this.level.playerStart.x;
    this.player.y = this.level.playerStart.y;
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.onGround = false;
  }

  // AC-2.6 顶撞问号块：标记已用并在上方生成金币
  questionBump(tx, ty) {
    const q = this.questionTiles.find((qt) => qt.tx === tx && qt.ty === ty);
    if (!q || q.used) return;
    q.used = true;
    this.coins.push({
      x: (tx + 0.5) * TILE_SIZE,
      y: (ty - 1 + 0.5) * TILE_SIZE,
      w: COIN_W,
      h: COIN_H,
      taken: false,
    });
  }

  // AC-5 主更新循环
  update(dt, input) {
    if (this.state !== 'PLAYING') return;
    if (this.paused) return;

    // 1. 垂直物理（跳跃 + 重力）— 在移动前更新 vy
    updatePlayerVertical(this.player, input, dt);

    // 2. 玩家位移与碰撞解析
    const info = moveWithCollision(this.player, dt, this.level);
    this.player.onGround = info.onGround;

    // 3. 水平输入（加速/减速）— 在移动后更新 vx
    //    若本帧撞墙（vx 已被碰撞解析归零），跳过加速避免立即重新增速
    if (!info.hitX) {
      updatePlayerHorizontal(this.player, input, dt);
    }

    // 4. 顶撞问号块
    for (const b of info.bumpedTiles) {
      this.questionBump(b.tx, b.ty);
    }

    // 5. 坠崖判定
    if (this.player.y > this.level.height * TILE_SIZE + PIT_TOLERANCE) {
      this.onHurt();
      return;
    }

    // 6. 通关判定
    if (this.level.flagBox && aabbOverlap(this.player, this.level.flagBox)) {
      this.state = 'WON';
      return;
    }

    // 7. 金币收集
    for (const coin of this.coins) {
      if (collectCoin(this.player, coin)) {
        this.score += COIN_SCORE;
      }
    }

    // 8. 敌人碰撞
    for (const enemy of this.enemies) {
      const type = enemyCollisionType(this.player, enemy);
      if (type === 'stomp') {
        squashEnemy(enemy);
        bouncePlayer(this.player);
        this.score += ENEMY_SCORE;
      } else if (type === 'hurt') {
        this.onHurt();
        return;
      }
    }

    // 9. 敌人巡逻
    for (const enemy of this.enemies) {
      updateGoomba(enemy, this.level, dt);
    }

    // 10. 相机跟随
    this.cameraX = followCamera(this.cameraX, this.player.x, this.level, dt);
  }
}
