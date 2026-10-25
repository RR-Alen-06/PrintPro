# Collaborator Sync Guide (Post-History Rewrite)

> [!CAUTION]
> **CRITICAL: DO NOT RUN `git pull` ON CLONES CREATED BEFORE OCTOBER 25, 2026.**
> Running `git pull` or `git merge` will attempt to merge the old rewritten commits with the new commits, creating duplicate history and inadvertently re-introducing purged credential references.

---

## Clean Slate Sync Protocol

To align with the sanitized remote repository and avoid history conflicts, follow the **Clean Slate approach** below.

### Scenario A: You have NO local uncommitted or unpushed work

Run the following commands in your local repository terminal:

#### Windows (PowerShell / CMD):
```bash
git fetch origin
git checkout main
git reset --hard origin/main
git clean -fd
```

#### macOS / Linux:
```bash
git fetch origin
git checkout main
git reset --hard origin/main
git clean -fd
```

---

### Scenario B: You have local in-progress or uncommitted work

To guarantee local work is safely preserved without accidentally re-injecting purged commits:

1. **Back up your uncommitted files**:
   ```bash
   git diff > my_in_progress_changes.patch
   ```
   *(Or simply copy your modified source files to a temporary folder outside the repository.)*

2. **Clone a fresh, clean copy of the repository**:
   ```bash
   git clone https://github.com/RR-Alen-06/PrintPro.git PrintPro-Clean
   cd PrintPro-Clean
   ```

3. **Re-apply your local changes**:
   - Create your feature branch from the clean `main`:
     ```bash
     git checkout -b feat/your-feature-name
     ```
   - Apply your patch or copy your modified files back into the project:
     ```bash
     git apply ../PrintPro/my_in_progress_changes.patch
     ```
   - Test, commit, and push normally.

4. **Retire the old clone**:
   Once your work is running cleanly in `PrintPro-Clean`, you can safely delete the old repository directory.

---

## Verifying Your Local Sync

Run the following command to verify you are on the sanitized commit tree:

```bash
git log -n 1 --format="%H %s"
```

The top commit on `main` should match the latest commit on `origin/main` on GitHub.

For any questions or sync assistance, reach out to the repository maintainer.
