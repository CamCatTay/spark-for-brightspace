# Spark for Brightspace

A Chrome extension that aggregates assignment due dates, quizzes, and discussion deadlines from all your enrolled D2L/Brightspace courses into a single chronological side panel.

D2L buries due dates across individual course pages. This fixes that.

**[Install from the Chrome Web Store](https://chromewebstore.google.com/detail/spark-for-brightspace/blajgfkdhpfijoemghigapachifplibd)** · Works on any Chromium browser (Chrome, Edge, Brave, Opera)

---

## Features

- All upcoming due dates from every enrolled course in one view
- Chronological calendar with date headers ("Today", "Tomorrow")
- Color-coded course indicators — consistent colors per course
- Urgency highlighting: due today (orange), due tomorrow (yellow), overdue (red)
- Frequency bar chart — see which days of the week are the most loaded
- Resizable, persistent side panel that stays visible as you navigate
- Syncs across multiple open D2L tabs (only one panel active at a time)
- Settings: hide specific courses or item types, adjust how far back to look

---

## Install Manually (for development)

```bash
git clone https://github.com/CamCatTay/spark-for-brightspace.git
cd spark-for-brightspace
npm install
npm run build
```

1. Open `chrome://extensions/`
2. Enable **Developer Mode**
3. Click **Load unpacked** → select the repo root
4. Navigate to any D2L page — the Spark icon appears in the toolbar

After any source change: `npm run build`, then click the reload icon on the extension card in `chrome://extensions/`.

---

## Docs

- [CONTRIBUTING.md](CONTRIBUTING.md) — how to work on this project
- [ARCHITECTURE.md](ARCHITECTURE.md) — how the code is structured and why

---

## Roadmap

- [x] Fetch assignments, quizzes, and discussions from all courses
- [x] Chronological calendar view
- [x] Frequency chart
- [x] Color-coded courses + scrollbar notch indicators
- [x] Urgency indicators
- [ ] Grade display alongside assignments
- [ ] Notifications / reminders for upcoming deadlines
- [ ] Export to calendar (Google Calendar / .ics)

---

## Feedback

Found a bug or have a feature idea? Open an issue. This is a side project but feedback is welcome.

---

## License

See [LICENSE](LICENSE). Personal and educational use is permitted. Redistribution or publishing under another identity is not.
