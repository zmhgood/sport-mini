// pages/family/join.js
const api = require('../../utils/api')

Page({
  data: {
    type: 'create',
    name: '',
    inviteCode: '',
    loading: false
  },

  onLoad(options) {
    this.setData({ type: options.type || 'create' })
    wx.setNavigationBarTitle({
      title: options.type === 'join' ? '加入家庭' : '创建家庭'
    })
  },

  onNameInput(e) {
    this.setData({ name: e.detail.value })
  },

  onCodeInput(e) {
    this.setData({ inviteCode: e.detail.value.toUpperCase() })
  },

  async createFamily() {
    if (!this.data.name.trim()) {
      wx.showToast({ title: '请输入家庭名称', icon: 'none' })
      return
    }

    this.setData({ loading: true })
    try {
      const res = await api.request('/family', 'POST', { name: this.data.name })
      if (res.code === 0) {
        wx.showToast({ title: '创建成功', icon: 'success' })
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      } else {
        wx.showToast({ title: res.message || '创建失败', icon: 'none' })
      }
    } catch (err) {
      wx.showToast({ title: '创建失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  async joinFamily() {
    if (!this.data.inviteCode.trim() || this.data.inviteCode.length !== 6) {
      wx.showToast({ title: '请输入6位邀请码', icon: 'none' })
      return
    }

    this.setData({ loading: true })
    try {
      const res = await api.request('/family/join', 'POST', { invite_code: this.data.inviteCode })
      if (res.code === 0) {
        wx.showToast({ title: '加入成功', icon: 'success' })
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      } else {
        wx.showToast({ title: res.message || '加入失败', icon: 'none' })
      }
    } catch (err) {
      wx.showToast({ title: '加入失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  }
})
