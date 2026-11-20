# 探雷 · 琥珀探测仪

一款中文原生 TypeScript 扫雷游戏。深橄榄金属外壳、琥珀读数、非对称桌面勘探笔记；手机保持单列与明确操作模式。无账号、无后端、无外部字体或图片依赖。

## 仓库与在线试玩

- GitHub：https://github.com/Raingor/minesweeper
- GitHub Pages：https://raingor.github.io/minesweeper/ （19角色版已上线，线上30项头像检查及48项完整玩法回归通过；130项单测和严格构建通过）
- main 推送自动执行规则测试、严格类型检查、构建和 Pages 发布。

## 运行

需要 Node.js 24（本次验证 v24.18.0）与 npm。

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
npm run test:browser
GAME_URL=http://localhost:4176 npm run test:browser
```

- 开发默认 `http://localhost:5176`；生产预览默认 `http://localhost:4176`。两者均 `strictPort`，占用时报错，不静默换端口。
- 构建先执行 TypeScript 严格检查，再生成 `dist/`；Vite `base: './'`，支持 GitHub Pages 子目录。
- 浏览器脚本需要本机 Google Chrome，使用 Playwright 独立无头 Chrome 上下文，不碰已登录浏览器。
- `GAME_URL` 可指向开发、preview 或实际部署 URL；浏览器测试不动态导入 `/src`。
- GitHub/Pages 发布与线上验收由主 Agent 统一负责，本项目记录不把本地通过冒称已上线。

## 玩法

| 难度 | 棋盘 | 地雷 |
| --- | --- | --- |
| 入门 | 8×8 | 10 |
| 标准 | 10×10 | 16 |
| 挑战 | 12×12 | 24 |

- **首次有效揭开才布雷**，所选格及周围一圈保证无雷。布雷有限洗牌抽取，不使用无限重试采样。
- 数字表示周围最多八格的地雷数。空白连片自动展开，不揭开已插旗的格子。
- 桌面左键揭开、右键插旗；触屏通过「揭开 / 插旗」切换后点格子，再次标记可撤旗。旗帜不启动布雷或计时。
- 旗帜不限数量；「待标记」为雷数减旗数，可能为负，不代表系统确认旗帜正确。
- 键盘 Tab 进入棋盘，方向键移动焦点，Enter / 空格按当前模式操作，F 插旗。方向键仅在棋盘内接管。
- **揭开所有非雷格才获胜**，不要求插旗或旗帜正确。触雷失败；终局显示雷图与错旗、停止计时并锁定棋盘输入。
- 手机默认完整适应屏幕。挑战格较密时可点「放大棋盘」，启用至少 48px 方格；在棋盘内部滚动操作，不撑宽页面。
- 可随时重开或切档。切档、重开与刷新均新开一局，不保存未完成棋盘；最佳纪录不受影响。
- 规则弹窗为原生 modal，支持 Escape、焦点约束与关闭后返回入口。支持减少动态效果设置。

## 本地纪录与隐私

只在 `localStorage` 的 `puzzle-minesweeper-v1` 保存 `{ version: 1, best: { easy?, normal?, hard? } }`，值为非负整数毫秒。按难度分别保存最快通关时间；界面按秒显示。不会保存个人信息或中途对局。

损坏 JSON、不支持版本、异常字段、负数/非整数等会安全重置。浏览器禁止存储或配额不足时显示提示，游戏仍可完整游玩，当页最佳纪录仅在内存保留。跨设备同步不在范围内。

## 结构

- `src/engine.ts`：纯规则、不可变状态、可注入随机源、有限抽样与迭代展开。
- `src/clock.ts`：独立单调时钟，不依赖 DOM/定时器；UI 只建一个显示刷新 interval。
- `src/storage.ts`：版本及字段校验、读写异常降级、分档纪录。
- `src/main.ts` / `src/style.css` / `src/icons.ts`：界面、输入与原创内联 SVG。
- `src/*.test.ts`：规则、Clock 与存储单测。
- `scripts/smoke.mjs`：真实开发/生产浏览器验收，输出 `artifacts/` 截图和 JSON；测试侧固定随机源，通过真实最后一次点击达成胜/败，不暴露产品作弊全局。

## 19 位勘探伙伴（追加实现）

主界面提供显眼但不遮棋盘的伙伴头像、名字和「换伙伴」入口。原生 `details/summary` 展开全部 19 位角色，点击或键盘选择即收起并返回入口焦点；Esc 同样收起。不会新增游戏弹窗或接管棋盘的方向键/F键。

- `src/characters.ts` / `src/characters.css`：独立角色目录、存储校验与主题界面。
- `public/characters-2d/`：从原消消乐复制的19张头像 WebP，共682,082字节；无全身图、PNG、Three.js或兄弟目录运行时依赖，图片使用相对路径兼容Pages。
- 独立 `localStorage` key：`puzzle-minesweeper-character-v1`，保存 `{ version: 1, id }`。非法id/损坏/错误版本安全回到自嘲熊；读写异常仍允许当页选角，并显示保存不可用提示。不改变扫雷纪录key。
- `src/characters.test.ts`：追加33项单测。当前 `npm test` **130项 / 4文件通过**；`npm run build` 通过。
- `scripts/characters-smoke.mjs`：独立Chrome验收脚本，覆盖19张加载、选择、刷新持久、非法/损坏/不可用存储、360px、键盘与截图，支持 `GAME_URL`。子Agent依错峰要求未启动浏览器；随后主Agent独立本地与线上各30项头像及48项玩法检查通过，人物版已发布。

主 Agent 错峰验收命令（在本项目目录，先确认服务可用）：

```sh
GAME_URL=http://localhost:5176 node scripts/characters-smoke.mjs
GAME_URL=http://localhost:4176 node scripts/characters-smoke.mjs
GAME_URL=http://localhost:4176 npm run test:browser
```

新脚本将生成 `artifacts/characters-desktop.png`、`characters-roster-desktop.png`、`characters-mobile-360.png`、`characters-roster-mobile-360.png` 与 `characters-results.json`；这些是待执行产物，不是本轮已生成截图。

## 基础版历史验证（追加头像前）

- `npm test`：97 项通过（3 个文件）。覆盖三难度×12种子×6首击位置、邻雷不跨行、雷数、有限随机抽取、旗帜与连片、完整胜负、计时和存储。
- `npm run build`：TypeScript + Vite 构建通过。
- 开发 5176 与生产 preview 4176 各 48 项浏览器检查通过，覆盖真实 Chrome 桌面 1440×900、390×844 触屏、360px 窄屏、reduced-motion、焦点/弹窗、胜败最后一步、手机插旗与重开切档、纪录刷新及存储降级测试；无 pageerror / console error / HTTP 404。
- 截图与 `smoke-results.json` 写入被忽略的 `artifacts/`，最后一轮为生产 preview；详见 `progress.md`。

## 已知边界

没有自动解题、和弦点击、中途续局或后台同步。挑战档在窄屏适应模式格子较小，放大模式提供可滚动大格。计时不会因打开规则或切到后台而暂停，使用实际经过时间；终局停止。开发/preview 服务只供本地验收，长期可用性由最终部署负责。
