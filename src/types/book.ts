// Book metadata types for PARDES API

export interface Book {
  id: number;
  title: string;
  authors: Author[];
  genres: string[];
  series?: string;
  seriesNum?: number;
  size: number;
  format: string;
  date: string;
  language: string;
  rating?: number;
  folder: string; // which fb2-* folder contains this book
}

export interface Author {
  lastName: string;
  firstName?: string;
  middleName?: string;
}

export interface SearchResult {
  book: Book;
  score: number; // relevance score (0-1)
  matchType: 'exact' | 'fuzzy' | 'partial';
}

export interface SearchOptions {
  query?: string;
  title?: string;
  author?: string;
  genre?: string;
  language?: string;
  limit?: number;
  offset?: number;
  fuzzy?: boolean;
}

export interface GenreStats {
  genre: string;
  count: number;
}

export interface IndexStats {
  totalBooks: number;
  totalAuthors: number;
  totalGenres: number;
  languages: { [lang: string]: number };
  indexedAt: string;
}
