export interface Author {
  firstName: string;
  lastName: string;
  middleName?: string;
}

export interface Book {
  id: number;
  title: string;
  authors: Author[];
  genres: string[];
  language: string;
  rating?: number;
  series?: string;
  seriesNum?: number;
  size?: number;
  format?: string;
  date?: string;
  folder?: string;
  score?: number;
  matchType?: string;
}

export interface SearchResult {
  results: Book[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface RandomResult {
  books: Book[];
  count: number;
}

export interface TopResult {
  books: Book[];
  count: number;
}

export interface PardesStats {
  totalBooks: number;
  totalAuthors: number;
  totalGenres: number;
  languages: Record<string, number>;
  indexedAt: string;
  ready: boolean;
}
