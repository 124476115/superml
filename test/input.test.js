// AC-7 输入
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Input } from '../src/engine/input.js';

test('AC-7.1 键位映射：方向键 / WASD / 空格 / Esc / p', () => {
  assert.equal(Input.actionForKey('ArrowLeft'), 'left');
  assert.equal(Input.actionForKey('a'), 'left');
  assert.equal(Input.actionForKey('A'), 'left');
  assert.equal(Input.actionForKey('ArrowRight'), 'right');
  assert.equal(Input.actionForKey('d'), 'right');
  assert.equal(Input.actionForKey('D'), 'right');
  assert.equal(Input.actionForKey('ArrowUp'), 'jump');
  assert.equal(Input.actionForKey('w'), 'jump');
  assert.equal(Input.actionForKey(' '), 'jump');
  assert.equal(Input.actionForKey('p'), 'pause');
  assert.equal(Input.actionForKey('P'), 'pause');
  assert.equal(Input.actionForKey('Escape'), 'pause');
  assert.equal(Input.actionForKey('x'), null);
  assert.equal(Input.actionForKey('Enter'), null);
});

test('AC-7.1b 按下 / 松开后状态反映到 left / right / jump', () => {
  const input = new Input();
  input.keydown('ArrowLeft');
  assert.equal(input.left, true);
  input.keyup('ArrowLeft');
  assert.equal(input.left, false);

  input.keydown('d');
  assert.equal(input.right, true);
  input.keyup('d');
  assert.equal(input.right, false);

  input.keydown(' ');
  assert.equal(input.jumpHeld, true);
  assert.equal(input.jumpPressed, true);
  input.keyup(' ');
  assert.equal(input.jumpHeld, false);
});

test('AC-7.2 同方向多键同时按下不冲突（计数去重）', () => {
  const input = new Input();
  input.keydown('ArrowLeft');
  input.keydown('a');
  assert.equal(input.left, true);
  // 松开其中一个，另一个仍按住 -> 仍为 true
  input.keyup('a');
  assert.equal(input.left, true);
  // 全部松开才变 false
  input.keyup('ArrowLeft');
  assert.equal(input.left, false);
});

test('AC-7.3 边沿事件：jumpPressed / pausePressed 仅存在一帧', () => {
  const input = new Input();
  input.keydown(' ');
  assert.equal(input.jumpPressed, true);
  input.resetFrame();
  assert.equal(input.jumpPressed, false);
  assert.equal(input.jumpHeld, true, '按住状态应保持');

  input.keydown('p');
  assert.equal(input.pausePressed, true);
  input.resetFrame();
  assert.equal(input.pausePressed, false);
  input.keyup('p');
});

test('AC-7.3b 忽略无关按键', () => {
  const input = new Input();
  input.keydown('Enter');
  input.keydown('9');
  assert.equal(input.left, false);
  assert.equal(input.right, false);
  assert.equal(input.jumpPressed, false);
  assert.equal(input.pausePressed, false);
  input.keyup('Enter');
  assert.equal(input.jumpPressed, false);
});
