// Device preference; independent of login and family data.
const FONT_OPTIONS = [
  { id: 'standard', label: '标准', scale: 1 },
  { id: 'large', label: '大号', scale: 1.15 },
  { id: 'extraLarge', label: '特大', scale: 1.3 }
]
const STORAGE_KEY = 'fontSizePreference'

function getFontSize(platform) {
  return FONT_OPTIONS.find(item => item.id === platform.getStorageSync(STORAGE_KEY)) || FONT_OPTIONS[0]
}

function applyFontSize(page, platform) {
  const option = getFontSize(platform)
  const style = `--app-font-scale: ${option.scale}; --app-tab-height: ${112 + Math.round((option.scale - 1) * 50)}rpx;`
  const update = { fontSizeId: option.id, fontSizeLabel: option.label, fontPageStyle: style }
  if (page.data.settings) update.settings = page.data.settings.map(item => item.id === 'fontSize' ? { ...item, value: option.label } : item)
  page.setData(update)
  const tab = typeof page.getTabBar === 'function' && page.getTabBar()
  if (tab) tab.setData({ fontPageStyle: style })
}

function withFontSize(definition, platform) {
  const onShow = definition.onShow
  return {
    ...definition,
    data: { fontPageStyle: '--app-font-scale: 1; --app-tab-height: 112rpx;', ...definition.data },
    onShow(...args) {
      applyFontSize(this, platform)
      return onShow && onShow.apply(this, args)
    }
  }
}

function saveFontSize(id, platform) {
  if (!FONT_OPTIONS.some(item => item.id === id)) return false
  platform.setStorageSync(STORAGE_KEY, id)
  return true
}

module.exports = { FONT_OPTIONS, getFontSize, applyFontSize, withFontSize, saveFontSize }
