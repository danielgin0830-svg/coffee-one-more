const ACTIVE_BREW_TIMER_KEY = 'coffeeActiveBrewTimerRecipe';

// 进入计时页后屏幕常亮的持续时长（5 分钟）
const KEEP_SCREEN_ON_MS = 5 * 60 * 1000;

// 节点倒计时提示音参数（用 WebAudioContext 实时合成，无需音频文件）
const CUE_PREP = { freq: 660, duration: 0.09, gain: 0.9 };
const CUE_NODE = { freq: 988, duration: 0.22, gain: 1 };

Page({
  data: {
    recipe: null,
    recipeTitle: '冲煮计时',
    recipeDoseMeta: '',
    recipeGrinderMeta: '',
    recipeGrindMeta: '',
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

    this.enableKeepScreenOn();

    const stages = this.buildTimerStages(recipe.stages, recipe);
    this.setData({
      recipe,
      recipeTitle: recipe.beanName || recipe.methodName || '冲煮计时',
      ...this.buildRecipeMeta(recipe),
      stages
    }, () => {
      this.updateStageByElapsed(0);
    });
  },

  onUnload() {
    this.stopTimer();
    this.disableKeepScreenOn();
    this.destroyAudioContext();
  },

  buildRecipeMeta(recipe = {}) {
    const doseParts = [];
    if (recipe.doseGrams) doseParts.push(`粉量：${recipe.doseGrams}g`);
    if (recipe.totalWater) doseParts.push(`水量：${recipe.totalWater}g`);

    const grinderName = this.getGrinderName(recipe);
    const grindSetting = this.getGrindSettingText(recipe.grindSetting, grinderName);

    return {
      recipeDoseMeta: doseParts.join(' · '),
      recipeGrinderMeta: grinderName,
      recipeGrindMeta: grindSetting ? `研磨度：${grindSetting}` : ''
    };
  },

  getGrinderName(recipe = {}) {
    const reference = String(recipe.grinderReference || '');
    const matched = reference.match(/^([^：:]+)[：:]/);
    return matched ? matched[1].trim() : '';
  },

  getGrindSettingText(grindSetting, grinderName = '') {
    const text = String(grindSetting || '').trim();
    if (!text) return '';
    if (grinderName && text.startsWith(grinderName)) {
      return text.slice(grinderName.length).trim();
    }
    return text;
  },

  buildTimerStages(rawStages = [], recipe = {}) {
    let elapsed = 0;
    let prevWater = 0;
    return rawStages.map((stage, index) => {
      const duration = this.parseDurationSeconds(stage.duration || stage.time || stage.timeNode || stage.totalTime) || 30;
      const startSeconds = elapsed;
      const endSeconds = elapsed + duration;
      elapsed = endSeconds;
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
    this.ensureAudioContext();
    this.setData({ running: true });
    this.timer = setInterval(() => {
      const nextElapsed = this.data.elapsedSeconds + 1;
      this.updateStageByElapsed(nextElapsed);
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

  maybePlayCountdownCue(elapsedSeconds) {
    const stages = this.data.stages || [];
    if (!stages.length) return;
    const stage = stages.find(item => elapsedSeconds < item.endSeconds);
    if (!stage) return;
    const remaining = stage.endSeconds - elapsedSeconds;
    if (remaining === 4 || remaining === 3 || remaining === 2) {
      this.playCue('prep');
    } else if (remaining === 1) {
      this.playCue('node');
      wx.vibrateShort({ type: 'medium' });
    }
  },

  ensureAudioContext() {
    if (this.audioContext || this.audioUnavailable) return this.audioContext;
    if (typeof wx.createWebAudioContext !== 'function') {
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
