# LeetCode Widget

A transparent glass desktop widget (Tauri + React) that shows your live LeetCode stats on your wallpaper.

## Download
Grab the latest installer from the [Releases page](https://github.com/RajatMungali/leetcode-widget/releases/latest). Windows may show a SmartScreen warning because the app is not code-signed: click More info, then Run anyway.

## Install
Run the downloaded `LeetCode.Widget_1.0.0_x64-setup.exe`
(or the `.msi`). Windows 10/11, no admin needed.

## Start it
Search **LeetCode Widget** in the Start menu. Only one copy runs; starting it again just shows it.

## First run
Enter your LeetCode username and press Connect. Public profile only, no password.

## What it shows
- Solved count ring with Easy / Medium / Hard
- **Monthly Goal** (default 60): goes up only when your total solved count goes up, so re-solving old problems doesn't count
- Submission heatmap with total submissions, active days, max and current streak

## Using it
- Drag anywhere to move. Drag the edges or corners to resize.
- Hover the top-right for refresh, settings, hide and quit.
- Pencil icon on the goal card changes the monthly target.
- Settings: username, glass blur, glass tint, placement (Desktop = behind apps, On top), click-through, launch on startup, refresh interval (2–5 min).
- Tray icon: click to show/hide; right-click for refresh, settings, click-through toggle, quit.
  If click-through is on you can't click the widget, so turn it off from the tray.

## Build from source
Needs Node, Rust (MSVC) and Visual Studio Build Tools (C++).
```
npm install
npm run tauri build
```

## Notes
- LeetCode's public API only gives the latest 20 accepted submissions, so the widget saves the monthly starting total locally and works from that.
- Data refreshes every few minutes, when the widget gains focus, and on manual refresh.
