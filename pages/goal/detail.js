// pages/goal/detail.js
const api = require('../../utils/api')

Page({
  data: {
    loading: true,
    loadError: '',
    goalId: null,
    starting: false,
    actionLoading: false,
    showMore: false,
    previewExercise: null,
    previewExerciseId: 0,
    partialSets: {},
    progressDate: '',
    canRecord: false,
    canSubmit: false,
    currentDate: '',
    historicalView: false,
    goal: null,
    progress: null,
    currentUserId: null,
    selectedDate: '',
    exerciseStatus: {}, // 每个动作的完成状态
    memberProgressList: [], // 参与成员进度列表
    // 分段进度条颜色
    segmentColors: ['#EF4444', '#3B82F6', '#22C55E', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16']
  },

  onLoad(options) {
    // 兼容处理：优先从 userId 获取，否则从 userInfo 获取
    let currentUserId = wx.getStorageSync('userId')
    if (!currentUserId) {
      const userInfo = wx.getStorageSync('userInfo')
      currentUserId = userInfo ? userInfo.id : null
    }

    const selectedDate = options.date || ''
    
    this.setData({ 
      goalId: options.id,
      currentUserId,
      selectedDate
    })
  },

  onShow() {
    this.loadDetails()
  },

  async loadDetails() {
    if (this._loadInProgress) return
    this._loadInProgress = true
    this.setData({ loading: true, loadError: '' })
    try {
      const [goal, progressData] = await Promise.all([
        this.loadGoal(),
        this.loadProgress(this.data.selectedDate)
      ])
      goal.memberCount = (progressData.progress.member_stats || []).filter(member => member.is_current_member !== false).length
      const progressDate = progressData.progress.date || this.data.selectedDate || goal.current_date
      const canRecord = goal.plan_type === 'personal'
        ? goal.executor_id == this.data.currentUserId
        : !!goal.is_participating
      const currentDate = goal.current_date || ''
      const canSubmit = canRecord && !!currentDate && progressDate === currentDate && goal.is_active !== false && goal.is_active !== 0
      const historicalView = !!(currentDate && progressDate && progressDate !== currentDate)
      if (historicalView) {
        goal.exercises = (progressData.progress.exercises || []).map(item => ({ ...item, exercise: item.exercise || {} }))
        goal.exerciseCount = goal.exercises.length
      }
      this.setData({ goal, ...progressData, progressDate, currentDate, canRecord, canSubmit, historicalView })
    } catch (err) {
      this.setData({ loadError: '计划信息加载失败，请重试' })
    } finally {
      this._loadInProgress = false
      this.setData({ loading: false })
    }
  },

  async loadGoal() {
    const res = await api.request(`/goals/${this.data.goalId}`, 'GET')
    if (res.code !== 0 || !res.data) throw new Error('计划详情加载失败')
    const goal = res.data
    goal.plan_type = goal.plan_type || 'shared'
    goal.memberCount = (goal.members && goal.members.length) || 0
    goal.exerciseCount = (goal.exercises && goal.exercises.length) || 0
    goal.exercises = (goal.exercises || []).map(item => ({ ...item, exercise: item.exercise || {} }))
    return goal
  },

  async loadProgress(date) {
    const queryDate = date || ''
    const dateParam = queryDate ? `?date=${queryDate}` : ''
    const res = await api.request(`/goals/${this.data.goalId}/progress${dateParam}`, 'GET')
    if (res.code !== 0 || !res.data) throw new Error('计划进度加载失败')
    const progress = res.data
    // 为每个动作添加颜色和计算进度
    const colors = this.data.segmentColors
    const exerciseStatus = {}

    if (progress && progress.member_stats) {
      progress.member_stats.forEach(member => {
        if (member.exercise_stats) {
          member.exercise_stats.forEach((ex, index) => {
            ex.color = colors[index % colors.length]
            // 计算段的宽度百分比
            ex.segment_width = member.total_sets > 0
              ? Math.round(ex.target_sets / member.total_sets * 100)
              : 0
            // 计算段内填充百分比
            ex.fill_width = ex.target_sets > 0
              ? Math.round(ex.completed_sets / ex.target_sets * 100)
              : 0

            // 记录当前用户每个动作的完成状态
            if (member.user_id == this.data.currentUserId) {
              exerciseStatus[ex.goal_exercise_id] = {
                completed_sets: ex.completed_sets,
                target_sets: ex.target_sets,
                status: ex.status,
                is_done: ex.completed_sets >= ex.target_sets,
                has_progress: ex.completed_sets > 0 && ex.completed_sets < ex.target_sets
              }
            }
          })
        }
      })
    }
    // 构建参与成员进度列表
    const memberProgressList = []
    if (progress && progress.member_stats) {
      progress.member_stats.forEach(member => {
        memberProgressList.push({
          user_id: member.user_id,
          user_name: member.user_name,
          user_avatar: member.user_avatar,
          is_current_member: member.is_current_member,
          completed_sets: member.completed_sets || 0,
          total_sets: member.total_sets || 0,
          progress_percent: member.total_sets > 0
            ? Math.round(member.completed_sets / member.total_sets * 100)
            : 0
        })
      })
    }
    return { progress, exerciseStatus, memberProgressList }
  },


  goProgress() {
    wx.navigateTo({ url: `/pages/goal/progress?id=${this.data.goalId}&date=${this.data.progressDate || (this.data.goal || {}).current_date || ''}` })
  },

  toggleMore() { this.setData({ showMore: !this.data.showMore }) },

  editGoal() {
    if (!this.data.goal || !this.data.goal.can_manage) return
    wx.navigateTo({ url: `/pages/goal/create?id=${this.data.goalId}&family_id=${this.data.goal.family_id || ''}` })
  },

  async setGoalActive(e) {
    if (this.data.actionLoading || !this.data.goal || !this.data.goal.can_manage) return
    const active = e.currentTarget.dataset.active === 'true'
    this.setData({ actionLoading: true })
    try {
      const res = await api.request(`/goals/${this.data.goalId}`, 'PUT', { is_active: active })
      if (res.code !== 0) throw new Error(res.message || '操作失败')
      await this.loadDetails()
      wx.showToast({ title: active ? '计划已恢复' : '计划已暂停', icon: 'success' })
    } catch (err) { wx.showToast({ title: err.message || '操作失败', icon: 'none' }) }
    finally { this.setData({ actionLoading: false, showMore: false }) }
  },

  async joinGoal() {
    const { goal, goalId, currentUserId } = this.data
    if (!goal || goal.plan_type !== 'shared' || goal.is_participating || this.data.starting) return
    if (!currentUserId) { wx.navigateTo({ url: '/pages/login/login' }); return }
    this.setData({ starting: true })
    try {
      const res = await api.request(`/goals/${goalId}/members`, 'POST', { user_id: Number(currentUserId) })
      if (res.code !== 0) throw new Error(res.message || '加入失败')
      await this.loadDetails()
      wx.showToast({ title: '已加入并开始', icon: 'success' })
    } catch (err) { wx.showToast({ title: err.message || '加入失败，请重试', icon: 'none' }) }
    finally { this.setData({ starting: false }) }
  },

  leaveGoal() {
    if (!this.data.goal || this.data.goal.plan_type !== 'shared' || !this.data.goal.is_participating) return
    wx.showModal({ title: '退出共同计划', content: '退出后将不再记录你的计划进度。', success: async result => {
      if (!result.confirm) return
      this.setData({ actionLoading: true })
      try {
        const res = await api.request(`/goals/${this.data.goalId}/members/me`, 'DELETE')
        if (res.code !== 0) throw new Error(res.message || '退出失败')
        await this.loadDetails()
        wx.showToast({ title: '已退出计划', icon: 'success' })
      } catch (err) { wx.showToast({ title: err.message || '退出失败，请重试', icon: 'none' }) }
      finally { this.setData({ actionLoading: false, showMore: false }) }
    } })
  },

  async startExercise(e) {
    if (this.data.starting || this.data.loading || this.data.loadError) return
    const { goal, currentUserId, goalId } = this.data
    if (!currentUserId) {
      wx.navigateTo({ url: '/pages/login/login' })
      return
    }
    if (goal.plan_type === 'personal' && goal.executor_id != currentUserId) return
    if (goal.plan_type === 'shared' && !goal.is_participating) return
    this.openExercise(e)
  },

  async completeAll(e) {
    const item = e.currentTarget.dataset.item
    if (this.data.actionLoading || !this.mayRecord()) return
    await this.saveCompletion(item.id, item.sets)
  },

  mayRecord() {
    const goal = this.data.goal || {}
    const participant = goal.plan_type === 'personal'
      ? goal.executor_id == this.data.currentUserId
      : !!goal.is_participating
    return participant && this.data.canSubmit && this.data.progressDate === goal.current_date
  },

  togglePartial(e) {
    const item = e.currentTarget.dataset.item
    const partialSets = { ...this.data.partialSets }
    if (partialSets[item.id]) { delete partialSets[item.id] } else {
      partialSets[item.id] = Array.from({ length: Number(item.sets) || 0 }, (_, i) => i < (this.data.exerciseStatus[item.id] || {}).completed_sets)
    }
    this.setData({ partialSets })
  },

  togglePartialSet(e) {
    const { id, index } = e.currentTarget.dataset
    const partialSets = { ...this.data.partialSets, [id]: [...this.data.partialSets[id]] }
    partialSets[id][index] = !partialSets[id][index]
    this.setData({ partialSets })
  },

  async savePartial(e) {
    const id = e.currentTarget.dataset.id
    await this.saveCompletion(id, (this.data.partialSets[id] || []).filter(Boolean).length)
  },

  async saveCompletion(goalExerciseId, completedSets) {
    if (this.data.actionLoading || !this.mayRecord() || completedSets < 1) return
    this.setData({ actionLoading: true })
    try {
      const res = await api.request(`/goals/${this.data.goalId}/complete`, 'POST', {
        goal_exercise_id: goalExerciseId,
        completed_sets: completedSets,
        date: this.data.progressDate || (this.data.goal || {}).current_date
      })
      if (res.code !== 0) throw new Error(res.message || '记录失败')
      await this.loadDetails()
      this.setData({ partialSets: { ...this.data.partialSets, [goalExerciseId]: null } })
      wx.showToast({ title: '已记录', icon: 'success' })
    } catch (err) { wx.showToast({ title: err.message || '记录失败，请重试', icon: 'none' }) }
    finally { this.setData({ actionLoading: false }) }
  },

  showExercisePreview(e) {
    const item = e.currentTarget.dataset.item
    if (!item) return
    this.setData({ previewExercise: { ...item.exercise, name: item.exercise?.name || item.exercise_name || item.name }, previewExerciseId: Number(item.exercise_id || item.exercise?.id) || 0 })
  },

  closeExercisePreview() {
    this.setData({ previewExercise: null, previewExerciseId: 0 })
  },

  stopPropagation() {},

  openExercise(e) {
    const item = e.currentTarget.dataset.item
    wx.navigateTo({ url: `/pages/exercise/exercise?id=${item.exercise_id}` })
  }
})
