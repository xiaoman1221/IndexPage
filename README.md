# Xiaoman's Ink · 满久琦

一个以《明日方舟：终末地》官网为视觉语言、以 [满久琦的关于页](https://www.yhdzz.cn/about) 为内容来源的个人主页。

纯 **Vite + TypeScript + 原生 CSS**，没有 UI 框架、没有动画库。背景地形、轨道核心、扫描线与 HUD 均为程序化生成；内容图片按 **1px 网格重绘为彩色点阵**（每像素最多一个点），背景、地形、卡片网格也统一为点阵；技术栈文字使用普通文字而不是点阵，穿插在背景与能力区；品牌 Logo 与 Hero HUD 图标保持清晰的普通图片/矢量显示。链接、文案、图片与主题全部集中在根目录的 **`config.json`**。

## 快速开始

```bash
npm install
npm run dev      # 本地开发，修改 config.json 自动刷新
npm run build    # 类型检查 + 生产构建
npm run preview  # 预览构建结果
```

构建产物在 `dist/`，可直接部署到任意静态托管（Vercel / Netlify / Cloudflare Pages / GitHub Pages）。

## 配置：config.json

根目录的 `config.json` 是页面内容的唯一数据源：

```
config.json  →  src/config.ts（类型与导出）  →  src/render.ts（渲染 DOM）  →  src/main.ts（交互）
```

`config.json` 在构建时被打包进 JS，因此修改后：

- 开发模式：Vite 会自动热更新 / 刷新；
- 生产环境：需要重新 `npm run build` 后再部署。

### 文件结构

| 字段 | 内容 |
| --- | --- |
| `meta` | 页面标题、描述、语言、favicon、浏览器主题色 |
| `theme` | UI 强调色 `accent` / `accentSoft`（写入 CSS 变量 `--acid` / `--acid-soft`） |
| `brand` | 站点名、英文名、别名、Logo 图片、首页链接 |
| `header` | 顶栏右侧 CTA（当前为 BLOG） |
| `clock` | 时钟时区与后缀（默认 `Asia/Shanghai` / `CST`） |
| `nav` | 顶部导航与右侧章节索引；`id` 必须对应页面 section 的 id |
| `rail` | 右侧索引下方的两行状态文字 |
| `boot` | 启动页文案与加载状态 |
| `scene` | Canvas 背景开关、主线色 `accent`、扫描高光色 `glow` |
| `swarm` | 全屏漂浮粒子层开关、密度、鼠标交互 |
| `particles` | 内容图片点阵、Hero 文字重组、一言粒子文字，以及 Hero / 头像 / 作品的点阵参数 |
| `hero` | 首屏标题、副标题、按钮、状态条、背景图、坐标标签 |
| `profile` | 个人档案、一言引用、数据、头像图片、ID 卡字段 |
| `capabilities` | 能力列表、标签、进度值、描边文字 |
| `works` | 作品卡片：标题、链接、封面图、标签、强调色 |
| `contact` | 邮箱、寄语、联系卡片 |
| `techStack` | 技术栈文字：背景点阵词 + 能力区可见 chips |
| `ticker` | 页脚上方滚动文字 |
| `footer` | 版权、ICP/公安备案入口、自定义链接、来源标注、回到顶部文案 |

### 链接

```json
{
  "header": {
    "cta": { "label": "BLOG", "href": "https://www.yhdzz.cn/", "external": true }
  },
  "contact": {
    "email": "me@example.com",
    "links": [
      {
        "no": "01",
        "label": "BLOG / 博客",
        "value": "www.yhdzz.cn",
        "href": "https://www.yhdzz.cn/",
        "external": true
      }
    ]
  }
}
```

- 站内跳转写 `#profile`、`#works` 等锚点；
- 站外链接写 `https://…`，`external: true` 会加上 `target="_blank"` 与 `rel="noreferrer"`；
- 邮箱会自动生成 `mailto:`；
- 渲染层会过滤 `javascript:` 等不安全的协议。

### 图片

所有图片放在 `public/images/`，在配置中用绝对路径引用：

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
        "urlLabel": "example.com",
        "image": "/images/works/example.jpg",
        "imageAlt": "项目封面",
        "tags": ["PROJECT", "WEB"],
        "accent": "#ff3ea5"
      }
    ]
  }
}
```

- 作品封面通过 `object-fit: cover` 填充，建议使用 **3:4** 的图片（如 800×1000）；也支持 SVG、PNG、WebP、JPG。
- `profile.avatar.image` 会覆盖 ID 卡中的字母组合；图片加载失败时自动回退到 `avatar.fallback`。
- `hero.image` 作为首屏右侧的低透明度叠加层，不需要时设为 `""`。
- `brand.logo` 为空时会保留内置的矢量菱形 Logo。
- 当前附带的图片均为抽象占位 SVG，直接替换同名文件即可保持配置不变。

### 富文本

只有以下三个字段允许少量内联 HTML：

- `profile.introHtml`
- `profile.quote.html`
- `works.quoteHtml`

允许的标签：`<br>`、`<em>`、`<b>`、`<i>`、`<strong>`、`<span>`、`<small>`。渲染时会移除所有属性以及 `script` / `style` / `iframe` 等不安全标签。

### 一言 Quote

引用卡片已接入 [Hitokoto 一言](https://hitokoto.cn/)：

```json
"quote": {
  "mode": "hitokoto",
  "endpoint": "https://v1.hitokoto.cn/?encode=json&charset=utf-8&c=d&c=i&c=k",
  "html": "落霞与孤鹜齐飞，秋水共长天一色。",
  "source": "一言 · 滕王阁序",
  "author": "— 王勃"
}
```

- `mode: "hitokoto"`：页面加载时请求一言 API，成功后替换引用、出处与作者；失败时保留 `html/source/author` 作为回退。
- 引用卡右上角显示 `↻ 换一句`，点击可重新请求。
- 引用正文会渲染为**纯白色粒子文字**（`src/quoteParticles.ts`）：按 blockquote 实际字体与换行栅格化字形，粒子持续轻微游走，但不响应鼠标；换一句时旧粒子飞向新字形。真实文本保留在 DOM 中，用于布局、选中与读屏。
- 粒子数量与开关由 `particles.quote` 控制；`prefers-reduced-motion` 下不启用，直接显示普通文本。
- 引用下方的统计条统一为「数值 + 单位 + 标签」结构，四项样式一致；进入视口时数字从 0 计数到目标值。
- `profile.stats` 中带 `since` 的项按日期实时计算天数（当前建站日 `2017-12-22`，每天自动 +1，并每分钟校准一次）；其余统计直接读取配置值。`prefers-reduced-motion` 下不播放计数动画。
- 设为 `mode: "static"` 或移除 `endpoint` 即使用静态回退内容。
- Hitokoto API 支持 CORS；这是页面唯一按需发起的外部请求（除配置中的远程图片外）。

### 导航与章节

```json
{
  "nav": [
    { "id": "home", "index": "00", "label": "首页", "labelEn": "INDEX", "href": "#home" },
    { "id": "profile", "index": "01", "label": "档案", "labelEn": "PROFILE", "href": "#profile" }
  ]
}
```

`id` 需要与 `index.html` 中 `<section id="...">` 对应，章节高亮和右侧索引依赖这个值。新增导航项时，同时新增对应 section。

点击任意指向 section 的站内锚点（顶部导航、右侧索引、Hero 按钮、页脚回到顶部）时，会先显示约 1 秒的 HUD 预加载面板（目标编号、英文名、进度条与同步状态），再瞬时滚动到目标小节；自由滚动不会打断浏览节奏。`prefers-reduced-motion` 下直接跳转。

滚动超过第一屏后，右下角浮出 `BACK TO TOP` 按钮，点击同样走预加载转场回到首页；滚动到页脚附近时自动收起，避免与页脚链接重复。

自由滚动时，地址栏 hash 会随当前小节自动切换（如 `#profile` → `#field` → `#works`），使用 `history.replaceState` 更新，不会产生额外的浏览历史记录。

