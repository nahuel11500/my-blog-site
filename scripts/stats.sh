#!/usr/bin/env bash
#
# Page-view stats from Workers Analytics Engine.
#
# Needs a gitignored .env — this repo is public, so never commit the token:
#   CLOUDFLARE_ACCOUNT_ID=...
#   CLOUDFLARE_API_TOKEN=...   # permission: Account Analytics -> Read
#
# Usage:
#   ./scripts/stats.sh [days]     # production only, default 7 days
#   HOST=all ./scripts/stats.sh   # every host, incl. workers.dev

set -euo pipefail

cd "$(dirname "$0")/.."
[ -f .env ] && set -a && . ./.env && set +a

: "${CLOUDFLARE_ACCOUNT_ID:?not set — see the comments in this file}"
: "${CLOUDFLARE_API_TOKEN:?not set — see the comments in this file}"

DAYS="${1:-7}"
HOST="${HOST:-nahuelcanavy.com}"
DATASET="blog_pageviews"
API="https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/analytics_engine/sql"

# blob4 is the serving host: previews and *.workers.dev write to this same
# dataset, and counting them as readers would be a lie.
SCOPE="timestamp > now() - INTERVAL '${DAYS}' DAY"
[ "$HOST" = "all" ] || SCOPE="${SCOPE} AND blob4 = '${HOST}'"

echo "── ${HOST}, last ${DAYS}d ──"

# sum(_sample_interval), not count(): it is the sampling weight, so the total
# stays true even if Analytics Engine sampled under load.
report() {
	local title="$1" column="$2" limit="${3:-}"

	printf '\n=== %s ===\n' "$title"
	curl -sS "$API" \
		-H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
		--data "
			SELECT ${column} AS key, sum(_sample_interval) AS views
			FROM ${DATASET}
			WHERE ${SCOPE}
			GROUP BY key
			ORDER BY views DESC
			${limit}
			FORMAT JSONEachRow
		" | jq -r '[.key, .views] | @tsv' | column -t
}

report 'Top pages' blob1
report 'Referrers' blob2
report 'Countries' blob3 'LIMIT 15'
report 'Hosts' blob4

printf '\n=== Views per day ===\n'
curl -sS "$API" \
	-H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
	--data "
		SELECT toDate(timestamp) AS day, sum(_sample_interval) AS views
		FROM ${DATASET}
		WHERE ${SCOPE}
		GROUP BY day
		ORDER BY day
		FORMAT JSONEachRow
	" | jq -r '[.day, .views] | @tsv' | column -t
