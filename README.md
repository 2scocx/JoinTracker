# JointTracker v4 — Stats + i18n + Undo + Notifications

This version adds:
- language selection (English, Italian, French, Spanish)
- more stats: bell-curve posterior (λ), percentile vs simulated global sample
- confidence intervals via posterior variance and bell curve visualization
- interactive charts (ResponsiveContainer + Brush) for zooming/selection
- Undo per entry and general undo stack, with restore
- Notification toggle that requests permission and can show predicted-now prompts

## Run
1. unzip and open folder in VS Code
2. npm install
3. npm run dev
4. open http://localhost:5173

Notes:
- Notifications use the Web Notifications API; you must allow them in the browser.
- Global distribution is simulated for percentile comparisons.
