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
function getConfig() {
  const { envVersion } = wx.getAccountInfoSync().miniProgram
  // 仅开发工具连接本地服务；手机预览、体验版和正式版连接生产服务。
  const { platform } = wx.getDeviceInfo()
  const currentEnv = envVersion === 'develop' && platform === 'devtools' ? 'development' : 'production'
  
  return {
    ...ENV[currentEnv],
    env: currentEnv
  }
}

module.exports = {
  getConfig,
  ENV
}
