// AC-3.8 可及性静态分析：验证关卡中所有交互元素（问号块/金币）是否可达
// 依据玩家物理：最大跳高 ≈ JUMP_VELOCITY²/(2*GRAVITY) = 560²/3600 ≈ 87px（2.7 格），
// 横向跳距 ≈ MOVE_SPEED * 2*t_apex ≈ 137px（约 4 格）。
// 设计铁律：任何可立足表面必须 ≤ 2 格高于其上一步立足面，否则不可达。

import { TILE_SIZE, PLAYER_WIDTH, PLAYER_HEIGHT } from './physics.js';

export const MAX_JUMP_PX = Math.floor((560 * 560) / (2 * 1800)); // 87
export const MAX_JUMP_UP_TILES = Math.floor(MAX_JUMP_PX / TILE_SIZE); // 2
export const MAX_JUMP_HORIZ_TILES = 4;

function isSolid(level, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= level.width || ty >= level.height) return false;
  return level.tiles[ty * level.width + tx] === 1;
}

// 是否可立足表面：该格实心、上方一格开放（玩家可站在其顶面上）
function isSurface(level, tx, ty) {
  return isSolid(level, tx, ty) && !isSolid(level, tx, ty - 1);
}

// 玩家站在列 tx 表面上时的水平占据区间（盒宽居中于瓦片）
function playerBoxX(tx) {
  return {
    left: tx * TILE_SIZE + (TILE_SIZE - PLAYER_WIDTH) / 2,
    right: tx * TILE_SIZE + (TILE_SIZE - PLAYER_WIDTH) / 2 + PLAYER_WIDTH,
  };
}

// 计算所有可达表面，返回 Map<tx, Set<ty>>
export function reachableSurfaces(level) {
  const start = level.playerStart;
  const ptx = Math.floor((start.x + PLAYER_WIDTH / 2) / TILE_SIZE); // 出生列（玩家中心）
  const startTy = Math.floor((start.y + PLAYER_HEIGHT) / TILE_SIZE); // 脚底所在行（支撑面）

  const reached = new Map(); // tx -> Set<ty>
  const queue = [];
  const add = (tx, ty) => {
    if (ty < 0 || ty >= level.height) return;
    if (!isSurface(level, tx, ty)) return;
    if (!reached.has(tx)) reached.set(tx, new Set());
    if (reached.get(tx).has(ty)) return;
    reached.get(tx).add(ty);
    queue.push([tx, ty]);
  };
  add(ptx, startTy);

  while (queue.length) {
    const [tx, ty] = queue.shift();

    // 1. 水平行走：同层相邻表面
    add(tx - 1, ty);
    add(tx + 1, ty);

    // 2. 跳跃：横向 ≤4 格，纵向上升 0~2 行（0 行 = 平地跳/跳过坑）
    for (let dtx = -MAX_JUMP_HORIZ_TILES; dtx <= MAX_JUMP_HORIZ_TILES; dtx++) {
      for (let dty = 0; dty <= MAX_JUMP_UP_TILES; dty++) {
        add(tx + dtx, ty - dty);
      }
    }

    // 3. 下落：从边缘掉下，落在下方第一个实心表面（横向 ≤4 格）
    for (let dtx = -MAX_JUMP_HORIZ_TILES; dtx <= MAX_JUMP_HORIZ_TILES; dtx++) {
      const cx = tx + dtx;
      for (let ry = ty + 1; ry < level.height; ry++) {
        if (isSurface(level, cx, ry)) {
          add(cx, ry);
          break;
        }
      }
    }
  }
  return reached;
}

// 问号块能否被顶：玩家站在其正下方（同列）可达表面上，跳起后头顶够到其底面
export function canBumpQuestion(level, q, reached) {
  const bottomY = (q.ty + 1) * TILE_SIZE;
  const rows = reached.get(q.tx);
  if (!rows) return false;
  const box = playerBoxX(q.tx);
  for (const ty of rows) {
    const headReach = ty * TILE_SIZE - PLAYER_HEIGHT - MAX_JUMP_PX; // 跳起后头顶最高
    if (headReach <= bottomY) return true;
  }
  return box && box.right > q.tx * TILE_SIZE; // （恒真，仅占位）
}

// 金币能否被拾取：玩家从金币列 ±4 列内的可达表面起跳，跳跃中玩家盒横扫到金币
// （跳坑途中可吃到坑上方的金币；竖直条件：跳起后头顶够到金币底、脚不低于金币顶）
export function canCollectCoin(level, coin, reached) {
  const w = coin.w || 20; // parseLevel 产生的金币只有 {x,y,taken}，尺寸在 Game 层补
  const h = coin.h || 24;
  const ctx = Math.floor((coin.x + w / 2) / TILE_SIZE);
  for (let tx = ctx - MAX_JUMP_HORIZ_TILES; tx <= ctx + MAX_JUMP_HORIZ_TILES; tx++) {
    const rows = reached.get(tx);
    if (!rows) continue;
    for (const ty of rows) {
      const feetY = ty * TILE_SIZE;
      const headReach = feetY - PLAYER_HEIGHT - MAX_JUMP_PX; // 跳起后头顶最高
      if (headReach <= coin.y + h && feetY >= coin.y) return true;
    }
  }
  return false;
}

// 审计关卡：返回所有不可达交互元素
// 返回 { reached, problems: [{type, tx, ty}] }
export function auditLevel(level) {
  const reached = reachableSurfaces(level);
  const problems = [];

  for (const q of level.questionTiles) {
    if (!canBumpQuestion(level, q, reached)) {
      problems.push({ type: 'question-unreachable', tx: q.tx, ty: q.ty });
      continue;
    }
    // 顶出的金币（问号块正上方 1 格）也必须可拾取，否则顶了拿不到
    const pop = {
      x: (q.tx + 0.5) * TILE_SIZE - 10,
      y: (q.ty - 1 + 0.5) * TILE_SIZE - 12,
      w: 20,
      h: 24,
    };
    if (!canCollectCoin(level, pop, reached)) {
      problems.push({ type: 'question-pop-uncollectible', tx: q.tx, ty: q.ty });
    }
  }

  for (const c of level.coins) {
    if (!canCollectCoin(level, c, reached)) {
      problems.push({ type: 'coin-unreachable', tx: Math.floor(c.x / TILE_SIZE), ty: Math.floor(c.y / TILE_SIZE) });
    }
  }

  return { reached, problems };
}
