# ELEC5620 Stage 1 submission (Mon 10-12 Group 14)

截止：**2026-10-04（周日）23:59 AEDT**。Canvas 到 10-11 才关，但越早交，面试排得越晚。

## 要交两样东西（Canvas）

| Canvas 作业 | 交什么 | 分值 |
| --- | --- | --- |
| Stage One Report Submission | 一个组的 PDF：[`ELEC5620_Stage1_Report.pdf`](ELEC5620_Stage1_Report.pdf)，由一名组员代表全组交 | 报告 15 + 面试 10 |
| Stage One Video Presentation Submission | ≤ 8 分钟的视频，建议附 YouTube 链接 | 5 |

## 文件

| 文件 | 内容 |
| --- | --- |
| [`ELEC5620_Stage1_Report.pdf`](ELEC5620_Stage1_Report.pdf) | 报告，13 章，覆盖评分表每一项 |
| [`ELEC5620_Stage1_Slides.pptx`](ELEC5620_Stage1_Slides.pptx) | 录视频用的 PowerPoint，24 页，按 A→B→C→D→E 每人一段。每页顶部有成员色标，图上有编号标注；字体用 Georgia 和 Arial，Windows 和 Mac 打开不会跑版。每页备注里是讲稿 |
| [`slides-source/`](slides-source/) | 幻灯片生成脚本 `build_deck.py`、按幻灯片配色重新渲染的图（源文件在 `mmd-src/`）和图标 |
| [`video-script.md`](video-script.md) | 逐页英文讲稿，不分讲者，约 7:52 |
| [`report-source/`](report-source/) | 报告源文件：`parts/*.md` 按章节，`build.mjs` 生成 PDF |

报告的模型和 [`docs/design/stage1/`](../../docs/design/stage1/README.md) 一致，那里是模型的主页面。

## 还缺什么

五个人的个人项（ad hoc 需求、用例规格、三张行为图）都已放进报告和幻灯片。还缺：E 的三张图（报告 §8.5 和第 23 页，图在 #139 里）；全组的事在 #135：贡献比例表（报告 §13.1）、录视频、视频的 YouTube 链接（报告封面）。

## 重新生成 PDF

修改 `report-source/parts/` 里的 Markdown 后运行 `node submission/stage1/report-source/build.mjs`。脚本需要 `@mermaid-js/mermaid-cli`、`marked` 和 `puppeteer`，在脚本开头的 `MMD` 路径下安装，并且需要一个 Chromium。

## 重新生成幻灯片

安装 `python-pptx` 后运行 `python3 submission/stage1/slides-source/build_deck.py`，会覆盖 `ELEC5620_Stage1_Slides.pptx`。个人行为模型页由 `behaviour_slide` 生成：把 Mermaid 源放进 `slides-source/mmd-src/<成员>-<activity|sequence|state>.mmd`，用 `mmd-src/cfg.json` 渲染到 `slides-source/assets/diagrams/`，再在脚本里调用 `behaviour_slide`。还没有图的成员用 `behaviour_template`（虚线占位框）。
