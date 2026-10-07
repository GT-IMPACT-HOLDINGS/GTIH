# Pull Request Description Writer

## Description
Analyzes the git branch diff against the main/development branch and generates a comprehensive, clean, and highly readable Pull Request (PR) description.

## When to Use
- When the user asks to "write a PR description", "prepare a pull request", or triggers this specific skill.
- When a feature or bug fix branch is complete and ready for review.

## Instructions
1. **Gather Context:** Run a diff against the target branch (usually `main` or `develop`) to see the aggregate changes. 
2. **Summarize Changes:** Group the changes logically into meaningful bullet points categorized by impact.
3. **Format the PR:** Construct a Markdown document utilizing the structure provided below. Keep explanations concise, clear, and geared toward code reviewers.

## Output Format
```markdown
## 📝 Description
<!-- A brief summary of what this PR introduces and the problem it solves -->

## 🚀 Type of Change
- [ ] 🐛 Bug fix (non-breaking change which fixes an issue)
- [ ] ✨ New feature (non-breaking change which adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] 🧹 Chore / Refactor / Documentation update

## 🛠️ Key Changes
- **[Module/Component Name]**: High-level detail of what changed.
- **[Module/Component Name]**: High-level detail of what changed.

## 🧪 How Has This Been Tested?
<!-- Please describe the tests that you ran to verify your changes. -->
- [ ] Unit Tests
- [ ] Integration Tests
- [ ] Manual Verification (Describe steps)

## 🔗 Related Issues
<!-- e.g., Closes #123 -->
Closes #
```
