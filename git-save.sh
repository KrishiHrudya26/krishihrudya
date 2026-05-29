#!/bin/bash
cd /var/www/krishihrudya
git add .
git commit -m "auto-save: $(date '+%Y-%m-%d %H:%M')"
git push
echo "✅ Pushed to GitHub!"
