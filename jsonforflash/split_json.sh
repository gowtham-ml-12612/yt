#!/bin/bash
# split_json.sh — splits a JSON array file into parts of 5 objects each
#
# Usage:
#   ./split_json.sh source/19_mar_2026_ronaldo_stats.json
#
# Output:
#   splittedjson/19_mar_2026/part1.json
#   splittedjson/19_mar_2026/part2.json
#   ...

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <path-to-json-file>"
  exit 1
fi

JSON_FILE="$1"

if [ ! -f "$JSON_FILE" ]; then
  echo "Error: File '$JSON_FILE' not found."
  exit 1
fi

# Require jq
if ! command -v jq &>/dev/null; then
  echo "Error: 'jq' is required but not installed. Run: brew install jq"
  exit 1
fi

# Extract filename without extension  e.g. 19_mar_2026_ronaldo_stats
BASENAME=$(basename "$JSON_FILE" .json)

# Date = first 3 underscore-separated segments  e.g. 19_mar_2026
DATE_PART=$(echo "$BASENAME" | cut -d'_' -f1-3)

# Output folder lives next to this script
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
OUTPUT_DIR="$SCRIPT_DIR/splittedjson/$DATE_PART"

mkdir -p "$OUTPUT_DIR"

# Count total items in the array
TOTAL=$(jq 'length' "$JSON_FILE")
echo "Splitting $TOTAL objects into parts of 5 → $OUTPUT_DIR"

PART=1
INDEX=0
while [ "$INDEX" -lt "$TOTAL" ]; do
  OUT="$OUTPUT_DIR/part${PART}.json"
  jq ".[$INDEX:$((INDEX + 5))]" "$JSON_FILE" > "$OUT"
  echo "  created: part${PART}.json"
  INDEX=$((INDEX + 5))
  PART=$((PART + 1))
done

echo "Done. $((PART - 1)) part(s) written to: $OUTPUT_DIR"
