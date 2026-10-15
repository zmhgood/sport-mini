const api = require('../../utils/api')

Component({
  properties: {
    exercise: { type: Object, value: {} },
    exerciseId: { type: Number, value: 0 }
  },
  data: { src: '', cover: '', isVideo: false, loading: true, failed: false, message: '', fetchError: false },
  observers: {
    'exercise, exerciseId': function () { this.loadMedia() }
  },
  lifetimes: {
    detached() { this._requestId = (this._requestId || 0) + 1 }
  },
  methods: {
    async loadMedia() {
      const requestId = this._requestId = (this._requestId || 0) + 1
      const exercise = this.data.exercise || {}
      this.setData({ fetchError: false })
      this.showMedia(exercise)
      if (exercise.gif_url || exercise.video_url || exercise.video || !this.data.exerciseId) return
      try {
        const res = await api.request(`/exercises/${this.data.exerciseId}`, 'GET')
        if (this._requestId !== requestId) return
        if (res.code !== 0 || !res.data) throw new Error('动作示范加载失败')
        this.showMedia({ ...exercise, ...res.data })
      } catch (err) {
        if (this._requestId === requestId) this.setData({ fetchError: true, message: '未能读取动作示范，可重试' })
      }
    },
    showMedia(exercise) {
      const cover = exercise.image_url || exercise.image || '/images/exercise/default-exercise.jpg'
      const src = exercise.gif_url || exercise.video_url || exercise.video || cover
      const isVideo = /\.(mp4|mov|avi|mkv)(\?|#|$)/i.test(src)
      const loading = src !== this.data.src || isVideo !== this.data.isVideo || this.data.failed ? true : this.data.loading
      this.setData({ src, cover, isVideo, loading, failed: false, message: src === cover ? '动作图片' : isVideo ? '点击播放动作视频' : '动作动图' })
    },
    onLoad() { this.setData({ loading: false }) },
    onError() {
      if (this.data.src !== this.data.cover) {
        this.setData({ src: this.data.cover, isVideo: false, loading: true, message: '示范加载失败，显示动作图片', fetchError: true })
      } else {
        this.setData({ loading: false, failed: true, message: '动作图片加载失败，请重试' })
      }
    },
    retry() {
      this.setData({ src: '' }, () => this.loadMedia())
    }
  }
})
