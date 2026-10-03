# ELEC5620 Stage 1 视频稿 / Video script

要求：≤ 8 分钟，介绍项目、主要 AI 角色、功能、用例和设计模型（Canvas: Stage One Video Presentation Submission）。
按幻灯片顺序，每人连续讲自己那一段。估时按每分钟 140 个英文单词，每页加 3 秒翻页。

| 成员 | 讲的页 | 估计时长 |
| --- | --- | --- |
| A Ziqi He | 1–5 | 1:56 |
| B Tingsong Jin | 6–9 | 1:20 |
| C Yi Qiao | 10–15 | 1:48 |
| D Jiahang Bian | 16–19 | 1:17 |
| E Weihao Wang | 20–24 | 1:25 |
| 合计 | 24 页 | 7:46 |

## 要各自补的

- A、B、D、E：把自己的活动图、时序图、状态机放进 "Individual behaviour models" 那一页（现在是虚线占位框），再写约 25 秒讲稿：说出自己的 ad hoc 需求和用例，指出 LLM 在图里的位置、由哪段确定性代码把关。

## 录制建议

- 最省事：开一个 Zoom/Teams 会议，一个人共享幻灯片的 Present 模式，大家轮流开麦，录一遍。录完看时长，超了就删减讲稿，不要加快语速。
- 导出 MP4 上传到 Canvas 的 "Stage One Video Presentation Submission"；再传 YouTube（设为 Unlisted），链接写进报告封面并附在提交里。
- 讲稿是参考，不必逐字念。

## 逐页讲稿

### 1. AI Trip Planner

**A Ziqi He** · 约 18 秒

Hi, I'm Ziqi He, member A. We are Group 14 from the Monday 10 to 12 class, and this is AI Trip Planner, a one-person AI travel agency. Each of us will present our own part.

### 2. Every travel choice constrains the others

**A Ziqi He** · 约 24 秒

Planning a trip means juggling many sites, and every choice constrains the others. A chatbot can write an itinerary, but it invents prices and never checks that the parts fit. So we built an agency where specialist agents plan together on real data, and code checks their work.

### 3. Two humans, seven AI roles

**A Ziqi He** · 约 24 秒

There are two humans: the traveller, our customer, and the founder who runs the agency and tests the agents in our Agent Lab. Then seven AI roles: a coordinator that talks to the traveller, a supervisor that assigns work, and five specialists, each with its own prompt and tools.

### 4. The graph drives the agents, not the other way round

**A Ziqi He** · 约 25 秒

Our key design choice: the LangGraph workflow drives the agents, not the other way round. Specialists plan in stages on a shared board, code detects budget, time and route conflicts, and only the agents involved revise, for at most three rounds. If a model fails, a validated fallback keeps planning working.

### 5. [A's use case]: activity, sequence and state machine

**A Ziqi He** · 约 25 秒

[About 25 seconds. Name your ad hoc requirement and use case, then point to where the LLM sits in each diagram and which code checks it. Replace the three placeholders with your diagrams.]

### 6. Each member owns two core features and one optional

**B Tingsong Jin** · 约 23 秒

I'm Tingsong Jin, member B. We classified requirements into the agreed scope, mandatory capabilities and optional features. Each member owns two core features and one optional one, shown here. Every member also wrote an ad hoc requirement and broke it into functional, non-functional and constraint requirements.

### 7. Eight feature groups with their constraints

**B Tingsong Jin** · 约 18 秒

The feature diagram groups the system into seven areas, with mandatory, optional and alternative features, such as shared or individual rooms. We added cross-tree constraints and attached non-functional requirements, like money in integer cents.

### 8. Ten use cases, one traveller, three external systems

**B Tingsong Jin** · 约 14 秒

The use case diagram has one traveller and three external systems. Each member wrote at least one full specification, and our behaviour diagrams come from those.

### 9. [B's use case]: activity, sequence and state machine

**B Tingsong Jin** · 约 25 秒

