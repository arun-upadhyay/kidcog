#!/usr/bin/env bash
#
# KidCog: stop anything already running, then start the API server and the
# Expo app together.
#
#   ./dev.sh            start everything (Expo shows its QR code; press w/i/a)
#   ./dev.sh --web      same, and open the web version in your browser
#   ./dev.sh --clear    same, and clear Expo's cache first (use after odd errors
#                       or after changing app/.env)
#   ./dev.sh stop       stop everything and exit
#
# The server runs in the background and writes to logs/server.log
# (watch it live with:  tail -f logs/server.log). Expo runs in this window.
# Press Ctrl+C to stop Expo; the server is stopped with it.
#
# Written for the bash that ships with macOS (3.2), so no newer bash features.

set -u

ROOT="$(cd "$(dirname "$0")" && pwd)"
SERVER_DIR="$ROOT/server"
APP_DIR="$ROOT/app"
LOG_DIR="$ROOT/logs"
SERVER_LOG="$LOG_DIR/server.log"
EXPO_PORTS="8081 8082 8083 19000 19001 19002"

# Use the server's PORT from server/.env if set, otherwise 4000.
SERVER_PORT=4000
if [ -f "$SERVER_DIR/.env" ]; then
  p="$(grep -E '^[[:space:]]*PORT[[:space:]]*=' "$SERVER_DIR/.env" | tail -n 1 | cut -d= -f2 | tr -d '[:space:]"'"'")"
  case "$p" in ''|*[!0-9]*) ;; *) SERVER_PORT="$p" ;; esac
fi

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }
fail() { printf '  \033[31m✗\033[0m %s\n' "$*"; }

# ---------------------------------------------------------------------------
# Stopping
# ---------------------------------------------------------------------------

pids_on_port() {
  lsof -nP -t -iTCP:"$1" -sTCP:LISTEN 2>/dev/null | sort -u
}

stop_port() {
  port="$1"; label="$2"
  pids="$(pids_on_port "$port")"
  [ -z "$pids" ] && return 0
  # Ask nicely first, then insist.
  kill $pids 2>/dev/null
  i=0
  while [ -n "$(pids_on_port "$port")" ] && [ $i -lt 10 ]; do sleep 0.5; i=$((i + 1)); done
  pids="$(pids_on_port "$port")"
  if [ -n "$pids" ]; then kill -9 $pids 2>/dev/null; sleep 0.5; fi
  if [ -n "$(pids_on_port "$port")" ]; then
    fail "Could not free port $port ($label). Close whatever is using it and try again."
    return 1
  fi
  ok "Stopped $label on port $port"
}

stop_project_processes() {
  # Leftover watchers from this project that may not be holding a port
  # (for example a tsx watcher whose server crashed).
  for pattern in "$SERVER_DIR/node_modules/.bin/tsx" "tsx watch src/index.ts" "$APP_DIR/node_modules/.bin/expo" "expo start"; do
    for pid in $(pgrep -f "$pattern" 2>/dev/null); do
      [ "$pid" = "$$" ] && continue
      # Only processes started inside this project folder.
      cwd="$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p')"
      case "$cwd" in "$ROOT"*) kill "$pid" 2>/dev/null && ok "Stopped leftover process $pid ($pattern)";; esac
    done
  done
}

stop_all() {
  bold "Stopping anything already running…"
  stop_port "$SERVER_PORT" "API server" || exit 1
  for port in $EXPO_PORTS; do stop_port "$port" "Expo" || exit 1; done
  stop_project_processes
  ok "Nothing left running"
}

# ---------------------------------------------------------------------------
# Checks
# ---------------------------------------------------------------------------

