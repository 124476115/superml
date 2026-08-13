# Super Mario 网页游戏 — 规格说明书（SDD）

> 版本：1.0　|　日期：2026-08-10　|　状态：实现中
>
> 本文件是 SDD（Specification-Driven Development）的规格基线。
> 所有测试用例（`test/*.test.js`）均由本文「验收标准」（AC）逐条推导，
> 实现是否完成以「验收标准」是否全部通过为准。

---

## 1. 项目概述

一个纯前端、零依赖的「超级玛丽」横版平台跳跃网页游戏。
使用 HTML5 Canvas 渲染，原生 JavaScript（ES Modules）编写，核心逻辑与渲染分离，
核心逻辑可在 Node.js 中独立单元测试。

- **技术栈**：HTML5 Canvas 2D + 原生 ES Modules + Node 内置 `node:test`
- **无构建步骤**：浏览器直接加载源码，方便静态托管
- **部署**：静态文件 + lighttpd 本地服务软连接

## 2. 功能需求（用户故事）

| ID | 用户故事 |
|----|----------|
| US-1 | 作为玩家，我可以用键盘左右移动、跳跃，控制马里奥在关卡中前进 |
| US-2 | 作为玩家，我可以踩死敌人（栗子怪 Goomba）获得加分并反弹 |
| US-3 | 作为玩家，我吃到金币可以获得 100 分 |
| US-4 | 作为玩家，撞到敌人侧面会损失一条命并重生 |
| US-5 | 作为玩家，掉入悬崖会损失一条命并重生 |
| US-6 | 作为玩家，抵达终点旗杆即可通关获胜 |
| US-7 | 作为玩家，命数为 0 时游戏结束，我可以重新开始 |
| US-8 | 作为玩家，画面可见计分、命数，并按我的位置平滑滚动镜头 |
| US-9 | 作为玩家，我按下暂停键可暂停/恢复游戏 |

## 3. 玩法规则

1. **移动**：按 ← / →（或 A / D）左右移动；按 ↑ / Space / W 跳跃。
   - 跳跃键按住可跳得更高（可变跳跃高度）；松开后立即截断上升速度。
2. **物理**：重力持续作用于垂直速度；存在最大下落速度；水平方向有加速/减速/摩擦。
3. **碰撞**：与实心瓦片（砖块/地面/问号块）进行 AABB 碰撞解析：
   - 从上方落地 → 站在上面（`onGround = true`），速度归零
   - 撞到侧面 → 水平方向被阻挡
   - 从下方顶撞 → 垂直上升速度截断（并触发问号块出金币）
4. **敌人（栗子怪）**：
   - 自动巡逻：遇到实心边界或悬崖边缘自动转向
   - 被玩家踩中（玩家下落且脚部在上方）→ 敌人死亡，玩家获得 100 分并向上反弹
   - 玩家与其侧面/底部接触 → 玩家损失一条命
5. **金币**：接触即收集，+100 分，金币消失。
6. **命数与胜负**：
   - 初始 3 条命；损失一条命后回到出生点（若已超过某检查点则回出生点）
   - 命数为 0 → GAME_OVER；重新开始恢复 3 条命与 0 分
   - 接触旗杆（水平重合且垂直范围在旗杆内）→ WON
7. **镜头**：相机水平跟随玩家，不超过关卡边界。

## 4. 物理常量（SPEC 定义，实现不得更改数值）

```js
const PHYSICS = {
  GRAVITY: 1800,          // 重力加速度 px/s²
  MAX_FALL: 700,          // 最大下落速度 px/s
  MOVE_SPEED: 220,        // 最大水平移动速度 px/s
  ACCEL: 1600,            // 水平加速度 px/s²
  DECEL: 1200,            // 无输入时的减速度 px/s²
  JUMP_VELOCITY: -560,    // 起跳初速度 px/s（向上为负）
  JUMP_HOLD_FACTOR: 0.55, // 松开跳跃键后剩余上升速度比例（可变跳跃）
  TILE_SIZE: 32,          // 瓦片边长 px
  PLAYER_WIDTH: 24,       // 玩家碰撞盒宽 px
  PLAYER_HEIGHT: 30,      // 玩家碰撞盒高 px
  ENEMY_WIDTH: 26,
  ENEMY_HEIGHT: 26,
  BOUNCE_VELOCITY: -420,  // 踩敌人后的反弹初速度
  ENEMY_SPEED: 60,        // 敌人巡逻速度 px/s
  CAMERA_SPEED: 600,      // 相机最大追速 px/s
  COIN_SCORE: 100,        // 吃金币得分
  ENEMY_SCORE: 100,       // 踩敌人得分
  PIT_TOLERANCE: 64,      // 掉出关卡底部多少 px 判定为坠崖
};
```

## 5. 数据定义

### 5.1 关卡格式（文本，逐行等宽）

