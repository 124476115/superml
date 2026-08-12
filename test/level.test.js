// AC-3 关卡解析
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TILE_SIZE, PLAYER_WIDTH, PLAYER_HEIGHT, ENEMY_WIDTH, ENEMY_HEIGHT } from '../src/engine/physics.js';
import { parseLevel } from '../src/engine/level.js';

// 18 列 × 7 行（已对齐）
// 行0:  P 出生点(4,0)  o 金币(9,0)  G 敌人(12,0)  F 旗杆(17,0)
// 行2:  # 实心(10,2)  ? 问号块(11,2)
// 行5:  # 实心(5..15,5)
// 行6:  # 实心(0..17,6)
const LEVEL_TEXT = [
  '....P....o..G....F',
  '..................',
  '..........#?......',
  '..................',
  '..................',
  '.....###########.',
  '##################',
].join('\n');

test('AC-3.1 解析得到正确的宽高与瓦片数组', () => {
  const level = parseLevel(LEVEL_TEXT);
  assert.equal(level.width, 18);
  assert.equal(level.height, 7);
  assert.equal(level.tiles.length, 18 * 7);
});

test('AC-3.2 实心字符 # / ? 映射为 1，其余为 0', () => {
  const level = parseLevel(LEVEL_TEXT);
  const idx = (tx, ty) => ty * level.width + tx;
  assert.equal(level.tiles[idx(10, 2)], 1); // #
  assert.equal(level.tiles[idx(11, 2)], 1); // ?
  assert.equal(level.tiles[idx(5, 5)], 1);
  assert.equal(level.tiles[idx(15, 5)], 1);
  assert.equal(level.tiles[idx(16, 5)], 0); // 行5最后一个 . 不是实心
  assert.equal(level.tiles[idx(4, 0)], 0);  // P 位置非实心
  assert.equal(level.tiles[idx(9, 0)], 0);  // o 位置非实心
});

test('AC-3.3 识别 P 出生点并换算为站立左上角坐标', () => {
  const level = parseLevel(LEVEL_TEXT);
  // P 在 (4,0)：水平居中在瓦片，垂直站在瓦片上（底部=(0+1)*TILE_SIZE）
  assert.deepEqual(level.playerStart, {
    x: 4 * TILE_SIZE + (TILE_SIZE - PLAYER_WIDTH) / 2,
    y: 1 * TILE_SIZE - PLAYER_HEIGHT,
  });
});

test('AC-3.4 识别所有 o 金币坐标（瓦片中心，金币左上角偏移）', () => {
  const level = parseLevel(LEVEL_TEXT);
  assert.equal(level.coins.length, 1);
  // 金币中心对齐瓦片中心，左上角 = 中心 - (10, 12)
  assert.deepEqual(level.coins[0], {
    x: (9 + 0.5) * TILE_SIZE - 10,
    y: (0 + 0.5) * TILE_SIZE - 12,
    taken: false,
  });
});

test('AC-3.5 识别所有 G 敌人坐标（站立左上角）', () => {
  const level = parseLevel(LEVEL_TEXT);
  assert.equal(level.enemies.length, 1);
  assert.deepEqual(level.enemies[0], {
    x: 12 * TILE_SIZE + (TILE_SIZE - ENEMY_WIDTH) / 2,
    y: 1 * TILE_SIZE - ENEMY_HEIGHT,
  });
});

test('AC-3.6 识别 F 旗杆坐标', () => {
  const level = parseLevel(LEVEL_TEXT);
  assert.ok(level.flag, '应存在旗杆');
  assert.equal(level.flag.tx, 17);
  assert.equal(level.flag.x, (17 + 0.5) * TILE_SIZE);
});

test('AC-3.6b 无 F 时 flag 为 null', () => {
  const text = [
    '....P....o..G....',
    '..................',
    '##################',
  ].join('\n');
  const level = parseLevel(text);
  assert.equal(level.flag, null);
});

test('AC-3.7 多个 P 抛出错误', () => {
  const text = ['...P...P...', '###########'].join('\n');
  assert.throws(() => parseLevel(text), /P/);
});
