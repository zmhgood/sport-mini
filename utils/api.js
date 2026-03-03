// utils/api.js - API请求封装
const app = getApp()

const BASE_URL = 'http://localhost:8080/api'

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
          // Token过期，清除登录状态
          wx.removeStorageSync('token')
          wx.removeStorageSync('userInfo')
          app.globalData.isLoggedIn = false
          app.globalData.userInfo = null
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

module.exports = {
  request,
  get,
  post,
  put,
  del,
  upload,
  BASE_URL
}
