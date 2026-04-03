// pages/goal/create.js
const api = require('../../utils/api')

// 分类映射
const GROUP_ID_TO_CATEGORY = {
  1: { category: 'upper', name: '上肢' },
  2: { category: 'core', name: '核心' },
  3: { category: 'lower', name: '下肢' }
}

Page({
  data: {
    familyId: null,
    name: '',
    members: [],
    selectedMemberCount: 0,
    selectedExercises: [],
    exerciseList: [],
    filteredExerciseList: [],
    currentCategory: 'all',
    selectedCount: 0,
    showExerciseModal: false,
    loading: false
  },

  onLoad(options) {
    this.setData({ familyId: options.family_id })
    this.loadMembers()
    this.loadExercises()
  },

  async loadMembers() {
    if (!this.data.familyId) {
      console.error('缺少family_id参数')
      return
    }
    try {
      const res = await api.request(`/family/members?family_id=${this.data.familyId}`, 'GET')
      if (res.code === 0) {
        const members = (res.data || []).map(m => ({
          ...m,
          user: m.user || {},
          selected: true // 默认全选
        }))
        const selectedMemberCount = members.filter(m => m.selected).length
        this.setData({ members, selectedMemberCount })
      }
    } catch (err) {
      console.error('加载成员失败:', err)
    }
  },

  async loadExercises() {
    try {
      const res = await api.request('/exercises?page=1&page_size=100', 'GET')
      if (res.code === 0) {
        // 为每个动作添加分类信息和选中状态
        const exerciseList = (res.data.list || []).map(e => {
          const groupInfo = GROUP_ID_TO_CATEGORY[e.muscle_group_id] || { category: 'other', name: '其他' }
          return {
            ...e,
            _selected: false,
            _category: groupInfo.category,
            _categoryName: groupInfo.name
          }
        })
        this.setData({ exerciseList, filteredExerciseList: exerciseList })
      }
    } catch (err) {
      console.error('加载动作失败:', err)
    }
  },

  onNameInput(e) {
    this.setData({ name: e.detail.value })
  },

  toggleMember(e) {
    const id = e.currentTarget.dataset.id
    const members = this.data.members.map(m => {
      if (m.user_id == id) {  // 使用宽松比较，兼容数字和字符串类型
        return { ...m, selected: !m.selected }
      }
      return m
    })
    const selectedMemberCount = members.filter(m => m.selected).length
    this.setData({ members, selectedMemberCount })
  },

  // 切换分类
  switchCategory(e) {
    const category = e.currentTarget.dataset.category
    const { exerciseList } = this.data
    let filtered = exerciseList
    if (category !== 'all') {
      filtered = exerciseList.filter(e => e._category === category)
    }
    this.setData({ currentCategory: category, filteredExerciseList: filtered })
  },

  addExercise() {
    // 打开弹窗前，同步已选择状态到 exerciseList
    const selectedIds = this.data.selectedExercises.map(e => e.exercise_id)
    const exerciseList = this.data.exerciseList.map(e => ({
      ...e,
      _selected: selectedIds.includes(e.id)
    }))
    // 重置分类为全部
    this.setData({ 
      exerciseList, 
      currentCategory: 'all',
      filteredExerciseList: exerciseList,
      selectedCount: selectedIds.length,
      showExerciseModal: true 
    })
  },

  closeExerciseModal() {
    this.setData({ showExerciseModal: false })
  },

  stopPropagation() {
    // 阻止事件冒泡，空函数
  },

  selectExercise(e) {
    const item = e.currentTarget.dataset.item
    const exerciseList = this.data.exerciseList.map(ex => {
      if (ex.id === item.id) {
        return { ...ex, _selected: !ex._selected }
      }
      return ex
    })
    const selectedCount = exerciseList.filter(e => e._selected).length
    // 同时更新筛选列表
    let filtered = exerciseList
    if (this.data.currentCategory !== 'all') {
      filtered = exerciseList.filter(e => e._category === this.data.currentCategory)
    }
    this.setData({ exerciseList, filteredExerciseList: filtered, selectedCount })
  },

  confirmExercises() {
    // 确认选择，将选中的动作添加到 selectedExercises
    const selectedItems = this.data.exerciseList.filter(e => e._selected)
    
    // 保留已设置过组数次数的，新添加的使用默认值
    const selectedExercises = selectedItems.map(item => {
      const existing = this.data.selectedExercises.find(e => e.exercise_id === item.id)
      if (existing) {
        return existing
      }
      return {
        exercise_id: item.id,
        name: item.name,
        sets: 3,
        reps: 10
      }
    })
    
    this.setData({ selectedExercises, showExerciseModal: false })
  },

  onSetsInput(e) {
    const index = e.currentTarget.dataset.index
    const value = parseInt(e.detail.value) || 0
    const selectedExercises = this.data.selectedExercises
    selectedExercises[index].sets = value
    this.setData({ selectedExercises })
  },

  onRepsInput(e) {
    const index = e.currentTarget.dataset.index
    const value = parseInt(e.detail.value) || 0
    const selectedExercises = this.data.selectedExercises
    selectedExercises[index].reps = value
    this.setData({ selectedExercises })
  },

  removeExercise(e) {
    const index = e.currentTarget.dataset.index
    const selectedExercises = this.data.selectedExercises
    selectedExercises.splice(index, 1)
    this.setData({ selectedExercises })
  },

  async createGoal() {
    if (!this.data.name.trim()) {
      wx.showToast({ title: '请输入目标名称', icon: 'none' })
      return
    }

    const selectedMembers = this.data.members.filter(m => m.selected)
    if (selectedMembers.length === 0) {
      wx.showToast({ title: '请选择至少一个成员', icon: 'none' })
      return
    }

    if (this.data.selectedExercises.length === 0) {
      wx.showToast({ title: '请添加至少一个动作', icon: 'none' })
      return
    }

    this.setData({ loading: true })
    try {
      const data = {
        name: this.data.name,
        member_ids: selectedMembers.map(m => m.user_id),
        exercises: this.data.selectedExercises.map(e => ({
          exercise_id: e.exercise_id,
          sets: e.sets,
          reps: e.reps
        }))
      }

      const res = await api.request(`/goals?family_id=${this.data.familyId}`, 'POST', data)
      if (res.code === 0) {
        wx.showToast({ title: '创建成功', icon: 'success' })
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      } else {
        wx.showToast({ title: res.message || '创建失败', icon: 'none' })
      }
    } catch (err) {
      wx.showToast({ title: '创建失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  }
})
