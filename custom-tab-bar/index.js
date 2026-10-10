// custom-tab-bar/index.js
Component({
  data: {
    selected: 0,
    color: "#7A858B",
    selectedColor: "#176B73",
    list: [
      {
        pagePath: "/pages/index/index",
        text: "首页",
        icon: "/images/icons/home.svg",
        selectedIcon: "/images/icons/home-active.svg"
      },
      {
        pagePath: "/pages/muscle/muscle",
        text: "锻炼",
        icon: "/images/icons/exercise.svg",
        selectedIcon: "/images/icons/exercise-active.svg"
      },
      {
        pagePath: "/pages/profile/profile",
        text: "我的",
        icon: "/images/icons/profile.svg",
        selectedIcon: "/images/icons/profile-active.svg"
      }
    ]
  },

  methods: {
    switchTab(e) {
      const data = e.currentTarget.dataset
      const url = data.path
      
      wx.switchTab({ url })
      
      this.setData({
        selected: data.index
      })
    }
  }
})
