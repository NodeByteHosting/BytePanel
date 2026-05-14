# Git Submodule Setup for NodeByte GSM

This guide covers the submodule strategy for NodeByte GSM.

## Submodule Architecture

**Submodules (independent versioning):**
- `agent/` — NodeByte Game Server Agent (GSA)
- `games/` — Game server recipes (GSG)
- `lib/providers/` — Provider implementations (GSP)

## Why This Approach?

- **Agent + Games + Providers as submodules** — Can be updated/released independently
- **Clear ownership boundaries** — Each domain can evolve in its own repo
- **Cleaner CI/CD separation** — Independent checks and release cadence per component

## Prerequisites

Before starting, you need:

1. **Read access** to submodule repositories:
   - `NodeByteHosting/GSA` (agent)
   - `NodeByteHosting/GSG` (games)
   - `NodeByteHosting/GSP` (providers)

2. **Git credentials configured** for private repo access (SSH or HTTPS token)

3. **Local clean state**:
   ```bash
   git status
   # Should show "working tree clean"
   ```

## Step 1: Clone with Submodules

```bash
git clone --recursive https://github.com/NodeByteHosting/GSM.git
```

If already cloned:

```bash
git submodule sync --recursive
git submodule update --init --recursive
```

If the remote repositories are brand new and empty, use the bootstrap flow below instead of `git submodule add -b main`:

```bash
git rm -r --cached agent games lib/providers
ren agent agent.backup
ren games games.backup
ren lib\providers providers.backup

git submodule add https://github.com/NodeByteHosting/GSA.git agent
git submodule add https://github.com/NodeByteHosting/GSG.git games
git submodule add https://github.com/NodeByteHosting/GSP.git lib/providers

cd agent
git switch -c main
git add .
git commit -m "feat: initial commit"
git push -u origin main
cd ..

cd games
git switch -c main
git add .
git commit -m "feat: initial commit"
git push -u origin main
cd ..

cd lib/providers
git switch -c main
git add .
git commit -m "feat: initial commit"
git push -u origin main
cd ../..
```

## Step 2: Verify Setup

```bash
git submodule status
```

You should see all three submodules listed with their commit hashes.

## Daily Workflow

### Cloning with Submodules

```bash
git clone --recursive https://github.com/NodeByteHosting/GSM.git
```

Or if already cloned:

```bash
git submodule sync --recursive
git submodule update --init --recursive
```

### Making Changes

**To modify a game recipe (submodule):**

```bash
cd games
# Make changes...
git add .
git commit -m "feat: add new game"
git push origin main
cd ..

# Update the submodule pointer in main repo
git add games
git commit -m "Update games submodule"
git push origin main
```

**To modify the agent (already a submodule):**

```bash
cd agent
# Make changes...
git add .
git commit -m "fix: improve agent"
git push origin main
cd ..

# Update the submodule pointer in main repo
git add agent
git commit -m "Update agent submodule"
git push origin main
```

**To modify providers (submodule):**

```bash
cd lib/providers
# Make changes...
git add .
git commit -m "feat: improve provider integration"
git push origin main
cd ../..

# Update the submodule pointer in main repo
git add lib/providers
git commit -m "Update providers submodule"
git push origin main
```

**To modify the main repo only:**

```bash
# Edit files in app/, lib/, etc. (excluding submodule repos)
git add .
git commit -m "feat: improve billing"
git push origin main
```

### Updating All Submodules

To pull the latest from all submodules:

```bash
git pull
git submodule update --remote
```

### Helper Scripts

**Recommended (cross-platform) commands:**

```bash
bun run submodules:setup
bun run submodules:validate
bun run submodules:status
bun run submodules:update
bun run submodules:push
```

**Shell script variants (optional):**

```bash
bash scripts/setup-submodules.sh
bash scripts/validate-submodules.sh
```

**Status and update helpers:**

```bash
git submodule status --recursive
git submodule sync --recursive
git submodule update --init --recursive --remote
```

**Push all submodules and main repo:**

```bash
bash scripts/push-submodules.sh
```

This handles `agent`, `games`, and `lib/providers` submodules, then pushes the main repo.

If those remotes are still empty, bootstrap them first with `git submodule add` without `-b main`, then create and push the `main` branch inside each submodule before using the push script.

The package commands above call `scripts/submodules.mjs` and work in PowerShell, cmd, and Unix shells.

## Troubleshooting

### Submodule in Detached HEAD

```bash
cd games
git checkout main
cd ..
git add games
git commit -m "Reattach games submodule to main"
```

### Submodule Won't Push

Ensure upstream is set:

```bash
cd games
git push -u origin main
cd ..
```

### Sync Issues

Get submodule status:

```bash
git submodule foreach --recursive git status
```

### Clone with Submodules Failed

Manually initialize:

```bash
git submodule update --init --recursive
```

## Private Submodules

Submodules can absolutely be private repositories.

For private submodules, each developer and CI environment must have read access to all submodule repos.

Common approaches:
- Use SSH URLs in `.gitmodules` (recommended for developer machines)
- Use HTTPS with PAT/token in CI
- Configure CI checkout to fetch submodules recursively with credentials

## Legacy Migration Note

`scripts/convert-to-submodules.sh` is retained only as a historical migration script and is deprecated for normal use.

## CI/CD Considerations

The main repo's CI workflows include:

- `.github/workflows/submodules.yml` — Validates submodule pointers
- `.github/workflows/ci.yml` — Main repo lint, type, test, build
- `agent/.github/workflows/ci.yml` — Agent-specific lint, type, build
- Games can have their own CI in `games/.github/workflows/`

## Questions?

- Community: https://discord.gg/nodebyte
- Maintainer: oss@nodebyte.co.uk
