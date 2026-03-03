// app.js
App({
  onLaunch() {
    // 初始化
    console.log('小程序启动')
    
    // 检查登录状态
    this.checkLoginStatus()
  },

  globalData: {
    userInfo: null,
    isLoggedIn: false,
    baseUrl: 'http://localhost:8080/api'
  },

  // 检查登录状态
  checkLoginStatus() {
    const token = wx.getStorageSync('token')
    if (token) {
      this.globalData.isLoggedIn = true
      this.getUserInfo()
    }
  },

  // 获取用户信息
  getUserInfo() {
    const userInfo = wx.getStorageSync('userInfo')
    if (userInfo) {
      this.globalData.userInfo = userInfo
    }
  },

  // 登录方法
  login() {
    return new Promise((resolve, reject) => {
      wx.login({
        success: (res) => {
          if (res.code) {
            // 发送 code 到后端换取 token
            wx.request({
              url: `${this.globalData.baseUrl}/auth/login`,
              method: 'POST',
              data: { code: res.code },
              success: (response) => {
                if (response.data.code === 0) {
                  const { token, userInfo } = response.data.data
                  wx.setStorageSync('token', token)
                  wx.setStorageSync('userInfo', userInfo)
                  this.globalData.isLoggedIn = true
                  this.globalData.userInfo = userInfo
                  resolve(userInfo)
                } else {
                  reject(response.data.message)
                }
              },
              fail: reject
            })
          } else {
            reject(res.errMsg)
          }
        },
        fail: reject
      })
    })
  }
})
