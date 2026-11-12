# Okiro CF

A dark, Okiro-style desktop app for one goal: **reach Codeforces Master (2100)** by solving every problem rated ≤ 2000 in the last 300 contests, with **Arjun**, a local AI friend and Grandmaster-level coach.

- **Contests:** a cftracker-style grid (Div 1/2/3/4, Educational, Global, Div 1+2), colored by solved, attempted and untouched, with problems above your rating cap dimmed.
- **Roadmap:** walks the contests from newest to oldest and always knows where you are, e.g. "Round 934 (Div. 2), problem C next".
- **Workspace:**
  - the statement, with math rendered
  - a Monaco C++ editor with clangd autocomplete, diagnostics and contest snippets (`cp`, `dsu`, `segtree`, `modint`, …)
  - CPH-style tests: samples plus your own custom tests
  - **Submit** straight to your Codeforces account, with the verdict tracked live
- **Arjun:**
  - runs on `gpt-oss-20b` through Ollama, fully local, with a one-click switch to Claude for hard problems
  - explains the problem, brainstorms with you at the spoiler level you choose, reviews your code, and helps hunt down WAs
  - grounded in a curated algorithms knowledge base (local RAG), the official editorial (hidden from you), and real code execution (`run_tests`, `run_code`, `stress_test`)
  - remembers your weak spots between sessions
- **Calendar:** Day, Week, Month and Year views with daily goals and a heatmap.
- **Stats:** rating history, progress by level and by rating, tags, streaks, and what Arjun remembers about you.

## Setup on your Mac, step by step

### 1. Install the prerequisites (one time)

```bash
# Xcode Command Line Tools: gives clang++ (compiler) and clangd (autocomplete)
xcode-select --install

# Homebrew, if you don't have it (https://brew.sh)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Node.js 22 LTS (20.19+ also works) and Ollama (runs Arjun locally)
brew install node@22 ollama
```

Check everything is there:

```bash
node -v            # v22.x (or v20.19+)
npm -v
clang++ --version  # Apple clang
xcrun --find clangd
ollama --version
```

You'll need an Apple Silicon Mac with **16 GB+ RAM** (24 GB recommended; gpt-oss-20b uses about 13 GB) and about **20 GB of free disk**.

### 2. Get the code

```bash
git clone https://github.com/Dharma-Raghava-Sai-Shashank/okiro-master.git
cd okiro-master
npm install        # downloads Electron and all libraries (a few minutes)
```

### 3. Check it

```bash
npm test           # unit tests: roadmap math, output checker, contest classifier, editorial splitter, KB parser
npm run typecheck  # TypeScript, main + UI
```

### 4. Download Arjun's models (one time, about 13.3 GB)

You can do this from inside the app on first launch, or now in a terminal:

```bash
ollama serve &                 # skip if the Ollama app is already running
ollama pull gpt-oss:20b        # Arjun's brain (~13 GB)
ollama pull nomic-embed-text   # knowledge-base search (~300 MB)
```

### 5. Launch

```bash
npm run dev
```

Then on first launch:
1. **Enter your Codeforces handle.** Contests, problems and your solved list sync automatically (the first sync takes about 10 seconds).
2. **Set up Arjun.** Click **Start** (Ollama), then **Download** for anything missing, then **Index** for the knowledge base. You can skip this and do it later in **Settings → Arjun**.
3. **Settings → Log in to Codeforces.** This is a one-time login inside the app, needed for **Submit**.
4. *(Optional)* **Settings → Anthropic API key** turns on the ☁️ toggle in Arjun's chat, which sends a conversation to Claude for really hard problems.

### 6. Daily use

- **Home** says hi (Arjun greets you each day) and shows **Up next**. Click **Solve**.
- In the **Workspace**:
  1. Read the statement, or click **Explain** in Arjun's panel.
  2. Brainstorm with Arjun. The spoiler slider controls how much he gives away.
  3. Write code: type `cp` + Enter for the template, and `dsu`, `segtree`, `modint`, `lazyseg`, … for snippets.
  4. **⌘↵** runs the samples and your custom tests. **⌘⇧↵** submits to Codeforces.
  5. When a verdict arrives, Arjun reacts. On a WA he can stress-test your code to find a failing input.
- **Calendar** and **Stats** track your daily goal, streak and progress toward 2100.

### 7. Build a standalone app (optional)

```bash
npm run build:mac   # creates dist/Okiro CF-<version>.dmg
```

The app isn't code-signed, so the first time you open it, right-click → **Open**.

### Updating

```bash
git pull && npm install && npm run dev
```

Your data (progress, code, chats, Arjun's memory) lives in `~/Library/Application Support/Okiro CF` and survives updates.

## How Arjun works

Each message assembles the following:
- **The persona and critical-thinking protocol** (`resources/persona/arjun.md`): constraints, then complexity budget, then small cases, observations, candidate techniques, checking against the samples, and finally trying to break the idea.
- **Facts from the database:** roadmap position, today's goal, streak, and your rating. He never invents these numbers.
- **The current problem:** statement, constraints, and your current code, local test results and Codeforces verdicts.
- **Knowledge-base notes:** the top matches from `resources/kb/*.md`, found by embedding search with keyword search as a fallback.
- **The hidden editorial:** fetched from the contest's Tutorial blog and split per problem. It's marked "never reveal beyond the spoiler level". Its job is to point his hints at the *correct* idea.
- **Tools** (up to 6 calls per reply, each shown in the chat):
  - `run_tests`, `run_code`, `stress_test` (a brute force and a generator against your code)
  - `search_knowledge`, `get_editorial`, `get_user_history`

After an AC he saves a note about the solve, plus a one-line lesson, and uses them in later sessions.

Spoiler levels: **Nudge → Hint → Approach → Pseudocode → Full solution** (the slider in the chat).

## Where things live

| | |
|---|---|
| `src/main` | Electron main process: Codeforces API, scraping and submit, runner, clangd bridge, LLM providers, Arjun, SQLite (`node:sqlite`) |
| `src/renderer` | React 19 + Tailwind v4 UI |
| `src/shared` | Typed IPC contract shared by both sides |
| `resources/kb` | Arjun's knowledge base. Add or edit `.md` files, then click **Re-index** in Settings |
| `resources/persona/arjun.md` | Arjun's persona. You can also override it in Settings |
| `resources/include/bits/stdc++.h` | Shim, because Apple clang doesn't ship `bits/stdc++.h` |
| `~/Library/Application Support/Okiro CF` | Your database, code, compiled binaries and Codeforces browser session |

## Troubleshooting

- **A "Codeforces — verification" window pops up.** That's a Cloudflare check. Complete it once and the app continues.
- **Auto-submit can't find the form.** Your code is copied to the clipboard and the submit page is left open, so paste it and submit by hand. The verdict is still tracked.
- **`ordered_set` / `__gnu_pbds`** only exists in GCC. Run `brew install gcc`, then set the compiler to `g++-14` in Settings.
- **Arjun says "not ready".** Check **Settings → Arjun**: Ollama must be running and the model downloaded.
- **Running this on a managed or company laptop.** Endpoint security tools (e.g. CrowdStrike) may flag the app compiling and running C++ binaries, starting `clangd`/`ollama`, or scripting the Codeforces site. Check with your IT team first.
