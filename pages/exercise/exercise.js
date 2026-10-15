const { withFontSize } = require('../../utils/font-size')
// pages/exercise/exercise.js
const api = require('../../utils/api')

Page(withFontSize({
  data: {
    exercise: null,
    loading: true,
    loadError: '',
    exerciseId: null
  },

  onLoad(options) {
    const { id } = options
    this.setData({ exerciseId: id })
    if (id) {
      this.getExerciseDetail(id)
    }
  },

  // 获取锻炼详情
  async getExerciseDetail(id = this.data.exerciseId) {
    this.setData({ loading: true, loadError: '', exercise: null })
    try {
      const res = await api.request(`/exercises/${id}`, 'GET')
      if (res.code !== 0 || !res.data) throw new Error(res.message || '动作加载失败')
      const exercise = res.data
      exercise.gif_url = exercise.gif_url || exercise.video_url || exercise.video || ''
      exercise.image = exercise.image_url || exercise.image || '/images/exercise/default-exercise.jpg'
      exercise.targetMuscle = exercise.target_muscle || exercise.targetMuscle || ''
      this.setData({ exercise })
    } catch (err) {
      this.setData({ loadError: err.message || '动作加载失败，请重试' })
    } finally {
      this.setData({ loading: false })
    }
  },

  retryLoad() {
    return this.getExerciseDetail()
  },

  // 查看动图
  viewGif() {
    const { exercise } = this.data
    if (exercise && exercise.gif_url) {
      // 有动图，跳转到动图展示页面
      wx.navigateTo({
        url: `/pages/gif-viewer/gif-viewer?src=${encodeURIComponent(exercise.gif_url)}&title=${encodeURIComponent(exercise.name)}`
      })
    } else {
      wx.showToast({
        title: '暂无动图',
        icon: 'none'
      })
    }
  },

  // 分享
  onShareAppMessage() {
    return {
      title: `跟我一起练习${this.data.exercise?.name || '锻炼'}`,
      path: `/pages/exercise/exercise?id=${this.data.exercise?.id}`
    }
  }
}, wx))
