// AC-1 物理
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PHYSICS, GRAVITY, MAX_FALL, MOVE_SPEED, ACCEL, DECEL,
  JUMP_VELOCITY, JUMP_HOLD_FACTOR, TILE_SIZE,
  applyGravity, capFall, accelerate, decelerate, jump, cutJump,
} from '../src/engine/physics.js';

const DT = 0.1;

test('AC-1.1 重力使垂直速度随时间增加', () => {
  assert.equal(applyGravity(0, DT), GRAVITY * DT);
  assert.equal(applyGravity(100, DT), 100 + GRAVITY * DT);
});

test('AC-1.2 垂直速度不超过 MAX_FALL', () => {
  assert.equal(capFall(MAX_FALL), MAX_FALL);
  assert.equal(capFall(MAX_FALL + 500), MAX_FALL);
  assert.equal(capFall(0), 0);
  // 上升速度（负值）不被截断
  assert.equal(capFall(-500), -500);
});

test('AC-1.3 有输入时水平速度向目标速度加速', () => {
  assert.equal(accelerate(0, 1, DT), ACCEL * DT);
  assert.equal(accelerate(0, -1, DT), -ACCEL * DT);
  // 限制在 MOVE_SPEED 内
  assert.equal(accelerate(MOVE_SPEED, 1, DT), MOVE_SPEED);
  assert.equal(accelerate(MOVE_SPEED - 10, 1, DT), MOVE_SPEED);
  assert.equal(accelerate(-MOVE_SPEED + 10, -1, DT), -MOVE_SPEED);
});

test('AC-1.4 无输入时水平速度减速至 0', () => {
  assert.equal(decelerate(200, DT), 200 - DECEL * DT);
  assert.equal(decelerate(-200, DT), -200 + DECEL * DT);
  // 不会越过 0
  assert.equal(decelerate(50, DT), 0);
  assert.equal(decelerate(-50, DT), 0);
  assert.equal(decelerate(0, DT), 0);
});

test('AC-1.5 起跳设置垂直速度为 JUMP_VELOCITY', () => {
  assert.equal(jump(), JUMP_VELOCITY);
});

test('AC-1.6 松开跳跃键时上升速度被截断（可变跳跃）', () => {
  assert.equal(cutJump(-300), -300 * JUMP_HOLD_FACTOR);
  assert.equal(cutJump(JUMP_VELOCITY), JUMP_VELOCITY * JUMP_HOLD_FACTOR);
  // 下落中（vy >= 0）不受影响
  assert.equal(cutJump(100), 100);
});

test('常量符合 SPEC 定义', () => {
  assert.equal(GRAVITY, 1800);
  assert.equal(MAX_FALL, 700);
  assert.equal(MOVE_SPEED, 220);
  assert.equal(ACCEL, 1600);
  assert.equal(DECEL, 1200);
  assert.equal(JUMP_VELOCITY, -560);
  assert.equal(JUMP_HOLD_FACTOR, 0.55);
  assert.equal(TILE_SIZE, 32);
  assert.ok(PHYSICS.ENEMY_SPEED > 0);
});
