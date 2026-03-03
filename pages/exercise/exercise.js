// pages/exercise/exercise.js
const api = require('../../utils/api')

Page({
  data: {
    exercise: null,
    currentStep: 0,
    isPlaying: false,
    timer: 0,
    timerText: '00:00',
    completed: false
  },

  timer: null,

  onLoad(options) {
    const { id } = options
    if (id) {
      this.getExerciseDetail(id)
    }
  },

  onUnload() {
    this.stopTimer()
  },

  // 获取锻炼详情
  getExerciseDetail(id) {
    api.request(`/exercises/${id}`, 'GET').then(res => {
      if (res.code === 0) {
        this.setData({ exercise: res.data })
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
          image: '/images/exercise-detail.png',
          video: '/videos/exercise1.mp4',
          description: '坐姿抬腿是一个非常适合老年人的下肢锻炼动作，可以有效增强大腿前侧肌肉力量，提高行走能力和膝关节稳定性。',
          benefits: [
            '增强大腿肌肉力量',
            '改善膝关节稳定性',
            '提高行走能力',
            '预防跌倒'
          ],
          steps: [
            { 
              order: 1, 
              title: '准备姿势', 
              desc: '坐在稳固的椅子上，背部挺直，双手扶住椅子两侧',
              image: '/images/step1.png',
              duration: 10
            },
            { 
              order: 2, 
              title: '抬起右腿', 
              desc: '吸气，慢慢将右腿向前抬起，直到与地面平行',
              image: '/images/step2.png',
              duration: 5
            },
            { 
              order: 3, 
              title: '保持姿势', 
              desc: '在最高点保持2-3秒，感受大腿肌肉收缩',
              image: '/images/step3.png',
              duration: 3
            },
            { 
              order: 4, 
              title: '缓慢放下', 
              desc: '呼气，控制速度慢慢将腿放下，不要突然松劲',
              image: '/images/step4.png',
              duration: 5
            },
            { 
              order: 5, 
              title: '换腿重复', 
              desc: '左腿重复相同动作，完成一组后休息30秒',
              image: '/images/step5.png',
              duration: 5
            }
          ],
          precautions: [
            '动作要缓慢，不要急躁',
            '保持呼吸均匀，不要憋气',
            '如果感到不适请立即停止',
            '膝关节疼痛者应减少幅度'
          ],
          contraindications: [
            '急性膝关节损伤',
            '严重膝关节病变',
            '近期有腿部手术'
          ]
        }
      })
    })
  },

  // 播放视频
  playVideo() {
    this.setData({ isPlaying: true })
    // 实际项目中使用 video 组件
    wx.showToast({
      title: '视频播放中',
      icon: 'none'
    })
  },

  // 开始计时
  startTimer() {
    if (this.timer) return
    
    this.setData({ isPlaying: true })
    this.timer = setInterval(() => {
      const timer = this.data.timer + 1
      const minutes = Math.floor(timer / 60)
      const seconds = timer % 60
      this.setData({
        timer,
        timerText: `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      })
      
      // 检查是否完成
      if (timer >= this.data.exercise.duration * 60) {
        this.completeExercise()
      }
    }, 1000)
  },

  // 暂停计时
  pauseTimer() {
    this.stopTimer()
    this.setData({ isPlaying: false })
  },

  // 停止计时
  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  },

  // 完成锻炼
  completeExercise() {
    this.stopTimer()
    this.setData({ completed: true, isPlaying: false })
    
    // 更新今日完成数
    const completed = wx.getStorageSync('todayCompleted') || 0
    wx.setStorageSync('todayCompleted', completed + 1)
    
    wx.showModal({
      title: '太棒了！',
      content: '您已完成本次锻炼，继续保持！',
      showCancel: false,
      confirmText: '好的'
    })
  },

  // 切换步骤
  prevStep() {
    if (this.data.currentStep > 0) {
      this.setData({ currentStep: this.data.currentStep - 1 })
    }
  },

  nextStep() {
    const { currentStep, exercise } = this.data
    if (currentStep < exercise.steps.length - 1) {
      this.setData({ currentStep: currentStep + 1 })
    }
  },

  // 播放语音
  playAudio() {
    wx.showToast({
      title: '语音播放中',
      icon: 'none'
    })
  },

  // 分享
  onShareAppMessage() {
    return {
      title: `跟我一起练习${this.data.exercise?.name || '锻炼'}`,
      path: `/pages/exercise/exercise?id=${this.data.exercise?.id}`
    }
  }
})
