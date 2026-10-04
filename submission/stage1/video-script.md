# ELEC5620 Stage 1 视频稿 / Video script

要求：≤ 8 分钟，介绍项目、主要 AI 角色、功能、用例和设计模型（Canvas: Stage One Video Presentation Submission）。
课程没有要求每个人出镜或出声，所以讲稿按幻灯片逐页写，不分讲者，谁讲都可以。估时按每分钟 140 个英文单词，每页加 3 秒翻页，合计约 7:52（24 页）。
每页讲稿和 PPT 备注里的一致，改讲稿时两边一起改（见 `slides-source/build_deck.py`）。

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

### 5. Three LLM calls, each fenced by code

约 32 秒

UC-A1 turns one free-text message into a validated plan. The LLM acts three times: it extracts the stated facts, the supervisor delegates to specialists, and it writes the reply. Code fences each step: the Zod contract validates the brief, a missing fact ends the turn with one question instead of a default, and at most three revision rounds run, each kept only if the plan score improves.

### 6. Each member owns two core features and one optional

约 21 秒

We classified requirements into the agreed scope, mandatory capabilities and optional features. Each member owns two core features and one optional one, shown here. Every member also wrote an ad hoc requirement and broke it into functional, non-functional and constraint requirements.

### 7. Seven feature groups with their constraints

约 18 秒

The feature diagram groups the system into seven areas, with mandatory, optional and alternative features, such as shared or individual rooms. We added cross-tree constraints and attached non-functional requirements, like money in integer cents.

### 8. Ten use cases, one traveller, three external systems

约 14 秒

The use case diagram has one traveller and three external systems. Each member wrote at least one full specification, and our behaviour diagrams come from those.

### 9. The LLM picks offered fares; code checks every hop

约 30 秒

UC-B1 arranges flights and moves between cities. The transport LLM only selects offered flight ids and a departure slot for each hop. Code then checks every choice against the evidence, one fare per hop, day bounds and route fit, and takes prices and durations from the providers. A missing fare stays unknown, never free, and an invalid choice falls back to a deterministic plan.

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

### 19. Evidence first; the LLM drafts, code decides

约 23 秒

UC-D1 shows both specialists working from evidence: the guide uses map coordinates and weather data; dining uses restaurant candidates and confirmed dietary preferences. The LLM drafts guidance, while deterministic code validates its output and budget. Forecasts are distinguished from climate context, and unavailable weather is disclosed.

### 20. Dependencies point inward to the shared contracts

约 15 秒

Six packages, each with an owner, all depend inward on the shared contracts, which depend on nothing. New specialists, providers or stores plug in behind existing interfaces.

### 21. One serverless app, optional cloud services

约 14 秒

It deploys as one serverless Next.js app. Memory, account sync and sign-in are optional, and without keys the same build runs fully on mock data.

### 22. How a change gets in

约 19 秒

A change must trace to a requirement; a change to shared contracts needs a written decision. A pull request is accepted when CI passes, an end-to-end artifact exists, use case postconditions hold and the models are updated.

### 23. Edits are previewed and checked before they apply

约 36 秒

UC-E1 edits an existing trip through the timeline or map while keeping routes, budget and uncertain prices visible. Timeline and map operations go to a deterministic preview endpoint, which validates the schema and version, checks routes and conflicts, recalculates costs, and marks changed prices as unverified. The chat LLM can update the brief or replan, but it does not create an edit request. The state machine ends in Applied only after the browser accepts the validated preview.

### 24. Models choose. Code decides. The traveller stays in control.

约 10 秒

In short: models choose, code decides, and the traveller stays in control. Thank you for watching.
