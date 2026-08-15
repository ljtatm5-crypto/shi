#!/usr/bin/env bash
set -e
cd "/mnt/d/挑战杯/网站/试用版"
git add product.html js/main.js
git commit -m "feat(product): step 5 daily summary now reflects current meal calories

- Replace hardcoded 1650/1800 kcal, 82% with live values driven by
  the calories_kcal computed in step 4.
- Add updateDailySummary() with robust fallback: writes to
  [data-daily] slots when present, otherwise rewrites any legacy
  'N / M kcal' + 'X%' nodes so cached HTML also updates.
- Trigger the refresh on image recognition, on step-3 recalculation,
  when the user opens step 5, and once on DOMContentLoaded."
git push origin HEAD
echo "---"
git log --oneline -3
