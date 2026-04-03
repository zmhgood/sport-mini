// utils/api.js - API请求封装
const app = getApp()
const { getConfig } = require('../config/config')

// 获取环境配置
const config = getConfig()
const BASE_URL = config.baseURL

/**
 * 封装请求方法
 * @param {string} url - 请求路径
 * @param {string} method - 请求方法
 * @param {object} data - 请求数据
 */
function request(url, method = 'GET', data = {}) {
  return new Promise((resolve, reject) => {
    const token = wx.getStorageSync('token')
    
    wx.request({
      url: `${BASE_URL}${url}`,
      method,
      data,
      header: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : ''
      },
      success: (res) => {
        if (res.statusCode === 200) {
          resolve(res.data)
        } else if (res.statusCode === 401) {
          // Token过期，清除登录状态并跳转登录页
          wx.removeStorageSync('token')
          wx.removeStorageSync('userInfo')
          app.globalData.isLoggedIn = false
          app.globalData.userInfo = null
          // 获取当前页面路径
          const pages = getCurrentPages()
          const currentPage = pages[pages.length - 1]
          const currentRoute = currentPage ? currentPage.route : ''
          // 如果当前不在登录页，则跳转
          if (currentRoute && !currentRoute.includes('login')) {
            wx.navigateTo({
              url: '/pages/login/login'
            })
          }
          reject(new Error('登录已过期，请重新登录'))
        } else {
          reject(new Error(res.data.message || '请求失败'))
        }
      },
      fail: (err) => {
        reject(new Error('网络请求失败'))
      }
    })
  })
}

/**
 * GET请求
 */
function get(url, params = {}) {
  const queryString = Object.keys(params)
    .map(key => `${key}=${encodeURIComponent(params[key])}`)
    .join('&')
  
  const fullUrl = queryString ? `${url}?${queryString}` : url
  return request(fullUrl, 'GET')
}

/**
 * POST请求
 */
function post(url, data = {}) {
  return request(url, 'POST', data)
}

/**
 * PUT请求
 */
function put(url, data = {}) {
  return request(url, 'PUT', data)
}

/**
 * DELETE请求
 */
function del(url, data = {}) {
  return request(url, 'DELETE', data)
}

/**
 * 上传文件
 */
function upload(filePath, formData = {}) {
  return new Promise((resolve, reject) => {
    const token = wx.getStorageSync('token')
    
    wx.uploadFile({
      url: `${BASE_URL}/upload`,
      filePath,
      name: 'file',
      formData,
      header: {
        'Authorization': token ? `Bearer ${token}` : ''
      },
      success: (res) => {
        if (res.statusCode === 200) {
          resolve(JSON.parse(res.data))
        } else {
          reject(new Error('上传失败'))
        }
      },
      fail: reject
    })
  })
}

/**
 * 认证相关API
 */
const auth = {
  // 微信登录
  wechatLogin: (code) => post('/auth/login', { code }),
  
  // 发送短信验证码
  sendSMSCode: (phone, purpose = 'login') => post('/auth/send-code', { phone, purpose }),
  
  // 短信登录
  smsLogin: (phone, code) => post('/auth/sms-login', { phone, code }),
  
  // 获取用户信息
  getUserInfo: () => get('/user/info'),
  
  // 更新用户信息
  updateUserInfo: (data) => put('/user/info', data)
}

/**
 * 评论相关API
 */
const comment = {
  // 获取评论列表
  getList: (exerciseId, page = 1, pageSize = 10) => 
    get('/comments', { exercise_id: exerciseId, page, page_size: pageSize }),
  
  // 发表评论
  create: (data) => post('/comments', data),
  
  // 删除评论
  delete: (id) => del(`/comments/${id}`),
  
  // 点赞/取消点赞
  toggleLike: (id) => post(`/comments/${id}/like`),
  
  // 获取我的评论
  getMyComments: (page = 1, pageSize = 10) => 
    get('/user/comments', { page, page_size: pageSize })
}

module.exports = {
  request,
  get,
  post,
  put,
  del,
  upload,
  auth,
  comment,
  BASE_URL,
  
  /**
   * 检查是否登录
   * @returns {boolean}
   */
  isLoggedIn() {
    return !!wx.getStorageSync('token')
  },
  
  /**
   * 检查登录状态，未登录则跳转登录页
   * @param {function} callback - 已登录时的回调
   */
  requireLogin(callback) {
    if (this.isLoggedIn()) {
      callback && callback()
    } else {
      wx.showModal({
        title: '提示',
        content: '该功能需要登录后使用，是否立即登录？',
        confirmText: '去登录',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/login/login' })
          }
        }
      })
    }
  }
}