| 字符 | 含义 | 是否实心 |
|------|------|----------|
| `.` / 空格 | 空 | 否 |
| `#` | 实心砖块/地面 | 是 |
| `?` | 问号块（实心，顶撞出金币） | 是 |
| `o` | 金币（漂浮，碰撞收集） | 否 |
| `G` | 栗子怪出生点 | 否 |
| `P` | 玩家出生点（每关恰好 1 个） | 否 |
| `F` | 终点旗杆 | 否 |

解析结果：

```js
{
  width: 80,           // 关卡宽（瓦片数）
  height: 15,          // 关卡高（瓦片数）
  tiles: [0, 1, ...],  // 一维数组，长度 width*height，0=空，1=实心
  questionTiles: [{x, y}], // 问号块坐标
  playerStart: {x, y},     // 玩家出生点（像素坐标，瓦片中心）
  coins: [{x, y, taken:false}],  // 金币（像素坐标）
  enemies: [{x, y}],           // 敌人出生点（像素坐标）
  flag: {x, y} | null          // 旗杆（像素坐标，X 为瓦片中心）
}
```

坐标换算规则：瓦片 `(tx, ty)` 的像素位置 = `(tx * TILE_SIZE, ty * TILE_SIZE)`；
出生点/金币/敌人取所在瓦片中心 `(tx + 0.5) * TILE_SIZE`。

### 5.2 实体结构

```js
// 玩家
{ type:'player', x, y, w:PLAYER_WIDTH, h:PLAYER_HEIGHT,
  vx, vy, onGround:false, facing:1, alive:true, deadTimer }
// 敌人（栗子怪）
{ type:'goomba', x, y, w, h, vx, vy, dir:1, alive:true, squashed:false }
// 金币
{ type:'coin', x, y, w:20, h:24, taken:false }
```

### 5.3 游戏状态机

```
READY ──start──▶ PLAYING ──flag──▶ WON
   ▲                │
   └──────restart───┴──lives=0──▶ GAME_OVER
```

- `READY`：初始待机（显示提示）
- `PLAYING`：正常游玩
- `WON`：通关（显示胜利，可按 R 重开）
- `GAME_OVER`：游戏结束（显示重开提示）

暂停为正交状态：仅 `PLAYING` 时可暂停/恢复。

## 6. 界面（UI）需求

- 左上角显示 **得分（SCORE）** 与 **命数（LIVES）**
- 顶部居中显示状态（READY/PLAYING/WON/GAME_OVER 对应文案）
- 底部显示操作提示
- Canvas 尺寸：宽 800px，高 480px；每瓦片 32px → 可视区 25×15 瓦片

## 7. 验收标准（Acceptance Criteria）

> 每个 AC 可测试。AC-编号 对应测试文件，见第 8 节映射。

### AC-1 物理（physics）
- [ ] AC-1.1 重力使垂直速度随时间增加：`applyGravity(vy=0, dt=0.1)` 的增量为 `GRAVITY * dt`
- [ ] AC-1.2 垂直速度不超过 `MAX_FALL`
- [ ] AC-1.3 有输入时水平速度向目标速度 `MOVE_SPEED * dir` 以 `ACCEL` 加速
- [ ] AC-1.4 无输入时水平速度以 `DECEL` 减速至 0
- [ ] AC-1.5 起跳设置垂直速度为 `JUMP_VELOCITY`
- [ ] AC-1.6 松开跳跃键：若仍在上升，速度乘以 `JUMP_HOLD_FACTOR`（可变跳跃）

### AC-2 碰撞（collision）
- [ ] AC-2.1 `aabbOverlap(a,b)` 正确判断两 AABB 是否重叠（含边界相切不算重叠）
- [ ] AC-2.2 向右移动撞到右侧实心瓦片：玩家右边界 = 瓦片左边界，`vx=0`
- [ ] AC-2.3 从上方落到瓦片顶面：`y` 对齐到瓦片顶面，`vy=0`，`onGround=true`
- [ ] AC-2.4 从下方顶撞瓦片底面：`vy=0`（上升被截断）
- [ ] AC-2.5 碰撞解析按「水平先、垂直后」的顺序，保证斜面/角落不卡死
- [ ] AC-2.6 顶撞问号块：碰撞信息含被顶瓦片，问号块被标记为已用，其上方生成一枚金币

### AC-3 关卡（level）
- [ ] AC-3.1 解析文本关卡得到正确 `width`/`height`/`tiles`
- [ ] AC-3.2 实心字符（`#`/`?`）映射为瓦片值 1，其余为 0
- [ ] AC-3.3 识别 `P` 出生点并换算为瓦片中心像素坐标
- [ ] AC-3.4 识别所有 `o` 金币坐标
- [ ] AC-3.5 识别所有 `G` 敌人坐标
- [ ] AC-3.6 识别 `F` 旗杆坐标
- [ ] AC-3.7 非法输入（含多个 `P`、无 `P`）抛出明确错误

