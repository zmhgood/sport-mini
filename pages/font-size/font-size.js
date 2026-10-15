const { FONT_OPTIONS, applyFontSize, withFontSize, saveFontSize } = require('../../utils/font-size')

Page(withFontSize({
  data: { options: FONT_OPTIONS },

  selectFontSize(e) {
    const id = e.currentTarget.dataset.id
    try {
      if (!saveFontSize(id, wx)) return
      applyFontSize(this, wx)
      wx.showToast({ title: '字号已保存', icon: 'success' })
    } catch (err) {
      wx.showToast({ title: '保存失败，请重试', icon: 'none' })
    }
  }
}, wx))
