const DEFAULT_BANNER_IMAGE = '/images/exercise/default-exercise.jpg'
const DEFAULT_BANNERS = [{ id: 0, title: '带着家人一起动起来吧', description: '每天动一动，一起养成锻炼习惯', image_url: DEFAULT_BANNER_IMAGE }]

function bannerItems(data) {
  if (!data || typeof data.configured !== 'boolean' || !Array.isArray(data.items) || data.items.length > 10) throw new Error('轮播图响应无效')
  if (!data.configured) return DEFAULT_BANNERS.map(item => ({ ...item }))
  const ids = new Set()
  return data.items.map(item => {
    if (!item || !Number.isSafeInteger(item.id) || item.id <= 0 || ids.has(item.id) || item.enabled !== true ||
        typeof item.title !== 'string' || typeof item.description !== 'string' ||
        typeof item.image_url !== 'string' || !item.image_url.startsWith('https://')) throw new Error('轮播图响应无效')
    ids.add(item.id)
    return { id: item.id, title: item.title, description: item.description, image_url: item.image_url }
  })
}

module.exports = { DEFAULT_BANNER_IMAGE, DEFAULT_BANNERS, bannerItems }
