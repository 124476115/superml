// AC-7 输入处理（键位映射 + 状态管理 + 边沿事件）

export class Input {
  constructor() {
    this._keys = new Set(); // 当前按下的原始键（Set 天然去重，免疫浏览器按键重复）
    this.jumpPressed = false;
    this.pausePressed = false;
  }

  get left() {
    return this._keys.has('ArrowLeft') || this._keys.has('a') || this._keys.has('A');
  }

  get right() {
    return this._keys.has('ArrowRight') || this._keys.has('d') || this._keys.has('D');
  }

  get jumpHeld() {
    return this._keys.has('ArrowUp') || this._keys.has('w') ||
      this._keys.has('W') || this._keys.has(' ');
  }

  // AC-7.1 键位映射
  static actionForKey(key) {
    switch (key) {
      case 'ArrowLeft':
      case 'a':
      case 'A':
        return 'left';
      case 'ArrowRight':
      case 'd':
      case 'D':
        return 'right';
      case 'ArrowUp':
      case 'w':
      case 'W':
      case ' ':
        return 'jump';
      case 'p':
      case 'P':
      case 'Escape':
        return 'pause';
      default:
        return null;
    }
  }

  // AC-7.1b/7.2 按下按键（Set 去重，免疫浏览器按键重复机制）
  keydown(key) {
    const action = Input.actionForKey(key);
    if (action === null) return;
    const wasPressed = this._keys.has(key);
    this._keys.add(key);
    if (action === 'jump' && !wasPressed) {
      this.jumpPressed = true;
    }
    if (action === 'pause' && !wasPressed) {
      this.pausePressed = true;
    }
  }

  // AC-7.1b/7.2 松开按键
  keyup(key) {
    this._keys.delete(key);
  }

  // AC-7.3 帧末重置边沿事件
  resetFrame() {
    this.jumpPressed = false;
    this.pausePressed = false;
  }
}
