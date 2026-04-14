// pages/gif-viewer/gif-viewer.js
Page({
  data: {
    src: '',
    title: '动图展示'
  },

  onLoad(options) {
    const { src, title } = options
    if (src) {
      this.setData({
        src: decodeURIComponent(src),
        title: title ? decodeURIComponent(title) : '动图展示'
      })
      wx.setNavigationBarTitle({ title: this.data.title })
    } else {
      wx.showToast({ title: '动图地址错误', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1500)
    }
  },

  // 图片加载错误
  onImageError() {
    wx.showToast({ title: '动图加载失败', icon: 'none' })
  }
})
