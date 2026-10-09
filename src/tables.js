// The three tables of the post's CSVs, from an export's result. Numbers stay numbers; what Bing didn't
// give is ''. A query whose pages weren't fetched (it failed, or the export stopped first) is left out
// of the mapping and its mapped columns are empty, instead of passing for a query without mapping.
export const share = rate => (rate == null ? '' : Math.round(rate * 10000) / 100);
const join = list => list.join('; ');

export function tables({ queries, pages, mapping }) {
  const perPage = new Map();
  for (const cited of mapping.values()) {
    for (const [url, citations] of cited) {
      const entry = perPage.get(url) ?? { mapped: 0, queries: 0 };
      entry.mapped += citations;
      entry.queries += 1;
      perPage.set(url, entry);
    }
  }

  const mappingRows = [];
  for (const q of queries) {
    const cited = mapping.get(q.query);
    if (!cited) continue;
    const head = [q.query, join(q.intent), join(q.topic), share(q.rate)];
    if (!cited.length) mappingRows.push([...head, '', '']);
    for (const [url, citations] of cited) mappingRows.push([...head, url, citations]);
  }

  return [
    {
      file: 'mapping',
      sheet: 'mapping',
      header: ['query', 'intent', 'topic', 'citation_share', 'page', 'citations'],
      rows: mappingRows,
    },
    {
      file: 'queries-summary',
      sheet: 'queries',
      header: ['query', 'intent', 'topic', 'citation_share', 'total_citations', 'mapped_citations', 'num_pages_mapped'],
      rows: queries.map(q => {
        const cited = mapping.get(q.query);
        const mapped = cited ? cited.reduce((sum, [, citations]) => sum + citations, 0) : '';
        return [q.query, join(q.intent), join(q.topic), share(q.rate), q.citations, mapped, cited ? cited.length : ''];
      }),
    },
    {
      file: 'pages-summary',
      sheet: 'pages',
      header: ['page', 'total_citations', 'mapped_citations', 'unmapped_citations', 'num_queries_mapped'],
      rows: pages.map(p => {
        const m = perPage.get(p.url) ?? { mapped: 0, queries: 0 };
        return [p.url, p.citations, m.mapped, p.citations - m.mapped, m.queries];
      }),
    },
  ];
}
