const { formatRecipeRatioText } = require('../../utils/ratio.js');

const STAGE_POUR_STYLE = '全程中心小圈注水，不冲粉床的边缘';

Component({
  properties: {
    recipe: {
      type: Object,
      value: {},
      observer() {
        this.updateDisplayStages();
      }
    },
    showSave: {
      type: Boolean,
      value: true
    },
    showFeedback: {
      type: Boolean,
      value: true
    },
    showBackButton: {
      type: Boolean,
      value: false
    },
    showBrewStart: {
      type: Boolean,
      value: false
    },
    allowSavedUpdate: {
      type: Boolean,
      value: false
    },
    saveText: {
      type: String,
      value: '保存方案'
    },
    backText: {
      type: String,
      value: '返回上页'
    },
    retryText: {
      type: String,
      value: '回到首页'
    }
  },

  data: {
    displayStages: [],
    displayMethodName: '',
    displayMethodSource: '',
    displayRatioText: '',
    grinderTipExpanded: false
  },

  lifetimes: {
    attached() {
      this.updateDisplayStages();
    }
  },

  methods: {
    updateDisplayStages() {
      const recipe = this.data.recipe || {};
      const displayMethodName = recipe.methodName === '创建个人方案' ? '' : (recipe.methodName || '');
      const displayMethodSource = displayMethodName ? (recipe.methodSource || '') : '';
      let elapsedSeconds = 0;
      const rawStages = recipe.stages || [];
      const lastPourStageIndex = this.findLastPourStageIndex(rawStages);
      const stages = rawStages.map((stage, index) => {
        const timeResult = this.formatStageTimeNode(stage, elapsedSeconds);
        elapsedSeconds = timeResult.elapsedSeconds;

        return {
          ...stage,
          stageIndex: index + 1,
          waterLabel: this.formatStageWater(stage.water),
          timeLabel: stage.timeLabel || (index >= lastPourStageIndex ? '预计完成时间' : '下一段注水'),
          durationLabel: timeResult.label,
          noteText: this.formatStageNote(stage, recipe)
        };
      });
      this.setData({
        displayStages: stages,
        displayMethodName,
        displayMethodSource,
        displayRatioText: formatRecipeRatioText(recipe, '-')
      });
    },

    formatStageWater(value) {
      if (value === null || value === undefined || value === '') return '';
      const text = String(value).trim();
      if (!text) return '';
      if (/g|ml|mL|克|毫升/.test(text)) return text;
      return `${text}g`;
    },

    findLastPourStageIndex(stages = []) {
      for (let index = stages.length - 1; index >= 0; index -= 1) {
        if (this.formatStageWater(stages[index].water)) return index;
      }
      return stages.length - 1;
    },

    formatStageTimeNode(stage = {}, elapsedSeconds = 0) {
      const explicitTime = stage.timeNode || stage.timePoint || stage.totalTime || stage.time;
      if (explicitTime) {
        const explicitSeconds = this.parseDurationSeconds(explicitTime);
        return {
          label: explicitSeconds !== null ? this.formatSecondsAsTimeNode(explicitSeconds) : this.formatStageDuration(explicitTime),
          elapsedSeconds
        };
      }

      const durationSeconds = this.parseDurationSeconds(stage.duration);
      if (durationSeconds !== null) {
        const nextElapsedSeconds = elapsedSeconds + durationSeconds;
        return {
          label: this.formatSecondsAsTimeNode(nextElapsedSeconds),
          elapsedSeconds: nextElapsedSeconds
        };
      }

      return {
        label: this.formatStageDuration(stage.duration),
        elapsedSeconds
      };
    },

    parseDurationSeconds(value) {
      if (value === null || value === undefined || value === '') return null;
      if (typeof value === 'number' && Number.isFinite(value)) return value;
      const text = String(value).trim();
      if (!text || text.includes(':') || text.includes('-')) return null;
      const match = text.match(/^(\d+(?:\.\d+)?)\s*(s|秒)?$/i);
      return match ? Number(match[1]) : null;
    },

    formatSecondsAsTimeNode(seconds) {
      const roundedSeconds = Math.max(0, Math.round(seconds));
      const minutes = String(Math.floor(roundedSeconds / 60)).padStart(2, '0');
      const restSeconds = String(roundedSeconds % 60).padStart(2, '0');
      return `${minutes}:${restSeconds}`;
    },

    formatStageDuration(value) {
      if (value === null || value === undefined || value === '') return '';
      const text = String(value).trim();
      if (!text) return '';
      if (text.includes(':')) return this.formatClockText(text);
      if (/s|秒|分/.test(text)) return text;
      return `${text}s`;
    },

    formatClockText(text) {
      return String(text).replace(/\d{1,2}:\d{1,2}/g, matched => {
        const parts = matched.split(':');
        const minutes = String(Number(parts[0]) || 0).padStart(2, '0');
        const seconds = String(Number(parts[1]) || 0).padStart(2, '0');
        return `${minutes}:${seconds}`;
      });
    },

    formatStageNote(stage = {}, recipe = {}) {
      if (!this.isBloomStage(stage) && !stage.showNote) return '';
      const hasNote = !!stage.pourStyle || !!stage.detail;
      if (hasNote && !recipe.manualReplica) return stage.pourStyle || STAGE_POUR_STYLE;
      if (stage.pourStyle) return stage.pourStyle;
      if (!stage.detail) return '';
      const parts = String(stage.detail)
        .split(' · ')
        .filter(part => !part.startsWith('时间：') && !part.startsWith('注水到：'));
      return parts.join(' · ') || stage.detail;
    },

    isBloomStage(stage = {}) {
      const name = String(stage.name || '');
      return name.includes('闷蒸') || name.includes('预浸');
    },

    onBookmark() {
      this.triggerEvent('bookmark', { recipe: this.data.recipe });
    },
    onRetry() {
      this.triggerEvent('retry');
    },
    onBackPage() {
      this.triggerEvent('back');
    },
    onShareCard() {
      this.triggerEvent('sharecard', { recipe: this.data.recipe });
    },
    onStartBrew() {
      this.triggerEvent('startbrew', { recipe: this.data.recipe });
    },
    onSave() {
      if (this.data.recipe && this.data.recipe.saved && !this.data.allowSavedUpdate) return;
      this.triggerEvent('save', { recipe: this.data.recipe });
    },
    onFeedback(e) {
      this.triggerEvent('feedback', { type: e.currentTarget.dataset.type });
    },
    onToggleGrinderTip() {
      this.setData({ grinderTipExpanded: !this.data.grinderTipExpanded });
    }
  }
});
