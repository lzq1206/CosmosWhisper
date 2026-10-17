# ScriptWidget packages

These two `.swt` files are ScriptWidget Package 2.0 ZIP archives:

- `exports/visible-sky.swt` — Shanghai “可见天区” version.
- `exports/active-planisphere.swt` — Shanghai “活动星盘” version based on the Watch dial.

Both packages bundle their chart PNG and need no network permission. The chart is a snapshot generated from the current repository renderer. The hour and minute hands follow the device clock; the second hand uses ScriptWidget’s native `clockSecond` animation.

To rebuild the chart images and both import files, run `npm run generate:scriptwidget` from the repository root. To import, open the `.swt` file on iPhone or iPad and choose ScriptWidget from the share sheet.
