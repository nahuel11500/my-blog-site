#!/usr/bin/env bash
#
# Reader stats from Workers Analytics Engine. See "Analytics" in the README.
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

# blob5 is the event, blob6 the bot reason ('' = looks like a person).
# Rows written before the bot filter existed have both empty: they count as
# views, unfiltered.
PEOPLE="${SCOPE} AND blob6 = ''"
VIEW="blob5 IN ('', 'view')"
READ="blob5 = 'read'"

# sum(_sample_interval), not count(): it is the sampling weight, so the total
# stays true even if Analytics Engine sampled under load.
query() {
	curl -sS "$API" \
		-H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
		--data "$1 FORMAT JSONEachRow"
}

report() {
	local title="$1" column="$2" limit="${3:-}"

	printf '\n=== %s ===\n' "$title"
	query "
		SELECT ${column} AS key, sum(_sample_interval) AS views
		FROM ${DATASET}
		WHERE ${PEOPLE} AND ${VIEW}
		GROUP BY key
		ORDER BY views DESC
		${limit}
	" | jq -r '[.key, .views] | @tsv' | column -t
}

echo "── ${HOST}, last ${DAYS}d, bots filtered out ──"

printf '\n=== Posts: opened vs read to the end ===\n'
query "
	SELECT blob1 AS post,
		sum(if(${VIEW}, _sample_interval, 0)) AS views,
		sum(if(${READ}, _sample_interval, 0)) AS reads
	FROM ${DATASET}
	WHERE ${PEOPLE} AND startsWith(blob1, '/blog/') AND blob1 != '/blog/'
	GROUP BY post
	ORDER BY reads DESC, views DESC
" | jq -r '[.post, .views, .reads] | @tsv' | (echo -e "post\tviews\treads"; cat) | column -t

report 'Top pages' blob1
report 'Referrers' blob2
report 'Countries' blob3 'LIMIT 15'
report 'Hosts' blob4

printf '\n=== Filtered as bots (ua = user-agent, asn = datacenter network) ===\n'
query "
	SELECT blob5 AS event, blob6 AS reason, sum(_sample_interval) AS hits
	FROM ${DATASET}
	WHERE ${SCOPE} AND blob6 != ''
	GROUP BY event, reason
	ORDER BY hits DESC
" | jq -r '[.event, .reason, .hits] | @tsv' | column -t

printf '\n=== Per day ===\n'
query "
	SELECT toDate(timestamp) AS day,
		sum(if(${VIEW}, _sample_interval, 0)) AS views,
		sum(if(${READ}, _sample_interval, 0)) AS reads
	FROM ${DATASET}
	WHERE ${PEOPLE}
	GROUP BY day
	ORDER BY day
" | jq -r '[.day, .views, .reads] | @tsv' | (echo -e "day\tviews\treads"; cat) | column -t
