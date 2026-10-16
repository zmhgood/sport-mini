# 小程序页面回归

用 Node.js 18+ 运行，不需要安装依赖或真实登录：

```bash
node --test tests/*.test.js
```

发布包使用 `node scripts/release.cjs 版本号 全新输出目录` 生成；加 `--upload` 可在生成后上传。
脚本从已提交代码生成干净包，将同一个版本参数写入包内 `config/build-info.js` 并传给微信上传命令。
体验版页脚使用包内版本，正式版优先使用微信接口返回的版本。源码中的空构建信息用于本地开发，不作为待上传包手工上传。
上传前如需验证包，可调用脚本导出的 `uploadRelease({ project, version, commit })` 上传同一份已验证包；版本不一致或文件被改动时会拒绝上传。

测试加载真实 Page 脚本，模拟 API 延迟、错误和返回数据；同时读取实际 WXML，检查可见文本。覆盖家庭列表/详情/目标以及目标详情/进度各依赖的失败、真实空数据、请求去重、重试、页面重进、家庭选择、进度计算和旧请求迟到。

`page-harness.js` 只评估模板条件、循环和文本，不替代官方 WXML/WXSS 编译器、布局或真机测试。模拟响应均为合成数据，不访问线上、不使用凭据、不写入真实家庭或锻炼记录。

2026-10-13 新增的业务风险探针单独运行：

```bash
node tests/risk-audit.cjs
```

此脚本执行当前 Page 和同级 admin 仓库的真实 Vue 函数，依赖全部为合成数据，结果默认写入 `/tmp/qa-risk-audit-20261013.json`（可用 `QA_RISK_REPORT` 指定路径）。存在已知缺陷时返回退出码 1，并区分断言失败与脚本执行错误；不要把这项失败当作测试环境异常，或混入页面测试通过数。运行需要本项目旁的 `admin` 仓库存在。它不代替数据库并发/事务测试，也不证明真实浏览器或真机行为。

完整新用例和执行状态见 `docs/qa/test-cases-20261013.csv`；风险与验收口径见 `docs/qa/code-risk-review-20261013.md` 和 `docs/qa/statistics-contract-20261013.md`。

`devtools-regression.cjs` 使用官方 `miniprogram-automator` 连接原项目的本机自动化端口，验证提交、邀请、图片、异常重试、版本页脚和设置状态。通过 `MINI_AUTOMATOR_PATH` 指定已安装的模块、`MINI_AUTOMATOR_ENDPOINT` 指定连接地址（默认 `ws://127.0.0.1:9420`）。仅允许模拟器运行，API 返回值和用户资料使用合成数据；结束时恢复请求方法、版本方法和本地存储。截图与结果保存到系统临时目录，不写入项目源码目录。

本次修复验证见 `docs/qa/fix-validation-20261013.md`；数据库结果与后台浏览器摘要在同目录。官方SDK自动导航超时记为未验证，不以 Page 单元或旧截图替代通过。后台可复现浏览器脚本位于同级 admin 的 `tests/browser-regression.cjs`。
