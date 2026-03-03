// pages/index/index.js
const app = getApp()
const api = require('../../utils/api')

Page({
  data: {
    userInfo: null,
    isLoggedIn: false,
    bannerList: [],
    recommendExercises: [],
    muscleGroups: [],
    todayProgress: {
      completed: 0,
      total: 3
    }
  },

  onLoad() {
    this.initData()
  },

  onShow() {
    // 设置tabBar选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 })
    }
    this.checkLogin()
    this.updateProgress()
  },

  // 初始化数据
  initData() {
    this.getBannerList()
    this.getRecommendExercises()
    this.getMuscleGroups()
  },

  // 检查登录状态
  checkLogin() {
    this.setData({
      isLoggedIn: app.globalData.isLoggedIn,
      userInfo: app.globalData.userInfo
    })
  },

  // 获取轮播图
  getBannerList() {
    // 模拟数据，实际调用后端接口
    this.setData({
      bannerList: [
        { id: 1, title: '每日锻炼', desc: '坚持锻炼，健康长寿', image: '/images/banner1.png' },
        { id: 2, title: '预防跌倒', desc: '下肢力量训练', image: '/images/banner2.png' },
        { id: 3, title: '改善平衡', desc: '核心肌群锻炼', image: '/images/banner3.png' }
      ]
    })
  },

  // 获取推荐锻炼
  getRecommendExercises() {
    api.request('/exercises/recommend', 'GET').then(res => {
      if (res.code === 0) {
        this.setData({ recommendExercises: res.data })
      }
    }).catch(() => {
      // 使用模拟数据
      this.setData({
        recommendExercises: [
          { id: 1, name: '坐姿抬腿', targetMuscle: '大腿前侧', difficulty: '简单', duration: 10, image: '/images/exercise1.png' },
          { id: 2, name: '靠墙静蹲', targetMuscle: '大腿、臀部', difficulty: '中等', duration: 15, image: '/images/exercise2.png' },
          { id: 3, name: '手臂环绕', targetMuscle: '肩部', difficulty: '简单', duration: 5, image: '/images/exercise3.png' }
        ]
      })
    })
  },

  // 获取肌肉分组
  getMuscleGroups() {
    this.setData({
      muscleGroups: [
        { id: 1, name: '上肢', icon: '/images/muscle/arm.png', desc: '手臂、肩部', count: 12 },
        { id: 2, name: '核心', icon: '/images/muscle/core.png', desc: '腹部、背部', count: 8 },
        { id: 3, name: '下肢', icon: '/images/muscle/leg.png', desc: '大腿、小腿', count: 15 }
      ]
    })
  },

  // 更新今日进度
  updateProgress() {
    const completed = wx.getStorageSync('todayCompleted') || 0
    this.setData({
      'todayProgress.completed': completed
    })
  },

  // 开始今日锻炼
  startTodayExercise() {
    wx.navigateTo({
      url: '/pages/muscle/muscle'
    })
  },

  // 跳转到锻炼详情
  goToExercise(e) {
    const { id } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/pages/exercise/exercise?id=${id}`
    })
  },

  // 跳转到肌肉部位
  goToMuscle(e) {
    const { id } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/pages/muscle/muscle?groupId=${id}`
    })
  },

  // 登录
  handleLogin() {
    app.login().then(() => {
      this.checkLogin()
    }).catch(err => {
      wx.showToast({
        title: '登录失败',
        icon: 'none'
      })
    })
  },

  // 分享
  onShareAppMessage() {
    return {
      title: '银龄健身 - 专为老年人设计的肌肉锻炼助手',
      path: '/pages/index/index'
    }
  }
})
