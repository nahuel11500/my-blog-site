import assert from 'node:assert/strict';
import { test } from 'node:test';
import { wrap } from './wrap.ts';

// One unit of width per character.
const mono = { widthOfTextAtSize: (text: string) => text.length };
const words = (...texts: string[]) => texts.map((text) => ({ text, font: mono }));
const lines = (ls: { text: string }[][]) => ls.map((l) => l.map((f) => f.text).join(''));

test('wraps on spaces', () => {
	assert.deepEqual(lines(wrap(words('aaa ', 'bbb ', 'ccc'), 8, 1)), ['aaa bbb ', 'ccc']);
});

test('never breaks between a word and the punctuation glued to it', () => {
	// "Cloud" is bold and ": migrated" regular: two fragments, no space between them.
	const fragments = words('the ', 'Cloud', ': ', 'migrated');
	// At width 9, 'the Cloud' fits but 'the Cloud:' does not: the colon must not start a line.
	assert.deepEqual(lines(wrap(fragments, 9, 1)), ['the ', 'Cloud: ', 'migrated']);
});

test('keeps a link inside its parentheses', () => {
	const fragments = words('43% ', '(', 'write-up', ').');
	assert.deepEqual(lines(wrap(fragments, 8, 1)), ['43% ', '(write-up).']);
});

test('a unit wider than the line still gets a line of its own', () => {
	assert.deepEqual(lines(wrap(words('a ', 'abcdefghij'), 4, 1)), ['a ', 'abcdefghij']);
});
