// utils/util.js - 工具函数

/**
 * 格式化时间
 */
function formatTime(date) {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hour = String(d.getHours()).padStart(2, '0')
  const minute = String(d.getMinutes()).padStart(2, '0')
  const second = String(d.getSeconds()).padStart(2, '0')
  
  return `${year}-${month}-${day} ${hour}:${minute}:${second}`
}

/**
 * 格式化日期
 */
function formatDate(date) {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  
  return `${year}-${month}-${day}`
}

/**
 * 获取今天是星期几
 */
function getWeekDay(date) {
  const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  const d = new Date(date)
  return weekDays[d.getDay()]
}

/**
 * 格式化时长（分钟转小时分钟）
 */
function formatDuration(minutes) {
  if (minutes < 60) {
    return `${minutes}分钟`
  }
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`
}

/**
 * 显示加载提示
 */
function showLoading(title = '加载中...') {
  wx.showLoading({
    title,
    mask: true
  })
}

/**
 * 隐藏加载提示
 */
function hideLoading() {
  wx.hideLoading()
}

/**
 * 显示成功提示
 */
function showSuccess(title) {
  wx.showToast({
    title,
    icon: 'success',
    duration: 2000
  })
}

/**
 * 显示错误提示
 */
function showError(title) {
  wx.showToast({
    title,
    icon: 'none',
    duration: 2000
  })
}

/**
 * 防抖函数
 */
function debounce(fn, delay = 300) {
  let timer = null
  return function(...args) {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      fn.apply(this, args)
    }, delay)
  }
}

/**
 * 节流函数
 */
function throttle(fn, delay = 300) {
  let lastTime = 0
  return function(...args) {
    const now = Date.now()
    if (now - lastTime >= delay) {
      lastTime = now
      fn.apply(this, args)
    }
  }
}

/**
 * 深拷贝
 */
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj
  }
  
  if (obj instanceof Date) {
    return new Date(obj)
  }
  
  if (obj instanceof Array) {
    return obj.map(item => deepClone(item))
  }
  
  const clone = {}
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      clone[key] = deepClone(obj[key])
    }
  }
  return clone
}

/**
 * 本地存储
 */
const storage = {
  set(key, value) {
    try {
      wx.setStorageSync(key, value)
      return true
    } catch (e) {
      return false
    }
  },
  
  get(key, defaultValue = null) {
    try {
      const value = wx.getStorageSync(key)
      return value || defaultValue
    } catch (e) {
      return defaultValue
    }
  },
  
  remove(key) {
    try {
      wx.removeStorageSync(key)
      return true
    } catch (e) {
      return false
    }
  },
  
  clear() {
    try {
      wx.clearStorageSync()
      return true
    } catch (e) {
      return false
    }
  }
}

module.exports = {
  formatTime,
  formatDate,
  getWeekDay,
  formatDuration,
  showLoading,
  hideLoading,
  showSuccess,
  showError,
  debounce,
  throttle,
  deepClone,
  storage
}
