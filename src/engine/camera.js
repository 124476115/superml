// AC-6 相机数学（世界→屏幕坐标换算、夹紧、平滑跟随）

import { TILE_SIZE, CAMERA_SPEED } from './physics.js';

export const VIEW_W = 800;
export const VIEW_H = 480;

// AC-6.1 世界坐标 → 屏幕坐标
export function screenX(worldX, cameraX) {
  return worldX - cameraX;
}

// AC-6.2 相机最大 X 位置
export function maxCameraX(level) {
  return level.width * TILE_SIZE - VIEW_W;
}

// AC-6.2 相机夹紧在 [0, maxCameraX] 内
export function clampCamera(cameraX, level) {
  const max = Math.max(0, maxCameraX(level));
  if (cameraX < 0) return 0;
  if (cameraX > max) return max;
  return cameraX;
}

// AC-6.3 相机平滑跟随玩家
// - 目标 = 玩家X - 半屏宽
// - 有最大追速 CAMERA_SPEED
// - 玩家越过边界时，相机直接吸附到边界
export function followCamera(current, playerX, level, dt) {
  const max = Math.max(0, maxCameraX(level));
  const desired = playerX - VIEW_W / 2;

  // 玩家在关卡边界外 → 相机吸附到边界
  if (desired >= max) return max;
  if (desired <= 0) return 0;

  // 在边界内 → 以最大追速靠近目标
  const diff = desired - current;
  const maxStep = CAMERA_SPEED * dt;
  if (Math.abs(diff) <= maxStep) return desired;
  return current + Math.sign(diff) * maxStep;
}
