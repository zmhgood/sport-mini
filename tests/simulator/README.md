# 官方模拟器布局回归

使用原微信开发者工具项目，不启动第二份项目。依赖官方 `miniprogram-automator`；端口为本机 `9420`。

```bash
/Applications/wechatwebdevtools.app/Contents/MacOS/cli auto --project /Users/zmh/CodeBuddy/20260227183322 --auto-port 9420
export MINI_AUTOMATOR_PATH=/path/to/miniprogram-automator
export MINI_QA_OUTPUT=/tmp/sport-mini-layout-qa
node tests/simulator/family-layout.cjs device-label
node tests/simulator/surfaces.cjs device-label
node tests/simulator/pages.cjs device-label
```

在工具里选择机型并等待实际重新载入；如旧上下文不更新，用新的 `--auto-port` 重新运行官方 `auto` 命令，同时将 `MINI_AUTOMATOR_ENDPOINT` 设为对应的 `ws://127.0.0.1:端口`。三份脚本串行执行，前一轮结束后才能切换尺寸。结果记录实际 `systemInfo`，不能仅根据标签判断机型。仅使用虚构资料与模拟请求；非 GET 请求被拒绝并记录，发生业务写入或运行异常则失败。不要点击真实登录、保存、加入、创建或提交按钮。

- `family-layout.cjs`：1个/12个家庭、长名称、弹层遮挡、安全区、列表滚动、关闭后底栏恢复。
- `surfaces.cjs`：三个一级页面、个人页页脚、目标提交按钮、15动作选择弹窗、首末项选择、确认、长文字与图片比例。
- `pages.cjs`：登录、资料编辑、加入/创建家庭、家庭详情、目标列表/详情/创建、锻炼填写/进度查看、动作详情、历史、协议、隐私、媒体查看；输入绑定、至少44px按钮、末尾可达和横向边界。可用 `QA_CASE='profile edit'` 单独运行一个场景。

动作选择通过 WXML `tap` 事件加独立状态回读验证绑定；页面切换使用官方路由。它们不代表真实触摸、所有入口按钮或业务接口都已验收。缩短视口用于检验空间压力，不等于打开真实软件键盘；输入的 `cursor-spacing` 仍需真机验证。

SDK 截图默认关闭；`MINI_QA_SCREENSHOTS=1` 才启用。优先用开发者工具窗口截图留证。SDK `navigateBack` 曾返回成功但页面栈与可见窗口不一致，不在这些脚本里使用；390px返回另通过「模拟操作 → 返回」验证。遇到状态不一致，停止该轮，恢复原项目自动化连接后复测，不能把工具异常当作产品通过或失败。

执行后恢复模拟请求，并重新编译清除仅在页面内存中的测试资料；不要清除用户缓存。模拟器不能替代真实 iOS/Android、输入法、系统字体、分享、账号权限及GIF/视频解码测试。
# 动图与弹窗回归

`media-popups.cjs <label>` 检查动作图文预览、进度页 GIF、图片回退、动作列表滚动、分类回顶、底部确认栏和安全区。复用上方的 `MINI_AUTOMATOR_PATH`、`MINI_AUTOMATOR_ENDPOINT` 与 `MINI_QA_OUTPUT` 环境变量。

使用官方模拟器和合成计划数据，拦截并拒绝全部 API 写入。GIF 使用公开动作资源。默认结束时恢复 `wx.request`。仅在需要原生鼠标验证时传 `--hold-picker`：它会保留弹窗及请求拦截，验证后需恢复 `wx.request` 或重新编译原项目。用例通过不代表真机键盘、触屏手势已验证。

# 字号与计划按钮回归

`profile-status.cjs` 检查个人页统计的加载/失败状态：标准与特大字号下，提示和重试按钮独占一行，两列统计保持对齐；同时检查横向边界与重试按钮触控尺寸。只使用模拟请求，不写入后台，结束后恢复字号偏好。每次机型测试使用独立的 `MINI_QA_OUTPUT` 目录，并核对报告中的实际窗口尺寸。

`font-size.cjs <label>` 运行前先把原项目编译到首页。脚本先验证家庭选择弹层，再从“我的”进入字号设置，检查三档实际渲染字号、重进保留、个人页底栏安全区、计划原生菜单、示范和完成按钮对齐、大字弹窗，以及已有家庭时的新建入口。字体偏好按设备保存，不随退出登录清除；仅接受标准100%、大号115%、特大130%三档。所有后端写入被拒绝，结束时恢复原有存储及请求。

`plans.cjs` 的原生菜单通过 `wx.showActionSheet` 模拟选择验证权限和业务调用。`MINI_QA_SCREENSHOTS=0` 可在锁屏等无法截图时跳过截图，报告会明确标记视觉复核待完成；不能将该运行当作视觉验收通过。切换机型后串行复测，并核对报告中的实际窗口尺寸。
# 提审前真实网络检查

仓库的 `project.config.json` 默认启用 `urlCheck`，可直接导入本目录。原父目录项目也须在 `project.config.json` 和本机 `project.private.config.json` 中开启 `setting.urlCheck`，不能勾选“不校验合法域名”。模拟器普通开发模式仍连接本地服务；下面的检查显式使用与体验版一致的生产 API。

```bash
MINI_AUTOMATOR_PATH=/tmp/wechat-local-qa/node_modules/miniprogram-automator \
MINI_AUTOMATOR_ENDPOINT=ws://127.0.0.1:9460 \
node tests/simulator/domain-network.cjs --upload-avatar
```

该检查使用真实微信登录和网络，未配置域名必须先被拒绝，否则停止。`--upload-avatar` 会上传一张不含个人信息的测试 PNG，但不修改头像、昵称或锻炼数据。脚本不会打印登录 code 或 token；登录 token 只在本轮内存中使用。测试还会切换模拟器页面，用实际 `exercise-media` 图片加载回调验证公开 GIF 和测试图片；不模拟网络成功。报告中的 `getImageInfo` 是附加下载检查，需与实际图片组件结果区分。运行结束停在公开动图页；未覆盖系统头像选择、真机触控及后台隐私指引配置。

发布时应使用仓库配置的 `setting.urlCheck=true`，并核对公众平台的 request、uploadFile 等域名配置；不要从历史上传目录复制关闭校验的设置。后台隐私保护指引需同步本次政策中的家庭可见范围、管理员计划权限和历史记录保留规则。
