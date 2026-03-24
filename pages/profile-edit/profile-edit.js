// pages/profile-edit/profile-edit.js
const api = require('../../utils/api')

Page({
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
    const value = e.detail.value
    this.setData({
      'userInfo.age': value ? parseInt(value) : null
    })
  },

  // 身高输入
  onHeightInput(e) {
    const value = e.detail.value
    this.setData({
      'userInfo.height': value ? parseInt(value) : null
    })
  },

  // 体重输入
  onWeightInput(e) {
    const value = e.detail.value
    this.setData({
      'userInfo.weight': value ? parseInt(value) : null
    })
  },

  // 健康状况输入
  onHealthStatusInput(e) {
    this.setData({
      'userInfo.health_status': e.detail.value
    })
  },

  // 保存
  async onSave() {
    const { userInfo } = this.data

    // 验证
    if (userInfo.age && (userInfo.age < 1 || userInfo.age > 150)) {
      wx.showToast({ title: '请输入正确的年龄', icon: 'none' })
      return
    }
    if (userInfo.height && (userInfo.height < 50 || userInfo.height > 250)) {
      wx.showToast({ title: '请输入正确的身高', icon: 'none' })
      return
    }
    if (userInfo.weight && (userInfo.weight < 20 || userInfo.weight > 300)) {
      wx.showToast({ title: '请输入正确的体重', icon: 'none' })
      return
    }

    this.setData({ loading: true })

    try {
      const res = await api.request('/user/info', 'PUT', {
        nick_name: userInfo.nick_name,
        gender: userInfo.gender,
        age: userInfo.age,
        height: userInfo.height,
        weight: userInfo.weight,
        health_status: userInfo.health_status
      })

      if (res.code === 0) {
        // 更新本地存储
        const localUserInfo = wx.getStorageSync('userInfo') || {}
        const updatedInfo = {
          ...localUserInfo,
          ...userInfo
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
      wx.showToast({ title: '网络错误', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  // 取消
  onCancel() {
    wx.navigateBack()
  }
})
