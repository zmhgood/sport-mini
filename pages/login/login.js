// pages/login/login.js
const app = getApp()
const api = require('../../utils/api')

Page({
  data: {
    loading: false,
    showWechatForm: false, // 是否显示微信头像昵称表单
    wechatAvatarUrl: '',   // 微信头像
    wechatNickName: '',    // 微信昵称
    agreePrivacy: false,   // 是否同意隐私政策
    systemConfig: {
      logo_url: '',
      site_name: '爸妈动起来'
    }
  },

  onLoad() {
    this.getSystemConfig()
  },

  // 获取系统配置
  getSystemConfig() {
    api.request('/configs', 'GET').then(res => {
      if (res.code === 0 && res.data) {
        this.setData({
          systemConfig: {
            logo_url: res.data.logo_url || '',
            site_name: res.data.site_name || '爸妈动起来'
          }
        })
      }
    }).catch(() => {
      // 使用默认配置
    })
  },

  // 隐私政策勾选变化
  onPrivacyChange(e) {
    const checked = e.detail.value.includes('1')
    this.setData({ agreePrivacy: checked })
  },

  // 打开用户协议
  openUserAgreement() {
    wx.navigateTo({
      url: '/pages/agreement/agreement'
    })
  },

  // 打开隐私政策
  openPrivacyPolicy() {
    wx.navigateTo({
      url: '/pages/privacy/privacy'
    })
  },

  // 检查隐私政策
  checkPrivacyAgreement() {
    if (!this.data.agreePrivacy) {
      wx.showToast({ title: '请先同意用户协议和隐私政策', icon: 'none' })
      return false
    }
    return true
  },

  // 微信登录按钮点击 - 显示头像昵称表单
  wechatLogin() {
    console.log('微信登录按钮点击，显示表单')
    // 显示填写头像昵称的表单
    this.setData({ showWechatForm: true })
  },

  // 选择头像回调
  onChooseAvatar(e) {
    console.log('选择头像:', e.detail)
    const { avatarUrl } = e.detail
    this.setData({ wechatAvatarUrl: avatarUrl })
  },

  // 输入昵称
  onNickNameInput(e) {
    console.log('输入昵称:', e.detail)
    const nickName = e.detail.value
    this.setData({ wechatNickName: nickName })
  },

  // 确认微信登录
  confirmWechatLogin() {
    if (this.data.loading) return
    // 检查隐私政策
    if (!this.checkPrivacyAgreement()) return

    const { wechatAvatarUrl, wechatNickName } = this.data
    
    // 构建用户信息对象
    const profileUserInfo = {
      nickName: wechatNickName || '微信用户',
      avatarUrl: wechatAvatarUrl
    }
    
    this.startWeChatLogin(profileUserInfo)
  },

  startWeChatLogin(profileUserInfo) {
    this.setData({ loading: true })
    wx.showLoading({ title: '登录中...' })
    this.doWeChatLogin(profileUserInfo)
  },

  async doWeChatLogin(profileUserInfo) {
    try {
      // 获取登录code
      const loginRes = await new Promise((resolve, reject) => {
        wx.login({
          success: resolve,
          fail: reject
        })
      })

      if (!loginRes.code) {
        throw new Error('获取登录信息失败')
      }

      // 调用后端登录接口
      const res = await api.auth.wechatLogin(loginRes.code)
      wx.hideLoading()

      if (res.code !== 0) {
        throw new Error(res.message)
      }

      // 保存token
      wx.setStorageSync('token', res.data.token)
      wx.setStorageSync('userInfo', res.data.userInfo)
      wx.setStorageSync('userId', res.data.userInfo.id)
      app.globalData.isLoggedIn = true
      app.globalData.userInfo = res.data.userInfo

      // 若已拿到用户信息，回写到服务端
      if (profileUserInfo) {
        const { nickName } = profileUserInfo
        let { avatarUrl } = profileUserInfo
        if (avatarUrl) {
          const uploadRes = await api.upload(avatarUrl)
          avatarUrl = uploadRes.data.url
        }
        if (nickName || avatarUrl) {
          await api.auth.updateUserInfo({
            nick_name: nickName || '',
            avatar_url: avatarUrl || ''
          })
          const updatedUserInfo = {
            ...res.data.userInfo,
            nick_name: nickName || res.data.userInfo.nick_name,
            avatar_url: avatarUrl || res.data.userInfo.avatar_url
          }
          wx.setStorageSync('userInfo', updatedUserInfo)
          app.globalData.userInfo = updatedUserInfo
        }
      }

      // 登录后再拉一次用户信息，确保头像昵称已更新
      try {
        const latestRes = await api.auth.getUserInfo()
        if (latestRes.code === 0 && latestRes.data) {
          wx.setStorageSync('userInfo', latestRes.data)
          app.globalData.userInfo = latestRes.data
        }
      } catch (syncErr) {
        console.warn('同步用户信息失败:', syncErr)
      }

      this.setData({ loading: false })
      wx.showToast({ title: '登录成功', icon: 'success' })
      
      // 跳转到首页
      setTimeout(() => {
        wx.switchTab({ url: '/pages/index/index' })
      }, 1500)
    } catch (err) {
      wx.hideLoading()
      this.setData({ loading: false })
      wx.removeStorageSync('token')
      wx.removeStorageSync('userInfo')
      wx.removeStorageSync('userId')
      app.globalData.isLoggedIn = false
      app.globalData.userInfo = null
      wx.showToast({ title: err.message || '登录失败', icon: 'none' })
    }
  }
})