小节之间的留白也收紧了：`.section` 上下 padding 从 `clamp(92px, 13vh, 162px)` 调整为 `clamp(64px, 9vh, 112px)`，移动端为 `clamp(52px, 8vh, 84px)`，整体更紧凑。

### 页脚备案与自定义链接

`footer` 中新增三个填写入口，按顺序渲染在页脚底部，用 `·` 分隔：

```json
"footer": {
  "icp": {
    "label": "ICP备案号",
    "href": "https://beian.miit.gov.cn/",
    "external": true
  },
  "police": {
    "label": "公安备案号",
    "href": "https://beian.mps.gov.cn/",
    "external": true
  },
  "customLink": {
    "label": "小满的墨水瓶",
    "href": "https://www.yhdzz.cn/",
    "external": true
  }
}
```

- 把 `label` 换成实际备案号（如 `蒙ICP备2026xxxx号-1`、`蒙公网安备 1501xxxxxxxxxxxx号`）；`href` 默认为官方查询入口，也可改为备案详情页；
- 任意一项 `label` 或 `href` 为空时自动隐藏；三项都为空时整行不显示；
- `customLink` 是备案信息旁边的自定义链接，可改成任意站内或站外地址。

### 主题色

主题色分为三处，建议一起调整：

- `theme.accent` / `theme.accentSoft`：CSS 强调色（按钮、编号、标题强调等）；
- `scene.accent` / `scene.glow`：Canvas 地形与线框体的颜色；
- `meta.themeColor`：浏览器地址栏 / PWA 的主题色。

