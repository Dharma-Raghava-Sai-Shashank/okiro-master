# Okiro CF

A dark, Okiro-style desktop app for one goal: **reach Codeforces Master (2100)** by solving every problem rated ≤ 2000 in the last 300 contests, with **Arjun**, a local AI friend and Grandmaster-level coach.

- **Arjun, a voice-first assistant (JARVIS-style):**
  - Press **⌥Space** (or tap the glowing core) and just talk. He talks back, and you can interrupt him mid-sentence.
  - The mic is off unless you start a conversation, and everything stays on your Mac. Speech recognition is Whisper `base.en`, his voice is Kokoro, and both run locally.
  - Drive the app by voice: "open the next problem", "read the problem", "explain it", "run the tests", "submit", "how am I doing?"
  - He's grounded in a curated algorithms knowledge base (local RAG), the official editorial (hidden from you), and real code execution (`run_tests`, `run_code`, `stress_test`). He remembers your weak spots.
  - He runs on any Ollama model. The model is picked for your RAM, and you can escalate to Claude for hard problems.
- **Contests:** a cftracker-style grid (Div 1/2/3/4, Educational, Global, Div 1+2) with clear states:
  - ✓ solved, ✗ tried, to do (≤ your cap), and hatched above-cap problems
  - each contest marked DONE, IN PROGRESS or TO DO
- **Roadmap:** walks the contests from newest to oldest and always knows where you are, e.g. "Round 934 (Div. 2), problem C next".
- **Workspace (IDE-grade):**
  - **Problem:** the statement with math rendered, auto-extracted constraint chips (`n ≤ 2·10^5 → O(n log n)`), section tabs, runnable example cards, a timer and a scratchpad.
  - **Editor:** Monaco with clangd autocomplete and diagnostics, the calm `okiro-night` theme, inline compile errors, a snippet palette (⌘⇧P), and templates.
  - **Run:**
    - **Tests:** a side-by-side diff that highlights the first wrong token, and a time bar against the time limit.
    - **Custom:** run your code on any input.
    - **Submits:** a verdict timeline for your Codeforces submissions.
    - **Stress:** Arjun's counterexamples, with a one-click "Add as test".
  - **Submit** straight to your Codeforces account, with the verdict tracked live.
- **Calendar:** Day, Week, Month and Year views with daily goals and a heatmap.
- **Stats:**
  - a rating gauge with a projected date for reaching 2100, and the roadmap pace with an ETA
  - a 12-month heatmap
  - a verdict donut and first-try AC rate
  - target problems by rating band, and focus-area vs strength tags
  - solve time, when you solve (hour and weekday), and personal bests
  - "Arjun's read", which he can say out loud

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

You'll need an Apple Silicon Mac (8 GB works with `qwen3:4b`; more RAM allows a bigger, smarter model) and about **10 GB of free disk**.

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

### 4. Download Arjun's models (one time)

Pick the brain for your Mac's memory. Settings also recommends one and shows each model's abilities (🛠 tools · 🧠 thinking).

| Your Mac | Model | Size |
|---|---|---|
| 8 GB | `qwen3:4b` (tools + thinking) | ~2.5 GB |
| 16 GB | `qwen3:8b` | ~5 GB |
| 24 GB+ | `gpt-oss:20b` | ~13 GB |

```bash
ollama serve &                 # skip if the Ollama app is already running
ollama pull qwen3:4b           # Arjun's brain on an 8 GB Mac
ollama pull nomic-embed-text   # knowledge-base search (~300 MB)
```

Models without tool support, such as `qwen2.5-coder:3b`, still work. Arjun then reasons from what's on screen, but he can't run tests or open pages himself.

Arjun's ears and voice, Whisper `base.en` (~206 MB) and Kokoro (~325 MB), download automatically the first time you start a voice conversation, then stay cached.

### 5. Launch

```bash
npm run dev
```

Then on first launch:
1. **Enter your Codeforces handle.** Contests, problems and your solved list sync automatically (the first sync takes about 10 seconds).
2. **Set up Arjun.** Click **Start** (Ollama), then **Download** for anything missing, then **Index** for the knowledge base. You can skip this and do it later in **Settings → Arjun**.
3. **Settings → Log in to Codeforces.** This is a one-time login inside the app, needed for **Submit**.
4. *(Optional)* **Settings → Anthropic API key** turns on the ☁️ toggle in Arjun's chat, which sends a conversation to Claude for really hard problems.

### 6. Talking to Arjun

| Do this | How |
|---|---|
| Start / end a conversation | **⌥Space**, or tap the Arjun core |
| Interrupt him | just start talking, or press **Esc** |
| Full-screen HUD | **⌥⇧Space** |
| Transcript / typed chat | **⌘J** |

The first time, macOS asks for microphone access; allow it. Use headphones if he hears himself through the speakers.

Things to say:
- "open the next problem", "open problem 1950 C", "go to stats", "show calendar year view"
- "read the problem", "read sample 2", "explain it", "give me a hint", "more hints" / "fewer hints"
- "run the tests", "run sample 1", "submit" (he asks you to confirm, then you say "yes"), "why is it failing?"
- "how am I doing?", "use Claude" / "use local", "stop", "stop listening"

Anything else goes to Arjun as a normal conversation.

### 7. Daily use

- **Home** shows **Up next** and Arjun's core. Press ⌥Space; he greets you once a day with where you are on the roadmap. Click **Solve** (or say "open the next problem").
- In the **Workspace**:
  1. Read the statement, or say "read the problem" / "explain it".
  2. Brainstorm with Arjun out loud. The spoiler level ("more hints" / "fewer hints", or the slider in the ⌘J transcript) controls how much he gives away.
  3. Write code: type `cp` + Enter for the template, and `dsu`, `segtree`, `modint`, `lazyseg`, … for snippets.
  4. **⌘↵** runs the samples and your custom tests (or say "run the tests"). **⌘⇧↵** submits to Codeforces. **⌘.** toggles focus mode.
  5. When a verdict arrives, Arjun reacts. On a WA he can stress-test your code to find a failing input.
- **Calendar** and **Stats** track your daily goal, streak and progress toward 2100.

### 8. Build a standalone app (optional)

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
