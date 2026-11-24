#!/usr/bin/env bash
# Set (closed issue) or clear (reopened issue) the End date of an issue's project item.
# Run by .github/workflows/project-end-date.yml; an existing End date is never overwritten.
# Usage: scripts/project/end-date.sh <issue-number> set|clear

source "$(dirname "$0")/lib.sh"

number=${1:?usage: end-date.sh <issue-number> set|clear}
action=${2:?usage: end-date.sh <issue-number> set|clear}

load_project
load_item "$number"
if [ -z "$ITEM_ID" ]; then
  echo "#$number is not in project $PROJECT_OWNER/$PROJECT_NUMBER, nothing to do"
  exit 0
fi

case "$action" in
  set)
    if [ -z "$ITEM_END" ]; then
      set_date "$END_FIELD_ID" "$(today)"
      echo "#$number: End date $(today)"
    else
      echo "#$number: End date kept ($ITEM_END)"
    fi
    ;;
  clear)
    clear_field "$END_FIELD_ID"
    echo "#$number: End date cleared"
    ;;
  *)
    echo "unknown action: $action" >&2
    exit 1
    ;;
esac
