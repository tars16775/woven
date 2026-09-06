#!/bin/zsh
# Stop Woven on this Mac and unmount the volume cleanly.
for port in 3000 4000; do
  pids=$(lsof -tiTCP:$port -sTCP:LISTEN 2>/dev/null || true)
  if [ -n "$pids" ]; then echo "Stopping port $port"; kill $pids 2>/dev/null || true; fi
done
sleep 1
if [ -d /Volumes/Woven ]; then
  hdiutil detach /Volumes/Woven >/dev/null 2>&1 && echo "Woven volume unmounted." || echo "Volume busy; leaving it mounted."
fi
echo "Stopped."
