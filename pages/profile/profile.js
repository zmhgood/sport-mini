// pages/profile/profile.js
const app = getApp()
const api = require('../../utils/api')

Page({
  data: {
    isLoggedIn: false,
    userInfo: null,
    statistics: {
      totalDays: 0,
      totalExercises: 0,
      totalMinutes: 0
    },
    historyList: [],
    settings: [
      { id: 'fontSize', name: '字体大小', value: '标准', icon: '📝' },
      { id: 'voice', name: '语音播报', value: '开启', icon: '🔊' },
      { id: 'reminder', name: '锻炼提醒', value: '每日 8:00', icon: '⏰' },
      { id: 'emergency', name: '紧急联系', value: '设置', icon: '📞' }
    ]
  },

  onLoad() {
    this.checkLogin()
  },

  onShow() {
    // 设置tabBar选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 })
    }
    this.loadStatistics()
    this.loadHistory()
  },

  // 检查登录状态
  checkLogin() {
    this.setData({
      isLoggedIn: app.globalData.isLoggedIn,
      userInfo: app.globalData.userInfo
    })
  },

  // 加载统计数据
  loadStatistics() {
    const stats = wx.getStorageSync('userStatistics') || {
      totalDays: 12,
      totalExercises: 36,
      totalMinutes: 180
    }
    this.setData({ statistics: stats })
  },

  // 加载历史记录
  loadHistory() {
    const history = wx.getStorageSync('exerciseHistory') || [
      { date: '2026-02-27', exercises: ['坐姿抬腿', '手臂环绕'], duration: 15 },
      { date: '2026-02-26', exercises: ['靠墙静蹲', '提踵练习'], duration: 20 },
      { date: '2026-02-25', exercises: ['坐姿扭转'], duration: 10 }
    ]
    this.setData({ historyList: history })
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

  // 获取用户信息
  getUserProfile() {
    wx.getUserProfile({
      desc: '用于完善用户资料',
      success: (res) => {
        this.setData({
          userInfo: res.userInfo
        })
        wx.setStorageSync('userInfo', res.userInfo)
      }
    })
  },

  // 跳转到设置页面
  goToSetting(e) {
    const { id } = e.currentTarget.dataset
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    })
  },

  // 查看历史详情
  viewHistory(e) {
    const { date } = e.currentTarget.dataset
    wx.showToast({
      title: '功能开发中',
      icon: 'none'
    })
  },

  // 分享
  onShareAppMessage() {
    return {
      title: '银龄健身 - 陪我一起锻炼吧',
      path: '/pages/index/index'
    }
  }
})