> 当前配置里 `theme.accent` 与 `meta.themeColor` 是蓝色 `#0066FF`，但 `scene.accent` 仍是荧光黄 `#e6ff2e`。因此页面是蓝色 UI + 黄色地形/粒子源的双层配色。如果希望全蓝，需要同步修改 `scene.accent`、`scene.glow`，并重新着色 `public/images/*.svg`。

### 点阵与图片

- **内容图片**：Hero 叠加图、头像、作品封面采样为彩色点阵，`dotColor: "source"`；Hero 使用更密的 `dotSpacing: 2`，头像/作品保持 `6`；
- **Logo / Hero Sigil**：不参与点阵化。Logo 保持普通 `<img>`，Hero Sigil 保留原始矢量 SVG、轨道旋转、扫描线与 3D 全息体；
- **背景**：Canvas 地形/核心、全站 10px 白点网格、Hero/Contact 背景大字与卡片网格均为点阵；
- **技术栈文字**：**不使用点阵**。背景中漂浮 AI / LLM / PYTHON / TYPESCRIPT 等普通文字，能力区显示可见的 `// TECH STACK` chips。

控制项在 `config.json` 的 `particles` 中：

```json
{
  "particles": {
    "enabled": true,
    "density": 1,
    "dotMatrix": true,
    "dotSpacing": 6,
    "dotColor": "source",
    "morph": {
      "enabled": true,
      "interval": 5.5,
      "scatter": 1.6,
      "gather": 1.9,
      "hold": 2
    },
    "quote": { "enabled": true, "max": 2600 },
    "hero": { "max": 12000, "dotSpacing": 2, "size": 1.2, "interactive": false },
    "avatar": { "max": 8000, "size": 1.3 },
    "works": { "max": 6000, "size": 1.6 }
  }
}
```

- `dotSpacing`：点阵网格间距（px），越小越密；Hero 可在 `particles.hero.dotSpacing` 单独覆盖（当前 `2`，约 12000 点）。
- `dotColor: "source"`：点使用图片原始颜色；也可填 `#ffffff` 之类的固定颜色。
- `max`：单张图片的安全上限；实际数量由图像特征与内容占用像素决定。
- `size`：点尺寸倍数；移动端与低性能设备会自动降低活跃点数。
- `interactive` / `scatter`：悬浮散开/回弹。

