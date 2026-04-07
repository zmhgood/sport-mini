// pages/profile/profile.js
const api = require('../../utils/api')

Page({
  data: {
    isLoggedIn: false,
    userInfo: null,
    currentFamily: {},      // 当前选择的家庭
    statistics: {
      totalDays: 0,
      totalExercises: 0,
      totalMinutes: 0,
      totalSets: 0
    },
    // 多家庭统计
    familyStats: [],        // 按家庭分组的统计
    showFamilyStats: false, // 是否展开家庭统计
    currentWeekOffset: 0,   // 当前周偏移量（0=本周，-1=上周，1=下周）
    weekStats: [],          // 当前周的统计数据
    maxCount: 1,            // 最大值用于柱状图高度
    weekRange: '',          // 当前周的日期范围
    canGoPrev: true,        // 是否可以向左滑动
    canGoNext: true,        // 是否可以向右滑动
    settings: [
      { id: 'family', name: '我的家庭', value: '管理', icon: '👨‍👩‍👧‍👦' },
      { id: 'goals', name: '锻炼目标', value: '查看', icon: '🎯' },
      { id: 'profile', name: '个人信息', value: '编辑', icon: '👤' },
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
    this.checkLogin()
    if (api.isLoggedIn()) {
      this.loadStatistics()
      this.loadFamilyStatistics()
      this.loadWeekStats(0)
      this.loadCurrentFamily()
    }
  },

  // 加载当前选择的家庭
  async loadCurrentFamily() {
    const cachedFamilyId = wx.getStorageSync('currentFamilyId')
    if (!cachedFamilyId) return

    try {
      // 先尝试从 /families 接口获取家庭列表
      const res = await api.request('/families', 'GET')
      if (res.code === 0 && res.data) {
        const families = res.data
        const family = families.find(f => String(f.id) === String(cachedFamilyId))
        if (family) {
          this.setData({
            currentFamily: { id: cachedFamilyId, name: family.name }
          })
          return
        }
      }
      // 如果没找到，显示默认名称
      this.setData({
        currentFamily: { id: cachedFamilyId, name: '当前家庭' }
      })
    } catch (err) {
      console.error('加载当前家庭失败:', err)
      this.setData({
        currentFamily: { id: cachedFamilyId, name: '当前家庭' }
      })
    }
  },

  // 检查登录状态
  checkLogin() {
    const isLoggedIn = api.isLoggedIn()
    const userInfo = wx.getStorageSync('userInfo')
    this.setData({
      isLoggedIn,
      userInfo
    })
  },

  // 加载统计数据
  loadStatistics() {
    api.request('/user/statistics', 'GET').then(res => {
      if (res.code === 0 && res.data) {
        this.setData({
          statistics: {
            totalDays: res.data.totalDays || 0,
            totalExercises: res.data.totalExercises || 0,
            totalMinutes: res.data.totalMinutes || 0,
            totalSets: res.data.totalSets || 0
          }
        })
      }
    }).catch(() => {
      const stats = wx.getStorageSync('userStatistics') || {
        totalDays: 0,
        totalExercises: 0,
        totalMinutes: 0,
        totalSets: 0
      }
      this.setData({ statistics: stats })
    })
  },

  // 加载按家庭分组的统计
  loadFamilyStatistics() {
    return api.request('/user/statistics/by-family', 'GET').then(res => {
      if (res.code === 0 && res.data) {
        this.setData({ familyStats: res.data || [] })
      }
    }).catch((err) => {
      console.error('加载家庭统计失败:', err)
      this.setData({ familyStats: [] })
    })
  },

  // 切换家庭统计显示
  toggleFamilyStats() {
    this.setData({
      showFamilyStats: !this.data.showFamilyStats
    })
  },

  // 加载一周统计数据
  loadWeekStats(weekOffset) {
    console.log('[loadWeekStats] 请求 week_offset:', weekOffset)
    api.request(`/user/week-stats?week_offset=${weekOffset}`, 'GET').then(res => {
      console.log('[loadWeekStats] 响应:', res)
      console.log('[loadWeekStats] raw:', JSON.stringify(res))
      if (res.code === 0 && res.data) {
        const stats = (res.data.stats || []).map(item => {
          const totalSets = Number(item.totalSets || 0)
          const count = Number(item.count || 0)
          const rawPercent = totalSets > 0 ? (count / totalSets) * 100 : 0
          const barPercent = Math.min(100, rawPercent)
          return { ...item, totalSets, count, barPercent }
        })

        console.log('[loadWeekStats] canGoPrev:', res.data.canGoPrev, 'canGoNext:', res.data.canGoNext)

        this.setData({
          currentWeekOffset: weekOffset,
          weekStats: stats,
          maxCount: 100,
          weekRange: res.data.weekRange,
          canGoPrev: !!res.data.canGoPrev,   // 强制转换为布尔值
          canGoNext: !!res.data.canGoNext
        }, () => {
          console.log('[loadWeekStats] 更新后, canGoPrev:', this.data.canGoPrev)
        })
      }
    }).catch((err) => {
      console.error('加载周统计失败:', err)
    })
  },

  // 上一周（向左滑动）
  prevWeek() {
    console.log('[prevWeek] canGoPrev:', this.data.canGoPrev, 'currentWeekOffset:', this.data.currentWeekOffset)
    if (!this.data.canGoPrev) {
      console.log('[prevWeek] 不能滑动')
      return
    }
    const newOffset = this.data.currentWeekOffset - 1
    console.log('[prevWeek] 新偏移量:', newOffset)
    this.loadWeekStats(newOffset)
  },

  // 下一周（向右滑动）
  nextWeek() {
    if (!this.data.canGoNext) return
    const newOffset = this.data.currentWeekOffset + 1
    this.loadWeekStats(newOffset)
  },

  // 生成模拟的一周数据
  generateMockWeekStats() {
    const now = new Date()
    const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    const result = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now)
      date.setDate(date.getDate() - i)
      result.push({
        date: date.toISOString().split('T')[0],
        weekday: weekDays[date.getDay()],
        count: 0,
        minutes: 0
      })
    }
    return result
  },

  // 生成进度圆环 SVG
  generateProgressSvg(progress) {
    const size = 36
    const strokeWidth = 3
    const radius = (size - strokeWidth) / 2
    const circumference = 2 * Math.PI * radius
    const offset = circumference - (progress / 100) * circumference

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${size/2}" cy="${size/2}" r="${radius}" fill="none" stroke="#E2E8F0" stroke-width="${strokeWidth}"/>
      <circle cx="${size/2}" cy="${size/2}" r="${radius}" fill="none" stroke="#3B82F6" stroke-width="${strokeWidth}"
        stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" stroke-linecap="round"
        transform="rotate(-90 ${size/2} ${size/2})"/>
    </svg>`

    // 对 SVG 进行 URL 编码
    return encodeURIComponent(svg)
  },

  // 绘制所有圆环进度
  drawProgressRings() {
    // SVG 方案，无需 canvas 绘制
  },

  // 绘制单个圆环进度
  drawProgressRing(index, progress) {
    // SVG 方案，无需 canvas 绘制
  },

  // 跳转到目标详情页
  goToGoalDetail(e) {
    const { id } = e.currentTarget.dataset
    if (id) {
      wx.navigateTo({
        url: `/pages/goal/detail?id=${id}`
      })
    }
  },

  // 从柱状图跳转到目标详情
  goToGoalFromChart(e) {
    const { id, count, goalids, date } = e.currentTarget.dataset
    if (count > 0) {
      // 如果有多个目标，取第一个
      const targetId = goalids && goalids.length > 0 ? goalids[0] : id
      if (targetId) {
        const queryDate = date || ''
        const dateParam = queryDate ? `&date=${queryDate}` : ''
        wx.navigateTo({
          url: `/pages/goal/detail?id=${targetId}${dateParam}`
        })
      }
    }
  },

  // 跳转到锻炼记录列表页
  goToHistory() {
    wx.navigateTo({
      url: '/pages/history/history'
    })
  },

  // 加载本地历史记录
  loadLocalHistory() {
    const localHistory = wx.getStorageSync('exerciseHistory') || []
    if (localHistory.length > 0) {
      this.setData({ historyList: localHistory })
    } else {
      // 没有任何记录
      this.setData({ historyList: [] })
    }
  },

  // 格式化日期
  formatDate(dateStr) {
    const date = new Date(dateStr)
    const month = date.getMonth() + 1
    const day = date.getDate()
    const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    const weekDay = weekDays[date.getDay()]
    return `${month}月${day}日 ${weekDay}`
  },

  // 登录
  handleLogin() {
    wx.navigateTo({ url: '/pages/login/login' })
  },

  // 退出登录
  handleLogout() {
    wx.showModal({
      title: '提示',
      content: '确定要退出登录吗？',
      success: (res) => {
        if (res.confirm) {
          wx.removeStorageSync('token')
          wx.removeStorageSync('userInfo')
          this.setData({
            isLoggedIn: false,
            userInfo: null,
            statistics: { totalDays: 0, totalExercises: 0, totalMinutes: 0, totalSets: 0 },
            historyList: []
          })
          wx.showToast({ title: '已退出登录', icon: 'success' })
        }
      }
    })
  },

  // 跳转到设置页面
  goToSetting(e) {
    const { id } = e.currentTarget.dataset
    
    switch(id) {
      case 'family':
        wx.navigateTo({ url: '/pages/family/family' })
        break
      case 'goals':
        wx.navigateTo({ url: '/pages/goal/list' })
        break
      case 'profile':
        wx.navigateTo({ url: '/pages/profile-edit/profile-edit' })
        break
      default:
        wx.showToast({
          title: '功能开发中',
          icon: 'none'
        })
    }
  },

  // 分享
  onShareAppMessage() {
    return {
      title: '银龄健身 - 陪我一起锻炼吧',
      path: '/pages/index/index'
    }
  }
})
