import {
	PDFDict,
	PDFDocument,
	PDFName,
	PDFString,
	StandardFonts,
	rgb,
	type PDFFont,
	type PDFPage,
	type RGB,
} from 'pdf-lib';
import { FOOTER_DEFAULT, META_DEFAULT } from '../../worker/cv-stamp';
import { cv, parse, type Segment } from '../data/cv';

// Renders src/data/cv.ts as an A4 PDF, at build time. The Worker stamps each
// download in place (worker/cv-stamp.ts), so this file only has to leave the
// placeholder where the stamp goes.
//
// Black and white like the site, in Helvetica: a standard PDF font, so nothing
// is embedded and every reader shows it the same.

const PAGE: [number, number] = [595.28, 841.89];
const MARGIN = 42;
const WIDTH = PAGE[0] - 2 * MARGIN;
const FOOTER = 44; // room kept at the bottom of each page for the stamp

const BODY = 9;
const LEADING = 12;
const BULLET_INDENT = 12;

// The site's grays, on paper: black ink where the site is white.
const gray = (v: number) => rgb(v / 255, v / 255, v / 255);
const INK = gray(0); // name, titles, links
const TEXT = gray(0x26); // reading text
const SOFT = gray(0x52); // section titles
const MUTED = gray(0x73); // dates, places, small print
const UNDERLINE = gray(0xa3);
const RULE = gray(0xe5);

interface Fonts {
	regular: PDFFont;
	bold: PDFFont;
}

interface Word {
	text: string;
	font: PDFFont;
	href?: string;
}

class Writer {
	page!: PDFPage;
	y = 0;
	readonly pages: PDFPage[] = [];

	constructor(
		readonly doc: PDFDocument,
		readonly fonts: Fonts,
	) {
		this.newPage();
	}

	newPage() {
		this.page = this.doc.addPage(PAGE);
		this.pages.push(this.page);
		this.y = PAGE[1] - MARGIN;
	}

	/** Starts a new page unless `height` still fits above the footer. */
	keep(height: number) {
		if (this.y - height < FOOTER + 10) this.newPage();
	}

	text(text: string, x: number, size: number, font: PDFFont, color: RGB) {
		this.page.drawText(text, { x, y: this.y, size, font, color });
	}

	link(href: string, x: number, width: number, size: number) {
		const { doc, page } = this;
		const annot = doc.context.obj({
			Type: 'Annot',
			Subtype: 'Link',
			Rect: [x, this.y - size * 0.25, x + width, this.y + size * 0.9],
			Border: [0, 0, 0],
			// A PDF has no base URL: a link to this site must be absolute.
			A: { Type: 'Action', S: 'URI', URI: PDFString.of(new URL(href, 'https://nahuelcanavy.com').href) },
		});
		page.node.addAnnot(doc.context.register(annot));
	}

	/** Wraps rich text to `width`, starting at `x`. */
	paragraph(segments: Segment[], x: number, width: number, size = BODY, color = TEXT) {
		const words: Word[] = segments.flatMap((s) =>
			s.text
				.split(/(?<= )/)
				.filter((w) => w !== '')
				.map((w) => ({ text: w, font: s.bold ? this.fonts.bold : this.fonts.regular, href: s.href })),
		);

		const lines: Word[][] = [[]];
		let used = 0;
		for (const word of words) {
			const w = word.font.widthOfTextAtSize(word.text.trimEnd(), size);
			if (used + w > width && lines.at(-1)!.length > 0) {
				lines.push([]);
				used = 0;
			}
			lines.at(-1)!.push(word);
			used += word.font.widthOfTextAtSize(word.text, size);
		}

		for (const line of lines) {
			this.keep(LEADING);
			let cx = x;
			for (const word of line) {
				const shown = word.text.trimEnd();
				const w = word.font.widthOfTextAtSize(shown, size);
				this.text(shown, cx, size, word.font, word.href ? INK : color);
				if (word.href) {
					this.page.drawLine({
						start: { x: cx, y: this.y - 1.5 },
						end: { x: cx + w, y: this.y - 1.5 },
						thickness: 0.4,
						color: UNDERLINE,
					});
					this.link(word.href, cx, w, size);
				}
				cx += word.font.widthOfTextAtSize(word.text, size);
			}
			this.y -= LEADING;
		}
	}

	bullet(text: string) {
		this.keep(LEADING);
		this.page.drawCircle({ x: MARGIN + 4, y: this.y + 3, size: 1.3, color: MUTED });
		this.paragraph(parse(text), MARGIN + BULLET_INDENT, WIDTH - BULLET_INDENT);
		this.y -= 2;
	}

