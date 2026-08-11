// AC-4 实体（玩家、敌人、金币）

import {
  PLAYER_WIDTH, PLAYER_HEIGHT, ENEMY_WIDTH, ENEMY_HEIGHT,
  ENEMY_SPEED, GRAVITY, MAX_FALL, JUMP_VELOCITY, BOUNCE_VELOCITY,
  TILE_SIZE, ACCEL, DECEL,
  applyGravity, capFall, accelerate, decelerate, jump, cutJump,
} from './physics.js';
import { aabbOverlap, solidTilesOverlap, tileAt } from './collision.js';

// AC-4 玩家工厂
export function createPlayer(x, y) {
  return {
    type: 'player',
    x, y,
    w: PLAYER_WIDTH,
    h: PLAYER_HEIGHT,
    vx: 0, vy: 0,
    onGround: false,
    facing: 1,
    alive: true,
    deadTimer: 0,
  };
}

// AC-4 敌人工厂
export function createGoomba(x, y) {
  return {
    type: 'goomba',
    x, y,
    w: ENEMY_WIDTH,
    h: ENEMY_HEIGHT,
    vx: ENEMY_SPEED,
    vy: 0,
    dir: 1,
    alive: true,
    squashed: false,
  };
}

// AC-4.1/4.2 垂直物理：跳跃 + 重力（在移动前调用）
export function updatePlayerVertical(p, input, dt) {
  if (input.jumpPressed && p.onGround) {
    p.vy = jump();
  }
  p.vy = capFall(applyGravity(p.vy, dt));
  if (!input.jumpHeld && p.vy < 0) {
    p.vy = cutJump(p.vy);
  }
}

// AC-4.1 水平输入：加速/减速（在移动后调用，确保当前帧 vx 先用于位移）
export function updatePlayerHorizontal(p, input, dt) {
  const left = input.left && !input.right;
  const right = input.right && !input.left;
  if (left) {
    p.vx = accelerate(p.vx, -1, dt);
    p.facing = -1;
  } else if (right) {
    p.vx = accelerate(p.vx, 1, dt);
    p.facing = 1;
  } else {
    p.vx = decelerate(p.vx, dt);
  }
}

// AC-4.1/4.2 玩家更新（便捷合并：供单元测试直接调用）
export function updatePlayer(p, input, dt) {
  updatePlayerVertical(p, input, dt);
  updatePlayerHorizontal(p, input, dt);
}

// AC-4.3 玩家与敌人碰撞分类
export function enemyCollisionType(p, e) {
  if (!e.alive) return null;
  if (!aabbOverlap(p, e)) return null;
  // 玩家下落且脚部在敌人上半部 → 踩中
  const playerBottom = p.y + p.h;
  const enemyCenter = e.y + e.h / 2;
  if (p.vy > 0 && playerBottom <= enemyCenter) return 'stomp';
  return 'hurt';
}

// AC-4.3d 踩死敌人
export function squashEnemy(e) {
  e.alive = false;
  e.squashed = true;
}

// AC-4.3d 玩家反弹
export function bouncePlayer(p) {
  p.vy = BOUNCE_VELOCITY;
}

// AC-4.5 接触金币：收集
export function collectCoin(p, coin) {
  if (coin.taken) return false;
  if (!aabbOverlap(p, coin)) return false;
  coin.taken = true;
  return true;
}

// AC-4.5 直接标记金币已取
export function takeCoin(coin) {
  coin.taken = true;
}

// AC-4.6 敌人巡逻：遇墙或悬崖转向
export function updateGoomba(g, level, dt) {
  if (g.squashed || !g.alive) return;

  const oldX = g.x;
  g.x += g.vx * dt;

  // 撞墙检测
  if (solidTilesOverlap(g, level)) {
    g.x = oldX;
    g.dir = -g.dir;
    g.vx = ENEMY_SPEED * g.dir;
    return;
  }

  // 悬崖检测：前方下方是否有地面
  const frontX = g.dir > 0 ? g.x + g.w : g.x;
  const frontTx = Math.floor(frontX / TILE_SIZE);
  const groundTy = Math.floor((g.y + g.h) / TILE_SIZE);
  const groundTile = tileAt(level, frontTx, groundTy);
  if (!groundTile || !groundTile.solid) {
    g.x = oldX;
    g.dir = -g.dir;
    g.vx = ENEMY_SPEED * g.dir;
  }
}
