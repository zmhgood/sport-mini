// 环境配置
const ENV = {
  // 开发环境
  development: {
    baseURL: 'http://localhost:8080/api',
    debug: true
  },
  // 生产环境  
  production: {
    baseURL: 'https://www.dosport.online/api',
    debug: false
  }
}

// 获取当前环境配置
// 小程序可通过 __wxConfig 判断环境，或手动切换
function getConfig() {
  // 方式1: 通过开发者工具环境判断
  // const accountInfo = wx.getAccountInfoSync()
  // const env = accountInfo.miniProgram.envVersion // develop: 开发版, trial: 体验版, release: 正式版
  
  // 方式2: 手动指定（推荐，更清晰）
  const currentEnv = 'development' // 发布前改为 'production'
  
  return {
    ...ENV[currentEnv],
    env: currentEnv
  }
}

module.exports = {
  getConfig,
  ENV
}
