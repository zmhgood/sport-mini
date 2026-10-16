const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const vm = require('node:vm')
const { execFileSync } = require('node:child_process')
const { prepareRelease, uploadRelease } = require('../scripts/release.cjs')
const { loadPage, visibleText } = require('./page-harness')
const buildInfo = require('../config/build-info')

for (const [envVersion, apiVersion, builtVersion, expected] of [
  ['trial', '', '1.0.20261016.6', 'v1.0.20261016.6'],
  ['trial', undefined, '1.0.20261016.6', 'v1.0.20261016.6'],
  ['trial', '1.0.0', '1.0.20261016.6', 'v1.0.20261016.6'],
  ['release', '2.0.0', '1.0.20261016.6', 'v2.0.0'],
  ['release', '', '1.0.20261016.6', 'v1.0.20261016.6'],
  ['develop', '', '1.0.20261016.6', '开发版']
]) {
  test(`footer ${envVersion}/${apiVersion} with a packaged version`, () => {
    const previous = buildInfo.version
    try {
      buildInfo.version = builtVersion
      const { page } = loadPage('pages/profile/profile.js', async () => ({ code: 0 }), {}, {
        wx: { getAccountInfoSync: () => ({ miniProgram: { envVersion, version: apiVersion } }) }
      })
      page.loadVersion()
      assert.equal(page.data.versionText, expected)
      assert.ok(visibleText('pages/profile/profile.wxml', page.data).includes(`爸妈动起来 ${expected}`))
    } finally { buildInfo.version = previous }
  })
}

test('committed package embeds its upload version and rejects version mismatch or tampering', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'sport-release-version-'))
  t.after(() => fs.rmSync(root, { recursive: true, force: true }))
  const repo = path.join(root, 'repo'); fs.mkdirSync(repo)
  for (const name of ['config/build-info.js', 'pages/profile/profile.js', 'project.config.json']) {
    const target = path.join(repo, name); fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.copyFileSync(path.join(__dirname, '..', name), target)
  }
  const git = (...args) => execFileSync('git', args, { cwd: repo, stdio: 'pipe' })
  git('init'); git('add', '.')
  git('-c', 'core.hooksPath=/dev/null', '-c', 'commit.gpgsign=false', '-c', 'user.name=QA', '-c', 'user.email=qa@example.invalid', 'commit', '-m', 'synthetic package')
  const release = prepareRelease('1.0.20261016.6', path.join(root, 'package'), repo)
  const built = require(path.join(release.project, 'miniprogram/config/build-info.js'))
  assert.equal(built.version, release.version)
  assert.equal(built.commit, release.commit)
  let page
  vm.runInNewContext(fs.readFileSync(path.join(release.project, 'miniprogram/pages/profile/profile.js'), 'utf8'), {
    Page: value => { page = value },
    require: name => name.endsWith('build-info') ? built : name.endsWith('font-size') ? { withFontSize: value => value } : {},
    wx: { getAccountInfoSync: () => ({ miniProgram: { envVersion: 'trial', version: '' } }) }
  })
  page.setData = value => Object.assign(page.data, value)
  page.loadVersion(); assert.equal(page.data.versionText, 'v1.0.20261016.6')
  assert.throws(() => uploadRelease({ ...release, version: '1.0.20261016.7' }), /does not match/)
  fs.appendFileSync(path.join(release.project, 'miniprogram/pages/profile/profile.js'), '\n// changed')
  assert.throws(() => uploadRelease(release), /changed after build/)
  assert.throws(() => prepareRelease('bad version', path.join(root, 'invalid'), repo), /Invalid release/)
})
