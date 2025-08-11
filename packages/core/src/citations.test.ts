import { test, expect } from 'bun:test';
import { 
  groupSpansByTitle, 
  collapsePageRanges, 
  formatPageRanges, 
  formatCitationGroup,
  formatCitations,
  type SpanCitation 
} from './citations.ts';

test('groupSpansByTitle groups citations by document title', () => {
  const citations: SpanCitation[] = [
    { span_id: '1', title: 'IFRS 15 Summary', page: 12 },
    { span_id: '2', title: 'IFRS 15 Summary', page: 13 },
    { span_id: '3', title: 'GAAP Guide', page: 5 },
    { span_id: '4', title: 'IFRS 15 Summary', page: 16 },
  ];

  const groups = groupSpansByTitle(citations);
  
  expect(groups).toHaveLength(2);
  expect(groups[0]).toEqual({
    title: 'IFRS 15 Summary',
    pages: [12, 13, 16]
  });
  expect(groups[1]).toEqual({
    title: 'GAAP Guide',
    pages: [5]
  });
});

test('collapsePageRanges creates contiguous ranges', () => {
  // Test case from CLAUDE.md: [p12,p13,p14,p16] → p.12–14, p.16
  const pages = [12, 13, 14, 16];
  const ranges = collapsePageRanges(pages);
  
  expect(ranges).toEqual([
    { start: 12, end: 14 },
    { start: 16, end: 16 }
  ]);
});

test('collapsePageRanges handles single pages', () => {
  const pages = [5];
  const ranges = collapsePageRanges(pages);
  
  expect(ranges).toEqual([
    { start: 5, end: 5 }
  ]);
});

test('collapsePageRanges handles non-contiguous pages', () => {
  const pages = [1, 3, 5, 7];
  const ranges = collapsePageRanges(pages);
  
  expect(ranges).toEqual([
    { start: 1, end: 1 },
    { start: 3, end: 3 },
    { start: 5, end: 5 },
    { start: 7, end: 7 }
  ]);
});

test('formatPageRanges formats ranges correctly', () => {
  const ranges = [
    { start: 12, end: 14 },
    { start: 16, end: 16 }
  ];
  
  const formatted = formatPageRanges(ranges);
  expect(formatted).toBe('p.12–14, p.16');
});

test('formatCitationGroup formats complete citation', () => {
  const group = {
    title: 'IFRS 15 Summary',
    pages: [12, 13, 14, 16]
  };
  
  const formatted = formatCitationGroup(group);
  expect(formatted).toBe('"IFRS 15 Summary" p.12–14, p.16');
});

test('formatCitations handles complete example', () => {
  const citations: SpanCitation[] = [
    { span_id: '1', title: 'IFRS 15 Summary', page: 12 },
    { span_id: '2', title: 'IFRS 15 Summary', page: 13 },
    { span_id: '3', title: 'IFRS 15 Summary', page: 14 },
    { span_id: '4', title: 'IFRS 15 Summary', page: 16 },
  ];

  const formatted = formatCitations(citations);
  expect(formatted).toBe('"IFRS 15 Summary" p.12–14, p.16');
});

test('formatCitations handles multiple documents', () => {
  const citations: SpanCitation[] = [
    { span_id: '1', title: 'IFRS 15 Summary', page: 12 },
    { span_id: '2', title: 'GAAP Guide', page: 5 },
    { span_id: '3', title: 'IFRS 15 Summary', page: 14 },
  ];

  const formatted = formatCitations(citations);
  expect(formatted).toBe('"IFRS 15 Summary" p.12, p.14; "GAAP Guide" p.5');
});