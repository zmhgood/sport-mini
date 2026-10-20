const { withFontSize } = require('../../utils/font-size')
// pages/index/index.js
const app = getApp()
const api = require('../../utils/api')
const { categoryForExercise, loadAllExercises } = require('../../utils/exercise-category')
const { DEFAULT_BANNER_IMAGE, DEFAULT_BANNERS, bannerItems } = require('../../utils/banner')

Page(withFontSize({
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
    this.checkLogin()
    this.getBannerList()
    this.getRecommendExercises()
    this.updateProgress()
    this.loadFamilyGoals()
  },

  // 初始化数据
  initData() {
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
  async getBannerList() {
    if (this._bannerLoading) return
    this._bannerLoading = true
    try {
      const res = await api.request('/banners', 'GET')
      if (res.code !== 0) throw new Error('轮播图加载失败')
      this.setData({ bannerList: bannerItems(res.data) })
      this._bannerLoaded = true
    } catch (_) {
      // Keep the last successful list, including an intentionally empty list.
      if (!this._bannerLoaded) this.setData({ bannerList: DEFAULT_BANNERS.map(item => ({ ...item })) })
    } finally {
      this._bannerLoading = false
    }
  },

  onBannerImageError(e) {
    const index = Number(e.currentTarget.dataset.index)
    const item = this.data.bannerList[index]
    if (!item || item.image_url === DEFAULT_BANNER_IMAGE) return
    this.setData({ bannerList: this.data.bannerList.map((banner, i) => i === index ? { ...banner, image_url: DEFAULT_BANNER_IMAGE } : banner) })
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

  // 跳转到加入家庭页面
  goToJoinFamily() {
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
    wx.switchTab({
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

  // 跳转到锻炼分类页
  goToMuscle() {
    wx.switchTab({
      url: '/pages/muscle/muscle'
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
      url: '/pages/goal/goal'
    })
  },

  // 已登录查看我的页，未登录直接登录
  goToProfile() {
    if (!wx.getStorageSync('token')) {
      wx.navigateTo({ url: '/pages/login/login' })
      return
    }
    wx.switchTab({ url: '/pages/profile/profile' })
  },

  // 分享
  onShareAppMessage() {
    return {
      title: '爸妈动起来 - 带着家人一起动起来吧',
      path: '/pages/index/index'
    }
  }
}, wx))
