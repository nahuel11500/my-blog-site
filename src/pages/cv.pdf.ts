import type { APIRoute } from 'astro';
import { renderCvPdf } from '../lib/cv-pdf';

// Built once, at build time. In production the Worker serves it, stamped with
// the download time and a reference: see worker/cv-stamp.ts.
export const GET: APIRoute = async () => {
	const pdf = (await renderCvPdf()) as Uint8Array<ArrayBuffer>;
	return new Response(pdf, { headers: { 'content-type': 'application/pdf' } });
};