	heading(title: string) {
		this.keep(18 + 3 * LEADING);
		this.y -= 8;
		this.text(title.toUpperCase(), MARGIN, 9, this.fonts.regular, SOFT);
		this.y -= 5;
		this.page.drawLine({
			start: { x: MARGIN, y: this.y },
			end: { x: MARGIN + WIDTH, y: this.y },
			thickness: 0.6,
			color: RULE,
		});
		this.y -= LEADING;
	}

	/** Bold title on the left, dates on the right, then where in gray. */
	entry(title: string, period: string, where: string) {
		this.keep(3 * LEADING);
		const { bold, regular } = this.fonts;
		this.text(title, MARGIN, BODY + 1, bold, INK);
		this.text(period, MARGIN + WIDTH - regular.widthOfTextAtSize(period, BODY), BODY, regular, MUTED);
		this.y -= LEADING;
		this.text(where, MARGIN, BODY, regular, MUTED);
		this.y -= LEADING + 1;
	}
}

export async function renderCvPdf(): Promise<Uint8Array> {
	const doc = await PDFDocument.create();
	const fonts: Fonts = {
		regular: await doc.embedFont(StandardFonts.Helvetica),
		bold: await doc.embedFont(StandardFonts.HelveticaBold),
	};
	// A standard font also keeps the stamp's text as plain bytes in the file,
	// which is what lets the Worker swap it without a PDF library.
	const stampFont = fonts.regular;

	doc.setTitle(`${cv.name} – CV`);
	doc.setAuthor(cv.name);
	doc.setKeywords(['Kubernetes', 'Platform Engineering', 'SRE', 'Go', 'Python', 'FinOps']);
	doc.setCreator('nahuelcanavy.com');
	doc.setProducer('nahuelcanavy.com');
	doc.setCreationDate(new Date());

	const w = new Writer(doc, fonts);

	// Header
	w.text(cv.name, MARGIN, 24, fonts.bold, INK);
	w.y -= 20;
	w.text(cv.tagline, MARGIN, BODY + 1.5, fonts.regular, TEXT);
	w.y -= LEADING + 2;
	const separator = '   ·   ';
	w.paragraph(
		cv.links.flatMap((l, i) => [
			...(i > 0 ? [{ text: separator, bold: false }] : []),
			{ text: l.label, bold: false, href: l.href },
		]),
		MARGIN,
		WIDTH,
		BODY - 0.5,
		MUTED,
	);

	w.heading('Experience');
	for (const role of cv.experience) {
		w.entry(role.title, role.period, `${role.company}, ${role.location}`);
		for (const b of role.bullets) w.bullet(b);
		w.y -= 4;
	}

	w.heading('Education');
	for (const school of cv.education) {
		w.entry(school.name, school.period, `${school.degree}, ${school.location}`);
		for (const b of school.bullets) w.bullet(b);
		w.y -= 4;
	}

	w.heading('Skills');
	for (const group of cv.skills) {
		w.paragraph(
			[{ text: `${group.label}: `, bold: true }, ...parse(group.items.join(', '))],
			MARGIN,
			WIDTH,
		);
	}
	w.y -= 4;

	w.heading('Projects');
	for (const p of cv.projects) w.bullet(p);

	// Footer on every page: the date stamp's placeholder, and the page number if there are several.
	const stampKey = PDFName.of('FStamp');
	w.pages.forEach((page, i) => {
		page.node.setFontDictionary(stampKey, stampFont.ref);
		const stamp = doc.context.stream(
			`q 0.451 g BT /FStamp 7 Tf ${MARGIN} 28 Td (${FOOTER_DEFAULT}) Tj ET Q`,
		);
		page.node.addContentStream(doc.context.register(stamp));
		if (w.pages.length > 1) {
			const n = `${i + 1} / ${w.pages.length}`;
			page.drawText(n, {
				x: MARGIN + WIDTH - fonts.regular.widthOfTextAtSize(n, 7),
				y: 28,
				size: 7,
				font: fonts.regular,
				color: MUTED,
			});
		}
	});

	// The reference only goes in the metadata: out of sight, and still there if the footer is cropped.
	const info = doc.context.lookup(doc.context.trailerInfo.Info, PDFDict);
	info.set(PDFName.of('Subject'), PDFString.of(META_DEFAULT));

	// Without object streams the Info dictionary stays plain text in the file,
	// where the Worker can find the placeholder.
	return doc.save({ useObjectStreams: false });
}
