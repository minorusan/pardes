import { config } from '../config';
import { Book, SearchResult, RandomResult, TopResult, PardesStats } from '../types';

const BASE_URL = config.pardes.apiUrl;

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`);
  if (!response.ok) {
    throw new Error(`PARDES API error: ${response.status} ${response.statusText}`);
  }
  return response.json() as Promise<T>;
}

export const pardes = {
  async search(query: string, limit = 10): Promise<SearchResult> {
    const encoded = encodeURIComponent(query);
    return fetchJson<SearchResult>(`/books?q=${encoded}&limit=${limit}`);
  },

  async getBook(id: number): Promise<Book> {
    return fetchJson<Book>(`/books/${id}`);
  },

  async getStats(): Promise<PardesStats> {
    return fetchJson<PardesStats>('/stats');
  },

  async getRandomBooks(count = 5): Promise<RandomResult> {
    return fetchJson<RandomResult>(`/books/random?count=${count}`);
  },

  async getTopBooks(limit = 10): Promise<TopResult> {
    return fetchJson<TopResult>(`/books/top?limit=${limit}`);
  },

  getDownloadUrl(bookId: number): string {
    return `${BASE_URL}/books/${bookId}/download`;
  },

  getCoverUrl(bookId: number): string {
    return `${BASE_URL}/books/${bookId}/cover`;
  },

  async downloadBook(bookId: number): Promise<{ buffer: Buffer; filename: string }> {
    const response = await fetch(`${BASE_URL}/books/${bookId}/download`);
    if (!response.ok) {
      throw new Error(`Failed to download book: ${response.status}`);
    }

    const disposition = response.headers.get('content-disposition');
    let filename = `book_${bookId}.fb2`;
    if (disposition) {
      const match = disposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
      if (match && match[1]) {
        filename = match[1].replace(/['"]/g, '');
      }
    }

    const arrayBuffer = await response.arrayBuffer();
    return {
      buffer: Buffer.from(arrayBuffer),
      filename,
    };
  },
};
