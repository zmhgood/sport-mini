const { withFontSize } = require('../../utils/font-size')
// pages/muscle/muscle.js
const api = require('../../utils/api')
const { categoryForExercise, loadAllExercises } = require('../../utils/exercise-category')

Page(withFontSize({
  data: {
    currentTab: 0,
    tabs: ['上肢', '核心', '下肢'],
    muscleGroups: [],
    exercises: [],
    loadError: '',
    loading: true
  },

  onLoad(options) {
    console.log('muscle页面加载，参数:', options)
    // 从 URL 参数或 storage 获取 groupId
    let groupId = options.groupId || wx.getStorageSync('muscleGroupId')
    // 清除 storage 中的参数，避免影响下次
    wx.removeStorageSync('muscleGroupId')
    
    if (groupId) {
      const tabIndex = ['upper', 'core', 'lower'].indexOf(categoryForExercise({ muscle_group_id: Number(groupId) }))
      console.log('设置当前tab:', tabIndex)
      this.setData({ currentTab: tabIndex >= 0 && tabIndex < 3 ? tabIndex : 0 })
    }
    this.loadData()
  },

  onShow() {
    // 设置tabBar选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 })
    }
  },

  // 加载数据
  loadData() {
    this.getMuscleGroups()
    this.getExercises()
  },

  // 获取肌肉分组
  getMuscleGroups() {
    this.setData({
      muscleGroups: [
        {
          id: 2,
          name: '上肢',
          muscles: ['手臂', '肩部', '胸部'],
          icon: '/images/muscle/arm.jpg',
          description: '增强上肢力量，提高日常活动能力'
        },
        {
          id: 4,
          name: '核心',
          muscles: ['腹部', '背部', '腰部'],
          icon: '/images/muscle/core.jpg',
          description: '稳定身体重心，改善平衡能力'
        },
        {
          id: 3,
          name: '下肢',
          muscles: ['大腿', '小腿', '臀部'],
          icon: '/images/muscle/leg.jpg',
          description: '增强行走能力，预防跌倒'
        }
      ]
    })
  },

  // 获取锻炼列表
  async getExercises() {
    const requestId = (this._requestId || 0) + 1
    this._requestId = requestId
    const category = ['upper', 'core', 'lower'][this.data.currentTab]
    this.setData({ loading: true, loadError: '', exercises: [] })
    try {
      const items = await loadAllExercises(api)
      if (requestId !== this._requestId) return
      const exercises = items.filter(item => categoryForExercise(item) === category).map(item => ({
        ...item,
        targetMuscle: item.target_muscle || item.targetMuscle || '',
        image: item.image_url || item.image || ''
      }))
      this.setData({ exercises })
    } catch (err) {
      if (requestId === this._requestId) this.setData({ loadError: err.message || '动作加载失败，请重试' })
    } finally {
      if (requestId === this._requestId) this.setData({ loading: false })
    }
  },

  // 切换标签
  switchTab(e) {
    const index = e.currentTarget.dataset.index
    this.setData({ currentTab: index, loading: true })
    this.getExercises()
  },

  // 跳转到锻炼详情
  goToExercise(e) {
    const { id } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/pages/exercise/exercise?id=${id}`
    })
  },

}, wx))
