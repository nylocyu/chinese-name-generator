# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start          # Production — node server.js on port 3000
npm run dev        # Development — node --watch server.js (auto-restarts on file change)
```

Requires a `.env` file with `ANTHROPIC_API_KEY=sk-ant-...` (copy from `.env.example`).

## Architecture

**Node.js/Express backend + vanilla JS frontend.** No build step — all frontend files are served as static assets from `public/`.

### Backend (`server.js`)
Two API routes call `claude-opus-4-6` via the Anthropic SDK and return JSON:
- `POST /api/generate` — accepts `{ name, gender, soundPreference, style }`, returns a structured Chinese name with pinyin, meanings, cultural note, pronunciation tip
- `POST /api/check` — accepts `{ name }` (Chinese characters), returns authenticity score, character analysis, verdict

Both routes prompt Claude to return raw JSON, extract it with a regex (`/\{[\s\S]*\}/`), and parse it before forwarding to the client.

### Frontend
Two pages: `public/index.html` (generator quiz) and `public/checker.html` (name checker). Each page has a corresponding JS file in `public/js/`.

**Quiz flow** (`generator.js`): 4-step state machine in a single `state` object. Steps are absolutely positioned and transition with CSS `opacity` + `translateX`. On submit, the quiz card is hidden and a loading state shown; on success, `#quiz-section` is hidden and `#result-section` revealed. `resetQuiz()` restores all state and DOM to initial.

**Checker flow** (`checker.js`): Single form submission, SVG ring animation driven by `stroke-dashoffset` (circumference ≈ 219.9 for r=35).

### Styling (`public/css/styles.css`)
Single shared stylesheet for both pages using CSS custom properties (`--accent`, `--gold`, `--bg-card`, etc.). Decorative background characters are rendered via `body::before` / `body::after` pseudo-elements. Google Fonts: Cormorant Garamond (headings), DM Sans (UI), Noto Serif SC (Chinese characters).
