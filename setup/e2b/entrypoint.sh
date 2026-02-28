#!/bin/bash

# ─── TestDriver E2B Sandbox Entrypoint ───────────────────────────────────────
# Starts the Linux desktop environment, then launches the testdriver-runner.

export DISPLAY=:0
export XAUTHORITY="${HOME}/.Xauthority"
SCREEN_WIDTH="${SCREEN_WIDTH:-1366}"
SCREEN_HEIGHT="${SCREEN_HEIGHT:-768}"

# Start the desktop environment (Xvfb, XFCE, x11vnc, noVNC)
# Uses the shared start-desktop.sh script if available, otherwise inline startup
if [ -x /home/user/scripts/start-desktop.sh ]; then
  echo "[entrypoint] Starting desktop via start-desktop.sh..."
  /home/user/scripts/start-desktop.sh &
  sleep 10
else
  # Fallback: inline desktop startup for Docker/non-E2B environments
  # Create Xauthority so Xlib can connect to the display
  touch "$XAUTHORITY" 2>/dev/null || true
  xauth generate :0 . trusted 2>/dev/null || true

  # Start Xvfb (flags match E2B desktop SDK)
  echo "[entrypoint] Starting Xvfb on :0 (${SCREEN_WIDTH}x${SCREEN_HEIGHT}x24)"
  Xvfb :0 -ac -screen 0 "${SCREEN_WIDTH}x${SCREEN_HEIGHT}x24" -retro -nolisten tcp &
  XVFB_PID=$!
  sleep 2

  # Verify Xvfb is actually running
  for _i in $(seq 1 10); do
    xdpyinfo -display :0 > /dev/null 2>&1 && break
    sleep 1
  done

  if ! kill -0 $XVFB_PID 2>/dev/null; then
    echo "[entrypoint] ERROR: Xvfb failed to start, retrying..."
    Xvfb :0 -ac -screen 0 "${SCREEN_WIDTH}x${SCREEN_HEIGHT}x24" -retro -nolisten tcp &
    XVFB_PID=$!
    sleep 3
  fi

  # Disable X11 screen blanking & DPMS
  xset s off 2>/dev/null || true
  xset s noblank 2>/dev/null || true
  xset -dpms 2>/dev/null || true

  # Start XFCE desktop
  echo "[entrypoint] Starting XFCE desktop..."
  startxfce4 &
  sleep 3

  # Kill power manager and error dialogs (not needed in headless)
  killall xfce4-power-manager 2>/dev/null || true
  xdotool search --name "Error" windowclose 2>/dev/null || true
  xdotool search --name "Power Manager" windowclose 2>/dev/null || true

  # Start X server monitor (auto-restarts Xvfb if it crashes)
  if [ -x /home/user/scripts/monitor_x.sh ]; then
    echo "[entrypoint] Starting X server monitor..."
    /home/user/scripts/monitor_x.sh &
  fi

  # Start x11vnc for VNC access
  # -noxdamage: poll framebuffer instead of relying on XDAMAGE (broken in Xvfb)
  # -fixscreen V=2: full screen refresh every 2s to fix stale/black frames
  echo "[entrypoint] Starting x11vnc..."
  x11vnc -display :0 -forever -nopw -shared -rfbport 5900 \
    -noxdamage -fixscreen V=2 \
    -bg -o /dev/null 2>/dev/null || true

  # Start noVNC web viewer on port 6080
  if [ -d /opt/noVNC ]; then
    echo "[entrypoint] Starting noVNC on port 6080..."
    /opt/noVNC/utils/novnc_proxy --vnc localhost:5900 --listen 6080 &
  fi

  # Trap signals for clean shutdown
  trap "kill $XVFB_PID 2>/dev/null; exit 0" SIGTERM SIGINT
fi

# ─── Start TestDriver Runner ─────────────────────────────────────────────────
echo "[entrypoint] Starting testdriver-runner..."
exec testdriver-runner "$@"
