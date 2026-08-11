// AC-7 输入处理（键位映射 + 状态管理 + 边沿事件）

export class Input {
  constructor() {
    this.left = false;
    this.right = false;
    this.jumpHeld = false;
    this.jumpPressed = false;
    this.pausePressed = false;
    this._leftCount = 0;
    this._rightCount = 0;
    this._jumpCount = 0;
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

  // AC-7.1b/7.2 按下按键（同方向多键计数去重）
  keydown(key) {
    const action = Input.actionForKey(key);
    if (action === null) return;
    switch (action) {
      case 'left':
        this._leftCount++;
        this.left = true;
        break;
      case 'right':
        this._rightCount++;
        this.right = true;
        break;
      case 'jump':
        this._jumpCount++;
        this.jumpHeld = true;
        this.jumpPressed = true;
        break;
      case 'pause':
        this.pausePressed = true;
        break;
    }
  }

  // AC-7.1b/7.2 松开按键
  keyup(key) {
    const action = Input.actionForKey(key);
    if (action === null) return;
    switch (action) {
      case 'left':
        this._leftCount = Math.max(0, this._leftCount - 1);
        if (this._leftCount === 0) this.left = false;
        break;
      case 'right':
        this._rightCount = Math.max(0, this._rightCount - 1);
        if (this._rightCount === 0) this.right = false;
        break;
      case 'jump':
        this._jumpCount = Math.max(0, this._jumpCount - 1);
        if (this._jumpCount === 0) this.jumpHeld = false;
        break;
      case 'pause':
        break;
    }
  }

  // AC-7.3 帧末重置边沿事件
  resetFrame() {
    this.jumpPressed = false;
    this.pausePressed = false;
  }
}
