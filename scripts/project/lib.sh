# Shared helpers for the GitHub Project "Mon ptit President" (user project #13).
# Sourced by claim.sh and end-date.sh; field and option ids are resolved by name at run time.
# Needs a gh token with the `project` scope (`gh auth refresh -s project`).

set -euo pipefail

PROJECT_OWNER="${PROJECT_OWNER:-Jean-MarcCheynier}"
PROJECT_NUMBER="${PROJECT_NUMBER:-13}"

# gh on Linux/CI, gh.exe from WSL.
GH="${GH:-$(command -v gh || command -v gh.exe || true)}"
if [ -z "$GH" ]; then
  echo "gh CLI not found" >&2
  exit 1
fi

today() { TZ=Europe/Paris date +%F; }

repo() {
  if [ -n "${GITHUB_REPOSITORY:-}" ]; then
    echo "$GITHUB_REPOSITORY"
  else
    "$GH" repo view --json nameWithOwner -q .nameWithOwner | tr -d '\r'
  fi
}

# Loads PROJECT_ID, STATUS_FIELD_ID, START_FIELD_ID, END_FIELD_ID and IN_PROGRESS_OPTION_ID.
load_project() {
  local out
  out=$("$GH" api graphql -f owner="$PROJECT_OWNER" -F number="$PROJECT_NUMBER" -f query='
    query($owner: String!, $number: Int!) {
      repositoryOwner(login: $owner) {
        ... on ProjectV2Owner {
          projectV2(number: $number) {
            id
            status: field(name: "Status") {
              ... on ProjectV2SingleSelectField { id options { id name } }
            }
            start: field(name: "Start date") { ... on ProjectV2Field { id } }
            end: field(name: "End date") { ... on ProjectV2Field { id } }
          }
        }
      }
    }' -q '.data.repositoryOwner.projectV2 | [
      .id,
      .status.id,
      .start.id,
      .end.id,
      (.status.options[] | select(.name == "In Progress") | .id)
    ] | @tsv' | tr -d '\r')
  IFS=$'\t' read -r PROJECT_ID STATUS_FIELD_ID START_FIELD_ID END_FIELD_ID IN_PROGRESS_OPTION_ID <<<"$out"
  if [ -z "${IN_PROGRESS_OPTION_ID:-}" ]; then
    echo "Project $PROJECT_OWNER/$PROJECT_NUMBER: missing Status/In Progress, Start date or End date" >&2
    exit 1
  fi
}

# Loads ISSUE_ID, ITEM_ID (empty if the issue is not in the project), ITEM_START and ITEM_END.
load_item() {
  local number=$1 r out
  r=$(repo)
  out=$("$GH" api graphql -f owner="${r%/*}" -f name="${r#*/}" -F number="$number" -f query='
    query($owner: String!, $name: String!, $number: Int!) {
      repository(owner: $owner, name: $name) {
        issue(number: $number) {
          id
          projectItems(first: 50) {
            nodes {
              id
              project { id }
              start: fieldValueByName(name: "Start date") { ... on ProjectV2ItemFieldDateValue { date } }
              end: fieldValueByName(name: "End date") { ... on ProjectV2ItemFieldDateValue { date } }
            }
          }
        }
      }
    }' -q '.data.repository.issue | [
      .id,
      ((.projectItems.nodes[] | select(.project.id == "'"$PROJECT_ID"'")) // {} | (.id // "-"), (.start.date // "-"), (.end.date // "-"))
    ] | @tsv' | tr -d '\r')
  IFS=$'\t' read -r ISSUE_ID ITEM_ID ITEM_START ITEM_END <<<"$out"
  [ "$ITEM_ID" = "-" ] && ITEM_ID=""
  [ "$ITEM_START" = "-" ] && ITEM_START=""
  [ "$ITEM_END" = "-" ] && ITEM_END=""
  return 0
}

add_item() {
  ITEM_ID=$("$GH" api graphql -f projectId="$PROJECT_ID" -f contentId="$ISSUE_ID" -f query='
    mutation($projectId: ID!, $contentId: ID!) {
      addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) { item { id } }
    }' -q '.data.addProjectV2ItemById.item.id' | tr -d '\r')
}

set_date() {
  local field_id=$1 date=$2
  "$GH" api graphql -f projectId="$PROJECT_ID" -f itemId="$ITEM_ID" -f fieldId="$field_id" -f date="$date" -f query='
    mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $date: Date!) {
      updateProjectV2ItemFieldValue(input: {
        projectId: $projectId, itemId: $itemId, fieldId: $fieldId, value: { date: $date }
      }) { projectV2Item { id } }
    }' >/dev/null
}

clear_field() {
  local field_id=$1
  "$GH" api graphql -f projectId="$PROJECT_ID" -f itemId="$ITEM_ID" -f fieldId="$field_id" -f query='
    mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!) {
      clearProjectV2ItemFieldValue(input: { projectId: $projectId, itemId: $itemId, fieldId: $fieldId }) {
        projectV2Item { id }
      }
    }' >/dev/null
}

set_status_in_progress() {
  "$GH" api graphql -f projectId="$PROJECT_ID" -f itemId="$ITEM_ID" -f fieldId="$STATUS_FIELD_ID" \
    -f optionId="$IN_PROGRESS_OPTION_ID" -f query='
    mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
      updateProjectV2ItemFieldValue(input: {
        projectId: $projectId, itemId: $itemId, fieldId: $fieldId,
        value: { singleSelectOptionId: $optionId }
      }) { projectV2Item { id } }
    }' >/dev/null
}
