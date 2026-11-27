// Line wrapping for the CV PDF, kept apart from pdf-lib so it can be tested.

export interface Fragment {
	text: string;
	font: { widthOfTextAtSize(text: string, size: number): number };
	href?: string;
}

/**
 * Splits fragments (one word each, with its trailing space if any) into lines
 * no wider than `width`. Fragments with no space between them wrap as one unit,
 * so a line never breaks between a bold or linked word and the punctuation
 * right after it: "**Cloud**:" or "([write-up](…))".
 */
export function wrap<F extends Fragment>(fragments: F[], width: number, size: number): F[][] {
	const units: F[][] = [];
	let open = false;
	for (const f of fragments) {
		if (open) units.at(-1)!.push(f);
		else units.push([f]);
		open = !f.text.endsWith(' ');
	}

	const measure = (unit: F[], trim: boolean) =>
		unit.reduce((sum, f, i) => {
			const text = trim && i === unit.length - 1 ? f.text.trimEnd() : f.text;
			return sum + f.font.widthOfTextAtSize(text, size);
		}, 0);

	const lines: F[][] = [[]];
	let used = 0;
	for (const unit of units) {
		if (used + measure(unit, true) > width && lines.at(-1)!.length > 0) {
			lines.push([]);
			used = 0;
		}
		lines.at(-1)!.push(...unit);
		used += measure(unit, false);
	}

	return lines;
}
