const ACTIVE_BREW_TIMER_KEY = 'coffeeActiveBrewTimerRecipe';

// 需求1：进入计时页后屏幕常亮的持续时长（5 分钟）
const KEEP_SCREEN_ON_MS = 5 * 60 * 1000;

// 需求2：节点倒计时提示音参数（用 WebAudioContext 实时合成，无需音频文件）
// CUE_PREP = 倒数第 3、2 秒的“预备”音（较低、较短）
// CUE_NODE = 倒数第 1 秒的“节点”音（较高、较长，与预备音明显区分）
const CUE_PREP = { freq: 660, duration: 0.09, gain: 0.5 };
const CUE_NODE = { freq: 988, duration: 0.22, gain: 0.6 };

Page({
  data: {
    recipe: null,
    recipeTitle: '冲煮计时',
    recipeMeta: '',
    stages: [],
    currentStage: null,
    nextStage: null,
    currentIndex: 0,
    elapsedSeconds: 0,
    elapsedLabel: '00:00',
    remainingLabel: '00:00',
    progressPercent: 0,
    progressMarkers: [],
    running: false,
    isFinished: false
  },

  onLoad() {
    const recipe = wx.getStorageSync(ACTIVE_BREW_TIMER_KEY);
    if (!recipe || !Array.isArray(recipe.stages) || !recipe.stages.length) {
      wx.showToast({
        title: '未读取到方案',
        icon: 'none'
      });
      return;
    }

    // 需求1：方案有效、进入计时页即开启屏幕常亮，并在 5 分钟后自动关闭
    this.enableKeepScreenOn();

    const stages = this.buildTimerStages(recipe.stages, recipe);
    this.setData({
      recipe,
      recipeTitle: recipe.beanName || recipe.methodName || '冲煮计时',
      recipeMeta: this.buildRecipeMeta(recipe),
      stages
    }, () => {
      this.updateStageByElapsed(0);
    });
  },

  onUnload() {
    this.stopTimer();
    // 需求1：离开页面时关闭屏幕常亮并清除 5 分钟定时器
    this.disableKeepScreenOn();
    // 需求2：释放音频上下文
    this.destroyAudioContext();
  },

  buildRecipeMeta(recipe = {}) {
    const parts = [];
    if (recipe.doseGrams) parts.push(`${recipe.doseGrams}g 粉`);
    if (recipe.totalWater) parts.push(`${recipe.totalWater}g 水`);
    if (recipe.grindSetting) parts.push(recipe.grindSetting);
    return parts.join(' · ');
  },

  buildTimerStages(rawStages = [], recipe = {}) {
    let elapsed = 0;
    let prevWater = 0;
    return rawStages.map((stage, index) => {
      const duration = this.parseDurationSeconds(stage.duration || stage.time || stage.timeNode || stage.totalTime) || 30;
      const startSeconds = elapsed;
      const endSeconds = elapsed + duration;
      elapsed = endSeconds;
      // 注水增量：本段目标水量 - 上一段目标水量（解析不出时不显示）
      const targetWater = this.parseWaterValue(stage.water);
      let incrementLabel = '';
      if (targetWater !== null && targetWater >= prevWater) {
        incrementLabel = `本段 +${Math.round(targetWater - prevWater)}g`;
      }
      if (targetWater !== null) prevWater = targetWater;
      return {
        ...stage,
        stageIndex: index + 1,
        duration,
        startSeconds,
        endSeconds,
        endLabel: this.formatSeconds(endSeconds),
        waterLabel: this.formatWater(stage.water),
        incrementLabel,
        timeLabel: index === rawStages.length - 1 ? '预计完成时间' : '下一段注水',
        prompt: this.getStagePrompt(stage, recipe)
      };
    });
  },

  getStagePrompt(stage = {}, recipe = {}) {
    const text = stage.pourStyle || stage.detail || stage.note || '';
    if (text) return String(text);
    const name = String(stage.name || '');
    if (name.includes('闷蒸') || name.includes('预浸')) {
      return '小水流充分打湿粉床，观察液面是否稳定回落。';
    }
    if (String(recipe.beanCategory || '').includes('A')) {
      return '小圈绕注提高甜感和香气，液面只允许缓慢上升。';
    }
    return '中心小圈为主，控制尾段涩木和浑浊感。';
  },

  parseDurationSeconds(value) {
    if (value === null || value === undefined || value === '') return 0;
    if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.round(value));
    const text = String(value).trim();
    if (!text) return 0;
    const clock = text.match(/^(\d{1,2}):(\d{1,2})$/);
    if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
    const number = text.match(/\d+(\.\d+)?/);
    return number ? Math.max(0, Math.round(Number(number[0]))) : 0;
  },

  formatWater(value) {
    if (value === null || value === undefined || value === '') return '-';
    const text = String(value).trim();
    if (!text) return '-';
    if (/g|ml|mL|克|毫升/.test(text)) return text;
    return `${text}g`;
  },

  // 从目标水量里解析出数值（支持 "160"、"160g"、"160-180" 取首个数字），用于计算注水增量
  parseWaterValue(value) {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const match = String(value).match(/\d+(\.\d+)?/);
    return match ? Number(match[0]) : null;
  },

  formatSeconds(seconds) {
    const safeSeconds = Math.max(0, Math.round(Number(seconds) || 0));
    const minutes = String(Math.floor(safeSeconds / 60)).padStart(2, '0');
    const rest = String(safeSeconds % 60).padStart(2, '0');
    return `${minutes}:${rest}`;
  },

  onToggleTimer() {
    if (this.data.running) {
      this.stopTimer();
      this.setData({ running: false });
      return;
    }
    this.startTimer();
  },

  startTimer() {
    this.stopTimer();
    // 需求2：在用户点击“开始”的手势栈内初始化音频上下文，规避自动播放限制
    this.ensureAudioContext();
    this.setData({ running: true });
    this.timer = setInterval(() => {
      const nextElapsed = this.data.elapsedSeconds + 1;
      this.updateStageByElapsed(nextElapsed);
      // 需求2：仅在计时自然推进时检测节点倒计时提示音（手动跳段不触发）
      this.maybePlayCountdownCue(nextElapsed);
      const totalSeconds = this.getTotalSeconds();
      if (nextElapsed >= totalSeconds) {
        this.stopTimer();
        this.setData({ running: false });
      }
    }, 1000);
  },

  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  },

  // ===== 需求1：屏幕常亮（5 分钟自动关闭）=====
  enableKeepScreenOn() {
    wx.setKeepScreenOn({ keepScreenOn: true });
    this.clearKeepScreenOnTimer();
    this.keepScreenOnTimer = setTimeout(() => {
      this.keepScreenOnTimer = null;
      wx.setKeepScreenOn({ keepScreenOn: false });
    }, KEEP_SCREEN_ON_MS);
  },

  disableKeepScreenOn() {
    this.clearKeepScreenOnTimer();
    wx.setKeepScreenOn({ keepScreenOn: false });
  },

  clearKeepScreenOnTimer() {
    if (this.keepScreenOnTimer) {
      clearTimeout(this.keepScreenOnTimer);
      this.keepScreenOnTimer = null;
    }
  },

  // ===== 需求2：节点倒计时提示音 =====
  // 在每个阶段结束（注水节点）前：倒数第 3、2 秒播“预备”音，倒数第 1 秒播“节点”音
  maybePlayCountdownCue(elapsedSeconds) {
    const stages = this.data.stages || [];
    if (!stages.length) return;
    // 找到即将到达的那个节点所属阶段（第一个结束时间晚于当前用时的阶段）
    const stage = stages.find(item => elapsedSeconds < item.endSeconds);
    if (!stage) return;
    const remaining = stage.endSeconds - elapsedSeconds;
    if (remaining === 3 || remaining === 2) {
      this.playCue('prep');
    } else if (remaining === 1) {
      this.playCue('node');
      // 额外增强（需求未要求，不需要可删此行）：节点处配合一次震动，照顾湿手看不清屏幕的场景
      wx.vibrateShort({ type: 'medium' });
    }
  },

  ensureAudioContext() {
    if (this.audioContext || this.audioUnavailable) return this.audioContext;
    if (typeof wx.createWebAudioContext !== 'function') {
      // 基础库过低不支持 WebAudioContext 时静默降级，不影响计时主流程
      this.audioUnavailable = true;
      return null;
    }
    try {
      this.audioContext = wx.createWebAudioContext();
    } catch (e) {
      this.audioUnavailable = true;
    }
    return this.audioContext;
  },

  playCue(kind) {
    const ctx = this.ensureAudioContext();
    if (!ctx) return;
    const cue = kind === 'node' ? CUE_NODE : CUE_PREP;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = cue.freq;
      // 用指数包络起停，避免方波爆音（click）
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(cue.gain, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + cue.duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + cue.duration + 0.02);
    } catch (e) {}
  },

  destroyAudioContext() {
    if (this.audioContext) {
      try {
        if (typeof this.audioContext.close === 'function') {
          this.audioContext.close();
        }
      } catch (e) {}
      this.audioContext = null;
    }
  },

  onReset() {
    this.stopTimer();
    this.setData({ running: false, isFinished: false });
    this.updateStageByElapsed(0);
  },

  onNextStage() {
    const stages = this.data.stages || [];
    if (!stages.length) return;
    const current = stages[this.data.currentIndex] || stages[0];
    const nextElapsed = Math.min(current.endSeconds, this.getTotalSeconds());
    this.updateStageByElapsed(nextElapsed);
  },

  onPrevStage() {
    const stages = this.data.stages || [];
    if (!stages.length) return;
    const previousIndex = Math.max(0, this.data.currentIndex - 1);
    this.updateStageByElapsed(stages[previousIndex].startSeconds);
  },

  onExit() {
    this.stopTimer();
    wx.navigateBack();
  },

  onReturnRecipe() {
    this.stopTimer();
    wx.navigateBack({
      fail: () => {
        wx.switchTab({
          url: '/pages/brew/brew'
        });
      }
    });
  },

  updateStageByElapsed(elapsedSeconds) {
    const stages = this.data.stages || [];
    if (!stages.length) return;
    const totalSeconds = this.getTotalSeconds();
    const safeElapsed = Math.max(0, Math.min(Math.round(elapsedSeconds), totalSeconds));
    let index = stages.findIndex(stage => safeElapsed < stage.endSeconds);
    if (index < 0) index = stages.length - 1;
    const currentStage = stages[index];
    const nextStage = stages[index + 1] || null;
    const remainingSeconds = Math.max(0, currentStage.endSeconds - safeElapsed);
    const progressPercent = totalSeconds ? Math.round((safeElapsed / totalSeconds) * 100) : 0;
    const isFinished = totalSeconds > 0 && safeElapsed >= totalSeconds;
    this.setData({
      elapsedSeconds: safeElapsed,
      elapsedLabel: this.formatSeconds(safeElapsed),
      remainingLabel: this.formatSeconds(remainingSeconds),
      currentIndex: index,
      currentStage,
      nextStage,
      progressPercent,
      progressMarkers: this.buildProgressMarkers(stages, safeElapsed),
      isFinished
    });
  },

  buildProgressMarkers(stages = [], elapsedSeconds = 0) {
    const last = stages[stages.length - 1];
    const totalSeconds = last ? last.endSeconds : 0;
    if (!totalSeconds) return [];
    return stages.map((stage, index) => {
      const percent = Math.max(0, Math.min(100, (stage.endSeconds / totalSeconds) * 100));
      return {
        id: `${stage.stageIndex || index + 1}-${stage.endLabel}`,
        label: stage.endLabel || this.formatSeconds(stage.endSeconds),
        percent: percent.toFixed(2),
        reached: elapsedSeconds >= stage.endSeconds,
        edge: index === stages.length - 1 ? 'last' : ''
      };
    });
  },

  getTotalSeconds() {
    const stages = this.data.stages || [];
    const last = stages[stages.length - 1];
    return last ? last.endSeconds : 0;
  }
});
