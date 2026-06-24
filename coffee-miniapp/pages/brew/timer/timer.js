const ACTIVE_BREW_TIMER_KEY = 'coffeeActiveBrewTimerRecipe';

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
    return rawStages.map((stage, index) => {
      const duration = this.parseDurationSeconds(stage.duration || stage.time || stage.timeNode || stage.totalTime) || 30;
      const startSeconds = elapsed;
      const endSeconds = elapsed + duration;
      elapsed = endSeconds;
      return {
        ...stage,
        stageIndex: index + 1,
        duration,
        startSeconds,
        endSeconds,
        endLabel: this.formatSeconds(endSeconds),
        waterLabel: this.formatWater(stage.water),
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
    this.setData({ running: true });
    this.timer = setInterval(() => {
      const nextElapsed = this.data.elapsedSeconds + 1;
      this.updateStageByElapsed(nextElapsed);
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
