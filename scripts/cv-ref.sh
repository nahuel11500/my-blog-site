#!/usr/bin/env bash
#
# When, and from which country, the CV copy carrying a given reference was
# downloaded. The reference is in the copy's metadata: `pdfinfo <file>` shows
#   Subject: Downloaded from nahuelcanavy.com/cv on ... - ref 7F3A-9C1E
# See "CV" in the README. Same .env as scripts/stats.sh.
#
# Usage: ./scripts/cv-ref.sh 7F3A-9C1E

set -euo pipefail

cd "$(dirname "$0")/.."
[ -f .env ] && set -a && . ./.env && set +a

: "${CLOUDFLARE_ACCOUNT_ID:?not set — see scripts/stats.sh}"
: "${CLOUDFLARE_API_TOKEN:?not set — see scripts/stats.sh}"

REF="${1:?usage: $0 <ref, e.g. 7F3A-9C1E>}"
[[ "$REF" =~ ^[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}$ ]] || { echo "not a reference: $REF" >&2; exit 1; }
REF="${REF^^}"

# -f: an API error (expired token, missing permission) fails the script
# instead of reaching jq as a row of empty fields.
rows=$(curl -fsS "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/analytics_engine/sql" \
	-H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
	--data "
		SELECT timestamp, blob3 AS country, blob2 AS referrer, blob4 AS host, blob6 AS bot
		FROM blog_pageviews
		WHERE blob5 = 'download' AND blob7 = '${REF}'
		ORDER BY timestamp
		FORMAT JSONEachRow
	" | jq -r '[.timestamp, .country, .referrer, .host, (if .bot == "" then "person" else "bot:" + .bot end)] | @tsv')

if [ -z "$rows" ]; then
	echo "no download with ref ${REF} (unknown, or older than 3 months)"
else
	printf 'time\tcountry\treferrer\thost\tverdict\n%s\n' "$rows" | column -t -s $'\t'
fi
