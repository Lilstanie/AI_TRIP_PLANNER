# ELEC5620 Stage 1 视频稿 / Video script

要求：≤ 8 分钟，介绍项目、主要 AI 角色、功能、用例和设计模型（Canvas: Stage One Video Presentation Submission）。
课程没有要求每个人出镜或出声，所以讲稿按幻灯片逐页写，不分讲者，谁讲都可以。估时按每分钟 140 个英文单词，每页加 3 秒翻页，合计约 7:31（24 页）。
每页讲稿和 PPT 备注里的一致，改讲稿时两边一起改（见 `slides-source/build_deck.py`）。

## 还要补的

- 第 5、9、19、23 页是 A、B、D、E 的个人行为模型页（现在是虚线占位框）。各自把活动图、时序图、状态机放进去，再写约 25 秒讲稿：说出 ad hoc 需求和用例，指出 LLM 在图里的位置、由哪段确定性代码把关。

## 录制建议

- 打开 PPT 的演示模式，用 Zoom/Teams 或系统录屏录一遍画外音，不需要开摄像头。录完看时长，超了就删减讲稿，不要加快语速。
- 导出 MP4 上传到 Canvas 的 "Stage One Video Presentation Submission"；再传 YouTube（设为 Unlisted），链接写进报告封面并附在提交里。
- 讲稿是参考，不必逐字念。

## 逐页讲稿

### 1. AI Trip Planner

约 13 秒

Hi, we are Group 14 from the Monday 10 to 12 class, and this is AI Trip Planner, a one-person AI travel agency.

### 2. Every travel choice constrains the others

约 24 秒

Planning a trip means juggling many sites, and every choice constrains the others. A chatbot can write an itinerary, but it invents prices and never checks that the parts fit. So we built an agency where specialist agents plan together on real data, and code checks their work.

### 3. Two humans, seven AI roles

约 24 秒

There are two humans: the traveller, our customer, and the founder who runs the agency and tests the agents in our Agent Lab. Then seven AI roles: a coordinator that talks to the traveller, a supervisor that assigns work, and five specialists, each with its own prompt and tools.

### 4. The graph drives the agents, not the other way round

约 25 秒

Our key design choice: the LangGraph workflow drives the agents, not the other way round. Specialists plan in stages on a shared board, code detects budget, time and route conflicts, and only the agents involved revise, for at most three rounds. If a model fails, a validated fallback keeps planning working.

### 5. [A's use case]: activity, sequence and state machine

约 25 秒

[About 25 seconds. Name member A's ad hoc requirement and use case, then point to where the LLM sits in each diagram and which code checks it. Replace the three placeholders with the diagrams.]

### 6. Each member owns two core features and one optional

约 21 秒

We classified requirements into the agreed scope, mandatory capabilities and optional features. Each member owns two core features and one optional one, shown here. Every member also wrote an ad hoc requirement and broke it into functional, non-functional and constraint requirements.

### 7. Seven feature groups with their constraints

约 18 秒

The feature diagram groups the system into seven areas, with mandatory, optional and alternative features, such as shared or individual rooms. We added cross-tree constraints and attached non-functional requirements, like money in integer cents.

### 8. Ten use cases, one traveller, three external systems

约 14 秒

The use case diagram has one traveller and three external systems. Each member wrote at least one full specification, and our behaviour diagrams come from those.

### 9. [B's use case]: activity, sequence and state machine

约 25 秒

[About 25 seconds. Name member B's ad hoc requirement and use case, then point to where the LLM sits in each diagram and which code checks it. Replace the three placeholders with the diagrams.]

### 10. From one ad hoc requirement to two use cases

约 23 秒

Member C owns accommodation and budget. The ad hoc requirement: the hotel must fit the money left after flights, a budget overrun should swap to a cheaper hotel that still meets the traveller's rules, and an impossible budget should name the minimum. That gave two use cases.

### 11. Object diagram: a Tokyo trip that is AUD 640 over budget

约 21 秒

The object diagram snapshots the planning board for a Tokyo trip that is 640 dollars over budget. The hotel prices are real fixture values; transport and dining are illustrative. Accommodation is asked to save 379 dollars, so it moves to the saver hotel.

### 12. Collaboration and structured class

约 15 秒

The collaboration shows roles, not classes: the budget code plays the judge that turns proposals into targeted revisions. The structured class shows the workflow's parts and its injected ports.

### 13. The LLM chooses once; code checks before any price

约 18 秒

In this activity diagram the LLM appears once, choosing one candidate id. Around it everything is deterministic: invalid output falls back to a rule, a booked stay skips the search, and prices are in cents.

### 14. Budget overrun and a targeted revision

约 15 秒

The sequence diagram shows an overrun: detectConflicts sends a revision only to the agents that can cut, and round two is kept only because the plan score improved.

### 15. The accommodation section within one planning turn

约 12 秒

The state machine follows the accommodation section through one turn, and maps its internal states onto the three statuses the traveller sees.

### 16. Six class diagrams drawn from the code

约 17 秒

Our class model has six diagrams drawn from the code. The spine runs from the workspace, through the coordinator and workflow, to specialists that reach tools and memory only through injected interfaces.

### 17. One Specialist interface, five realisations

约 15 秒

Every agent realises one Specialist interface, so the graph loops over them without knowing their models. The registry aggregates agents, while a plan is composed of its sections.

### 18. What we chose, and what we discarded

约 18 秒

We discarded a model-driven loop and free agent-to-agent chat, because limits and costs must be testable. We dropped approval checkpoints, since confirming applied nothing, and chose DeepSeek because it was about three times faster.

### 19. [D's use case]: activity, sequence and state machine

约 25 秒

[About 25 seconds. Name member D's ad hoc requirement and use case, then point to where the LLM sits in each diagram and which code checks it. Replace the three placeholders with the diagrams.]

### 20. Dependencies point inward to the shared contracts

约 15 秒

Six packages, each with an owner, all depend inward on the shared contracts, which depend on nothing. New specialists, providers or stores plug in behind existing interfaces.

### 21. One serverless app, optional cloud services

约 14 秒

It deploys as one serverless Next.js app. Memory, account sync and sign-in are optional, and without keys the same build runs fully on mock data.

### 22. How a change gets in

约 19 秒

A change must trace to a requirement; a change to shared contracts needs a written decision. A pull request is accepted when CI passes, an end-to-end artifact exists, use case postconditions hold and the models are updated.

### 23. [E's use case]: activity, sequence and state machine

约 25 秒

[About 25 seconds. Name member E's ad hoc requirement and use case, then point to where the LLM sits in each diagram and which code checks it. Replace the three placeholders with the diagrams.]

### 24. Models choose. Code decides. The traveller stays in control.

约 10 秒

In short: models choose, code decides, and the traveller stays in control. Thank you for watching.