### AC-4 实体（entities）
- [ ] AC-4.1 玩家更新：水平/垂直速度位移叠加，重力持续生效
- [ ] AC-4.2 玩家仅在 `onGround` 时能起跳
- [ ] AC-4.3 踩中未死亡敌人：敌人 `alive=false`，玩家 `vy=BOUNCE_VELOCITY`，得 100 分
- [ ] AC-4.4 侧面接触存活敌人：玩家损失一条命并重生
- [ ] AC-4.5 接触金币：金币 `taken=true`，得分 +100
- [ ] AC-4.6 敌人巡逻：受重力下落（悬空敌人落到地面）后直行，并在遇到实心瓦片或悬崖边缘时转向
- [ ] AC-4.7 被踩扁的敌人保留扁平形象 `SQUASH_DURATION` 秒（计时器递减），期间静止，结束后不再绘制

### AC-5 游戏流程（game）
- [ ] AC-5.1 状态机：`READY→PLAYING`（start）、`PLAYING→WON`（触旗）、`PLAYING→GAME_OVER`（命=0）
- [ ] AC-5.2 初始命数 = 3，初始分 = 0
- [ ] AC-5.3 掉入深渊（y > 关卡底 + 容忍）→ 损失一条命并重生
- [ ] AC-5.4 命数减为 0 → 状态变为 `GAME_OVER`
- [ ] AC-5.5 restart 恢复：命数=3、分=0、状态=READY、玩家回出生点、敌人/金币重置
- [ ] AC-5.6 暂停：仅 PLAYING 可暂停/恢复，暂停期间 `update` 不推进
- [ ] AC-5.7 顶出金币弹出动画：`coinPopOffset(popT)` 先上升（≤2 格）后回落，动画结束后静止在初始位置
- [ ] AC-5.8 顶撞问号块生成的金币带弹出计时（`popT`），`update` 推进计时器并落回原位

### AC-6 渲染（render，逻辑部分可在 Node 测试）
- [ ] AC-6.1 世界坐标→屏幕坐标换算：`screenX = worldX - cameraX`
- [ ] AC-6.2 相机夹紧在关卡边界内（0 ≤ cameraX ≤ maxCameraX）
- [ ] AC-6.3 相机平滑跟随玩家（目标 = 玩家X - 半屏宽，有最大追速）
- [ ] AC-6.4 drawGame 可用 mock ctx 绘制不抛错
- [ ] AC-6.5 调试命中框模式（debug=true）：描出玩家/敌人/金币/问号块/实心砖碰撞盒
- [ ] AC-6.6 已顶问号块绘制为灰色「已用块」，顶出金币带弹出动画可正常绘制

### AC-7 输入（input）
- [ ] AC-7.1 键位映射：`ArrowLeft`/`a`→左，`ArrowRight`/`d`→右，`ArrowUp`/`w`/` `→跳跃
- [ ] AC-7.2 按键去重：同方向多个键同时按不产生冲突
- [ ] AC-7.3 记录按下状态与按下/释放的边沿事件（用于可变跳跃与暂停）

### AC-3.8 可及性（reachability，静态分析）
- [ ] 依据玩家物理（跳高约 87px / 2 格、横跳约 4 格），关卡中每个问号块都可被顶（顶出金币也可拾取），每枚静态金币都可拾取

### AC-8 部署与可玩性
- [ ] AC-8.1 通过 lighttpd 软连接可访问游戏首页（HTTP 200）
- [ ] AC-8.2 静态资源（JS/CSS/关卡）可正常加载（HTTP 200）
- [ ] AC-8.5/8.6-8.8 全部 5 关均可被自动 AI（按住右 + 遇坑/墙/敌跳跃）通关

## 8. 测试 ↔ 验收标准 映射

| 测试文件 | 覆盖 AC |
|----------|---------|
| `test/physics.test.js` | AC-1.x |
| `test/collision.test.js` | AC-2.x |
| `test/level.test.js` | AC-3.x |
| `test/entities.test.js` | AC-4.x |
| `test/game.test.js` | AC-5.x |
| `test/render.test.js` | AC-6.x |
| `test/input.test.js` | AC-7.x |
| `test/reachability.test.js` | AC-3.8/8.9 |
| `test/level1.test.js` | AC-8.1-8.5（level1 可玩性） |
| `test/levels.test.js` | AC-8.6-8.8（全部 5 关可玩性） |
| `deploy/verify.sh` | AC-8.x |

## 9. 非功能需求

- 无外部依赖、无构建步骤，`node --test` 全绿即可交付
- 核心模块（physics/collision/level/entities/game）不依赖 DOM，可在 Node 测试
- 渲染模块依赖 Canvas 上下文，但仅通过参数注入，便于 mock 测试
- 帧率自适应：使用 `dt`（秒）驱动的物理，不依赖固定帧率
