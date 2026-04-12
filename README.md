# D2L Assignment Tracker

A Chrome extension that adds a side panel to D2L (Brightspace) showing your upcoming assignment due dates without digging through course pages.

## What It Does

D2L buries assignment due dates across multiple pages and course tabs. 
This extension fixes that by pulling your assignments and displaying them in a clean side panel right when you need them.

- Fetches all assignments for a course automatically
- Side panel view with upcoming due dates sorted by date
- Works directly on D2L without any extra setup
- More features to come (see roadmap)

## Installation (Manual or Web Store)

Note: This extension will work on ANY Chromium based browser.
(Google Chrome, Microsoft Edge, Opera, Brave, ect)

Install from Google Web Store:

Search "Spark for Brightspace" or use this [Link](https://chromewebstore.google.com/detail/spark-for-brightspace/blajgfkdhpfijoemghigapachifplibd)

Install manually:

1. Clone or download this repo
```bash
git clone https://github.com/CamCatTay/spark-for-brightspace.git
```

2. Open Chrome and navigate to `chrome://extensions/`
3. Enable Developer Mode
4. Click Load unpacked and select the project folder
5. Navigate to any D2L course page the side panel icon will appear

## How It Works

The extension runs on D2L (Brightspace) pages and uses the D2L API to read assignment data for the active course. 
Results are displayed in a persistent side panel so you can stay oriented without leaving the page.

## Roadmap

- [x] Fetch assignments from all courses
- [x] Side panel with due date display
- [x] Frequency graph to see what days of the week are the most dense
- [x] Color coded course names and notch indicators on scroll bar
- [x] Color-coded urgency indicators (due soon, overdue)
- [ ] Grade display alongside assignments
- [ ] Notifications / reminders for upcoming deadlines
- [ ] Export to calendar (Google Calendar / .ics)

## Contributing

Found a bug or have a feature idea? Open an issue. This is a side project but feedback is welcome.

## License

Copyright (c) 2026 CamCatTay and yousef-0614. All rights reserved.

This project is free to use for personal and educational purposes. 
However, you may not redistribute, republish, rebrand, or submit any 
version of this project modified or unmodified to the Chrome Web Store 
or any other platform under your own name or any other identity. Forks 
for private personal use are permitted, but public redistribution of 
derivative works is not. Ownership and authorship of this project remain 
exclusively with the original creators.
