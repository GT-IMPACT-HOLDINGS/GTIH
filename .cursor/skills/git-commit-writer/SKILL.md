# Git Commit Writer (Conventional Commits)

## Description
Generates a structured, meaningful git commit message based on the staged changes in the workspace, strictly adhering to the Conventional Commits 1.0.0 specification.

## When to Use
- When the user asks to "write a commit message", "commit this", or triggers the git-commit-writer skill.
- Before committing changes to source control.

## Instructions
1. **Analyze the Diff:** Review the staged changes (`git diff --cached`). If no changes are staged, look at the unstaged changes (`git diff`) and ask the user if they want to include them.
2. **Determine the Type:** Select the most appropriate prefix from this list:
   - `feat`: A new feature for the user (corresponds to MINOR in semantic versioning).
   - `fix`: A bug fix for the user (corresponds to PATCH in semantic versioning).
   - `docs`: Documentation only changes.
   - `style`: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc).
   - `refactor`: A code change that neither fixes a bug nor adds a feature.
   - `perf`: A code change that improves performance.
   - `test`: Adding missing tests or correcting existing tests.
   - `chore`: Changes to the build process or auxiliary tools and libraries such as documentation generation.
   - `ci`: Changes to CI configuration files and scripts.
3. **Determine Scope (Optional):** If the change is specific to a module, add a noun describing its section in parentheses, e.g., `feat(auth):`.
4. **Write the Description:**
   - Use the imperative, present tense: "change" not "changed" nor "changes".
   - Do not capitalize the first letter.
   - Do not place a period (.) at the end.
5. **Breaking Changes (If Applicable):** Append a `!` after the type/scope (e.g., `feat(api)!:`) or add `BREAKING CHANGE:` at the beginning of the footer description.

## Output Format
