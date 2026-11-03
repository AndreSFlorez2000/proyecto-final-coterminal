#!/usr/bin/env sh
cd "$(dirname "$0")" || exit 1
printf '%s\n' 'Control OC D1: abre http://localhost:5500 (Ctrl+C para cerrar)'
python3 -m http.server 5500 --bind 127.0.0.1