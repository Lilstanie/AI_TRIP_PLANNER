<a id="domain-docs"></a>

# 领域文档

本仓库采用单上下文领域文档布局。工程技能在探索代码库之前，应先读取共享领域文档。

<a id="before-exploring-read-these"></a>

## 探索前请阅读

- 仓库根目录的 **`CONTEXT.md`**。
- **`docs/adr/`**：阅读与即将处理的区域相关的 ADR。

如果这些文件不存在，请**直接继续**。不要报告文件缺失，也不要预先建议创建它们。`/domain-modeling` 技能可通过 `/grill-with-docs` 和 `/improve-codebase-architecture` 触发；只有真正解决了术语或决策时，它才会按需创建这些文件。

<a id="file-structure"></a>

## 文件结构

```text
/
├── CONTEXT.md
├── docs/
│   └── adr/
├── apps/
└── packages/
```

<a id="use-the-glossarys-vocabulary"></a>

## 使用术语表中的词汇

当输出内容需要命名领域概念时——无论是在问题标题、重构提案、假设还是测试名称中——请使用 `CONTEXT.md` 中定义的术语。不要改用术语表明确要求避免的同义词。

如果术语表中还没有所需概念，这就是一个信号：要么你正在创造本项目并未使用的措辞，要么确实存在需要交给 `/domain-modeling` 记录的缺口。

<a id="flag-adr-conflicts"></a>

## 标明与 ADR 的冲突

如果输出与现有 ADR 冲突，请明确指出，而不是静默覆盖：

> _与 ADR-0007（事件溯源订单）冲突，但值得重新讨论，因为……_
