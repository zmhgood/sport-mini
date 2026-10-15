// pages/goal/create.js
const api = require('../../utils/api')

const { categoryForExercise, loadAllExercises } = require('../../utils/exercise-category')

Page({
  data: {
    familyId: null,
    goalId: null,
    isEditing: false,
    planType: 'personal',
    participateInShared: true,
    isAdmin: false,
    currentUserId: null,
    executorId: null,
    name: '',
    members: [],
    selectedMemberCount: 0,
    selectedExercises: [],
    exerciseList: [],
    filteredExerciseList: [],
    currentCategory: 'all',
    selectedCount: 0,
    showExerciseModal: false,
    loading: false,
    membersLoading: false,
    membersLoaded: false,
    membersError: '',
    goalLoading: false,
    goalLoaded: false,
    goalError: ''
  },

  onLoad(options) {
    const currentUserId = wx.getStorageSync('userId') || (wx.getStorageSync('userInfo') || {}).id
    this.setData({ familyId: options.family_id, goalId: options.id || null, isEditing: !!options.id, currentUserId, executorId: currentUserId })
    if (options.id) wx.setNavigationBarTitle({ title: '编辑计划' })
    this.loadExercises()
    if (options.id) this.loadGoal(options.id).then(() => this.loadMembers())
    else this.loadMembers()
  },

  async loadMembers() {
    this.setData({ membersLoading: true, membersError: '' })
    if (!this.data.familyId) {
      this.setData({ membersLoading: false, membersError: '缺少家庭信息，请返回重试' })
      return
    }
    try {
      const res = await api.request(`/family/members?family_id=${this.data.familyId}`, 'GET')
      if (res.code !== 0 || !Array.isArray(res.data)) throw new Error('家庭成员加载失败')
      const members = res.data.map(m => ({
        ...m,
        user: m.user || {},
        selected: m.user_id == this.data.executorId
      }))
      const family = await api.request(`/family/${this.data.familyId}`, 'GET')
      if (family.code !== 0 || !family.data) throw new Error('家庭身份加载失败')
      const current = (family.data.members || []).find(m => m.user_id == this.data.currentUserId)
      const isAdmin = !!(current && current.role === 'admin')
      this.setData({ members, selectedMemberCount: 1, isAdmin, executorId: this.data.executorId || this.data.currentUserId, membersLoaded: true })
    } catch (err) {
      console.error('加载成员失败:', err)
      this.setData({ membersError: '家庭成员加载失败，请重试' })
    } finally {
      this.setData({ membersLoading: false })
    }
  },

  async loadGoal(goalId = this.data.goalId) {
    this.setData({ goalLoading: true, goalError: '' })
    try {
      const res = await api.request(`/goals/${goalId}`, 'GET')
      if (res.code !== 0 || !res.data) throw new Error('目标加载失败')
      const goal = res.data
      const pendingExercises = goal.pending_effective_date && goal.pending_exercises ? goal.pending_exercises : goal.exercises
      const members = this.data.members.map(m => ({ ...m, selected: m.user_id == goal.executor_id }))
      this.setData({ name: goal.name || '', planType: goal.plan_type || 'shared', executorId: goal.executor_id, members, selectedExercises: (pendingExercises || []).map(item => ({
        exercise_id: item.exercise_id,
        name: (item.exercise && item.exercise.name) || item.exercise_name || item.name || '',
        sets: item.sets,
        reps: item.reps
      })), goalLoaded: true })
    } catch (err) {
      wx.showToast({ title: '目标加载失败', icon: 'none' })
      this.setData({ goalError: '目标加载失败，请重试' })
    } finally {
      this.setData({ goalLoading: false })
    }
  },

  retryLoadGoal() {
    return this.loadGoal(this.data.goalId).then(() => this.loadMembers())
  },

  setPlanType(e) {
    if (this.data.isEditing) return
    this.setData({ planType: e.currentTarget.dataset.type })
  },

  toggleSharedParticipation() { this.setData({ participateInShared: !this.data.participateInShared }) },

  onExecutorChange(e) {
    if (this.data.isEditing) return
    const executorId = e.currentTarget.dataset.id
    this.setData({ executorId, members: this.data.members.map(m => ({ ...m, selected: m.user_id == executorId })) })
  },

  async loadExercises() {
    try {
      const items = await loadAllExercises(api)
      {
        // 为每个动作添加分类信息和选中状态
        const exerciseList = items.map(e => {
          const category = categoryForExercise(e)
          const groupInfo = { category: category === 'all' ? 'other' : category, name: ({ upper: '上肢', core: '核心', lower: '下肢' })[category] || '其他' }
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
    if (this.data.planType === 'shared') return
    const id = e.currentTarget.dataset.id
    if (!this.data.isAdmin && id != this.data.currentUserId) return
    const members = this.data.members.map(m => ({ ...m, selected: m.user_id == id }))
    this.setData({ members, selectedMemberCount: 1, executorId: id })
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
    if (this.data.loading || this._completed || this.data.membersLoading || !this.data.membersLoaded || this.data.membersError || this.data.goalLoading || this.data.goalError || (this.data.isEditing && !this.data.goalLoaded)) return
    if (!this.data.name.trim()) {
      wx.showToast({ title: '请输入目标名称', icon: 'none' })
      return
    }

    if (this.data.planType === 'personal' && !this.data.executorId) {
      wx.showToast({ title: '请选择计划成员', icon: 'none' })
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
        plan_type: this.data.planType,
        ...(this.data.planType === 'personal' ? { executor_id: Number(this.data.executorId) } : { member_ids: this.data.participateInShared && this.data.currentUserId ? [Number(this.data.currentUserId)] : [] }),
        exercises: this.data.selectedExercises.map(e => ({
          exercise_id: e.exercise_id,
          sets: e.sets,
          reps: e.reps
        }))
      }

      const signature = JSON.stringify(data)
      if (signature !== this._createSignature) {
        this._createSignature = signature
        this._requestKey = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2)
      }
      data.request_id = this._requestKey
      const res = this.data.isEditing
        ? await api.request(`/goals/${this.data.goalId}`, 'PUT', { name: data.name, exercises: data.exercises })
        : await api.request(`/goals?family_id=${this.data.familyId}`, 'POST', data)
      if (res.code === 0) {
        this._completed = true
        const pendingDate = res.data && res.data.pending_effective_date
        wx.showToast({ title: pendingDate ? `修改将于 ${pendingDate} 生效` : (this.data.isEditing ? '保存成功' : '创建成功'), icon: 'none', duration: 2200 })
        setTimeout(() => {
          wx.navigateBack()
        }, pendingDate ? 2600 : 1500)
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
