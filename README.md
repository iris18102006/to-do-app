# Tasklane

A small, fast to-do app with lists, priorities, due dates and notes. Written in strict TypeScript, bundled with Vite, no framework and no runtime dependencies.

## Features

- Smart views: Everything, Today, Coming up, Finished
- Custom lists with their own colour swatch
- Priority (low, medium, high), due dates and notes on every task
- Overdue and due-today highlighting
- Search and sorting (newest, due date, priority, A to Z)
- Undo after deleting a task
- Keyboard shortcuts: `n` to add a task, `/` to search
- Light and dark theme, follows your system by default
- Responsive layout, works on phones
- Everything is saved in your browser with `localStorage`, nothing leaves your device

## Getting started

Requires Node 18 or newer.

```bash
git clone https://github.com/<your-username>/tasklane.git
cd tasklane
npm install
npm run dev
```

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server with hot reload |
| `npm run build` | Type-check, then build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | Run the TypeScript compiler without emitting |

## Deploy to GitHub Pages

1. Push the repo to GitHub with `main` as the default branch.
2. Go to Settings, then Pages, and set Source to **GitHub Actions**.
3. Push to `main`. The workflow in `.github/workflows/deploy.yml` builds and publishes the site.

The Vite `base` is relative (`./`), so it works under any repository name.

## Project structure

```
.
├── index.html          Page markup
├── src/
│   ├── main.ts         App logic (state, rendering, events)
│   └── style.css       Styles and theme tokens
├── vite.config.ts
├── tsconfig.json
└── .github/workflows/deploy.yml
```

## Data

Tasks and lists are stored under the `todo-ts-v2` key in `localStorage`. Clearing site data resets the app to its sample tasks.

## License

MIT, see [LICENSE](LICENSE).
