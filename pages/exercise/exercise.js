// pages/exercise/exercise.js
const api = require('../../utils/api')

Page({
  data: {
    exercise: null,
    currentStep: 0,
    isPlaying: false,
    timer: 0,
    timerText: '00:00',
    completed: false,
    // 评论相关
    comments: [],
    commentTotal: 0,
    commentPage: 1,
    hasMoreComments: true,
    showCommentModal: false,
    commentContent: '',
    replyToId: 0,
    replyToName: ''
  },

  timer: null,

  onLoad(options) {
    const { id } = options
    if (id) {
      this.getExerciseDetail(id)
      this.loadComments(id)
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
          image: '',
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

  // 加载评论
  loadComments(exerciseId) {
    const id = exerciseId || this.data.exercise?.id
    if (!id) return
    
    api.comment.getList(id, 1, 10).then(res => {
      if (res.code === 0) {
        const comments = this.formatComments(res.data.list)
        this.setData({
          comments,
          commentTotal: res.data.total,
          commentPage: 1,
          hasMoreComments: res.data.list.length >= 10
        })
      }
    }).catch(() => {
      // 使用模拟数据
      this.setData({
        comments: [
          {
            id: 1,
            content: '这个动作很好，做了两周感觉腿有劲了！',
            like_count: 12,
            is_liked: false,
            created_at: '2天前',
            user: { nick_name: '张大爷' },
            replies: []
          },
          {
            id: 2,
            content: '膝盖不太好，做这个动作有点疼，有其他替代动作吗？',
            like_count: 5,
            is_liked: false,
            created_at: '1天前',
            user: { nick_name: '李阿姨' },
            replies: [
              { id: 3, content: '可以减少抬腿高度，或者做坐姿踢腿', user: { nick_name: '王教练' } }
            ]
          }
        ],
        commentTotal: 2,
        hasMoreComments: false
      })
    })
  },

  // 格式化评论时间
  formatComments(comments) {
    return comments.map(c => ({
      ...c,
      created_at: this.formatTime(c.created_at)
    }))
  },

  // 格式化时间
  formatTime(time) {
    const date = new Date(time)
    const now = new Date()
    const diff = now - date
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    
    if (minutes < 1) return '刚刚'
    if (minutes < 60) return `${minutes}分钟前`
    if (hours < 24) return `${hours}小时前`
    if (days < 30) return `${days}天前`
    return time.split('T')[0]
  },

  // 加载更多评论
  loadMoreComments() {
    const { exercise, commentPage, comments } = this.data
    const nextPage = commentPage + 1
    
    api.comment.getList(exercise.id, nextPage, 10).then(res => {
      if (res.code === 0) {
        const newComments = this.formatComments(res.data.list)
        this.setData({
          comments: [...comments, ...newComments],
          commentPage: nextPage,
          hasMoreComments: res.data.list.length >= 10
        })
      }
    })
  },

  // 显示评论输入框
  showCommentInput() {
    api.requireLogin(() => {
      this.setData({
        showCommentModal: true,
        replyToId: 0,
        replyToName: ''
      })
    })
  },

  // 显示回复输入框
  showReplyInput(e) {
    const { id, name } = e.currentTarget.dataset
    api.requireLogin(() => {
      this.setData({
        showCommentModal: true,
        replyToId: id,
        replyToName: name
      })
    })
  },

  // 隐藏评论输入框
  hideCommentInput() {
    this.setData({
      showCommentModal: false,
      commentContent: '',
      replyToId: 0,
      replyToName: ''
    })
  },

  // 阻止冒泡
  stopPropagation() {},

  // 评论输入
  onCommentInput(e) {
    this.setData({ commentContent: e.detail.value })
  },

  // 提交评论
  submitComment() {
    const { exercise, commentContent, replyToId } = this.data
    if (!commentContent.trim()) return

    const data = {
      exercise_id: exercise.id,
      content: commentContent.trim()
    }

    if (replyToId) {
      data.parent_id = replyToId
    }

    api.comment.create(data).then(res => {
      if (res.code === 0) {
        wx.showToast({ title: '评论成功', icon: 'success' })
        this.hideCommentInput()
        this.loadComments(exercise.id)
      }
    }).catch(err => {
      wx.showToast({ title: err.message || '评论失败', icon: 'none' })
    })
  },

  // 点赞/取消点赞
  toggleLike(e) {
    const { id } = e.currentTarget.dataset
    const isLoggedIn = api.isLoggedIn()
    
    if (!isLoggedIn) {
      wx.showModal({
        title: '提示',
        content: '登录后才能点赞哦',
        confirmText: '去登录',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/login/login' })
          }
        }
      })
      return
    }

    api.comment.toggleLike(id).then(res => {
      if (res.code === 0) {
        // 更新本地数据
        const comments = this.data.comments.map(c => {
          if (c.id === id) {
            return {
              ...c,
              is_liked: res.data.is_liked,
              like_count: res.data.is_liked ? c.like_count + 1 : c.like_count - 1
            }
          }
          return c
        })
        this.setData({ comments })
      }
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
    const that = this
    
    // 检查登录状态
    api.requireLogin(() => {
      that.stopTimer()
      that.setData({ completed: true, isPlaying: false })
      
      // 记录锻炼
      that.recordExercise()
      
      wx.showModal({
        title: '太棒了！',
        content: '您已完成本次锻炼，继续保持！',
        showCancel: false,
        confirmText: '好的'
      })
    })
  },
  
  // 记录锻炼到服务器
  recordExercise() {
    const { exercise, timer } = this.data
    if (!exercise) return
    
    // 先保存到本地缓存
    this.saveToLocalHistory(exercise, timer)
    
    api.post('/exercises/record', {
      exercise_id: exercise.id,
      duration: timer,
      sets: exercise.sets || 1
    }).then(res => {
      if (res.code === 0) {
        console.log('锻炼记录成功')
      }
    }).catch(err => {
      console.error('记录失败:', err)
      // 失败也没关系，本地已经有缓存
    })
  },

  // 保存到本地历史记录
  saveToLocalHistory(exercise, duration) {
    try {
      const today = new Date()
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      
      let history = wx.getStorageSync('exerciseHistory') || []
      
      // 查找今天的记录
      let todayRecord = history.find(h => h.rawDate === dateStr)
      if (todayRecord) {
        todayRecord.duration += duration
        if (!todayRecord.exercises.includes(exercise.name)) {
          todayRecord.exercises.push(exercise.name)
        }
      } else {
        const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
        history.unshift({
          rawDate: dateStr,
          date: `${today.getMonth() + 1}月${today.getDate()}日 ${weekDays[today.getDay()]}`,
          duration: Math.round(duration / 60),
          exercises: [exercise.name]
        })
      }
      
      // 最多保留30条记录
      if (history.length > 30) {
        history = history.slice(0, 30)
      }
      
      wx.setStorageSync('exerciseHistory', history)
    } catch (e) {
      console.error('保存本地记录失败:', e)
    }
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
