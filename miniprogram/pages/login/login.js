// pages/login/login.js
const app = getApp()
const api = require('../../utils/api')

Page({
  data: {
    loginType: 'wechat', // 默认微信登录
    phone: '',
    code: '',
    countdown: 0,
    loading: false,
    canSendCode: true,
    showWechatForm: false, // 是否显示微信头像昵称表单
    wechatAvatarUrl: '',   // 微信头像
    wechatNickName: '',    // 微信昵称
    systemConfig: {
      logo_url: '',
      site_name: '银龄健身'
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
            site_name: res.data.site_name || '银龄健身'
          }
        })
      }
    }).catch(() => {
      // 使用默认配置
    })
  },

  // 切换登录方式
  switchLoginType(e) {
    const type = e.currentTarget.dataset.type
    this.setData({ loginType: type })
  },

  // 输入手机号
  onPhoneInput(e) {
    this.setData({ phone: e.detail.value })
  },

  // 输入验证码
  onCodeInput(e) {
    this.setData({ code: e.detail.value })
  },

  // 发送验证码
  async sendCode() {
    const { phone, canSendCode, countdown } = this.data
    
    if (!canSendCode || countdown > 0) return
    
    // 验证手机号
    if (!phone || phone.length !== 11) {
      wx.showToast({ title: '请输入正确的手机号', icon: 'none' })
      return
    }

    try {
      wx.showLoading({ title: '发送中...' })
      const res = await api.auth.sendSMSCode(phone, 'login')
      wx.hideLoading()
      
      if (res.code !== 0) {
        throw new Error(res.message)
      }
      
      wx.showToast({ title: '验证码已发送', icon: 'success' })
      
      // 开始倒计时
      this.setData({ countdown: 60, canSendCode: false })
      this.timer = setInterval(() => {
        const newCountdown = this.data.countdown - 1
        if (newCountdown <= 0) {
          clearInterval(this.timer)
          this.setData({ countdown: 0, canSendCode: true })
        } else {
          this.setData({ countdown: newCountdown })
        }
      }, 1000)
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: err.message || '发送失败', icon: 'none' })
    }
  },

  // 短信登录
  async smsLogin() {
    const { phone, code, loading } = this.data
    
    if (loading) return
    
    // 验证输入
    if (!phone || phone.length !== 11) {
      wx.showToast({ title: '请输入正确的手机号', icon: 'none' })
      return
    }
    if (!code || code.length !== 6) {
      wx.showToast({ title: '请输入6位验证码', icon: 'none' })
      return
    }

    try {
      this.setData({ loading: true })
      wx.showLoading({ title: '登录中...' })
      
      const res = await api.auth.smsLogin(phone, code)
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
      
      const message = res.data.is_new ? '注册成功' : '登录成功'
      wx.showToast({ title: message, icon: 'success' })
      
      // 跳转到首页
      setTimeout(() => {
        wx.switchTab({ url: '/pages/index/index' })
      }, 1500)
    } catch (err) {
      wx.hideLoading()
      this.setData({ loading: false })
      wx.showToast({ title: err.message || '登录失败', icon: 'none' })
    }
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
        const { nickName, avatarUrl } = profileUserInfo
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
      wx.showToast({ title: err.message || '登录失败', icon: 'none' })
    }
  },

  onUnload() {
    if (this.timer) {
      clearInterval(this.timer)
    }
  }
})
