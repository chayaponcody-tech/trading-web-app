---
tags: [policy, documentation, workflow]
---
# Development Policy: Documentation Sync

## 📌 Objective
To maintain the integrity and accuracy of the project's "Secondary Brain," all system modifications must be reflected in the documentation immediately.

## 🛠 Mandatory Workflow
Every time a feature is implemented, a bug is fixed, or the system architecture is refined, the developer (or AI Agent) **MUST** follow these steps:

1.  **Code Implementation**: Complete the coding task in the `packages/` or `src/` directory.
2.  **Architecture Review**: Identify which parts of the `research/system_architecture.md` (or other relevant research files) are impacted by the change.
3.  **Sync Documentation**: Update the Markdown files in the `research/` directory to match the latest codebase state.
4.  **Verification**: Ensure that the technical documentation and the actual implementation are 100% synchronized before closing the task.

## 🗂 Key Files to Monitor
- `research/system_architecture.md`: The primary source of truth for the system's technical design.
- `research/welcome.md`: Onboarding and high-level project overview.

---
**Status**: ACTIVE
**Enforcement**: Required for all AI Agents and human collaborators.
