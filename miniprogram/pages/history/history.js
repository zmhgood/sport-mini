// pages/history/history.js
const api = require('../../utils/api')

Page({
  data: {
    historyList: [],
    page: 1,
    pageSize: 10,
    total: 0,
    hasMore: true,
    loading: false
  },

  _initialized: false,  // 使用实例变量而不是 data

  onLoad() {
    this.loadHistory()
  },

  // 加载历史记录
  loadHistory() {
    if (this.data.loading) return

    this.setData({ loading: true })

    const { page, pageSize } = this.data
    api.request(`/user/history?page=${page}&page_size=${pageSize}`, 'GET').then(res => {
      if (res.code === 0 && res.data) {
        const newList = res.data.list.map(item => {
          const progress = item.progress || 0
          return {
            date: this.formatDate(item.date),
            goalId: item.goal_id,
            goalName: item.goal_name,
            duration: Math.round(item.duration / 60),
            exercises: item.exercises || [],
            progress: progress,
            progressSvg: this.generateProgressSvg(progress)
          }
        })

        const total = res.data.total || 0
        const hasMore = this.data.page * this.data.pageSize < total

        this.setData({
          historyList: this.data.page === 1 ? newList : [...this.data.historyList, ...newList],
          total: total,
          hasMore: hasMore,
          loading: false
        })

        // 延迟设置初始化完成标记，防止 onReachBottom 过早触发
        setTimeout(() => {
          this._initialized = true
        }, 500)
      } else {
        this.setData({ loading: false })
      }
    }).catch((err) => {
      console.error('加载历史记录失败:', err)
      this.setData({ loading: false })
    })
  },

  // 加载更多
  loadMore() {
    if (!this.data.hasMore || this.data.loading) return

    this.setData({
      page: this.data.page + 1
    }, () => {
      this.loadHistory()
    })
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

  // 格式化日期
  formatDate(dateStr) {
    const date = new Date(dateStr)
    const month = date.getMonth() + 1
    const day = date.getDate()
    const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    const weekDay = weekDays[date.getDay()]
    return `${month}月${day}日 ${weekDay}`
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

    return encodeURIComponent(svg)
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.setData({
      page: 1,
      historyList: [],
      hasMore: true
    }, () => {
      this.loadHistory()
      wx.stopPullDownRefresh()
    })
  },

  // 上拉加载
  onReachBottom() {
    // 首次加载完成后才允许触发上拉加载
    if (!this._initialized) return
    this.loadMore()
  }
})
