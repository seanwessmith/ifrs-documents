// Citation formatting utilities for human-readable citations

export interface SpanCitation {
  span_id: string;
  title: string;
  page: number;
}

export interface CitationGroup {
  title: string;
  pages: number[];
}

export interface PageRange {
  start: number;
  end: number;
}

/**
 * Groups spans by document title and collects their pages
 */
export function groupSpansByTitle(citations: SpanCitation[]): CitationGroup[] {
  const groups = new Map<string, number[]>();
  
  for (const citation of citations) {
    if (!groups.has(citation.title)) {
      groups.set(citation.title, []);
    }
    groups.get(citation.title)!.push(citation.page);
  }
  
  // Sort pages within each group and remove duplicates
  return Array.from(groups.entries()).map(([title, pages]) => ({
    title,
    pages: [...new Set(pages)].sort((a, b) => a - b)
  }));
}

/**
 * Collapses contiguous page sequences into ranges
 */
export function collapsePageRanges(pages: number[]): PageRange[] {
  if (pages.length === 0) return [];
  
  const ranges: PageRange[] = [];
  let currentStart = pages[0];
  let currentEnd = pages[0];
  
  for (let i = 1; i < pages.length; i++) {
    const page = pages[i];
    
    if (page === currentEnd + 1) {
      // Extend current range
      currentEnd = page;
    } else {
      // End current range and start new one
      ranges.push({ start: currentStart, end: currentEnd });
      currentStart = page;
      currentEnd = page;
    }
  }
  
  // Add the final range
  ranges.push({ start: currentStart, end: currentEnd });
  
  return ranges;
}

/**
 * Formats page ranges into human-readable strings
 * Examples: "p.12", "p.12–14", "p.12, p.14"
 */
export function formatPageRanges(ranges: PageRange[]): string {
  return ranges.map(range => {
    if (range.start === range.end) {
      return `p.${range.start}`;
    } else {
      return `p.${range.start}–${range.end}`;
    }
  }).join(', ');
}

/**
 * Formats a citation group into human-readable format
 * Example: "IFRS 15 Summary" p.12–14, p.16
 */
export function formatCitationGroup(group: CitationGroup): string {
  const ranges = collapsePageRanges(group.pages);
  const pageString = formatPageRanges(ranges);
  return `"${group.title}" ${pageString}`;
}

/**
 * Main function to format span IDs into human-readable citations
 */
export function formatCitations(citations: SpanCitation[]): string {
  const groups = groupSpansByTitle(citations);
  return groups.map(formatCitationGroup).join('; ');
}