// pages/index/index.js
const app = getApp()
const api = require('../../utils/api')
const { categoryForExercise, loadAllExercises } = require('../../utils/exercise-category')

Page({
  data: {
    userInfo: null,
    isLoggedIn: false,
    bannerList: [],
    recommendLoading: true,
    recommendError: '',
    recommendExercises: [],
    filteredExercises: [],
    muscleGroups: [],
    // 多家庭数据结构
    goalsLoading: true,
    goalsError: '',
    hasTodayTasks: false,
    familiesWithGoals: [], // 所有家庭及其目标 [{family_id, family_name, goals: []}]
    totalPendingGoals: 0,  // 总待完成任务数
    families: [],
    currentFamily: {},
    showFamilyPopup: false,
    currentCategory: 'all',
    todayProgress: {
      completed: 0,
      total: 3
    }
  },

  onLoad() {
    this.initData()
  },

  onShow() {
    console.log('[onShow] 首页显示')
    // 设置tabBar选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0, hidden: false })
    }
    this.setData({ showFamilyPopup: false })
    this.checkLogin()
    this.getRecommendExercises()
    this.updateProgress()
    this.loadFamilyGoals()
  },

  onHide() {
    this.closeFamilyPopup()
  },

  // 初始化数据
  initData() {
    this.getBannerList()
    this.getMuscleGroups()
    this.loadFamilyGoals()
  },

  // 检查登录状态
  checkLogin() {
    const token = wx.getStorageSync('token')
    const userInfo = wx.getStorageSync('userInfo')
    console.log('[checkLogin] token:', token ? '存在' : '不存在', 'userInfo:', userInfo)
    this.setData({
      isLoggedIn: !!token,
      userInfo: userInfo || app.globalData.userInfo
    }, () => {
      console.log('[checkLogin] 设置后 isLoggedIn:', this.data.isLoggedIn)
    })
  },

  // 获取轮播图
  getBannerList() {
    // 模拟数据，实际调用后端接口
    this.setData({
      bannerList: [
        { id: 1, title: '每日锻炼', desc: '坚持锻炼，健康长寿', image: '' },
        { id: 2, title: '预防跌倒', desc: '下肢力量训练', image: '' },
        { id: 3, title: '改善平衡', desc: '核心肌群锻炼', image: '' }
      ]
    })
  },

  // 获取推荐锻炼
  async getRecommendExercises() {
    if (this._recommendLoading) return
    this._recommendLoading = true
    this.setData({ recommendLoading: true, recommendError: '' })
    try {
      const items = await loadAllExercises(api)
      const exercises = items.map(item => ({
        ...item,
        category: categoryForExercise(item),
        image: item.image_url || item.image || '',
        targetMuscle: item.target_muscle || item.targetMuscle || ''
      }))
      this.setData({
        recommendExercises: exercises,
        filteredExercises: this.data.currentCategory === 'all' ? exercises : exercises.filter(item => item.category === this.data.currentCategory)
      })
    } catch (err) {
      this.setData({ recommendError: err.message || '动作加载失败，请重试', recommendExercises: [], filteredExercises: [] })
    } finally {
      this._recommendLoading = false
      this.setData({ recommendLoading: false })
    }
  },

  // 加载家庭待完成任务（多家庭版本）
  async loadFamilyGoals() {
    const token = wx.getStorageSync('token')
    if (!token) {
      this._goalsRequest = null
      this.setData({ familiesWithGoals: [], families: [], currentFamily: {}, totalPendingGoals: 0, hasTodayTasks: false, goalsLoading: false, goalsError: '' })
      return
    }
    if (this._goalsRequest && this._goalsRequest.token === token) return
    const request = { token }
    this._goalsRequest = request
    this.setData({ goalsLoading: true, goalsError: '' })
    try {
      const res = await api.request('/goals/families', 'GET')
      if (this._goalsRequest !== request || wx.getStorageSync('token') !== token) return
      if (res.code !== 0 || !Array.isArray(res.data)) throw new Error('今日安排加载失败，请重试')
      const familiesWithGoals = res.data.map(f => ({ ...f, goals: f.goals || [] }))
      const families = familiesWithGoals.map(f => ({ id: f.family_id, name: f.family_name }))
      const cachedFamilyId = wx.getStorageSync('currentFamilyId')
      const currentFamily = families.find(f => f.id == cachedFamilyId) || families[0] || {}
      const goals = familiesWithGoals.flatMap(f => f.goals)
      const totalPendingGoals = goals.reduce((sum, g) => sum + Math.max(0, (g.total_exercises || 0) - (g.today_completed || 0)), 0)
      this.setData({ familiesWithGoals, families, currentFamily, totalPendingGoals, hasTodayTasks: goals.length > 0 })
    } catch (err) {
      if (this._goalsRequest === request && wx.getStorageSync('token') === token) {
        this.setData({ goalsError: '今日安排加载失败，请重试' })
      }
    } finally {
      if (this._goalsRequest === request) {
        this._goalsRequest = null
        this.setData({ goalsLoading: false })
      }
    }
  },

  goToFamily() { wx.navigateTo({ url: '/pages/family/family' }) },

  // 打开家庭选择弹窗
  switchFamily() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ hidden: true })
    }
    this.setData({ showFamilyPopup: true })
  },

  // 关闭家庭选择弹窗
  closeFamilyPopup() {
    this.setData({ showFamilyPopup: false })
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ hidden: false })
    }
  },

  // 阻止事件冒泡
  preventClose() {
    // 什么都不做，只是阻止冒泡
  },

  // 选择家庭
  selectFamily(e) {
    const familyId = e.currentTarget.dataset.id
    const family = this.data.families.find(f => f.id === familyId)
    if (family) {
      wx.setStorageSync('currentFamilyId', familyId)
      this.setData({ 
        currentFamily: family,
        familyName: family.name
      })
      this.closeFamilyPopup()
      // 重新加载该家庭的任务
      this.loadFamilyGoals()
    }
  },

  // 跳转到加入家庭页面
  goToJoinFamily() {
    this.closeFamilyPopup()
    wx.navigateTo({
      url: '/pages/family/join?type=join'
    })
  },

  // 切换分类
  switchCategory(e) {
    const category = e.currentTarget.dataset.category
    this.setData({ currentCategory: category })
    
    // 过滤锻炼列表
    let filtered = this.data.recommendExercises
    if (category !== 'all') {
      filtered = this.data.recommendExercises.filter(item => item.category === category)
    }
    this.setData({ filteredExercises: filtered })
  },

  // 获取肌肉分组
  getMuscleGroups() {
    this.setData({
      muscleGroups: [
        { id: 1, name: '上肢', icon: '/images/muscle/arm.jpg', desc: '手臂、肩部', count: 12 },
        { id: 2, name: '核心', icon: '/images/muscle/core.jpg', desc: '腹部、背部', count: 8 },
        { id: 3, name: '下肢', icon: '/images/muscle/leg.jpg', desc: '大腿、小腿', count: 15 }
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

  // 跳转到目标详情
  goToGoalDetail(e) {
    const { id } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/pages/goal/detail?id=${id}`
    })
  },

  // 跳转到目标列表
  goToGoalList() {
    wx.navigateTo({
      url: '/pages/goal/list'
    })
  },

  // 跳转到我的页统一登录
  goToProfile() {
    wx.switchTab({ url: '/pages/profile/profile' })
  },

  // 分享
  onShareAppMessage() {
    return {
      title: '爸妈动起来 - 专为老年人设计的肌肉锻炼助手',
      path: '/pages/index/index'
    }
  }
})
