// AC-1 物理常量与纯函数（SPEC 第 4 节，数值不得更改）

export const PHYSICS = {
  GRAVITY: 1800,
  MAX_FALL: 700,
  MOVE_SPEED: 220,
  ACCEL: 1600,
  DECEL: 1200,
  JUMP_VELOCITY: -560,
  JUMP_HOLD_FACTOR: 0.55,
  TILE_SIZE: 32,
  PLAYER_WIDTH: 24,
  PLAYER_HEIGHT: 30,
  ENEMY_WIDTH: 26,
  ENEMY_HEIGHT: 26,
  BOUNCE_VELOCITY: -420,
  ENEMY_SPEED: 60,
  CAMERA_SPEED: 600,
  COIN_SCORE: 100,
  ENEMY_SCORE: 100,
  PIT_TOLERANCE: 64,
};

export const {
  GRAVITY,
  MAX_FALL,
  MOVE_SPEED,
  ACCEL,
  DECEL,
  JUMP_VELOCITY,
  JUMP_HOLD_FACTOR,
  TILE_SIZE,
  PLAYER_WIDTH,
  PLAYER_HEIGHT,
  ENEMY_WIDTH,
  ENEMY_HEIGHT,
  BOUNCE_VELOCITY,
  ENEMY_SPEED,
  CAMERA_SPEED,
  COIN_SCORE,
  ENEMY_SCORE,
  PIT_TOLERANCE,
} = PHYSICS;

// AC-1.1 重力使垂直速度随时间增加
export function applyGravity(vy, dt) {
  return vy + GRAVITY * dt;
}

// AC-1.2 垂直速度不超过 MAX_FALL（上升不截断）
export function capFall(vy) {
  if (vy > MAX_FALL) return MAX_FALL;
  return vy;
}

// AC-1.3 有输入时水平速度向目标速度加速（限制在 ±MOVE_SPEED 内）
export function accelerate(vx, dir, dt) {
  const target = MOVE_SPEED * dir;
  const next = vx + ACCEL * dir * dt;
  if (dir > 0) return Math.min(next, target);
  if (dir < 0) return Math.max(next, target);
  return vx;
}

// AC-1.4 无输入时水平速度以 DECEL 减速至 0（不越过 0）
export function decelerate(vx, dt) {
  if (vx > 0) return Math.max(0, vx - DECEL * dt);
  if (vx < 0) return Math.min(0, vx + DECEL * dt);
  return 0;
}

// AC-1.5 起跳设置垂直速度为 JUMP_VELOCITY
export function jump() {
  return JUMP_VELOCITY;
}

// AC-1.6 松开跳跃键时上升速度被截断（下落中不受影响）
export function cutJump(vy) {
  if (vy < 0) return vy * JUMP_HOLD_FACTOR;
  return vy;
}
