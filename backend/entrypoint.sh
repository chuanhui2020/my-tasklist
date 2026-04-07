#!/bin/sh
# Ensure logs directory is writable
mkdir -p /app/logs
chown appuser:appuser /app/logs 2>/dev/null || true

exec gosu appuser "$@"
