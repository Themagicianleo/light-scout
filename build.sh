#!/bin/sh
# Wraps src/app.html (also the claude.ai artifact source) into the standalone, installable index.html that GitHub Pages serves,
# and adds the Spotter's Light Planner (planner/, vendor/leaflet/), which lives in separate files.
cd "$(dirname "$0")"
{
  printf '<!doctype html>\n<html lang="en"><head><meta charset="utf-8">\n'
  printf '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n'
  printf '<link rel="manifest" href="manifest.webmanifest">\n'
  printf '<link rel="stylesheet" href="vendor/leaflet/leaflet.css">\n'
  printf '<link rel="stylesheet" href="planner/planner.css">\n'
  printf '<link rel="icon" href="icons/icon.svg" type="image/svg+xml">\n'
  printf '<link rel="apple-touch-icon" href="icons/apple-touch-icon.png">\n'
  printf '<meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes">\n'
  printf '<meta name="apple-mobile-web-app-title" content="Light Scout">\n'
  printf '<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">\n'
  printf '<meta name="description" content="Golden hour, blue hour, sun direction and sky forecast for photographers.">\n'
  printf '<style>html,body{margin:0}body{font-size:14px}img{max-width:100%%}[hidden]{display:none!important}:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}</style>\n'
  printf '</head><body>\n'
  cat src/app.html
  # Spotter's Light Planner: Leaflet (map) and the planner's own modules, kept in separate files.
  printf '\n<script defer src="vendor/leaflet/leaflet.js"></script>\n'
  printf '<script type="module" src="planner/main.js"></script>\n'
  printf '<script>if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));</script>\n'
  printf '</body></html>\n'
} > index.html
