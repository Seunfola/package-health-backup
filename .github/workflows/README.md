# 🔍 Repository Health Analyzer

**FREE • Works with npm/yarn/pnpm • 100% Universal!**

## 🚀 Quick Start (30 seconds)

1. **⭐ Star this repo**
2. **Copy** `.github/workflows/analyze.yml` to YOUR repo
3. **Works automatically** with **your package manager!**
4. **Actions tab** → Run → Enter `vercel/next.js` → **Download HTML!**

## 🤖 Auto-Analysis (Bonus!)

**For repo owners**: Add to your repo for **daily auto-reports**!

Copy this to your workflow:

```yaml
- name: Auto-Analyze
  run: npx ts-node scripts/background-runner.ts

## 🎯 **Universal Package Manager Support**

| Package Manager | Lockfile | Command | ✅ Status |
|----------------|----------|---------|-----------|
| **npm** | `package-lock.json` | `npm install -g` | ✅ |
| **yarn** | `yarn.lock` | `yarn global add` | ✅ |
| **pnpm** | `pnpm-lock.yaml` | `pnpm add -g` | ✅ |
| **bun** | `bun.lockb` | Auto-detected | ✅ |

**No config needed!** It auto-detects your setup. ✨

## 📊 Example Output

<img width="800" src="https://via.placeholder.com/800x400/1a73e8/white?text=Repo+Health+Report">

## 🔧 **Private Repos**

**Settings** → **Secrets** → Add `CUSTOM_GITHUB_TOKEN` (repo scope)

## 📦 **Downloads**

| File | Purpose | Size |
|------|---------|------|
| `report.html` | **Beautiful dashboard** | 5KB |
| `health-report.json` | **Raw API data** | 2KB |

## 🤝 **Works in ANY Repo!**
