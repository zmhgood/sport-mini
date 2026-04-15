// pages/exercise/exercise.js
const api = require('../../utils/api')

Page({
  data: {
    exercise: null
  },

  onLoad(options) {
    const { id } = options
    if (id) {
      this.getExerciseDetail(id)
    }
  },

  // 获取锻炼详情
  getExerciseDetail(id) {
    api.request(`/exercises/${id}`, 'GET').then(res => {
      if (res.code === 0) {
        // 字段名转换
        const exercise = res.data
        exercise.gif_url = exercise.gif_url || exercise.video_url || exercise.video || ''
        exercise.image = exercise.image_url || exercise.image || '/images/default-exercise.png'
        exercise.targetMuscle = exercise.target_muscle || exercise.targetMuscle || ''
        this.setData({ exercise })
      }
    }).catch(() => {
      // 模拟数据
      this.setData({
        exercise: {
          id: id,
          name: '坐姿抬腿',
          targetMuscle: '大腿前侧（股四头肌）',
          difficulty: '简单',
          duration: 10,
          sets: 3,
          reps: '10-15次/组',
          calories: 30,
          image: '',
          gif_url: '',
          description: '坐姿抬腿是一个非常适合老年人的下肢锻炼动作，可以有效增强大腿前侧肌肉力量，提高行走能力和膝关节稳定性。'
        }
      })
    })
  },

  // 查看动图
  viewGif() {
    const { exercise } = this.data
    if (exercise.gif_url) {
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
})
