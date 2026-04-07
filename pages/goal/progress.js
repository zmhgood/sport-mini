// pages/goal/progress.js
const api = require('../../utils/api')

Page({
  data: {
    goalId: null,
    exercise: null,  // 当前锻炼的动作信息
    setsList: [],    // 组数列表，用于 checkbox
    completedSets: 0,
    completedPercent: 0,
    loading: false,
    
    // 进度查看模式
    myProgress: null,
    otherProgress: [],
    currentUserId: null,
    
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
    
    this.setData({ 
      currentUserId
    })
    
    // 判断是锻炼模式还是进度查看模式
    if (options.exercise) {
      // 锻炼模式：单个动作锻炼
      const exercise = JSON.parse(decodeURIComponent(options.exercise))
      this.setData({ 
        goalId: options.goal_id,
        exercise
      })
      this.initSetsList()
      this.loadExerciseProgress() // 加载已有进度
    } else if (options.goal_id) {
      // 进度查看模式
      this.setData({ goalId: options.goal_id })
      this.loadProgress()
    } else if (options.id) {
      // 兼容旧的路由方式
      this.setData({ goalId: options.id })
      this.loadProgress()
    }
  },

  onShow() {
    // 只有进度查看模式才需要刷新
    if (!this.data.exercise) {
      this.loadProgress()
    }
  },

  // 初始化组数列表
  initSetsList() {
    const { exercise } = this.data
    const setsList = []
    for (let i = 1; i <= exercise.sets; i++) {
      setsList.push({
        setNum: i,
        checked: false
      })
    }
    this.setData({ setsList, completedSets: 0, completedPercent: 0 })
  },

  // 加载当前动作的已有进度
  async loadExerciseProgress() {
    const { goalId, exercise, setsList } = this.data
    if (!exercise || !exercise.goal_exercise_id) return

    try {
      const res = await api.request(`/goals/${goalId}/progress`, 'GET')
      if (res.code === 0 && res.data) {
        // 找到当前用户的进度
        const myProgress = res.data.member_stats?.find(m => m.user_id == this.data.currentUserId)
        if (myProgress && myProgress.exercise_stats) {
          // 找到当前动作的进度
          const exerciseProgress = myProgress.exercise_stats.find(
            ex => ex.goal_exercise_id == exercise.goal_exercise_id
          )
          if (exerciseProgress && exerciseProgress.completed_sets > 0) {
            // 根据已完成组数更新 setsList
            const newSetsList = setsList.map((item, index) => ({
              ...item,
              checked: index < exerciseProgress.completed_sets
            }))
            const completedSets = exerciseProgress.completed_sets
            const completedPercent = Math.round((completedSets / exercise.sets) * 100)
            this.setData({ setsList: newSetsList, completedSets, completedPercent })
          }
        }
      }
    } catch (err) {
      console.error('加载进度失败:', err)
    }
  },

  // 切换组数选择
  toggleSet(e) {
    const index = e.currentTarget.dataset.index
    const setsList = this.data.setsList
    setsList[index].checked = !setsList[index].checked
    
    // 计算已完成的组数
    const completedSets = setsList.filter(s => s.checked).length
    const completedPercent = Math.round((completedSets / this.data.exercise.sets) * 100)
    
    this.setData({ setsList, completedSets, completedPercent })
  },

  // 提交进度
  async submitProgress() {
    const { goalId, exercise, completedSets } = this.data
    
    if (completedSets === 0) {
      wx.showToast({ title: '请至少完成一组', icon: 'none' })
      return
    }

    if (!exercise || !exercise.goal_exercise_id) {
      wx.showToast({ title: '动作信息不完整', icon: 'none' })
      return
    }

    this.setData({ loading: true })
    try {
      const res = await api.request(`/goals/${goalId}/complete`, 'POST', {
        goal_exercise_id: exercise.goal_exercise_id,
        completed_sets: completedSets
      })
      console.log('提交结果:', res)
      if (res.code === 0) {
        wx.showToast({ title: '记录成功', icon: 'success' })
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      } else {
        wx.showToast({ title: res.message || '提交失败', icon: 'none' })
      }
    } catch (err) {
      console.error('提交失败:', err)
      wx.showToast({ title: '提交失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  // 进度查看模式的方法
  async loadProgress() {
    try {
      const res = await api.request(`/goals/${this.data.goalId}/progress`, 'GET')
      if (res.code === 0 && res.data) {
        const progress = res.data
        const colors = this.data.segmentColors
        
        // 找到当前用户的进度
        const myProgress = progress.member_stats?.find(m => m.user_id == this.data.currentUserId)
        if (myProgress && myProgress.exercise_stats) {
          myProgress.exercise_stats.forEach((ex, index) => {
            ex.color = colors[index % colors.length]
            ex.segment_width = myProgress.total_sets > 0 
              ? Math.round(ex.target_sets / myProgress.total_sets * 100) 
              : 0
            ex.fill_width = ex.target_sets > 0 
              ? Math.round(ex.completed_sets / ex.target_sets * 100) 
              : 0
          })
        }
        
        // 其他成员的进度
        const otherProgress = progress.member_stats?.filter(m => m.user_id != this.data.currentUserId) || []
        otherProgress.forEach(member => {
          if (member.exercise_stats) {
            member.exercise_stats.forEach((ex, index) => {
              ex.color = colors[index % colors.length]
              ex.segment_width = member.total_sets > 0 
                ? Math.round(ex.target_sets / member.total_sets * 100) 
                : 0
              ex.fill_width = ex.target_sets > 0 
                ? Math.round(ex.completed_sets / ex.target_sets * 100) 
                : 0
            })
          }
        })

        this.setData({ 
          myProgress,
          otherProgress
        })
      }
    } catch (err) {
      console.error('加载进度失败:', err)
    }
  },

  async updateProgress(exerciseId, completedSets) {
    try {
      const res = await api.request(`/goals/${this.data.goalId}/complete`, 'POST', {
        goal_exercise_id: exerciseId,
        completed_sets: completedSets
      })
      if (res.code === 0) {
        this.loadProgress()
      }
    } catch (err) {
      wx.showToast({ title: '更新失败', icon: 'none' })
    }
  },

  decreaseSets(e) {
    const goalExerciseId = e.currentTarget.dataset.id
    const exercise = this.data.myProgress.exercise_stats.find(ex => ex.goal_exercise_id == goalExerciseId)
    if (exercise && exercise.completed_sets > 0) {
      this.updateProgress(goalExerciseId, exercise.completed_sets - 1)
    }
  },

  increaseSets(e) {
    const goalExerciseId = e.currentTarget.dataset.id
    const exercise = this.data.myProgress.exercise_stats.find(ex => ex.goal_exercise_id == goalExerciseId)
    if (exercise && exercise.completed_sets < exercise.target_sets) {
      this.updateProgress(goalExerciseId, exercise.completed_sets + 1)
    }
  }
})
