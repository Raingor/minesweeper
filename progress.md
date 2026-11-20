# 实施记录

## 2026-11-20
- 阅读根级 puzzle-games-plan.md，加载 frontend-design。
- 检查 Node v24.18.0 / npm 11.16.0；5176 / 4176 均无监听，不终止任何现有服务。
- 建立独立 package、TypeScript 和 Vite 配置，资源 base 为 ./。
- 建立纯规则 engine：首次有效揭开后从安全圈以外有限 partial Fisher–Yates 布雷，准确邻雷、迭代展开、旗帜保护、终局锁定。
- 建立独立 Clock 和版本化存储模块；纪录分档，读写异常/损坏/不支持版本安全降级。
- 完成琥珀复古探测仪视觉与交互。桌面非对称侧栏笔记+主要棋盘；手机明确揭开/插旗，挑战档可放大至48px以上格子并在棋盘内滚动，无页面横溢出。
- `npm install` 成功，生成本项目 package-lock，审计 0 漏洞。
- 初次单测有一个测试夹具失败：预留最后安全格被合法连片自动展开；改为通过合法插旗保护该格，再撤旗和真实揭开，不修改胜利规则。
- `npm test`：3 文件、97 项通过。多种子首击覆盖 3 难度 × 12 种子 × 6 位置，共 216 个首击局面及每格邻雷断言。
- `npm run build`：tsc 严格检查和 Vite 8.3.8 构建通过；最新产物 CSS约14.28kB、JS约14.95kB，资源相对base。
- 启动自己服务前端口空闲；使用 `npm run dev` 和 `npm run preview` 后台运行，不终止他人服务。
- 首次浏览器测试脚本在尝试点击 aria-disabled 终局格时被 Playwright 可操作性检查拦截。测试改用真实 mouse 坐标输入验证终局锁定，不取消产品的可访问禁用语义。
- 最终 `npm run test:browser`（dev 5176）48项通过。
- 最终 `GAME_URL=http://localhost:4176 npm run test:browser`（生产preview）48项通过。
- 浏览器覆盖：1440×900桌面、390×844真实触控、360px无溢出、reduced-motion、规则modal/焦点/键盘、重开/快速重开/切档、右键与手机模式切换、时钟起止、真实最后一步胜败、雷图/错旗、终局输入、纪录刷新与损坏/版本/读写异常。
- 测试侧固定随机源，独立计算已知雷图后真实UI逐格操作达成最后一步，不导入 `/src`，产品不暴露作弊global；另用固定种子2026生成自然在玩局面作展示截图。
- 两轮最终浏览器均 pageerror=0 / console error=0 / HTTP错误或404=0。
- 已调用 magpie-vision 检查截图，未见文字裁切或格子重叠；桌面构图为刻意非对称，手机挑战格小的问题由明确的放大棋盘功能解决。

## 最终截图与结果
- `artifacts/desktop-1440.png`：真实进行中的桌面局面。
- `artifacts/mobile-390.png`：真实触屏进行中的手机局面。
- `artifacts/mobile-challenge-390.png`：12×12手机挑战与旗帜。
- `artifacts/mobile-360-reduced-motion.png`：360px挑战档、减少动态效果。
- `artifacts/victory.png` / `artifacts/game-over.png`：真实最后一步胜利/触雷失败与终局雷图。
- `artifacts/rules-desktop.png`：原生规则modal。
- `artifacts/smoke-results.json`：最新48项结果，base为生产preview4176；所有产物均已忽略。

## 交接时服务状态
- `http://localhost:5176` 开发服务，node监听PID 65076。
- `http://localhost:4176` 生产preview，node监听PID 65144。
- 交接前已用lsof再次核实，两服务保留给主Agent独立验收。日志分别在被忽略的dev.log、preview.log。

## 已知边界与冻结
- 不保存中途棋盘，无和弦点击/自动解题/跨设备同步；这些不在首版范围内。
- 规则弹窗不暂停实际经过时间；前后台切换后仍按单调时钟计时，终局冻结。
- 窄屏12×12默认格较小，显式放大后48px以上且仅棋盘内部滚动。
- 无已知阻塞缺陷；本地验收通过不代表已经GitHub/Pages上线，主Agent负责发布与线上验收。
- 子 Agent 交付后冻结。未修改主Agent新增的 `.github/workflows/deploy.yml`，未执行git/commit/push/deploy/memory/Artifact，未派子agent，未写其他目录。

