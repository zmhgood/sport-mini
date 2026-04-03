// pages/goal/goal.js
const api = require('../../utils/api')

Page({
  data: {
    goals: []
  },

  onLoad() {
    this.loadGoals()
  },

  onShow() {
    this.loadGoals()
  },

  async loadGoals() {
    try {
      const res = await api.request('/goals', 'GET')
      if (res.code === 0) {
        const goals = (res.data || []).map(g => ({
          ...g,
          memberCount: (g.members && g.members.length) || 0,
          exerciseCount: (g.exercises && g.exercises.length) || 0
        }))
        this.setData({ goals })
      }
    } catch (err) {
      console.error('加载目标失败:', err)
    }
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/goal/detail?id=${id}` })
  }
})
