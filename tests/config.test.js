const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

for (const [envVersion, platform, expected] of [
  ['develop', 'devtools', 'http://localhost:8080/api'],
  ['develop', 'ios', 'https://www.dosport.online/api'],
  ['develop', 'android', 'https://www.dosport.online/api'],
  ['trial', 'devtools', 'https://www.dosport.online/api'],
  ['release', 'ios', 'https://www.dosport.online/api']
]) {
  test(`${envVersion} on ${platform} uses the reachable API`, () => {
    const sandbox = {
      module: { exports: {} },
      wx: {
        getAccountInfoSync: () => ({ miniProgram: { envVersion } }),
        getDeviceInfo: () => ({ platform })
      }
    }
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../config/config.js'), 'utf8'), sandbox)
    assert.equal(sandbox.module.exports.getConfig().baseURL, expected)
  })
}
