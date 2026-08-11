// AC-3 关卡解析（文本 → 结构化数据）

import { TILE_SIZE } from './physics.js';

const SOLID_CHARS = new Set(['#', '?']);

// 把瓦片坐标 (tx, ty) 转为瓦片中心像素坐标
function centerOf(tx, ty) {
  return { x: (tx + 0.5) * TILE_SIZE, y: (ty + 0.5) * TILE_SIZE };
}

// AC-3.1~3.7 解析文本关卡
export function parseLevel(text) {
  const lines = text.split('\n');
  // 取行最长宽度作为关卡宽度，空行视为全空行
  let width = 0;
  for (const line of lines) {
    if (line.length > width) width = line.length;
  }
  const height = lines.length;
  if (width === 0 || height === 0) {
    throw new Error('parseLevel: empty level');
  }

  const tiles = new Array(width * height).fill(0);
  const questionTiles = [];
  const coins = [];
  const enemies = [];
  let playerStart = null;
  let flag = null;

  for (let ty = 0; ty < height; ty++) {
    const line = lines[ty];
    for (let tx = 0; tx < width; tx++) {
      const ch = line[tx] || ' ';
      const idx = ty * width + tx;
      if (SOLID_CHARS.has(ch)) {
        tiles[idx] = 1;
        if (ch === '?') questionTiles.push({ tx, ty, used: false });
      } else if (ch === 'P') {
        if (playerStart !== null) {
          throw new Error(`parseLevel: multiple player start 'P' found`);
        }
        playerStart = centerOf(tx, ty);
      } else if (ch === 'o') {
        coins.push({ ...centerOf(tx, ty), taken: false });
      } else if (ch === 'G') {
        enemies.push(centerOf(tx, ty));
      } else if (ch === 'F') {
        flag = { tx, ty, ...centerOf(tx, ty) };
      }
      // 其余字符（. 或空格）保持 0
    }
  }

  if (playerStart === null) {
    throw new Error(`parseLevel: no player start 'P' found`);
  }

  return {
    width,
    height,
    tiles,
    questionTiles,
    playerStart,
    coins,
    enemies,
    flag,
    // 旗杆判定盒（用于碰撞检测）：以旗杆瓦片为中心，宽 1 瓦片、贯穿整个关卡高度
    flagBox: flag
      ? { x: flag.x - TILE_SIZE / 2, y: 0, w: TILE_SIZE, h: height * TILE_SIZE }
      : null,
  };
}
