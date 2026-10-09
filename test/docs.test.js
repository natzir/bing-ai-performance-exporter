// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(`${import.meta.dirname}/../${path}`, 'utf8');
const manifest = JSON.parse(read('extension/manifest.json'));

describe('docs', () => {
  it('gives the store the manifest\'s description as its Summary', () => {
    expect(read('store/listing.md')).toContain(`> ${manifest.description}\n`);
  });

  it('documents the three files with the post\'s columns', () => {
    const readme = read('README.md');
    for (const columns of [
      '`query, intent, topic, citation_share, page, citations`',
      '`query, intent, topic, citation_share, total_citations, mapped_citations, num_pages_mapped`',
      '`page, total_citations, mapped_citations, unmapped_citations, num_queries_mapped`',
    ]) {
      expect(readme).toContain(columns);
    }
  });

  it('explains every permission the manifest asks for', () => {
    const privacy = read('PRIVACY.md');
    const listing = read('store/listing.md');
    for (const permission of manifest.permissions) {
      expect(privacy).toContain(`**${permission}**`);
      expect(listing).toContain(`- ${permission}:`);
    }
  });
});