桌面高档实测：Hero 约 12000 点（受 `hero.max` 限制）、头像约 2900 点、作品封面约 1800–3500 点。

#### Hero 点阵文字

Hero 右侧的点阵每隔一段时间会**先打散到整个 Hero 视口，再重新拼成** `techStack` 中的一个技术词，循环播放：

- 词表默认取顶层 `techStack`，也可在 `particles.morph.words` 中单独指定；
- `morph.scatter` / `morph.gather` / `morph.hold` 分别控制打散、拼合与停留时长，当前为 **1.6 秒 + 1.9 秒 + 2 秒**；`morph.interval` 为两次换词的间隔（当前 `5.5` 秒，等于三段之和）；若省略 scatter/gather，则按 `interval - hold` 自动按 44% / 56% 分配；
- 打散阶段粒子铺满整个 Hero 视口，并临时解除 `.hero-media` 的右侧蒙版、降低透明度；Hero 文案仍在粒子上层，不遮挡文字；
- 拼合阶段粒子收拢到右侧字形区域，蒙版与透明度恢复；
- 字形区域按分辨率与宽高比自适应：宽屏约 `48% × 46%`、中心 `72% / 46%`，窄屏自动改为更大比例并进一步左移；`hero-media` 蒙版中心同步左移到 75%，保证放大后的字完整可见；
- 词长超过区域宽度时自动缩小字号；**默认点阵与换词粒子都跟随实时主题色**（`--acid` 为主，混入少量墨白与高光），不再使用 Hero 图片的原始青黄色；
- 默认点阵按像素亮度在主题色的深浅梯度间取色，保留原有明暗层次；头像与作品封面仍使用各自图片的颜色；
- **鼠标响应**：`particles.hero.interactive: true`，指针进入字形区域会立即请求下一次换词（仍走打散 → 拼合流程）；停留在区域内时粒子会小幅避开光标，力度与半径经过收敛，尽量不破坏字形可读性；
- 只作用于 Hero；`prefers-reduced-motion` 下不启用变形，保持静态点阵。

#### 移动端适配