## 主 Agent 独立验收与Pages发布
- 独立97单测、严格构建及生产preview 48项浏览器检查通过。
- 仓库 https://github.com/Raingor/minesweeper ，首次提交 `d2a1ac8`。
- 工作流 https://github.com/Raingor/minesweeper/actions/runs/44716998217 成功。
- 站点 https://raingor.github.io/minesweeper/ ，线上48/48检查通过；首击安全、胜败最后一步、手机插旗/揭开、纪录与资源错误检查均正常。
- 线上报告 `artifacts/smoke-results.json`，无pageerror/console/HTTP错误。

## 19位勘探伙伴追加实现（2026-11-20，尚未新版浏览器验收）
- 接到主 Agent 追加任务，只修改minesweeper；读取xiaoxiaole/src/catalog.ts并精确复制19张头像WebP至public/characters-2d（总682,082字节），未复制全身图、PNG或Three依赖。
- 新增src/characters.ts与characters.css：复古琥珀「勘探伙伴」证件式头像/人物名，桌面在侧栏，手机位于棋盘外头部；原生details/summary展开19角色网格，不新增dialog或叠盖棋盘。
- 每个选角按钮有aria-pressed/可访问名字，图片有alt；原生键盘激活、明确focus-visible、选完/Esc收起并回summary，仅在角色模块内处理Escape，不接管游戏键盘。
- 独立版本化伙伴选择存储，非法id/损坏/不支持版本默认classic；try/catch处理存储访问和配额异常，异常时仍可内存选角并显示提示；扫雷状态与纪录不变。
- main.ts仅新增模块挂载，不改engine/clock/storage；图片相对路径，无兄弟游戏运行时依赖。
- 新增src/characters.test.ts共33项；实际执行npm test：4文件、130项全部通过。
- 实际执行npm run build：tsc+Vite通过；新CSS约18.10kB、JS约18.53kB；独立头像随public复制到dist。
- 实际执行node --check scripts/characters-smoke.mjs：语法检查通过。
- 新增scripts/characters-smoke.mjs：独立Chrome上下文、GAME_URL；19图加载/名单/选择/刷新、360px触屏、键盘/焦点/Esc、非法和不可用存储、游戏仍可操作、错误收集、characters-*.png与JSON输出。
- **依协调指令暂不启动浏览器，本轮没有运行任何浏览器脚本，也没有生成characters截图。** 之前97单测/48浏览器与线上记录均为基础版历史，不是当前追加版线上结果。
- 本轮未启动/终止任何服务，未git/推送/发布/memory，也未修改根计划或其他项目。追加实现已冻结，主Agent错峰验收后统一发布。

### 主 Agent追加版验收命令
在本项目目录（确认自己的5176/4176服务可用，生产已构建）：
```sh
npm test
npm run build
GAME_URL=http://localhost:5176 node scripts/characters-smoke.mjs
GAME_URL=http://localhost:4176 node scripts/characters-smoke.mjs
GAME_URL=http://localhost:4176 npm run test:browser
```
待生成产物：artifacts/characters-desktop.png、characters-roster-desktop.png、characters-mobile-360.png、characters-roster-mobile-360.png、characters-results.json。

## 主Agent人物版发布验收（2026-11-20）
- 代码提交 `543f37a` 已推送main，Pages工作流 https://github.com/Raingor/minesweeper/actions/runs/44733700219 成功。
- 主Agent独立单测与生产构建通过；本地与线上均通过 30 项人物检查和 48 项完整玩法回归。
- 线上地址 https://raingor.github.io/minesweeper/ ，全部19张头像加载、选择与刷新保存、键盘与360px手机、存储异常降级通过；无页面、控制台或HTTP资源错误。
- 新版已上线，上文子Agent“未启动浏览器/待主Agent发布”仅为历史交接状态；截图和JSON位于忽略的artifacts目录，不提交构建/凭据。