[About 25 seconds. Name your ad hoc requirement and use case, then point to where the LLM sits in each diagram and which code checks it. Replace the three placeholders with your diagrams.]

### 10. From one ad hoc requirement to two use cases

**C Yi Qiao** · 约 25 秒

I'm Yi Qiao, member C. I own accommodation and budget. My ad hoc requirement: the hotel must fit the money left after flights, a budget overrun should swap to a cheaper hotel that still meets my rules, and an impossible budget should name the minimum. That gave my two use cases.

### 11. Object diagram: a Tokyo trip that is AUD 640 over budget

**C Yi Qiao** · 约 21 秒

The object diagram snapshots the planning board for a Tokyo trip that is 640 dollars over budget. The hotel prices are real fixture values; transport and dining are illustrative. Accommodation is asked to save 379 dollars, so it moves to the saver hotel.

### 12. Collaboration and structured class

**C Yi Qiao** · 约 15 秒

The collaboration shows roles, not classes: my budget code plays the judge that turns proposals into targeted revisions. The structured class shows the workflow's parts and its injected ports.

### 13. The LLM chooses once; code checks before any price

**C Yi Qiao** · 约 18 秒

In my activity diagram the LLM appears once, choosing one candidate id. Around it everything is deterministic: invalid output falls back to a rule, a booked stay skips the search, and prices are in cents.

### 14. Budget overrun and a targeted revision

**C Yi Qiao** · 约 15 秒

The sequence diagram shows an overrun: my detectConflicts sends a revision only to the agents that can cut, and round two is kept only because the plan score improved.

### 15. The accommodation section within one planning turn

**C Yi Qiao** · 约 14 秒

The state machine follows the accommodation section through one turn, and maps its internal states onto the three statuses the traveller sees. Over to D.

### 16. Six class diagrams drawn from the code

**D Jiahang Bian** · 约 19 秒

I'm Jiahang Bian, member D. Our class model has six diagrams drawn from the code. The spine runs from the workspace, through the coordinator and workflow, to specialists that reach tools and memory only through injected interfaces.

### 17. One Specialist interface, five realisations

**D Jiahang Bian** · 约 15 秒

Every agent realises one Specialist interface, so the graph loops over them without knowing their models. The registry aggregates agents, while a plan is composed of its sections.

### 18. What we chose, and what we discarded

**D Jiahang Bian** · 约 18 秒

We discarded a model-driven loop and free agent-to-agent chat, because limits and costs must be testable. We dropped approval checkpoints, since confirming applied nothing, and chose DeepSeek because it was about three times faster.

### 19. [D's use case]: activity, sequence and state machine

**D Jiahang Bian** · 约 25 秒

[About 25 seconds. Name your ad hoc requirement and use case, then point to where the LLM sits in each diagram and which code checks it. Replace the three placeholders with your diagrams.]

### 20. Dependencies point inward to the shared contracts

**E Weihao Wang** · 约 17 秒

I'm Weihao Wang, member E. Six packages, each with an owner, all depend inward on the shared contracts, which depend on nothing. New specialists, providers or stores plug in behind existing interfaces.

### 21. One serverless app, optional cloud services

**E Weihao Wang** · 约 14 秒

It deploys as one serverless Next.js app. Memory, account sync and sign-in are optional, and without keys the same build runs fully on mock data.

### 22. How a change gets in

**E Weihao Wang** · 约 19 秒

A change must trace to a requirement; a change to shared contracts needs a written decision. A pull request is accepted when CI passes, an end-to-end artifact exists, use case postconditions hold and the models are updated.

### 23. [E's use case]: activity, sequence and state machine

**E Weihao Wang** · 约 25 秒

[About 25 seconds. Name your ad hoc requirement and use case, then point to where the LLM sits in each diagram and which code checks it. Replace the three placeholders with your diagrams.]

### 24. Models choose. Code decides. The traveller stays in control.

**E Weihao Wang** · 约 10 秒

In short: models choose, code decides, and the traveller stays in control. Thank you for watching.
