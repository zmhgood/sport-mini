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
    const type = options.code ? 'join' : (options.type || 'create')
    this.setData({ type, inviteCode: (options.code || '').trim().toUpperCase() })
    wx.setNavigationBarTitle({
      title: this.data.type === 'join' ? '加入家庭' : '创建家庭'
    })
  },

  ensureLogin() {
    if (wx.getStorageSync('token')) return true
    wx.showToast({ title: '请先登录，再确认加入家庭', icon: 'none' })
    wx.navigateTo({ url: '/pages/login/login' })
    return false
  },

  onNameInput(e) {
    this.setData({ name: e.detail.value })
  },

  onCodeInput(e) {
    this.setData({ inviteCode: e.detail.value.toUpperCase() })
  },

  async createFamily() {
    if (this.data.loading || this._completed || !this.ensureLogin()) return
    if (!this.data.name.trim()) {
      wx.showToast({ title: '请输入家庭名称', icon: 'none' })
      return
    }

    this.setData({ loading: true })
    try {
      const res = await api.request('/family', 'POST', { name: this.data.name })
      if (res.code === 0) {
        this._completed = true
        if (res.data && res.data.id) wx.setStorageSync('currentFamilyId', res.data.id)
        wx.showToast({ title: '创建成功', icon: 'success' })
        setTimeout(() => {
          wx.redirectTo({ url: '/pages/family/family' })
        }, 1500)
      } else {
        wx.showToast({ title: res.message || '创建失败', icon: 'none' })
      }
    } catch (err) {
      wx.showToast({ title: err.message || '创建失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  async joinFamily() {
    if (this.data.loading || this._completed || !this.ensureLogin()) return
    const inviteCode = this.data.inviteCode.trim().toUpperCase()
    if (!/^[A-Z0-9]{6}$/.test(inviteCode)) {
      wx.showToast({ title: '请输入6位邀请码', icon: 'none' })
      return
    }

    this.setData({ loading: true })
    try {
      const res = await api.request('/family/join', 'POST', { invite_code: inviteCode })
      if (res.code === 0) {
        this._completed = true
        if (res.data && res.data.id) wx.setStorageSync('currentFamilyId', res.data.id)
        wx.showToast({ title: '加入成功', icon: 'success' })
        setTimeout(() => {
          wx.redirectTo({ url: '/pages/family/family' })
        }, 1500)
      } else {
        wx.showToast({ title: res.message || '加入失败', icon: 'none' })
      }
    } catch (err) {
      wx.showToast({ title: err.message || '加入失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  }
})