check_setup() {
  bold "Checking setup…"
  if ! command -v node >/dev/null 2>&1; then fail "Node.js is not installed."; exit 1; fi
  if ! command -v lsof >/dev/null 2>&1; then fail "lsof is missing (it ships with macOS)."; exit 1; fi
  node_major="$(node -p 'process.versions.node.split(".")[0]')"
  if [ "$node_major" != "22" ]; then
    warn "Node $(node -v) is installed; the server is built and deployed on Node 22. It should still run."
  else
    ok "Node $(node -v)"
  fi

  if [ ! -f "$SERVER_DIR/.env" ]; then fail "server/.env is missing (copy server/.env.example and fill it in)."; exit 1; fi
  if [ ! -f "$APP_DIR/.env" ]; then fail "app/.env is missing (copy app/.env.example and fill it in)."; exit 1; fi
  ok "server/.env and app/.env found"

  for dir in "$SERVER_DIR" "$APP_DIR"; do
    name="$(basename "$dir")"
    if [ ! -d "$dir/node_modules" ] || [ "$dir/package.json" -nt "$dir/node_modules" ]; then
      warn "Installing packages in $name/ (first run or package.json changed)…"
      (cd "$dir" && npm install --no-fund --no-audit) || { fail "npm install failed in $name/"; exit 1; }
      touch "$dir/node_modules"
    fi
  done
  ok "Packages installed"
}

# ---------------------------------------------------------------------------
# Starting
# ---------------------------------------------------------------------------

SERVER_PID=""

start_server() {
  bold "Starting the API server…"
  mkdir -p "$LOG_DIR"
  : > "$SERVER_LOG"
  (cd "$SERVER_DIR" && exec npm run dev) >> "$SERVER_LOG" 2>&1 &
  SERVER_PID=$!

  # Wait for /health to answer (up to 45 seconds).
  i=0
  until curl -fs "http://localhost:$SERVER_PORT/health" >/dev/null 2>&1; do
    # tsx watch keeps running after the server itself crashes, so also look
    # for an error in the log rather than waiting out the full timeout.
    if ! kill -0 "$SERVER_PID" 2>/dev/null || grep -qE '(^|[[:space:]])[A-Za-z]*Error(:| \[)|EADDRINUSE' "$SERVER_LOG"; then
      sleep 1
      fail "The server stopped while starting. Last lines of logs/server.log:"
      tail -n 25 "$SERVER_LOG" | sed 's/^/      /'
      exit 1
    fi
    i=$((i + 1))
    if [ $i -gt 90 ]; then
      fail "The server did not answer on port $SERVER_PORT within 45 seconds. Last lines of logs/server.log:"
      tail -n 25 "$SERVER_LOG" | sed 's/^/      /'
      exit 1
    fi
    sleep 0.5
  done
  ok "API server is up: http://localhost:$SERVER_PORT"

  # Surface the warnings the server prints at start-up (bad OpenAI key, missing
  # account-deletion migration, …) instead of burying them in the log.
  sleep 1
  if grep -qE '⚠|✗' "$SERVER_LOG"; then
    warn "The server printed warnings:"
    grep -E '⚠|✗|Fix:|Run supabase' "$SERVER_LOG" | sed 's/^/      /'
  fi
}

# Stop a process and everything it started (npm → tsx watch → node).
kill_tree() {
  for child in $(pgrep -P "$1" 2>/dev/null); do kill_tree "$child"; done
  kill "$1" 2>/dev/null
}

cleanup() {
  trap - INT TERM EXIT
  echo
  bold "Shutting down…"
  if [ -n "$SERVER_PID" ] && kill -0 "$SERVER_PID" 2>/dev/null; then
    kill_tree "$SERVER_PID"
  fi
  stop_port "$SERVER_PORT" "API server" >/dev/null 2>&1
  ok "Stopped. Run ./dev.sh to start again."
}

start_app() {
  bold "Starting the Expo app…"
  echo "      Server log: tail -f logs/server.log"
  echo "      In Expo: press w for web, i for iPhone simulator, a for Android, or scan the QR code."
  echo "      Press Ctrl+C to stop everything."
  echo
  cd "$APP_DIR" || exit 1
  # Not exec: when Expo exits, the trap below also stops the server.
  npx expo start $EXPO_FLAGS
}

# ---------------------------------------------------------------------------

EXPO_FLAGS=""
for arg in "$@"; do
  case "$arg" in
    stop|--stop) stop_all; exit 0 ;;
    --web) EXPO_FLAGS="$EXPO_FLAGS --web" ;;
    --clear|-c) EXPO_FLAGS="$EXPO_FLAGS --clear" ;;
    -h|--help) sed -n '2,16p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) fail "Unknown option: $arg (try ./dev.sh --help)"; exit 1 ;;
  esac
done

cd "$ROOT" || exit 1
stop_all
check_setup
trap cleanup INT TERM EXIT
start_server
start_app
