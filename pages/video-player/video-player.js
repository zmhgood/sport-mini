// pages/video-player/video-player.js
Page({
  data: {
    src: '',
    title: '视频播放',
    isPlaying: false,
    duration: 0,
    currentTime: 0,
    progress: 0,
    showControls: true,
    fullscreen: false
  },

  videoContext: null,

  onLoad(options) {
    const { src, title } = options
    if (src) {
      this.setData({
        src: decodeURIComponent(src),
        title: title ? decodeURIComponent(title) : '视频播放'
      })
      wx.setNavigationBarTitle({ title: this.data.title })
    } else {
      wx.showToast({ title: '视频地址错误', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 1500)
    }
  },

  onReady() {
    this.videoContext = wx.createVideoContext('videoPlayer')
  },

  onUnload() {
    if (this.videoContext) {
      this.videoContext.stop()
    }
  },

  // 视频加载完成
  onLoadedMetadata(e) {
    this.setData({ duration: e.detail.duration })
  },

  // 播放进度更新
  onTimeUpdate(e) {
    const { currentTime, duration } = e.detail
    const progress = duration > 0 ? (currentTime / duration) * 100 : 0
    this.setData({
      currentTime,
      progress
    })
  },

  // 播放状态变化
  onPlay() {
    this.setData({ isPlaying: true })
  },

  onPause() {
    this.setData({ isPlaying: false })
  },

  onEnded() {
    this.setData({ isPlaying: false })
  },

  // 播放/暂停切换
  togglePlay() {
    if (this.data.isPlaying) {
      this.videoContext.pause()
    } else {
      this.videoContext.play()
    }
  },

  // 全屏切换
  toggleFullscreen() {
    if (this.data.fullscreen) {
      this.videoContext.exitFullScreen()
    } else {
      this.videoContext.requestFullScreen()
    }
    this.setData({ fullscreen: !this.data.fullscreen })
  },

  // 进度条拖动
  onSeek(e) {
    const progress = e.detail.value
    const time = (progress / 100) * this.data.duration
    this.videoContext.seek(time)
  },

  // 错误处理
  onError(e) {
    console.error('视频播放错误:', e)
    wx.showToast({ title: '视频加载失败', icon: 'none' })
  }
})
