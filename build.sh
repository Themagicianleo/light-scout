#!/bin/sh
# Wraps src/app.html (also the claude.ai artifact source) into the standalone index.html that GitHub Pages serves.
cd "$(dirname "$0")"
{
  printf '<!doctype html>\n<html lang="en"><head><meta charset="utf-8">\n'
  printf '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
  printf '<meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes">\n'
  printf '<style>html,body{margin:0}body{font-size:14px}img{max-width:100%%}:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}</style>\n'
  printf '</head><body>\n'
  cat src/app.html
  printf '\n</body></html>\n'
} > index.html
