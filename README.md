# Xiaoman's Ink 

一个以《明日方舟：终末地》官网为视觉语言、以 [小满1221的关于页](https://www.yhdzz.cn/about) 为内容来源的个人主页。

纯 **Vite + TypeScript + 原生 CSS**，没有 UI 框架、没有动画库。背景地形、轨道核心、扫描线与 HUD 均为程序化生成；内容图片按 **1px 网格重绘为彩色点阵**（每像素最多一个点），背景、地形、卡片网格也统一为点阵；技术栈文字使用普通文字而不是点阵，穿插在背景与能力区；品牌 Logo 与 Hero HUD 图标保持清晰的普通图片/矢量显示。页面跟随系统浅色 / 深色主题；整页按模块分屏，一次滚动切换一整节，换节时文字溶解成粒子再重组；一言是一块会跟随主题的终端，逐字输出并在文字后叠加粒子光晕。链接、文案、图片与主题全部集中在根目录的 **`config.json`**。

## 快速开始

```bash
npm install
npm run dev        # 本地开发，修改 config.json 自动刷新
npm run typecheck  # 只做 TypeScript 类型检查
npm run build      # 类型检查 + 生产构建
npm run preview    # 预览构建结果
```

构建产物在 `dist/`，可直接部署到任意静态托管（Vercel / Netlify / Cloudflare Pages / GitHub Pages）。

## 配置：config.json

根目录的 `config.json` 是页面内容的唯一数据源：

```
config.json  →  src/config.ts（补全默认值与派生数据）  →  src/render.ts（渲染 DOM）  →  src/main.ts（交互）
```

配置里**只写内容**。序号、日期计数、URL 标签这类可以算出来的值都由 `src/config.ts` 自动补全，不需要（也不应该）手写：

| 自动生成 | 来源 |
| --- | --- |
| `nav[].index`、`nav[].href` | 导航顺序（`00`、`01`…）与 `id`（`#id`） |
| 各章节编号 `01`–`04` | 对应 `nav` 项的顺序 |
| `works` / `capabilities` / `contact` 的 `no` | 数组顺序（`01`、`02`…） |
| `works[].urlLabel`、`contact.links[].value` | 去掉协议与结尾斜杠的 `href` |
| `profile.stats[].value`（带 `since` 时） | 从 `since` 到今天的天数，每天自动更新 |
| `profile.avatar.image` | 缺省时使用 `brand.logo` |
| `meta.themeColor` | 缺省时使用 `theme.accent` |
| 任意字符串里的 `{year}` | 当前年份（页脚版权、ID 卡编号等） |
| 站外链接的 `target="_blank"` 与 `rel` | `http(s)://` 开头的链接自动新窗口打开 |
| 启动页提示语与阶段文案、Hero 滚动提示、回到顶部文案 | 代码内置默认值，可在配置中覆盖 |

`config.json` 在构建时被打包进 JS，因此修改后：

- 开发模式：Vite 会自动热更新 / 刷新；
- 生产环境：需要重新 `npm run build` 后再部署。

### 文件结构

| 字段 | 内容 |
| --- | --- |
| `meta` | 页面标题、描述、语言（可选，默认 `zh-CN`）、favicon（可选） |
| `theme` | UI 强调色 `accent`（写入 CSS 变量 `--acid`）；`--acid-soft` 默认由它自动调暗 |
| `brand` | 站点名、英文名、别名、Logo 图片、首页链接（可选，默认 `#home`） |
| `header` | 顶栏右侧 CTA（当前为 BLOG） |
| `clock` | 时钟时区与后缀（默认 `Asia/Shanghai` / `CST`） |
| `nav` | 顶部导航与右侧章节索引：只需 `id`、`label`、`labelEn`；`id` 必须对应页面 section 的 id |
| `rail` | 右侧索引下方的两行状态文字 |
| `boot` | 启动页标语；`hint` / `messages` 可选，有内置默认值 |
| `scene` | Canvas 背景色 `accent` / `glow`；`enabled: false` 可关闭 |
| `swarm` | 全屏漂浮粒子层密度与鼠标交互；`enabled: false` 可关闭 |
| `particles` | 内容图片点阵、Hero 文字重组、一言粒子光晕，以及 Hero / 头像 / 作品的点阵参数 |
| `assembly` | 分页不可用时的「粒子 → 文字」组装回退：`enabled`（默认 `true`）与 `max`（点数上限，默认 `3200`），整段可省略 |
| `hero` | 首屏标题、副标题、按钮、状态条、背景图、坐标标签、滚动提示 |
| `profile` | 个人档案、一言引用、数据、头像、ID 卡字段 |
| `capabilities` | 能力列表、标签、进度值、描边文字 |
| `works` | 作品卡片：标题、链接、封面图、标签、强调色 |
| `contact` | 邮箱、寄语、联系卡片（`value` 可省略，自动取域名） |
| `techStack` | 技术栈文字：背景点阵词 + 能力区可见 chips + Hero 换词词表 |
| `ticker` | 页脚上方滚动文字 |
| `footer` | 版权、ICP/公安备案入口（可选）、自定义链接、来源标注、回到顶部文案 |

### 链接

```json
{
  "header": {
    "cta": { "label": "BLOG", "href": "https://www.yhdzz.cn/" }
  },
  "contact": {
    "email": "me@example.com",
    "links": [
      { "label": "BLOG / 博客", "href": "https://www.yhdzz.cn/" }
    ]
  }
}
```

- 站内跳转写 `#profile`、`#works` 等锚点；
- 站外链接写 `https://…` 即可，渲染时会自动加上 `target="_blank"` 与 `rel="noreferrer"`；
- 需要强制新窗口 / 同窗口时，再显式写 `external: true` / `false`；
- 邮箱会自动生成 `mailto:`；
- 渲染层会过滤 `javascript:` 等不安全的协议。

### 图片

图片建议放在 `public/images/`，在配置中用绝对路径引用（也支持远程 URL，但跨域图片需要目标服务器允许 CORS 才能采样为点阵）：

```json
{
  "brand": { "logo": "/images/logo.svg" },
  "hero": { "image": "/images/hero.svg", "imageAlt": "工业风地形扫描图" },
  "profile": {
    "avatar": {
      "image": "/images/avatar.svg",
      "alt": "个人头像",
      "fallback": "XM",
      "caption": "XIAOMAN 1221"
    }
  },
  "works": {
    "items": [
      {
        "title": "我的项目",
        "href": "https://example.com",
        "image": "/images/works/example.jpg",
        "tags": ["PROJECT", "WEB"],
        "accent": "#ff3ea5"
      }
    ]
  }
}
```

- 作品封面通过 `object-fit: cover` 填充，建议使用 **3:4** 的图片（如 800×1000）；也支持 SVG、PNG、WebP、JPG。`works[].urlLabel` 与 `imageAlt` 可省略，默认取域名与标题。
- `profile.avatar.image` 会覆盖 ID 卡中的字母组合；省略时自动使用 `brand.logo`，图片加载失败时回退到 `avatar.fallback`。
- `hero.image` 作为首屏右侧的低透明度叠加层，不需要时设为 `""`。
- `brand.logo` 为空时会保留内置的矢量菱形 Logo。
- `public/images/` 下附带的是抽象占位 SVG，直接替换同名文件即可保持配置不变；`brand.logo` 与 `profile.avatar` 默认引用远程图片，可换成本地路径。

### 富文本

只有以下三个字段允许少量内联 HTML：

- `profile.introHtml`
- `profile.quote.html`
- `works.quoteHtml`

允许的标签：`<br>`、`<em>`、`<b>`、`<i>`、`<strong>`、`<span>`、`<small>`。渲染时会移除所有属性以及 `script` / `style` / `iframe` 等不安全标签。

### 一言 Quote

引用终端已接入 [Hitokoto 一言](https://hitokoto.cn/)：

```json
"quote": {
  "mode": "hitokoto",
  "endpoint": "https://v1.hitokoto.cn/?encode=json&charset=utf-8&c=d&c=i&c=k",
  "html": "落霞与孤鹜齐飞，秋水共长天一色。",
  "source": "一言 · 滕王阁序",
  "author": "— 王勃"
}
```

- 引用以**终端窗口**呈现：标题栏、`manjiuqi@ink:~$ hitokoto --random` 命令回显、`ONLINE / SYNCING / OFFLINE` 状态、底部可输入的命令行，右上角 `↻ rerun` 可重新请求。
- 命令行支持基础命令：`help` / `?` 列出命令，`hitokoto` / `refresh` / `rerun` / `quote` 换一句，`clear` / `cls` 清屏并回到当前句子，`whoami`、`about`、`date`、`echo <text>` 输出相应信息；未知命令提示输入 `help`。
- 输入区支持 `↑` / `↓` 历史、`Tab` 补全、`Esc` 关闭输出并失焦、`Ctrl/Cmd + L` 清屏；命令输入是带标签的真实 `input`，输出区为 `role="status"` 的 `aria-live` 区域，移动端聚焦不会触发页面缩放。
- 正文使用**打字机逐字输出**：先按最终文本预留高度避免跳动，再以约 10–28ms/字的节奏显示；输出完成后出处 / 作者淡入。
- 文字背后叠加**粒子光晕**（`src/quoteParticles.ts`）：按终端的等宽字体与换行栅格化字形，粒子绘制在文字下层并做轻微模糊与放大，颜色随主题切换；换一句时旧粒子淡出、新字形重新生成。
- 打字期间光晕会暂停，避免每个字符都重建；`particles.quote.max` 控制点数上限。
- `prefers-reduced-motion` 下关闭打字动画与粒子光晕，直接显示完整文本。
- `mode: "hitokoto"`：页面加载时请求一言 API，成功后替换引用、出处与作者；失败时保留 `html/source/author` 作为回退，并把终端状态显示为 `OFFLINE`。
- 引用下方的统计条统一为「数值 + 单位 + 标签」结构，四项样式一致；进入视口时数字从 0 计数到目标值。
- `profile.stats` 中带 `since` 的项省略 `value`：天数由 `src/config.ts` 在加载时计算，并在页面打开期间每分钟校准一次（跨零点自动 +1）；其余统计直接读取 `value`。`prefers-reduced-motion` 下不播放计数动画。

```json
"stats": [
  { "value": "92", "suffix": "篇", "label": "文章 / ARTICLES" },
  { "since": "2017-12-22", "suffix": "天", "label": "建站 / DAYS" }
]
```
- 设为 `mode: "static"` 或移除 `endpoint` 即使用静态回退内容。
- Hitokoto API 支持 CORS；这是页面唯一按需发起的外部请求（除配置中的远程图片外）。

### 导航与章节

```json
{
  "nav": [
    { "id": "home", "label": "首页", "labelEn": "INDEX" },
    { "id": "profile", "label": "关于", "labelEn": "ABOUT" }
  ]
}
```

`id` 需要与 `index.html` 中 `<section id="...">` 对应，章节高亮和右侧索引依赖这个值。导航序号（`00`、`01`…）与 `#id` 链接会自动生成，各章节标题右侧的编号同样取自这里。新增导航项时，同时新增对应 section。

点击任意指向 section 的站内锚点（顶部导航、右侧索引、Hero 按钮、页脚回到顶部）时，会先显示约 1 秒的 HUD 预加载面板（目标编号、英文名、进度条与同步状态），再瞬时滚动到目标小节；自由滚动不会打断浏览节奏。`prefers-reduced-motion` 下直接跳转。

滚动超过第一屏后，右下角浮出 `BACK TO TOP` 按钮，点击同样走预加载转场回到首页；滚动到页脚附近时自动收起，避免与页脚链接重复。

自由滚动时，地址栏 hash 会随当前小节自动切换（如 `#profile` → `#field` → `#works`），使用 `history.replaceState` 更新，不会产生额外的浏览历史记录。

小节之间的留白也收紧了：`.section` 上下 padding 从 `clamp(92px, 13vh, 162px)` 调整为 `clamp(64px, 9vh, 112px)`，移动端为 `clamp(52px, 8vh, 84px)`，整体更紧凑。

### 页脚备案与自定义链接

`footer` 里有三个**可选**入口，按顺序渲染在页脚底部，用 `·` 分隔：

```json
"footer": {
  "icp": { "label": "蒙ICP备2026xxxx号-1", "href": "https://beian.miit.gov.cn/" },
  "police": { "label": "蒙公网安备 1501xxxxxxxxxxxx号", "href": "https://beian.mps.gov.cn/" },
  "customLink": { "label": "小满的墨水瓶", "href": "https://www.yhdzz.cn/" }
}
```

- 默认配置只保留 `customLink`；需要备案信息时再补上 `icp` / `police`，把 `label` 换成实际备案号，`href` 可改为备案详情页；
- 任意一项 `label` 或 `href` 缺失时自动隐藏；三项都缺失时整行不显示；
- `customLink` 是备案信息旁边的自定义链接，可改成任意站内或站外地址。

### 主题色

主题色只需要改一处：

- `theme.accent`：写入 CSS 变量 `--acid`，按钮、编号、标题强调、进度条、启动页进度全部跟随；`--acid-soft`（渐变起点、滚动条悬停）默认由它自动调暗，也可以显式提供 `theme.accentSoft`；
- `meta.themeColor`（浏览器地址栏 / PWA 主题色）缺省时自动取 `theme.accent`；
- `scene.accent` / `scene.glow` 控制 Canvas 地形、线框体与粒子源，属于独立的装饰色。

> 当前配置是蓝色 UI（`#0066FF`）+ 荧光黄地形/粒子源（`#e6ff2e`）的双层配色。如果希望全蓝，同步修改 `scene.accent`、`scene.glow`，并重新着色 `public/images/*.svg`。
### 系统主题（浅色 / 深色）

页面通过 CSS 的 `prefers-color-scheme` 跟随系统外观：深色是默认视觉，浅色是同一套 HUD 语言的纸面变体。

- 颜色全部来自 CSS 变量（`--bg` / `--surface` / `--ink` / `--muted` / `--line` 等），浅色模式在样式表末尾统一覆盖；
- Canvas 效果读取 `--scene-ink`（地形 / 漂浮粒子）与 `--mix`（强调色调配方向），一言光晕读取 `--quote-particle`；系统切换时通过 `matchMedia('(prefers-color-scheme: light)')` 实时更新；
- 启动页、页面入场遮罩、小节预加载、移动端菜单、卡片与 ID 面板都有对应的浅色样式；
- 点阵图片在浅色下改用 `multiply` 混合模式，避免加色混合在亮背景上消失；
- 阴影、描边、渐变与混合模式按主题分别定义，切换系统主题无需刷新页面。

### 点阵与图片

- **内容图片**：Hero 叠加图、头像、作品封面采样为彩色点阵，`dotColor: "source"`；Hero 使用更密的 `dotSpacing: 2`，头像/作品保持 `6`；
- **Logo / Hero Sigil**：不参与点阵化。Logo 保持普通 `<img>`，Hero Sigil 保留原始矢量 SVG、轨道旋转、扫描线与 3D 全息体；
- **背景**：Canvas 地形/核心、全站 10px 白点网格、Hero/Contact 背景大字与卡片网格均为点阵；
- **技术栈文字**：**不使用点阵**。背景中漂浮 AI / LLM / PYTHON / TYPESCRIPT 等普通文字，能力区显示可见的 `// TECH STACK` chips。

控制项在 `config.json` 的 `particles` 中：

```json
{
  "particles": {
    "dotSpacing": 6,
    "dotColor": "source",
    "morph": { "interval": 5.5, "scatter": 1.6, "gather": 1.9, "hold": 2 },
    "quote": { "max": 2600 },
    "hero": { "max": 12000, "dotSpacing": 2, "blend": "lighter" },
    "avatar": { "max": 12000, "size": 1.3 },
    "works": { "max": 6000, "size": 1.6 }
  }
}
```

- `dotSpacing`：点阵网格间距（px），越小越密；Hero 可在 `particles.hero.dotSpacing` 单独覆盖（当前 `2`，约 12000 点）。
- `dotColor: "source"`：点使用图片原始颜色；也可填 `#ffffff` 之类的固定颜色。
- `max`：单张图片的安全上限；实际数量由图像特征与内容占用像素决定。
- `size` / `interactive` / `scatter`：点尺寸倍数、鼠标响应与散开力度，默认 `1.2` / `true` / `1.2`。
- `enabled`（总开关，默认 `true`）、`density`（密度倍率，默认 `1`）、`dotMatrix`（默认 `true`）省略即使用默认值。

桌面高档实测：Hero 约 12000 点（受 `hero.max` 限制）、头像约 4000–6000 点、作品封面约 1800–3500 点。

#### Hero 点阵文字

Hero 右侧的点阵每隔一段时间会**先打散到整个 Hero 视口，再重新拼成** `techStack` 中的一个技术词，循环播放：

- 词表默认取顶层 `techStack`，也可在 `particles.morph.words` 中单独指定；
- `morph.scatter` / `morph.gather` / `morph.hold` 分别控制打散、拼合与停留时长，当前为 **1.6 秒 + 1.9 秒 + 2 秒**；`morph.interval` 为两次换词的间隔（当前 `5.5` 秒，等于三段之和）；若省略 scatter/gather，则按 `interval - hold` 自动按 44% / 56% 分配；
- 打散阶段粒子铺满整个 Hero 视口，并临时解除 `.hero-media` 的右侧蒙版、降低透明度；Hero 文案仍在粒子上层，不遮挡文字；
- 拼合阶段粒子收拢到右侧字形区域，蒙版与透明度恢复；
- 字形区域按分辨率与宽高比自适应：宽屏约 `48% × 46%`、中心 `72% / 46%`，窄屏自动改为更大比例并进一步左移；`hero-media` 蒙版中心同步左移到 75%，保证放大后的字完整可见；
- 词长超过区域宽度时自动缩小字号；**默认点阵与换词粒子都跟随实时主题色**（`--acid` 为主，混入少量墨白与高光），不再使用 Hero 图片的原始青黄色；
- 默认点阵按像素亮度在主题色的深浅梯度间取色，保留原有明暗层次；头像与作品封面仍使用各自图片的颜色；
- **鼠标响应**：`particles.hero.interactive` 默认开启，指针进入字形区域会立即请求下一次换词（仍走打散 → 拼合流程）；停留在区域内时粒子会小幅避开光标，力度与半径经过收敛，尽量不破坏字形可读性；
- 只作用于 Hero；`prefers-reduced-motion` 下不启用变形，保持静态点阵。

#### 整屏分页与粒子转场

脚本启用后 `<main>` 会变成一个整屏分页容器：首页 / 关于 / 技能 / 项目 / 联系 / 页脚各占一屏，一次滚轮、触摸上滑、方向键或导航点击只切换一个模块。

- 切换时当前模块的文字先溶解成粒子，`main` 整体滑动到下一模块，粒子在新模块的文字位置重新汇聚，最后淡入真实文字；
- 模块的边框、卡片与插图随模块一起滑入滑出，只有文字参与粒子的溶解与重组；
- 模块内容高于一屏时（移动端或很矮的窗口），先在模块内部滚动，到达顶部 / 底部边界后才会切换模块；
- 支持 `Home` / `End` / `↑` / `↓` / `PageUp` / `PageDown` / 空格，以及触屏上下滑；导航、右侧索引、Hero 按钮与返回顶部都走同一套分页；
- 非当前模块会设置 `inert`，不进入 Tab 焦点与读屏顺序；地址栏同步为 `#home`、`#profile` … `#footer`，可直接深链到任意模块；
- `prefers-reduced-motion` 下取消滑动过渡与粒子转场，模块瞬间切换。

粒子转场使用 [pager.ts](src/pager.ts) 的预计算缓存：每个模块的文字在浏览器空闲时栅格化为点数有限的 glyph 目标，切换时只做位移与绘制，不在主线程重新采样。`assembly` 配置只在分页不可用时作为回退。

#### 移动端适配

- 入场文字粒子组装：`< 720px` 时粒子预算从 6500 降至 3000，矩阵停留与飞行时长同步缩短；
- Hero 换词：触摸设备无法 hover，**点击字形区域**即可触发下一次打散换词；移动端降低 `hero-media` 透明度，避免粒子干扰文案阅读；
- 作品轮播：保留原生触摸横向滑动；`(pointer: coarse)` 下滚动条触控高度增至 20px，把手常显；
- 一言粒子光晕：移动端粒子上限降为 1600，减少开销；
- 小节粒子组装：移动端复用 `assembly.max`，并在 `prefers-reduced-motion` 下关闭；
- 浮动 `BACK TO TOP`：触摸设备最小触控高度 40px；
- 启动页、小节预加载、统计计数等布局本身已提供移动端断点。

### 漂浮粒子层

`src/swarm.ts` 在页面最底层再叠一层全屏浮游光点（参考 FlowerTerminal 的环境粒子 + 上升尘埃）：

- 每颗粒子在慢速正弦力场中自行游走，带轻微闪烁与短拖尾；飞出视口后从对侧回卷，不会在边缘堆积；
- 粒子按深度分层，近处的更大、更快、更亮；多数为墨白尘埃，少量取 `scene.accent` / `scene.glow` 的荧光色；
- 指针靠近时向外散开（仅 `(pointer: fine)` 设备）；滚动过首屏后整层降低透明度；
- 使用独立固定 Canvas 与 `mix-blend-mode: screen` 叠加，`pointer-events: none`，不影响布局与点击；
- 标签页隐藏时暂停；`prefers-reduced-motion` 下只绘制一帧静态画面；移动端自动降低数量与 DPR。

控制项在 `config.json` 的 `swarm` 中：

```json
{
  "swarm": {
    "density": 1,
    "interactive": true
  }
}
```

- `density`：粒子数量倍率（`0.2–3`），桌面约 90 颗；
- `interactive`：是否启用鼠标排斥；触摸设备自动关闭；
- 颜色沿用 `scene.accent` / `scene.glow`。

当前技术栈：

```json
"techStack": [
  "AI", "LLM", "Java", "Python", "Golang", "TypeScript", "JavaScript",
  "React", "Next.js", "Vue", "Node.js", "Docker", "Kubernetes",
  "Linux", "Nginx", "Git", "Vite", "Photoshop", "Apifox", "OneDrive",
  "GitHub", "CSS"
]
```

`techStack` 同时用于背景普通文字、能力区 chips 与 Hero 换词词表；前两项 `AI / LLM` 高亮。请只放技术词：汉字会被浏览器回退字体渲染，破坏点阵效果。

#### 自适应性能

点阵预算按设备实时性能调整：

- 初始档位读取 `navigator.hardwareConcurrency`、`navigator.deviceMemory`、`(pointer: coarse)`、视口尺寸与 DPR；
- 高档：采样分辨率 480、DPR ≤ 1.5、活跃比例 1.0；中档：0.8–0.9、DPR ≤ 1.25；移动低档：0.58、DPR 1；
- 每约 1.2 秒采样实际 FPS：连续两次低于 40fps 时活跃点阵比例降低 0.12；连续五次高于 54fps 时提升 0.05；最低 0.32；
- 降低的是“活跃点阵数”，不会重建画布：始终取权重最高的前 N 个点，保留轮廓；
- 点阵采样在 `requestIdleCallback` 中构建，避免阻塞首屏；
- 离屏图片、隐藏标签页暂停；移动端自动减少 DPR 与活跃点数；
- 可在 DOM 上观察：`html[data-particle-tier]`、`html[data-particle-scale]`、canvas 的 `data-particles` / `data-active` / `data-mode`。

实现细节：

- 同一套共享 `requestAnimationFrame` 驱动所有可见点阵画布。
- 白底图片使用边缘 + 饱和度采样排除背景；深色线稿使用亮度 + 边缘权重筛选，避免整张图变成均匀点阵。
- 跨域图片先以 `crossOrigin="anonymous"` 探测；失败时保留原图；data/blob URL 视为同源。
- 系统开启“减少动态效果”时，点阵只绘制一次静态帧。

### 排版与 3D

这一轮把页面从“小字号 HUD”调整为“内容优先”的阅读尺度：

- 正文 17px，导航 15px（移动端菜单 28px），Hero 标题最大 168px；
- 次级文字颜色提升到 `--muted: #a9ad9f`，技术标签统一到 10px 以上；
- 主按钮文字根据强调色亮度自动使用黑/白（`--on-acid`），避免蓝色背景上黑字对比不足；
- 卡片标题、作品描述、联系方式、页脚说明都放大了字号。

3D 效果：

- Hero 右侧新增 CSS 3D 全息立方体 + 三圈轨道，鼠标移动时整体透视倾斜；
- 作品卡、联系卡、档案头像支持指针跟随的 3D tilt，并带随指针移动的高光；
- 章节标题使用 `perspective + rotateX` 的 3D 入场；
- 跑马灯、背景 CONTACT 字样使用 3D 倾斜；
- 按钮悬停有轻微的 `translateZ` 深度。

所有 3D 交互只在精细指针设备上启用；`prefers-reduced-motion` 下会关闭倾斜、旋转和入场动画，保留静态 3D 形态。

### 科技风细节

在 HUD 与 3D 之外，又补了一层接近军事 / 监控界面的科技装饰：

- 全站 10px 白色点阵网格；场景地形、核心、背景大字与卡片网格均为点阵；
- 顶部导航底部有横向扫描线；
- 时钟前增加绿色在线脉冲点；
- 每个章节标题右上角有一排技术刻度；
- 作品卡与联系卡四角增加 HUD 角标，作品卡右上角显示 `SYS.01 // LINK` 状态；
- 左侧固定遥测条（宽屏 ≥1360px）：`SYS.FEED`、三组动态信号条、`SIG` 数值与随机十六进制码；纯装饰并隐藏于较小屏幕；
- 光标外环增加上下准星刻度；
- Hero 主标题与章节标题加入短暂的 RGB 错位闪烁；
- 右侧状态文字改为竖排，避免与作品卡内容重叠。

这些装饰均不参与语义；`aria-hidden` 或纯伪元素实现，不会影响读屏与内容阅读。`prefers-reduced-motion` 下扫描线、闪烁与遥测更新都会停止。

### 资源加载启动页

加载页参考 [《明日方舟：终末地》官网](https://endfield.hypergryph.com/) 的资源加载界面重做，采用“暗色空间 + 左侧纵向进度条 + 右侧品牌组”的构图：

- 全屏 `#141414` 背景：Hero 图模糊处理后作为底纹，叠加噪点与暗角；
- 左侧 14px 宽的主题色纵向进度条，从顶部向下填充；百分比、刻度与状态文字跟随填充边缘向下移动；
- 右侧品牌组：白色菱形标记 + `小满1221` / `MAN JIUQI`，带循环扫描亮带；
- 底部装饰：主题色三角标记、渐隐分隔线、`boot.title` 标语与 `AS ABOVE / SO BELOW` 小字；
- 结束时先让主题色幕布从左向右覆盖全屏，再淡出露出页面；
- 30% 与 60% 处各停留 **500ms**，期间状态变为 `AUTHENTICATING // 身份校验` / `SYNCING ARCHIVE // 档案同步`，进度条渐变为浅主题色。

启动页开始退场时就会用一个不透明的入场层盖住页面，所以**页面不会在粒子效果前提前露出**；随后播放一次**首屏文字粒子描边 / 组装动画**（`src/intro.ts`），并且每次滚动到新的小节时都会再次播放小节版组装（`src/assembly.ts`）。进场顺序：

1. 启动页退场 → 全屏粒子点阵（页面仍不可见）；
2. 粒子飞向首屏所有可见文字的轮廓像素，先**描边**（品牌、导航、Hero 标题/副标题、按钮、状态区、时钟、右侧索引等）；
3. 描边短暂停留后，粒子从轮廓**填充**成完整的粒子文字；
4. 停留片刻，粒子与真实 DOM 文字交叉淡入，页面正式显示。

采样会读取每个元素的字体、字号、行高、内边距与对齐方式，并对小字号元素保留最低粒子数；描边只取字形边界像素。手动跳过启动页或 `prefers-reduced-motion` 时跳过整段动画。

时间轴：

| 阶段 | 时长 |
| --- | --- |
| 0% → 30% | 850ms |
| 30% 停顿 | 500ms |
| 30% → 60% | 650ms |
| 60% 停顿 | 500ms |
| 60% → 100% | 750ms |
| 主题色幕布 + 淡出 | 约 1.5s |

启动页文案由 `config.json` 的 `boot` 控制：`kicker` 与 `title` 为必填，`hint`（跳过提示）与 `messages`（阶段状态，最多 4 条）可省略并使用内置默认值。品牌名与右下角法务文字由 `brand` 自动生成。点击任意位置或按任意键可跳过；`prefers-reduced-motion` 下取消扫描/幕布动画，进度改为跳变，但仍保留 30% / 60% 的 500ms 停顿。启动页淡出完成后才会开始首屏粒子组装，避免动画被幕布遮住。

### 当前内容状态

内容已按 [yhdzz.cn/about](https://www.yhdzz.cn/about) 更新：

- 身份：满久琦 / 小满1221，运维、学生、开发、博主；
- 所在地：中国 · 呼和浩特；生于 2004 年，内蒙古鸿德文理学院 计算机科学与技术，INFP-T；
- 座右铭：天上如是，地下亦然；
- 站点：Xiaoman's Ink，92 篇文章、3247 天建站、81392 字、128 条评论；
- 工作室：云电科技工作室（2019 - 至今）；
- 项目：小满的墨水瓶、一言GO、小满网盘、云电工作室；
- 引用终端：Hitokoto 一言，打字机输出 + 粒子光晕，支持终端命令与 rerun；
- 技术栈：AI / LLM 与 Java、Python、Golang、TypeScript、React、Next.js、Vue、Node.js、Docker、Kubernetes、Linux、Nginx 等；
- 联系方式：im@manjiuqi.com、GitHub / 博客 / 网盘 / 工作室链接；
- 页脚只保留“小满的墨水瓶”自定义链接，备案入口留空（需要时在 `footer.icp` / `footer.police` 补充）；
- 内容图片为 1px 彩色点阵；技术栈文字为普通文字。

UI 强调色为蓝色 `#0066FF`，`scene.accent` 仍保留荧光黄作为地形/粒子源的辅助色。

## 研究：三个参考站点

### 1. endfield.hypergryph.com — 视觉与叙事参考

- **技术栈**：Next.js（App Router / RSC）静态导出，资源托管于 `web.hycdn.cn`。CSS Modules（`Header_icon__3iDIG` 形式的哈希类名），按路由拆分 JS/CSS，首屏对关键图片做 `preload`。
- **交互组件**：Swiper 轮播（干员、影像资料）、HTML5 `<video>` 作为首屏/角色展示背景、滚动驱动的分节内容、数字编号（`Si // 01`）与斜切几何边框。
- **视觉语言**：`#191919` 近黑底 + `#fffa00` 荧光黄，辅以品红 `#ff1aac` 与荧光绿 `#00ffa2`；Novecentosanswide / Gilroy 字体；HUD 角标、细线、巨大留白、工业感信息层级。
- **实现要点**：整页是一个全屏“着陆器”，通过固定导航 + 多个全屏 section + 视频/图像卡片构成；动效以 CSS transition 和滚动触发为主，重资源交给 CDN。

### 2. ak.hypergryph.com — 同体系的延续

- 同样使用 **Next.js + CSS Modules + CDN**，预加载角色立绘、二维码与分级图标。
- 内容组织更接近“资料库”：角色图鉴、公告、世界观入口分区明确；轮播与视频卡片为主。
- 与终末地共享一套设计母题：黑白 + 黄色高亮、巨型标题、编号、细线分割、全屏视觉。

### 3. index.anheyu.com — 内容与个人叙事参考

- **技术栈**：原生 HTML + 手写 CSS + Webpack 打包的 vanilla JS；引入 **Three.js r112** 与 **TweenLite**。
- **实现要点**：
  - 全屏 WebGL `<canvas>` 粒子/波浪背景，鼠标位置参与场的变化；
  - 预加载页（click to begin）、自定义跟随光标、自定义滚动条；
  - 基于滚动位置的 section 切换与视差，`split-line` 文本遮罩上移动画；
  - 内容结构清晰：Hero（欢迎语）→ About（自我介绍与引用）→ Services（热爱的事）→ Featured（博客 / GitHub / 图床 / 分享）→ Contact（邮箱与社交链接）。
- **内容线索**：`热爱可抵漫长岁月`、`你好哇，我是安知鱼...`、`你所热爱的就是你的生活`、`未来可期`、`Look for me`、`世间所有相遇，都是久别重逢`，以及四张 featured 卡片。

## 本项目如何融合两者

| 终末地的做法 | 本项目的实现 |
| --- | --- |
| 全屏 HUD 着陆页 | 100svh Hero + 固定四角框、扫描线、滚动进度、右侧章节索引 |
| 巨型字号 + 英文技术标签 | 巨型中文标题 + `PERSONAL ARCHIVE / PROFILE / FIELD` 等 mono 标签 |
| 荧光黄 + 近黑工业配色 | CSS 变量 `--acid` / `--bg` / `--line`，可由 `config.json` 改色 |
| 视频/图像驱动的角色卡 | 作品封面采样为粒子场 + CSS 网格/扫描叠层，横向滚动 + 吸附 + 拖拽 |
| 角色立绘/图标 | 内容图片转为 1px 彩色点阵；Logo/HUD 图标保持清晰；技术栈为普通文字 |
| 3D 空间感 | CSS 3D 全息立方体、卡片 tilt、章节 3D 入场、3D 跑马灯 |
| 军事 HUD 细节 | 蓝图网格、遥测条、HUD 角标、状态序列号、扫描线、准星光标 |
| Swiper 轮播 | 原生 `overflow-x` + `scroll-snap` + 按钮/拖拽/键盘控制；鼠标悬停作品列表时滚轮转为横向滚动，底部滚动条可拖动，到达两端后恢复页面滚动 |
| 分节编号 `Si // 01` | `00 INDEX` … `04 CONTACT` 的导航、侧栏与章节编号 |
| 公告 / 信息流 | 底部文字 ticker + 滚动进度条 |

| 安知鱼的做法 | 本项目的实现 |
| --- | --- |
| Three.js 粒子/波浪背景 | Canvas 2D 透视网格地形 + 旋转二十面体 + 星尘粒子（零依赖，性能可控） |
| 图片/图标呈现 | `src/particles.ts`：图片采样点阵、自适应预算、Hero 技术词重组、鼠标排斥/回弹与 CORS 探测 |
| 预加载 “Click to begin” | 左侧纵向进度条 + 品牌组 + 主题色幕布转场（参考 Endfield），颜色读取 `theme.accent`，可跳过，并兼容 `prefers-reduced-motion` |
| 自定义光标 | 缓动跟随的荧光点 + 外环，悬停交互元素时放大 |
| 滚动视差 / 文本遮罩 | IntersectionObserver 驱动 reveal、Hero 视差、章节高亮 |
| 内容结构 | Hero → Profile → Capability → Works → Contact，内容由 `config.json` 驱动 |

## 目录

```
.
├── config.json           # 页面内容、链接、图片、主题（唯一数据源）
├── index.html            # 语义骨架与装饰性 SVG
├── public/
│   ├── favicon.svg
│   ├── fonts/            # JetBrains Sans / Mono（自托管）
│   └── images/
│       ├── logo.svg
│       ├── avatar.svg
│       ├── hero.svg
│       └── works/        # 四张作品封面 SVG
├── src/
│   ├── config.ts         # 导入 config.json，补全默认值与派生数据并导出类型
│   ├── util.ts           # 公共小工具（补零、日期天数）
│   ├── render.ts         # 把配置渲染成完整 DOM
│   ├── intro.ts          # 首屏文字粒子描边与组装（描边 → 填充 → 页面）
│   ├── assembly.ts       # 分页不可用时的粒子组装回退
│   ├── textRaster.ts     # 把文字栅格化成 glyph 像素（首屏与小节共用）
│   ├── theme.ts          # 读取 Canvas 主题色并监听系统主题切换
│   ├── particles.ts      # 1px 彩色点采样、自适应预算、点阵化、Hero 文字重组与 CORS 探测
│   ├── pager.ts          # 整屏分页、手势、粒子溶解转场与文字目标缓存
│   ├── quoteParticles.ts # 一言终端的粒子光晕（栅格化、换字重组、主题适配）
│   ├── main.ts           # 启动页、时钟、滚动、导航、轮播、光标
│   ├── scene.ts          # Canvas 2D 程序化背景
│   ├── swarm.ts          # 全屏漂浮粒子层（游走、拖尾、鼠标排斥）
│   ├── style.css         # 设计系统、布局、动效、响应式
│   └── vite-env.d.ts
├── package.json
└── tsconfig.json
```

## 无障碍与性能

- 语义化 `header / nav / main / section / footer`，带 skip link；整屏分页用 `inert` 隔离非当前模块。
- 所有交互均可用键盘操作；分页支持方向键 / PageUp / PageDown / 空格 / Home / End，轮播按钮有 `aria-label` 与禁用态。
- Canvas 动画在标签页隐藏时暂停；DPR 上限 1.25–1.75；移动端自动降低网格密度。
- 图片元素保留在 DOM 中用于替代文本；粒子画布为 `aria-hidden`，不干扰读屏。
- 粒子画布使用 IntersectionObserver 按视口启停，只有可见的图片参与动画。
- 内容图片的点阵预算根据硬件档位和实时 FPS 动态调整；移动端自动降低 DPR 与活跃点数。
- 分页转场的文字目标在浏览器空闲时预计算并缓存，切换时只做粒子位移；入场动画与分页转场期间暂停背景 / 图片粒子循环，减少主线程竞争。
- 品牌 Logo 与 Hero Sigil 不参与粒子化，保持原始图像/矢量清晰度。
- 3D 倾斜只在 `(pointer: fine)` 设备启用；移动端使用静态透视与旋转动画。
- 字体本地加载并 `preload`；图片支持懒加载；远程图片与一言 API 只在配置引用时请求。
- 顶部导航用 `aria-current="location"` 标记当前小节；自定义光标只在精细指针且未开启“减少动态效果”时替换系统光标。
- 一言终端：状态点、命令回显与装饰性提示为 `aria-hidden`，命令输入是带标签的真实 `input`，输出区使用 `role="status"` 实时区域；引用正文与出处保留语义；`prefers-reduced-motion` 下打字动画与粒子光晕关闭，直接显示全文。
- 支持 `prefers-reduced-motion`：停止背景与粒子动画、关闭光标与大部分过渡，粒子显示为静态帧。

## 说明

- 页面信息与文案参考 [yhdzz.cn/about](https://www.yhdzz.cn/about)（小满1221）；设计语言参考 index.anheyu.com。
- 视觉语言参考 [《明日方舟：终末地》官网](https://endfield.hypergryph.com/) 与 [《明日方舟》官网](https://ak.hypergryph.com/)，仅作学习与设计练习，未复制其图片、字体或视频资源。
- 漂浮粒子层的游走 / 拖尾 / 鼠标排斥效果参考 [再花 · 个人终端](https://zaihuaovo.github.io/FlowerTerminal/)，为本项目独立实现。
- 字体 JetBrains Sans / JetBrains Mono 遵循 SIL Open Font License。
- 图片均可自由替换；粒子采样会自动适配，跨域图片需目标服务器允许 CORS。
