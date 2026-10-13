const names = {
  '上肢': 'upper', '胸部': 'upper', '肩部': 'upper', '手臂': 'upper',
  '核心': 'core', '背部': 'core',
  '下肢': 'lower', '腿部': 'lower'
}
// Legacy list responses may omit the group object. Prefer its actual name.
const legacy = { 2: 'upper', 3: 'lower', 4: 'core', 5: 'core', 6: 'upper', 7: 'upper', 8: 'upper', 9: 'lower' }

function categoryForExercise(exercise) {
  const groupName = exercise.muscle_group && exercise.muscle_group.name
  return groupName ? (names[groupName] || 'all') : (legacy[exercise.muscle_group_id] || 'all')
}

async function loadAllExercises(api) {
  const list = []
  let page = 1
  while (true) {
    const res = await api.request('/exercises', 'GET', { page, page_size: 100 })
    if (res.code !== 0) throw new Error(res.message || '动作加载失败')
    const items = res.data && (res.data.list || res.data)
    if (!Array.isArray(items)) throw new Error('动作响应格式错误')
    list.push(...items)
    if (!items.length || !res.data.total || list.length >= res.data.total) return list
    page++
  }
}

module.exports = { categoryForExercise, loadAllExercises }
