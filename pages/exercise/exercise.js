// pages/exercise/exercise.js
const api = require('../../utils/api')

Page({
  data: {
    exercise: null,
    // 评论相关
    comments: [],
    commentTotal: 0,
    commentPage: 1,
    hasMoreComments: true,
    showCommentModal: false,
    commentContent: '',
    replyToId: 0,
    replyToName: '',
    // 当前用户信息
    currentUserId: 0
  },

  onLoad(options) {
    const { id } = options
    // 获取当前用户ID
    const userId = wx.getStorageSync('userId')
    if (userId) {
      this.setData({ currentUserId: Number(userId) })
    }
    if (id) {
      this.getExerciseDetail(id)
      this.loadComments(id)
    }
  },

  // 获取锻炼详情
  getExerciseDetail(id) {
    api.request(`/exercises/${id}`, 'GET').then(res => {
      if (res.code === 0) {
        // 字段名转换
        const exercise = res.data
        exercise.video = exercise.video_url || exercise.video || ''
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
          video: '/videos/exercise1.mp4',
          description: '坐姿抬腿是一个非常适合老年人的下肢锻炼动作，可以有效增强大腿前侧肌肉力量，提高行走能力和膝关节稳定性。'
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
    const { exercise } = this.data
    if (exercise.video) {
      // 有视频，跳转到视频播放页面
      wx.navigateTo({
        url: `/pages/video-player/video-player?src=${encodeURIComponent(exercise.video)}&title=${encodeURIComponent(exercise.name)}`
      })
    } else {
      wx.showToast({
        title: '暂无视频',
        icon: 'none'
      })
    }
  },

  // 删除评论
  deleteComment(e) {
    const { id } = e.currentTarget.dataset
    const { exercise } = this.data
    
    wx.showModal({
      title: '提示',
      content: '确定要删除这条评论吗？',
      confirmColor: '#ff4d4f',
      success: (res) => {
        if (res.confirm) {
          api.comment.delete(id).then(res => {
            if (res.code === 0) {
              wx.showToast({ title: '删除成功', icon: 'success' })
              this.loadComments(exercise.id)
            }
          }).catch(err => {
            wx.showToast({ title: err.message || '删除失败', icon: 'none' })
          })
        }
      }
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
