Component({
  properties: {
    bean: {
      type: Object,
      value: {},
      observer() {
        this.updateDisplayTags();
      }
    },
    selected: {
      type: Boolean,
      value: false
    },
    showArrow: {
      type: Boolean,
      value: false
    },
    showCheck: {
      type: Boolean,
      value: false
    }
  },

  data: {
    displayTags: []
  },

  lifetimes: {
    attached() {
      this.updateDisplayTags();
    }
  },

  methods: {
    processingLabel(processing) {
      const labels = {
        washed: '水洗',
        natural: '日晒',
        honey: '蜜处理',
        other: '其他'
      };
      return labels[processing] || processing;
    },

    updateDisplayTags() {
      const bean = this.data.bean || {};
      const tags = [];
      if (bean.processing) {
        tags.push(this.processingLabel(bean.processing));
      }
      if (bean.roastLevelLabel && !tags.includes(bean.roastLevelLabel)) {
        tags.push(bean.roastLevelLabel);
      }
      this.setData({ displayTags: tags });
    },

    onTap() {
      this.triggerEvent('select', { bean: this.data.bean });
    }
  }
});
