// pages/muscle/muscle.js
const api = require('../../utils/api')

Page({
  data: {
    currentTab: 0,
    tabs: ['上肢', '核心', '下肢'],
    muscleGroups: [],
    exercises: [],
    loading: true
  },

  onLoad(options) {
    const { groupId } = options
    if (groupId) {
      this.setData({ currentTab: parseInt(groupId) - 1 })
    }
    this.loadData()
  },

  onShow() {
    // 设置tabBar选中状态
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 })
    }
  },

  // 加载数据
  loadData() {
    this.getMuscleGroups()
    this.getExercises()
  },

  // 获取肌肉分组
  getMuscleGroups() {
    this.setData({
      muscleGroups: [
        {
          id: 1,
          name: '上肢',
          muscles: ['手臂', '肩部', '胸部'],
          image: '/images/muscle/arm.png',
          description: '增强上肢力量，提高日常活动能力'
        },
        {
          id: 2,
          name: '核心',
          muscles: ['腹部', '背部', '腰部'],
          image: '/images/muscle/core.png',
          description: '稳定身体重心，改善平衡能力'
        },
        {
          id: 3,
          name: '下肢',
          muscles: ['大腿', '小腿', '臀部'],
          image: '/images/muscle/leg.png',
          description: '增强行走能力，预防跌倒'
        }
      ]
    })
  },

  // 获取锻炼列表
  getExercises() {
    const groupId = this.data.currentTab + 1
    
    api.request('/exercises', 'GET', { groupId }).then(res => {
      if (res.code === 0) {
        this.setData({ exercises: res.data, loading: false })
      }
    }).catch(() => {
      // 模拟数据
      const mockData = {
        0: [
          { id: 1, name: '手臂环绕', targetMuscle: '肩部', difficulty: '简单', duration: 5, sets: 3, image: '/images/exercise1.png' },
          { id: 2, name: '坐姿推举', targetMuscle: '肩部、手臂', difficulty: '中等', duration: 8, sets: 3, image: '/images/exercise2.png' },
          { id: 3, name: '弹力带弯举', targetMuscle: '手臂前侧', difficulty: '简单', duration: 6, sets: 3, image: '/images/exercise3.png' }
        ],
        1: [
          { id: 4, name: '坐姿扭转', targetMuscle: '腹部、腰部', difficulty: '简单', duration: 5, sets: 3, image: '/images/exercise4.png' },
          { id: 5, name: '平板支撑', targetMuscle: '核心肌群', difficulty: '中等', duration: 3, sets: 3, image: '/images/exercise5.png' },
          { id: 6, name: '桥式运动', targetMuscle: '臀部、腰部', difficulty: '简单', duration: 6, sets: 3, image: '/images/exercise6.png' }
        ],
        2: [
          { id: 7, name: '坐姿抬腿', targetMuscle: '大腿前侧', difficulty: '简单', duration: 8, sets: 3, image: '/images/exercise7.png' },
          { id: 8, name: '靠墙静蹲', targetMuscle: '大腿、臀部', difficulty: '中等', duration: 5, sets: 3, image: '/images/exercise8.png' },
          { id: 9, name: '提踵练习', targetMuscle: '小腿', difficulty: '简单', duration: 5, sets: 3, image: '/images/exercise9.png' }
        ]
      }
      this.setData({ 
        exercises: mockData[this.data.currentTab] || [], 
        loading: false 
      })
    })
  },

  // 切换标签
  switchTab(e) {
    const index = e.currentTarget.dataset.index
    this.setData({ currentTab: index, loading: true })
    this.getExercises()
  },

  // 跳转到锻炼详情
  goToExercise(e) {
    const { id } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/pages/exercise/exercise?id=${id}`
    })
  },

  // 播放语音介绍
  playAudio(e) {
    const { name, targetMuscle } = e.currentTarget.dataset
    wx.showToast({
      title: '语音播放中',
      icon: 'none'
    })
    // 实际项目中可以使用 wx.createInnerAudioContext() 播放音频
  }
})
