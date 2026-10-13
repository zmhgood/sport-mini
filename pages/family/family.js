// pages/family/family.js
const api = require('../../utils/api')

Page({
  data: {
    loading: true,
    loadError: '',
    families: [],        // 用户所有家庭
    family: null,        // 当前选中的家庭
    currentFamilyIndex: 0,
    members: [],
    goals: [],
    isAdmin: false,
    currentUserId: null
  },

  onShow() {
    this.loadFamilies()
  },

  async loadFamilies() {
    if (this._loadInProgress) return
    this._loadInProgress = true
    this.setData({ loading: true, loadError: '' })
    try {
      const res = await api.request('/families', 'GET')
      if (res.code !== 0) throw new Error('家庭列表加载失败')
      const families = res.data || []
      const currentUserId = parseInt(wx.getStorageSync('userId')) || 0
      const cachedFamilyId = wx.getStorageSync('currentFamilyId')
      const cachedIndex = families.findIndex(f => f.id === cachedFamilyId)
      const currentFamilyIndex = cachedIndex >= 0 ? cachedIndex : 0
      let detail = { family: null, members: [], isAdmin: false }
      let goals = []
      if (families.length > 0) {
        const familyId = families[currentFamilyIndex].id
        const [familyDetail, familyGoals] = await Promise.all([
          this.loadFamilyDetail(familyId, currentUserId),
          this.loadGoals(familyId)
        ])
        detail = familyDetail
        goals = familyGoals
      }
      this.setData({ families, currentUserId, currentFamilyIndex, ...detail, goals })
    } catch (err) {
      this.setData({ loadError: '家庭信息加载失败，请重试' })
    } finally {
      this._loadInProgress = false
      this.setData({ loading: false })
    }
  },

  async loadFamilyDetail(familyId, currentUserId) {
    const res = await api.request(`/family/${familyId}`, 'GET')
    if (res.code !== 0 || !res.data) throw new Error('家庭详情加载失败')
    const family = res.data
    const currentMember = family.members && family.members.find(m => m.user_id == currentUserId)
    return {
      family,
      members: (family.members || []).map(m => ({ ...m, user: m.user || {} })),
      isAdmin: !!(currentMember && currentMember.role === 'admin')
    }
  },

  onFamilyChange(e) {
    const index = parseInt(e.detail.value)
    const family = this.data.families[index]
    wx.setStorageSync('currentFamilyId', family.id)
    this.loadFamilies()
  },

  async loadGoals(familyId) {
    const res = await api.request(`/goals/family?family_id=${familyId}`, 'GET')
    if (res.code !== 0) throw new Error('家庭目标加载失败')
    return (res.data || []).map(g => ({
      ...g,
      memberCount: (g.members && g.members.length) || 0,
      exerciseCount: (g.exercises && g.exercises.length) || 0
    }))
  },

  goCreate() {
    wx.navigateTo({ url: '/pages/family/join?type=create' })
  },

  goJoin() {
    wx.navigateTo({ url: '/pages/family/join?type=join' })
  },

  onShareAppMessage() {
    const { family, isAdmin } = this.data
    if (!isAdmin || !family || !family.invite_code) {
      return { title: '爸妈动起来', path: '/pages/index/index' }
    }
    return {
      title: `邀请你加入「${family.name}」，一起锻炼`,
      path: `/pages/family/join?type=join&code=${encodeURIComponent(family.invite_code)}`
    }
  },

  copyInviteCode() {
    wx.setClipboardData({
      data: this.data.family.invite_code,
      success: () => {
        wx.showToast({ title: '已复制', icon: 'success' })
      }
    })
  },

  async refreshInviteCode() {
    try {
      const res = await api.request('/family/invite-code/refresh', 'POST', {
        family_id: this.data.family.id
      })
      if (res.code === 0) {
        this.setData({ 'family.invite_code': res.data.invite_code })
        wx.showToast({ title: '已刷新', icon: 'success' })
      }
    } catch (err) {
      wx.showToast({ title: '刷新失败', icon: 'none' })
    }
  },

  async removeMember(e) {
    const memberId = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认移除',
      content: '确定要移除该成员吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            const res = await api.request('/family/remove', 'POST', { 
              family_id: this.data.family.id,
              member_id: memberId 
            })
            if (res.code === 0) {
              wx.showToast({ title: '已移除', icon: 'success' })
              this.loadFamilies()
            }
          } catch (err) {
            wx.showToast({ title: '操作失败', icon: 'none' })
          }
        }
      }
    })
  },

  async transferAdmin(e) {
    const memberId = e.currentTarget.dataset.id
    wx.showModal({
      title: '转移管理员',
      content: '确定将管理员权限转移给该成员吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            const res = await api.request('/family/transfer', 'POST', { 
              family_id: this.data.family.id,
              new_admin_id: memberId 
            })
            if (res.code === 0) {
              wx.showToast({ title: '已转移', icon: 'success' })
              this.loadFamilies()
            }
          } catch (err) {
            wx.showToast({ title: '操作失败', icon: 'none' })
          }
        }
      }
    })
  },

  async leaveFamily() {
    const familyName = this.data.family ? this.data.family.name : '当前家庭'
    wx.showModal({
      title: '退出家庭',
      content: `确定要退出"${familyName}"家庭吗？`,
      success: async (res) => {
        if (res.confirm) {
          try {
            const res = await api.request('/family/leave', 'POST', {
              family_id: this.data.family.id
            })
            if (res.code === 0) {
              wx.showToast({ title: '已退出', icon: 'success' })
              // 清除缓存的家庭ID
              wx.removeStorageSync('currentFamilyId')
              // 重新加载家庭列表
              this.loadFamilies()
            }
          } catch (err) {
            wx.showToast({ title: '操作失败', icon: 'none' })
          }
        }
      }
    })
  },

  goCreateGoal() {
    wx.navigateTo({ url: '/pages/goal/create?family_id=' + this.data.family.id })
  },

  goGoalDetail(e) {
    const goalId = e.currentTarget.dataset.id
    wx.navigateTo({ url: '/pages/goal/detail?id=' + goalId })
  }
})
