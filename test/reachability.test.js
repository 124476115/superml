// AC-3.8/AC-8.9 可及性测试：每关所有问号块可顶、顶出金币可拾取、静态金币可拾取
// 运行：node --test test/reachability.test.js

import { test } from 'node:test';
import assert from 'node:assert';
import { parseLevel } from '../src/engine/level.js';
import { auditLevel } from '../src/engine/reachability.js';
import { levels } from '../src/levels/index.js';

for (let i = 0; i < levels.length; i++) {
  test(`AC-8.9 level${i + 1} 所有问号块可顶、顶出金币与静态金币可拾取`, () => {
    const level = parseLevel(levels[i]);
    const { problems } = auditLevel(level);
    assert.deepEqual(problems, [],
      `level${i + 1} 存在不可达元素: ${JSON.stringify(problems)}`);
  });
}
