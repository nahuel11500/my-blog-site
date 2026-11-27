/**
 * Stamps each download of /cv.pdf, so a copy that turns up somewhere can be
 * dated and checked against the current version at nahuelcanavy.com/cv:
 *   - the footer of each page gets the download date, kept soft;
 *   - the document's Subject (metadata) gets the time and a random reference,
 *     the one recorded with the download event.
 *
 * The PDF is built once (src/pages/cv.pdf.ts) with FOOTER_DEFAULT and
 * META_DEFAULT written as literal strings, uncompressed. The Worker swaps
 * those bytes for stamps of exactly the same length, so no offset in the file
 * moves and the cross-reference table stays valid: no PDF library in the
 * Worker, and next to no CPU per download.
 */

export const STAMP_LENGTH = 96;

/** Only characters that need no escaping in a PDF literal string, one byte each. */
const SAFE = /^[A-Za-z0-9 .,:/-]*$/;

/** What the footer says when the PDF was not served through the Worker (astro dev). */
export const FOOTER_DEFAULT = pad('Latest at nahuelcanavy.com/cv');

/** Same, for the metadata. Distinct from the footer, so each is replaced by its own stamp. */
export const META_DEFAULT = pad('Not stamped: served without the nahuelcanavy.com Worker');

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export interface Stamp {
	footer: string;
	meta: string;
}

export function pad(text: string): string {
	if (text.length > STAMP_LENGTH) throw new Error(`stamp longer than ${STAMP_LENGTH}: ${text}`);
	if (!SAFE.test(text)) throw new Error(`stamp has characters a PDF string would need escaped: ${text}`);
	return text.padEnd(STAMP_LENGTH, ' ');
}

/** 8 hex digits, grouped for reading aloud: 7F3A-9C1E. */
export function newRef(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(4));
	const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
	return `${hex.slice(0, 4)}-${hex.slice(4)}`;
}

export function stamp(at: Date, ref: string): Stamp {
	const day = `${at.getUTCDate()} ${MONTHS[at.getUTCMonth()]} ${at.getUTCFullYear()}`;
	const time = at.toISOString().slice(0, 16).replace('T', ' ');
	return {
		footer: `Downloaded on ${day}, latest at nahuelcanavy.com/cv`,
		meta: `Downloaded from nahuelcanavy.com/cv on ${time} UTC - ref ${ref}`,
	};
}

/**
 * Returns a copy of the PDF with every placeholder replaced by its stamp.
 * Throws if either placeholder is missing: better no CV than an unstamped one.
 */
export function stampPdf(pdf: Uint8Array, { footer, meta }: Stamp): Uint8Array {
	const out = pdf.slice();
	replaceAll(out, FOOTER_DEFAULT, footer, 'footer');
	replaceAll(out, META_DEFAULT, meta, 'metadata');
	return out;
}

function replaceAll(pdf: Uint8Array, placeholder: string, text: string, what: string) {
	const from = ascii(placeholder);
	const to = ascii(pad(text));
	let found = 0;

	for (let i = indexOf(pdf, from, 0); i !== -1; i = indexOf(pdf, from, i + from.length)) {
		pdf.set(to, i);
		found++;
	}

	if (found === 0) throw new Error(`no ${what} placeholder in the PDF`);
}

function ascii(text: string): Uint8Array {
	return Uint8Array.from(text, (c) => c.charCodeAt(0));
}

function indexOf(haystack: Uint8Array, needle: Uint8Array, start: number): number {
	const first = needle[0];
	const last = haystack.length - needle.length;

	outer: for (let i = haystack.indexOf(first, start); i !== -1 && i <= last; i = haystack.indexOf(first, i + 1)) {
		for (let j = 1; j < needle.length; j++) {
			if (haystack[i + j] !== needle[j]) continue outer;
		}
		return i;
	}

	return -1;
}
