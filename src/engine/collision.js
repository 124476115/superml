// AC-2 AABB 碰撞解析（水平先、垂直后；分步扫描防穿墙）

import { TILE_SIZE } from './physics.js';

// AC-2.1 边界相切不算重叠 → 使用严格 <
export function aabbOverlap(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

// 取瓦片坐标 (tx, ty)；越界返回 null
export function tileAt(level, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= level.width || ty >= level.height) return null;
  const v = level.tiles[ty * level.width + tx];
  return { tx, ty, solid: v === 1, value: v };
}

// 判断实体是否与任何实心瓦片重叠
export function solidTilesOverlap(entity, level) {
  const minTx = Math.floor(entity.x / TILE_SIZE);
  const maxTx = Math.floor((entity.x + entity.w - 1) / TILE_SIZE);
  const minTy = Math.floor(entity.y / TILE_SIZE);
  const maxTy = Math.floor((entity.y + entity.h - 1) / TILE_SIZE);
  for (let ty = minTy; ty <= maxTy; ty++) {
    for (let tx = minTx; tx <= maxTx; tx++) {
      const t = tileAt(level, tx, ty);
      if (t && t.solid) return true;
    }
  }
  return false;
}

// 沿 X 轴分步移动并解析碰撞
function moveX(entity, dx, level, info) {
  if (dx === 0) return;
  const sign = Math.sign(dx);
  let remaining = Math.abs(dx);
  const maxStep = TILE_SIZE / 2;
  while (remaining > 0) {
    const step = Math.min(remaining, maxStep);
    entity.x += sign * step;
    remaining -= step;
    if (!solidTilesOverlap(entity, level)) continue;
    // 发生碰撞：对齐到墙边
    const minTx = Math.floor(entity.x / TILE_SIZE);
    const maxTx = Math.floor((entity.x + entity.w - 1) / TILE_SIZE);
    const minTy = Math.floor(entity.y / TILE_SIZE);
    const maxTy = Math.floor((entity.y + entity.h - 1) / TILE_SIZE);
    if (sign > 0) {
      // 向右撞：找最左 solid 瓦片，玩家右边界对齐到其左边界
      let wallTx = Infinity;
      for (let ty = minTy; ty <= maxTy; ty++) {
        for (let tx = minTx; tx <= maxTx; tx++) {
          const t = tileAt(level, tx, ty);
          if (t && t.solid && tx < wallTx) wallTx = tx;
        }
      }
      if (wallTx !== Infinity) {
        entity.x = wallTx * TILE_SIZE - entity.w;
        entity.vx = 0;
        info.hitX = true;
      }
    } else {
      // 向左撞：找最右 solid 瓦片，玩家左边界对齐到其右边界
      let wallTx = -Infinity;
      for (let ty = minTy; ty <= maxTy; ty++) {
        for (let tx = minTx; tx <= maxTx; tx++) {
          const t = tileAt(level, tx, ty);
          if (t && t.solid && tx > wallTx) wallTx = tx;
        }
      }
      if (wallTx !== -Infinity) {
        entity.x = (wallTx + 1) * TILE_SIZE;
        entity.vx = 0;
        info.hitX = true;
      }
    }
    break;
  }
}

// 沿 Y 轴分步移动并解析碰撞
function moveY(entity, dy, level, info) {
  if (dy === 0) return;
  const sign = Math.sign(dy);
  let remaining = Math.abs(dy);
  const maxStep = TILE_SIZE / 2;
  while (remaining > 0) {
    const step = Math.min(remaining, maxStep);
    entity.y += sign * step;
    remaining -= step;
    if (!solidTilesOverlap(entity, level)) continue;
    // 发生碰撞：对齐
    const minTx = Math.floor(entity.x / TILE_SIZE);
    const maxTx = Math.floor((entity.x + entity.w - 1) / TILE_SIZE);
    const minTy = Math.floor(entity.y / TILE_SIZE);
    const maxTy = Math.floor((entity.y + entity.h - 1) / TILE_SIZE);
    if (sign > 0) {
      // 向下落：找最上 solid 瓦片，玩家底面对齐到其顶面
      let groundTy = Infinity;
      for (let tx = minTx; tx <= maxTx; tx++) {
        for (let ty = maxTy; ty >= minTy; ty--) {
          const t = tileAt(level, tx, ty);
          if (t && t.solid && ty < groundTy) groundTy = ty;
        }
      }
      if (groundTy !== Infinity) {
        entity.y = groundTy * TILE_SIZE - entity.h;
        entity.vy = 0;
        info.onGround = true;
        info.hitY = true;
      }
    } else {
      // 向上顶撞：找最下 solid 瓦片，玩家顶面对齐到其底面
      let ceilTy = -Infinity;
      for (let tx = minTx; tx <= maxTx; tx++) {
        for (let ty = minTy; ty <= maxTy; ty++) {
          const t = tileAt(level, tx, ty);
          if (t && t.solid && ty > ceilTy) ceilTy = ty;
        }
      }
      if (ceilTy !== -Infinity) {
        entity.y = (ceilTy + 1) * TILE_SIZE;
        entity.vy = 0;
        info.hitY = true;
        for (let tx = minTx; tx <= maxTx; tx++) {
          const t = tileAt(level, tx, ceilTy);
          if (t && t.solid) info.bumpedTiles.push({ tx, ty: ceilTy });
        }
      }
    }
    break;
  }
}

// AC-2.5 主入口：水平先、垂直后
export function moveWithCollision(entity, dt, level) {
  const info = { hitX: false, hitY: false, onGround: false, bumpedTiles: [] };
  entity.onGround = false;
  const dx = entity.vx * dt;
  const dy = entity.vy * dt;
  if (dx !== 0) moveX(entity, dx, level, info);
  if (dy !== 0) moveY(entity, dy, level, info);
  return info;
}
