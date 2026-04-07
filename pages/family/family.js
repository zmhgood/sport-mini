// pages/family/family.js
const api = require('../../utils/api')

Page({
  data: {
    families: [],        // 用户所有家庭
    family: null,        // 当前选中的家庭
    currentFamilyIndex: 0,
    members: [],
    goals: [],
    isAdmin: false,
    currentUserId: null
  },

  onLoad() {
    this.loadFamilies()
  },

  onShow() {
    this.loadFamilies()
  },

  async loadFamilies() {
    try {
      const res = await api.request('/families', 'GET')
      console.log('[loadFamilies] res:', res)
      if (res.code === 0) {
        const families = res.data || []
        const currentUserId = parseInt(wx.getStorageSync('userId')) || 0
        
        console.log('[loadFamilies] families:', families, 'currentUserId:', currentUserId)
        
        // 从缓存获取当前选择的家庭ID
        const cachedFamilyId = wx.getStorageSync('currentFamilyId')
        let currentFamilyIndex = 0
        
        // 如果有缓存的家庭ID，找到对应的索引
        if (cachedFamilyId && families.length > 0) {
          const index = families.findIndex(f => f.id === cachedFamilyId)
          if (index !== -1) {
            currentFamilyIndex = index
          }
        }
        
        this.setData({ 
          families, 
          currentUserId,
          currentFamilyIndex 
        })
        
        // 加载当前选中的家庭详情
        if (families.length > 0) {
          const familyId = families[currentFamilyIndex].id
          console.log('[loadFamilies] 加载家庭详情:', familyId)
          this.loadFamilyDetail(familyId)
        } else {
          this.setData({ 
            family: null, 
            members: [], 
            goals: [] 
          })
        }
      } else {
        wx.showToast({ title: res.message || '加载失败', icon: 'none' })
        this.setData({ 
          families: [], 
          family: null, 
          members: [], 
          goals: [] 
        })
      }
    } catch (err) {
      console.error('加载家庭列表失败:', err)
      wx.showToast({ title: '网络错误', icon: 'none' })
    }
  },

  async loadFamilyDetail(familyId) {
    try {
      const res = await api.request(`/family/${familyId}`, 'GET')
      console.log('[loadFamilyDetail] res:', res)
      if (res.code === 0 && res.data) {
        const family = res.data
        console.log('[loadFamilyDetail] family:', family, 'members:', family.members)
        
        // 检查当前用户是否是管理员（使用 == 而不是 ===，避免类型不匹配）
        const currentMember = family.members && family.members.find(m => m.user_id == this.data.currentUserId)
        const isAdmin = currentMember && currentMember.role === 'admin'
        console.log('[loadFamilyDetail] currentMember:', currentMember, 'isAdmin:', isAdmin)

        this.setData({
          family,
          members: (family.members || []).map(m => ({ ...m, user: m.user || {} })),
          isAdmin
        })

        // 获取家庭目标
        this.loadGoals(familyId)
      }
    } catch (err) {
      console.error('加载家庭详情失败:', err)
    }
  },

  onFamilyChange(e) {
    const index = parseInt(e.detail.value)
    const family = this.data.families[index]
    this.setData({ currentFamilyIndex: index })
    // 保存到缓存，保持与首页一致
    wx.setStorageSync('currentFamilyId', family.id)
    this.loadFamilyDetail(family.id)
  },

  async loadGoals(familyId) {
    try {
      const res = await api.request(`/goals/family?family_id=${familyId}`, 'GET')
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

  goCreate() {
    wx.navigateTo({ url: '/pages/family/join?type=create' })
  },

  goJoin() {
    wx.navigateTo({ url: '/pages/family/join?type=join' })
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
              this.loadFamilyDetail(this.data.family.id)
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
              this.loadFamilyDetail(this.data.family.id)
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
