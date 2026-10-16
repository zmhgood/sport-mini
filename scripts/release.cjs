// Build from the committed tree; the same version is embedded and sent to WeChat.
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const { execFileSync } = require('node:child_process')
const runtime = new Set(['app.js', 'app.json', 'app.wxss', 'sitemap.json', 'pages', 'components', 'custom-tab-bar', 'utils', 'images', 'assets', 'config', 'styles', 'resources'])
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex')

function prepareRelease(version, output, repo = path.resolve(__dirname, '..')) {
  if (!/^\d+(?:\.\d+){2,3}$/.test(version) || version.length > 64) throw Error('Invalid release version')
  const git = (...args) => execFileSync('git', args, { cwd: repo })
  const files = git('ls-tree', '-r', '--name-only', 'HEAD').toString().trim().split('\n')
    .filter(name => runtime.has(name.split('/')[0]))
  const dirty = git('diff', '--name-only', 'HEAD', '--', ...runtime).toString().trim()
  if (dirty) throw Error('Commit runtime changes before packaging')
  if (!files.includes('config/build-info.js')) throw Error('Build metadata template missing from commit')
  const commit = git('rev-parse', 'HEAD').toString().trim()
  const project = path.resolve(output)
  fs.mkdirSync(project) // Refuse to overwrite a previous release.
  const manifest = { version, commit, generatedFiles: ['config/build-info.js'], files: {} }
  for (const name of files) {
    const bytes = name === 'config/build-info.js'
      ? Buffer.from(`module.exports = ${JSON.stringify({ version, commit })}\n`)
      : git('show', `HEAD:${name}`)
    const target = path.join(project, 'miniprogram', name)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.writeFileSync(target, bytes)
    manifest.files[name] = hash(bytes)
  }
  const config = JSON.parse(git('show', 'HEAD:project.config.json').toString())
  config.miniprogramRoot = 'miniprogram/'
  config.projectname = `sport-mini-${version}`
  config.setting.urlCheck = true
  fs.writeFileSync(path.join(project, 'project.config.json'), JSON.stringify(config, null, 2))
  fs.writeFileSync(path.join(project, 'source-manifest.json'), JSON.stringify(manifest, null, 2))
  return { project, version, commit }
}

function uploadRelease(release) {
  const manifest = JSON.parse(fs.readFileSync(path.join(release.project, 'source-manifest.json')))
  const build = fs.readFileSync(path.join(release.project, 'miniprogram/config/build-info.js'), 'utf8')
  const expectedBuild = `module.exports = ${JSON.stringify({ version: release.version, commit: release.commit })}\n`
  if (manifest.version !== release.version || manifest.commit !== release.commit || build !== expectedBuild) {
    throw Error('Upload version does not match packaged build metadata')
  }
  for (const [name, expected] of Object.entries(manifest.files)) {
    if (hash(fs.readFileSync(path.join(release.project, 'miniprogram', name))) !== expected) throw Error('Package changed after build')
  }
  execFileSync('/Applications/wechatwebdevtools.app/Contents/MacOS/cli', [
    'upload', '--project', release.project, '--version', release.version,
    '--desc', `爸妈动起来 ${release.version}；Git ${release.commit.slice(0, 7)}`,
    '--info-output', path.join(release.project, 'upload-info.json')
  ], { stdio: 'inherit' })
}

if (require.main === module) {
  try {
    const [version, output, action] = process.argv.slice(2)
    if (!version || !output || (action && action !== '--upload')) throw Error('Usage: node scripts/release.cjs VERSION NEW_OUTPUT_DIR [--upload]')
    const release = prepareRelease(version, output)
    console.log(JSON.stringify(release))
    if (action === '--upload') uploadRelease(release)
  } catch (err) {
    console.error(err.message)
    process.exitCode = 1
  }
}
module.exports = { prepareRelease, uploadRelease }