- 入场文字粒子组装：`< 720px` 时粒子预算从 6500 降至 3000，矩阵停留与飞行时长同步缩短；
- Hero 换词：触摸设备无法 hover，**点击字形区域**即可触发下一次打散换词；移动端降低 `hero-media` 透明度，避免粒子干扰文案阅读；
- 作品轮播：保留原生触摸横向滑动；`(pointer: coarse)` 下滚动条触控高度增至 20px，把手常显；
- 一言粒子文字：移动端粒子上限降为 1600，减少开销；
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
    "enabled": true,
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
  "AI", "LLM", "Java", "Python", "Go", "TypeScript", "JavaScript",
  "React", "Next.js", "Vue", "Node.js", "Docker", "Kubernetes",
  "Linux", "Nginx", "Git", "Vite", "Photoshop", "Apifox", "OneDrive",
  "GitHub", "CSS"
]
```

`techStack` 同时用于背景普通文字与能力区 chips；前两项 `AI / LLM` 高亮。

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

启动页自然结束后还会播放一次**首屏文字粒子组装动画**（`src/intro.ts`）：首屏先呈现为全屏点阵矩阵，粒子随后飞向所有可见文字的像素位置（品牌、导航、Hero 标题/副标题、按钮、状态区、时钟、右侧索引等），组成完整的粒子文字；组装完成后短暂停留，再与真实 DOM 文字交叉淡入。采样会读取每个元素的字体、字号、行高、内边距与对齐方式，并对小字号元素保留最低粒子数。手动跳过启动页或 `prefers-reduced-motion` 时跳过此动画。

时间轴：

| 阶段 | 时长 |
| --- | --- |
| 0% → 30% | 850ms |
| 30% 停顿 | 500ms |
| 30% → 60% | 650ms |
| 60% 停顿 | 500ms |
| 60% → 100% | 750ms |
| 主题色幕布 + 淡出 | 约 1.5s |

启动页文案由 `config.json` 的 `boot` 控制：`kicker`、`title`、`hint` 与 `messages`（后者用于阶段状态）。品牌名与右下角法务文字由 `brand` 自动生成。点击任意位置或按任意键可跳过；`prefers-reduced-motion` 下取消扫描/幕布动画，进度改为跳变，但仍保留 30% / 60% 的 500ms 停顿。

### 当前内容状态

内容已按 [yhdzz.cn/about](https://www.yhdzz.cn/about) 更新：

- 身份：满久琦 / 小满1221，运维、学生、开发、博主；
- 所在地：中国 · 呼和浩特；生于 2004 年，内蒙古鸿德文理学院 计算机科学与技术，INFP-T；
- 座右铭：天上如是，地下亦然；
- 站点：Xiaoman's Ink，92 篇文章、3247 天建站、81392 字、128 条评论；
- 工作室：云电科技工作室（2019 - 至今）；
- 项目：小满的墨水瓶、一言GO、小满网盘、云电工作室；
- 引用卡：Hitokoto 一言，支持点击换一句；
- 技术栈：AI / LLM 与 Java、Python、Go、TypeScript、React、Next.js、Vue、Node.js、Docker、Kubernetes、Linux、Nginx 等；
- 联系方式：im@manjiuqi.com、GitHub / 博客 / 网盘 / 工作室链接；
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
│   ├── config.ts         # 导入 config.json 并导出类型
│   ├── render.ts         # 把配置渲染成完整 DOM
│   ├── particles.ts      # 1px 彩色点采样、自适应预算、点阵化、Hero 文字重组与 CORS 探测
│   ├── quoteParticles.ts # 一言正文的粒子文字（栅格化、换句重组、鼠标排斥）
│   ├── main.ts           # 启动页、时钟、滚动、导航、轮播、光标
│   ├── scene.ts          # Canvas 2D 程序化背景
│   ├── swarm.ts          # 全屏漂浮粒子层（游走、拖尾、鼠标排斥）
│   ├── style.css         # 设计系统、布局、动效、响应式
│   └── vite-env.d.ts
├── package.json
└── tsconfig.json
```

## 无障碍与性能

- 语义化 `header / nav / main / section / footer`，带 skip link。
- 所有交互均可用键盘操作；轮播按钮有 `aria-label` 与禁用态。
- Canvas 动画在标签页隐藏时暂停；DPR 上限 1.25–1.75；移动端自动降低网格密度。
- 图片元素保留在 DOM 中用于替代文本；粒子画布为 `aria-hidden`，不干扰读屏。
- 粒子画布使用 IntersectionObserver 按视口启停，只有可见的图片参与动画。
- 内容图片的点阵预算根据硬件档位和实时 FPS 动态调整；移动端自动降低 DPR 与活跃点数。
- 品牌 Logo 与 Hero Sigil 不参与粒子化，保持原始图像/矢量清晰度。
- 3D 倾斜只在 `(pointer: fine)` 设备启用；移动端使用静态透视与旋转动画。
- 字体本地加载并 `preload`；图片支持懒加载；远程图片与一言 API 只在配置引用时请求。
- 支持 `prefers-reduced-motion`：停止背景与粒子动画、关闭光标与大部分过渡，粒子显示为静态帧。

## 说明

- 页面信息与文案参考 [yhdzz.cn/about](https://www.yhdzz.cn/about)（满久琦 / 小满1221）；设计语言参考 index.anheyu.com。
- 视觉语言参考 [《明日方舟：终末地》官网](https://endfield.hypergryph.com/) 与 [《明日方舟》官网](https://ak.hypergryph.com/)，仅作学习与设计练习，未复制其图片、字体或视频资源。
- 漂浮粒子层的游走 / 拖尾 / 鼠标排斥效果参考 [再花 · 个人终端](https://zaihuaovo.github.io/FlowerTerminal/)，为本项目独立实现。
- 字体 JetBrains Sans / JetBrains Mono 遵循 SIL Open Font License。
- 图片均可自由替换；粒子采样会自动适配，跨域图片需目标服务器允许 CORS。
