const { withFontSize } = require('../../utils/font-size')
// pages/profile-edit/profile-edit.js
const api = require('../../utils/api')

Page(withFontSize({
  data: {
    userInfo: {
      nick_name: '',
      gender: 0,
      age: null,
      height: null,
      weight: null,
      health_status: ''
    },
    genderOptions: [
      { value: 0, label: '保密' },
      { value: 1, label: '男' },
      { value: 2, label: '女' }
    ],
    loading: false
  },

  onLoad() {
    this.loadUserInfo()
  },

  // 加载用户信息
  loadUserInfo() {
    const userInfo = wx.getStorageSync('userInfo') || {}
    this.setData({
      userInfo: {
        nick_name: userInfo.nick_name || '',
        gender: userInfo.gender || 0,
        age: userInfo.age || null,
        height: userInfo.height || null,
        weight: userInfo.weight || null,
        health_status: userInfo.health_status || ''
      }
    })
  },

  // 昵称输入
  onNickNameInput(e) {
    this.setData({
      'userInfo.nick_name': e.detail.value
    })
  },

  // 性别选择
  onGenderChange(e) {
    const index = parseInt(e.detail.value)
    this.setData({
      'userInfo.gender': this.data.genderOptions[index].value
    })
  },

  // 年龄输入
  onAgeInput(e) {
    return this.setIntegerInput('age', e.detail.value)
  },

  // 身高输入
  onHeightInput(e) {
    return this.setIntegerInput('height', e.detail.value)
  },

  // 体重输入
  onWeightInput(e) {
    return this.setIntegerInput('weight', e.detail.value)
  },

  setIntegerInput(field, value) {
    if (!/^\d*$/.test(value)) {
      const previous = this.data.userInfo[field]
      this.setData({ [`userInfo.${field}`]: previous })
      wx.showToast({ title: '只能输入整数', icon: 'none' })
      return previous == null ? '' : String(previous)
    }
    this.setData({ [`userInfo.${field}`]: value === '' ? null : value })
    return value
  },

  // 健康状况输入
  onHealthStatusInput(e) {
    this.setData({
      'userInfo.health_status': e.detail.value
    })
  },

  // 保存
  async onSave() {
    if (this.data.loading || this._completed) return
    const { userInfo } = this.data
    const age = userInfo.age == null ? 0 : Number(userInfo.age)
    const height = userInfo.height == null ? 0 : Number(userInfo.height)
    const weight = userInfo.weight == null ? 0 : Number(userInfo.weight)

    // 验证
    if (userInfo.age != null && (!Number.isInteger(age) || age < 1 || age > 150)) {
      wx.showToast({ title: '请输入正确的年龄', icon: 'none' })
      return
    }
    if (userInfo.height != null && (!Number.isInteger(height) || height < 50 || height > 250)) {
      wx.showToast({ title: '请输入正确的身高', icon: 'none' })
      return
    }
    if (userInfo.weight != null && (!Number.isInteger(weight) || weight < 20 || weight > 300)) {
      wx.showToast({ title: '请输入正确的体重', icon: 'none' })
      return
    }

    this.setData({ loading: true })

    try {
      const res = await api.request('/user/info', 'PUT', {
        nick_name: userInfo.nick_name,
        gender: userInfo.gender,
        age,
        height,
        weight,
        health_status: userInfo.health_status
      })

      if (res.code === 0) {
        const latest = await api.request('/user/info', 'GET')
        if (latest.code !== 0 || !latest.data) throw new Error('资料读回失败，请重试')
        this._completed = true
        // 更新本地存储
        const localUserInfo = wx.getStorageSync('userInfo') || {}
        const updatedInfo = {
          ...localUserInfo,
          ...latest.data
        }
        wx.setStorageSync('userInfo', updatedInfo)

        wx.showToast({ title: '保存成功', icon: 'success' })
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      } else {
        wx.showToast({ title: res.message || '保存失败', icon: 'none' })
      }
    } catch (err) {
      wx.showToast({ title: err.message || '网络错误', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  // 取消
  onCancel() {
    wx.navigateBack()
  }
}, wx))
