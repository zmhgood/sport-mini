// pages/goal/detail.js
const api = require('../../utils/api')

Page({
  data: {
    goalId: null,
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
    this.loadGoal()
    this.loadProgress(selectedDate)
  },

  onShow() {
    this.loadProgress(this.data.selectedDate)
  },

  async loadGoal() {
    try {
      const res = await api.request(`/goals/${this.data.goalId}`, 'GET')
      if (res.code === 0) {
        const goal = res.data || {}
        goal.memberCount = (goal.members && goal.members.length) || 0
        goal.exerciseCount = (goal.exercises && goal.exercises.length) || 0
        this.setData({ goal })
      }
    } catch (err) {
      console.error('加载目标失败:', err)
    }
  },

  async loadProgress(date) {
    try {
      const queryDate = date || ''
      const dateParam = queryDate ? `?date=${queryDate}` : ''
      const res = await api.request(`/goals/${this.data.goalId}/progress${dateParam}`, 'GET')
      if (res.code === 0) {
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
              completed_sets: member.completed_sets || 0,
              total_sets: member.total_sets || 0,
              progress_percent: member.total_sets > 0 
                ? Math.round(member.completed_sets / member.total_sets * 100) 
                : 0
            })
          })
        }
        this.setData({ progress, exerciseStatus, memberProgressList })
      }
    } catch (err) {
      console.error('加载进度失败:', err)
    }
  },

  goProgress() {
    wx.navigateTo({ url: `/pages/goal/progress?id=${this.data.goalId}` })
  },

  startExercise(e) {
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
