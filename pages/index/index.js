// pages/index/index.js
const app = getApp()
const api = require('../../utils/api')

Page({
  data: {
    userInfo: null,
    isLoggedIn: false,
    bannerList: [],
    recommendExercises: [],
    filteredExercises: [],
    muscleGroups: [],
    familyGoals: [],
    familyName: '',
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
    // 设置tabBar选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 })
    }
    this.checkLogin()
    this.updateProgress()
    this.loadFamilyGoals()
  },

  // 初始化数据
  initData() {
    this.getBannerList()
    this.getRecommendExercises()
    this.getMuscleGroups()
    this.loadFamilyGoals()
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
        { id: 1, title: '每日锻炼', desc: '坚持锻炼，健康长寿', image: '' },
        { id: 2, title: '预防跌倒', desc: '下肢力量训练', image: '' },
        { id: 3, title: '改善平衡', desc: '核心肌群锻炼', image: '' }
      ]
    })
  },

  // 获取推荐锻炼
  getRecommendExercises() {
    api.request('/exercises/recommend', 'GET').then(res => {
      if (res.code === 0) {
        const exercises = res.data || []
        // 根据 muscle_group_id 添加 category 字段
        // 1=上肢, 2=核心, 3=下肢 (根据实际数据库配置)
        exercises.forEach(item => {
          if (item.muscle_group_id === 1) {
            item.category = 'upper'
          } else if (item.muscle_group_id === 2) {
            item.category = 'core'
          } else if (item.muscle_group_id === 3) {
            item.category = 'lower'
          } else {
            item.category = 'all'
          }
          // 映射图片字段
          item.image = item.image_url || item.image || ''
          // 映射目标肌肉字段
          item.targetMuscle = item.target_muscle || item.targetMuscle || ''
        })
        this.setData({ 
          recommendExercises: exercises,
          filteredExercises: exercises
        })
      }
    }).catch(() => {
      // 使用模拟数据
      const exercises = [
        { id: 1, name: '坐姿抬腿', targetMuscle: '大腿前侧', difficulty: '简单', duration: 10, image: '/images/exercise1.png', category: 'lower', muscle_group_id: 3 },
        { id: 2, name: '靠墙静蹲', targetMuscle: '大腿、臀部', difficulty: '中等', duration: 15, image: '/images/exercise2.png', category: 'lower', muscle_group_id: 3 },
        { id: 3, name: '手臂环绕', targetMuscle: '肩部', difficulty: '简单', duration: 5, image: '/images/exercise3.png', category: 'upper', muscle_group_id: 1 },
        { id: 4, name: '平板支撑', targetMuscle: '核心', difficulty: '中等', duration: 10, image: '/images/exercise4.png', category: 'core', muscle_group_id: 2 }
      ]
      this.setData({ 
        recommendExercises: exercises,
        filteredExercises: exercises
      })
    })
  },

  // 加载家庭待完成任务
  async loadFamilyGoals() {
    if (!api.isLoggedIn()) {
      this.setData({ familyGoals: [], familyName: '', families: [], currentFamily: {} })
      return
    }
    try {
      // 并行获取家庭信息和目标
      const [familiesRes, goalsRes] = await Promise.all([
        api.request('/families', 'GET'),
        api.request('/goals', 'GET')
      ])
      
      // 设置家庭列表和当前家庭
      if (familiesRes.code === 0 && familiesRes.data && familiesRes.data.length > 0) {
        const families = familiesRes.data
        // 从缓存获取上次选中的家庭
        const cachedFamilyId = wx.getStorageSync('currentFamilyId')
        const currentFamily = cachedFamilyId 
          ? families.find(f => f.id === cachedFamilyId) || families[0]
          : families[0]
        
        this.setData({ 
          families: families,
          currentFamily: currentFamily,
          familyName: currentFamily.name 
        })
      } else {
        this.setData({ families: [], currentFamily: {}, familyName: '' })
      }
      
      // 设置目标列表
      if (goalsRes.code === 0) {
        this.setData({ familyGoals: goalsRes.data || [] })
      }
    } catch (err) {
      console.error('加载家庭目标失败:', err)
      this.setData({ familyGoals: [], familyName: '', families: [], currentFamily: {} })
    }
  },

  // 打开家庭选择弹窗
  switchFamily() {
    this.setData({ showFamilyPopup: true })
  },

  // 关闭家庭选择弹窗
  closeFamilyPopup() {
    this.setData({ showFamilyPopup: false })
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
        familyName: family.name,
        showFamilyPopup: false 
      })
      // 重新加载该家庭的任务
      this.loadFamilyGoals()
    }
  },

  // 跳转到加入家庭页面
  goToJoinFamily() {
    this.setData({ showFamilyPopup: false })
    wx.navigateTo({
      url: '/pages/family/join'
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
      title: '银龄健身 - 专为老年人设计的肌肉锻炼助手',
      path: '/pages/index/index'
    }
  }
})
