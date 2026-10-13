// pages/goal/detail.js
const api = require('../../utils/api')

Page({
  data: {
    loading: true,
    loadError: '',
    goalId: null,
    starting: false,
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
      this.setData({ goal, ...progressData })
    } catch (err) {
      this.setData({ loadError: '目标信息加载失败，请重试' })
    } finally {
      this._loadInProgress = false
      this.setData({ loading: false })
    }
  },

  async loadGoal() {
    const res = await api.request(`/goals/${this.data.goalId}`, 'GET')
    if (res.code !== 0 || !res.data) throw new Error('目标详情加载失败')
    const goal = res.data
    goal.memberCount = (goal.members && goal.members.length) || 0
    goal.exerciseCount = (goal.exercises && goal.exercises.length) || 0
    return goal
  },

  async loadProgress(date) {
    const queryDate = date || ''
    const dateParam = queryDate ? `?date=${queryDate}` : ''
    const res = await api.request(`/goals/${this.data.goalId}/progress${dateParam}`, 'GET')
    if (res.code !== 0 || !res.data) throw new Error('目标进度加载失败')
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
    wx.navigateTo({ url: `/pages/goal/progress?id=${this.data.goalId}` })
  },

  async startExercise(e) {
    if (this.data.starting || this.data.loading || this.data.loadError) return
    const { goal, currentUserId, goalId } = this.data
    if (!currentUserId) {
      wx.navigateTo({ url: '/pages/login/login' })
      return
    }
    this.setData({ starting: true })
    try {
      const participating = (goal.members || []).some(member => member.user_id == currentUserId)
      if (!participating) {
        const confirmed = await new Promise(resolve => wx.showModal({
          title: '加入锻炼目标',
          content: '您还未参与这个目标。加入后即可记录自己的锻炼进度。',
          confirmText: '加入并锻炼',
          success: result => resolve(result.confirm),
          fail: () => resolve(false)
        }))
        if (!confirmed) return
        const res = await api.request(`/goals/${goalId}/members`, 'POST', { user_id: Number(currentUserId) })
        if (res.code !== 0) throw new Error(res.message || '加入目标失败')
        // 刷新参与状态，防止返回后再次重复加入。
        const updatedGoal = await this.loadGoal()
        this.setData({ goal: updatedGoal })
      }
      this.openExercise(e)
    } catch (err) {
      wx.showToast({ title: err.message || '开始锻炼失败，请重试', icon: 'none' })
    } finally {
      this.setData({ starting: false })
    }
  },

  openExercise(e) {
    const item = e.currentTarget.dataset.item
    // 跳转到锻炼执行页面，传递动作信息
    const exerciseData = encodeURIComponent(JSON.stringify({
      goal_exercise_id: item.id,
      exercise_id: item.exercise_id,
      name: item.exercise.name,
      sets: item.sets,
      reps: item.reps,
      image_url: item.exercise.image_url
    }))
    wx.navigateTo({ 
      url: `/pages/goal/progress?goal_id=${this.data.goalId}&exercise=${exerciseData}`
    })
  }
})
