#!/usr/bin/env bash
# Claim an issue: assign it to the current gh user, move it to "In Progress" in the project
# and set its Start date to today (Europe/Paris) unless it already has one.
# Usage: scripts/project/claim.sh <issue-number>

source "$(dirname "$0")/lib.sh"

number=${1:?usage: claim.sh <issue-number>}

load_project
load_item "$number"
[ -z "$ITEM_ID" ] && add_item

"$GH" issue edit "$number" --add-assignee @me >/dev/null
set_status_in_progress
if [ -z "$ITEM_START" ]; then
  set_date "$START_FIELD_ID" "$(today)"
  echo "#$number: In Progress, Start date $(today)"
else
  echo "#$number: In Progress, Start date kept ($ITEM_START)"
fi
