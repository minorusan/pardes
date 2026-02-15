// Book Index Service - Parses INPX and provides search functionality
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import * as iconv from 'iconv-lite';
import { Book, Author, SearchResult, SearchOptions, GenreStats, IndexStats } from '../types/book';
import { logger, LogCategory } from '../logger/logger';

const BOOKS_DIR = '/mnt/cache/library/extracted';
const INPX_FILE = '/home/erkamen/pardes/static/books/flibusta_fb2_local.inpx';
const INDEX_CACHE_FILE = path.join(process.cwd(), '.book-index.json');

// Field delimiter in INP files (EOT character)
const FIELD_DELIMITER = '\x04';

class BookIndexService {
  private books: Map<number, Book> = new Map();
  private titleIndex: Map<string, number[]> = new Map(); // normalized title -> book IDs
  private authorIndex: Map<string, number[]> = new Map(); // normalized author -> book IDs
  private genreIndex: Map<string, number[]> = new Map(); // genre -> book IDs
  private initialized = false;
  private stats: IndexStats | null = null;

  // Transliteration map (Latin -> Cyrillic)
  private readonly translitMap: { [key: string]: string } = {
    'a': 'а', 'b': 'б', 'v': 'в', 'g': 'г', 'd': 'д', 'e': 'е', 'yo': 'ё',
    'zh': 'ж', 'z': 'з', 'i': 'и', 'j': 'й', 'k': 'к', 'l': 'л', 'm': 'м',
    'n': 'н', 'o': 'о', 'p': 'п', 'r': 'р', 's': 'с', 't': 'т', 'u': 'у',
    'f': 'ф', 'h': 'х', 'c': 'ц', 'ch': 'ч', 'sh': 'ш', 'shch': 'щ',
    'y': 'ы', 'yu': 'ю', 'ya': 'я', 'x': 'кс', 'w': 'в', 'q': 'к',
    // Common name patterns
    'harry': 'гарри', 'potter': 'поттер', 'tolstoy': 'толстой',
    'dostoevsky': 'достоевский', 'chekhov': 'чехов', 'pushkin': 'пушкин',
    'war': 'война', 'peace': 'мир'
  };

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const startTime = Date.now();
    logger.info(LogCategory.SYSTEM, 'Initializing book index...');

    // Try to load from cache first
    if (await this.loadFromCache()) {
      this.initialized = true;
      logger.info(LogCategory.SYSTEM, 'Book index loaded from cache', {
        books: this.books.size,
        timeMs: Date.now() - startTime
      });
      return;
    }

    // Parse INPX file
    await this.parseInpx();

    // Build search indices
    this.buildIndices();

    // Save to cache
    await this.saveToCache();

    this.initialized = true;
    logger.info(LogCategory.SYSTEM, 'Book index initialized', {
      books: this.books.size,
      timeMs: Date.now() - startTime
    });
  }

  private async loadFromCache(): Promise<boolean> {
    try {
      if (!fs.existsSync(INDEX_CACHE_FILE)) return false;

      const cacheData = JSON.parse(fs.readFileSync(INDEX_CACHE_FILE, 'utf-8'));

      // Check if INPX is newer than cache
      const inpxStat = fs.statSync(INPX_FILE);
      if (new Date(cacheData.indexedAt) < inpxStat.mtime) {
        logger.info(LogCategory.SYSTEM, 'INPX newer than cache, rebuilding...');
        return false;
      }

      // Restore books
      for (const book of cacheData.books) {
        this.books.set(book.id, book);
      }

      // Restore indices
      this.titleIndex = new Map(Object.entries(cacheData.titleIndex));
      this.authorIndex = new Map(Object.entries(cacheData.authorIndex));
      this.genreIndex = new Map(Object.entries(cacheData.genreIndex));
      this.stats = cacheData.stats;

      return true;
    } catch (error) {
      logger.warn(LogCategory.SYSTEM, 'Failed to load index cache', { error });
      return false;
    }
  }

  private async saveToCache(): Promise<void> {
    try {
      const cacheData = {
        indexedAt: new Date().toISOString(),
        stats: this.stats,
        books: Array.from(this.books.values()),
        titleIndex: Object.fromEntries(this.titleIndex),
        authorIndex: Object.fromEntries(this.authorIndex),
        genreIndex: Object.fromEntries(this.genreIndex)
      };
      fs.writeFileSync(INDEX_CACHE_FILE, JSON.stringify(cacheData));
      logger.info(LogCategory.SYSTEM, 'Index cache saved');
    } catch (error) {
      logger.warn(LogCategory.SYSTEM, 'Failed to save index cache', { error });
    }
  }

  private async parseInpx(): Promise<void> {
    if (!fs.existsSync(INPX_FILE)) {
      throw new Error(`INPX file not found: ${INPX_FILE}`);
    }

    // Extract INPX (it's a ZIP)
    const tempDir = '/tmp/pardes_inpx';
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true });
    }
    fs.mkdirSync(tempDir, { recursive: true });

    execSync(`unzip -o "${INPX_FILE}" -d "${tempDir}"`, { stdio: 'pipe' });

    // Parse all .inp files (books are in flat directory)
    const inpFiles = fs.readdirSync(tempDir).filter(f => f.endsWith('.inp'));

    for (const inpFile of inpFiles) {
      const folderName = inpFile.replace('.inp', '');
      const content = fs.readFileSync(path.join(tempDir, inpFile), 'utf-8');
      this.parseInpFile(content, folderName);
    }

    // Cleanup
    fs.rmSync(tempDir, { recursive: true });
  }

  private parseInpFile(content: string, folder: string): void {
    const lines = content.split('\n').filter(l => l.trim());

    for (const line of lines) {
      try {
        const book = this.parseLine(line, folder);
        if (book && this.bookFileExists(book)) {
          this.books.set(book.id, book);
        }
      } catch (error) {
        // Skip malformed lines
      }
    }
  }

  private parseLine(line: string, folder: string): Book | null {
    const fields = line.split(FIELD_DELIMITER);
    if (fields.length < 10) return null;

    // Parse authors (comma-separated: Last,First,Middle)
    const authorParts = fields[0].split(':')[0].split(',');
    const authors: Author[] = [];

    for (let i = 0; i < authorParts.length; i += 3) {
      if (authorParts[i]) {
        authors.push({
          lastName: authorParts[i].trim(),
          firstName: authorParts[i + 1]?.trim(),
          middleName: authorParts[i + 2]?.trim()
        });
      }
    }

    // Parse genres (colon-separated after author)
    const genrePart = fields[0].split(':').slice(1).join(':');
    const genres = fields[1] ? [genrePart, fields[1]].filter(g => g && !g.includes(',')) : [genrePart];

    // Parse remaining fields
    const title = fields[2] || '';
    const series = fields[3] || undefined;
    const seriesNum = fields[4] ? parseInt(fields[4]) : undefined;
    const id = parseInt(fields[5]);
    const size = parseInt(fields[6]) || 0;
    const format = fields[9] || 'fb2';
    const date = fields[10] || '';
    const language = fields[11] || 'ru';
    const rating = fields[12] ? parseInt(fields[12]) : undefined;

    if (isNaN(id)) return null;

    return {
      id,
      title,
      authors,
      genres: genres.filter(g => g),
      series,
      seriesNum: isNaN(seriesNum!) ? undefined : seriesNum,
      size,
      format,
      date,
      language,
      rating: isNaN(rating!) ? undefined : rating,
      folder: 'extracted' // flat directory, not used
    };
  }

  private findFolderForId(id: number): string | null {
    // No longer used - books are in flat directory
    return null;
  }

  private bookFileExists(book: Book): boolean {
    const filePath = path.join(BOOKS_DIR, `${book.id}.fb2`);
    return fs.existsSync(filePath);
  }

  private buildIndices(): void {
    const authors = new Set<string>();
    const genres = new Set<string>();
    const languages: { [lang: string]: number } = {};

    for (const [id, book] of this.books) {
      // Title index (normalized)
      const normalizedTitle = this.normalize(book.title);
      const titleWords = normalizedTitle.split(/\s+/);

      for (const word of titleWords) {
        if (word.length < 2) continue;
        const existing = this.titleIndex.get(word) || [];
        existing.push(id);
        this.titleIndex.set(word, existing);
      }

      // Author index
      for (const author of book.authors) {
        const fullName = this.normalize([author.lastName, author.firstName, author.middleName].filter(Boolean).join(' '));
        authors.add(fullName);

        const existing = this.authorIndex.get(fullName) || [];
        existing.push(id);
        this.authorIndex.set(fullName, existing);

        // Also index just last name
        const lastName = this.normalize(author.lastName);
        const lastNameExisting = this.authorIndex.get(lastName) || [];
        lastNameExisting.push(id);
        this.authorIndex.set(lastName, lastNameExisting);
      }

      // Genre index
      for (const genre of book.genres) {
        genres.add(genre);
        const existing = this.genreIndex.get(genre) || [];
        existing.push(id);
        this.genreIndex.set(genre, existing);
      }

      // Language stats
      languages[book.language] = (languages[book.language] || 0) + 1;
    }

    this.stats = {
      totalBooks: this.books.size,
      totalAuthors: authors.size,
      totalGenres: genres.size,
      languages,
      indexedAt: new Date().toISOString()
    };
  }

  // Normalize text for search (lowercase, remove punctuation)
  private normalize(text: string): string {
    return text.toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, '')
      .trim();
  }

  // Transliterate Latin to Cyrillic
  private transliterate(text: string): string {
    let result = text.toLowerCase();

    // First try full word replacements
    for (const [latin, cyrillic] of Object.entries(this.translitMap)) {
      if (latin.length > 1) {
        result = result.replace(new RegExp(latin, 'gi'), cyrillic);
      }
    }

    // Then single character replacements
    for (const [latin, cyrillic] of Object.entries(this.translitMap)) {
      if (latin.length === 1) {
        result = result.replace(new RegExp(latin, 'gi'), cyrillic);
      }
    }

    return result;
  }

  // Levenshtein distance for fuzzy matching
  private levenshtein(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  // Calculate similarity score (0-1)
  private similarity(a: string, b: string): number {
    const maxLen = Math.max(a.length, b.length);
    if (maxLen === 0) return 1;
    return 1 - this.levenshtein(a, b) / maxLen;
  }

  // Search books
  async search(options: SearchOptions): Promise<{ results: SearchResult[], total: number }> {
    await this.initialize();

    const limit = Math.min(options.limit || 20, 100);
    const offset = options.offset || 0;
    const results: SearchResult[] = [];
    const seenIds = new Set<number>();

    // General query search (searches title + author)
    if (options.query) {
      const query = this.normalize(options.query);
      const translitQuery = this.transliterate(options.query);

      // Search in titles
      for (const [word, ids] of this.titleIndex) {
        const sim = Math.max(
          this.similarity(word, query),
          this.similarity(word, translitQuery)
        );

        if (sim > 0.6 || word.includes(query) || word.includes(translitQuery)) {
          for (const id of ids) {
            if (seenIds.has(id)) continue;
            seenIds.add(id);

            const book = this.books.get(id)!;
            results.push({
              book,
              score: sim,
              matchType: sim === 1 ? 'exact' : sim > 0.8 ? 'fuzzy' : 'partial'
            });
          }
        }
      }

      // Search in authors
      for (const [author, ids] of this.authorIndex) {
        const sim = Math.max(
          this.similarity(author, query),
          this.similarity(author, translitQuery)
        );

        if (sim > 0.6 || author.includes(query) || author.includes(translitQuery)) {
          for (const id of ids) {
            if (seenIds.has(id)) continue;
            seenIds.add(id);

            const book = this.books.get(id)!;
            results.push({
              book,
              score: sim * 0.9, // Slightly lower score for author matches
              matchType: sim === 1 ? 'exact' : sim > 0.8 ? 'fuzzy' : 'partial'
            });
          }
        }
      }
    }

    // Title-specific search
    if (options.title) {
      const title = this.normalize(options.title);
      const translitTitle = this.transliterate(options.title);

      for (const [word, ids] of this.titleIndex) {
        if (word.includes(title) || word.includes(translitTitle)) {
          for (const id of ids) {
            if (seenIds.has(id)) continue;
            seenIds.add(id);

            const book = this.books.get(id)!;
            const fullTitle = this.normalize(book.title);
            const sim = Math.max(
              this.similarity(fullTitle, title),
              this.similarity(fullTitle, translitTitle)
            );

            results.push({
              book,
              score: sim,
              matchType: sim === 1 ? 'exact' : sim > 0.8 ? 'fuzzy' : 'partial'
            });
          }
        }
      }
    }

    // Author-specific search
    if (options.author) {
      const author = this.normalize(options.author);
      const translitAuthor = this.transliterate(options.author);

      for (const [name, ids] of this.authorIndex) {
        if (name.includes(author) || name.includes(translitAuthor) ||
            this.similarity(name, author) > 0.7 ||
            this.similarity(name, translitAuthor) > 0.7) {
          for (const id of ids) {
            if (seenIds.has(id)) continue;
            seenIds.add(id);

            const book = this.books.get(id)!;
            results.push({
              book,
              score: this.similarity(name, author),
              matchType: 'partial'
            });
          }
        }
      }
    }

    // Genre filter
    if (options.genre) {
      const genreIds = this.genreIndex.get(options.genre) || [];

      if (results.length > 0) {
        // Filter existing results by genre
        const genreSet = new Set(genreIds);
        const filtered = results.filter(r => genreSet.has(r.book.id));
        results.length = 0;
        results.push(...filtered);
      } else {
        // Return all books in genre
        for (const id of genreIds) {
          if (seenIds.has(id)) continue;
          seenIds.add(id);

          const book = this.books.get(id)!;
          results.push({
            book,
            score: 1,
            matchType: 'exact'
          });
        }
      }
    }

    // Language filter
    if (options.language) {
      const filtered = results.filter(r => r.book.language === options.language);
      results.length = 0;
      results.push(...filtered);
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    const total = results.length;
    const paged = results.slice(offset, offset + limit);

    return { results: paged, total };
  }

  // Get book by ID
  async getBook(id: number): Promise<Book | null> {
    await this.initialize();
    return this.books.get(id) || null;
  }

  // Get book file path
  async getBookPath(id: number): Promise<string | null> {
    const book = await this.getBook(id);
    if (!book) return null;

    const filePath = path.join(BOOKS_DIR, `${id}.fb2`);
    return fs.existsSync(filePath) ? filePath : null;
  }

  // Get all genres with counts
  async getGenres(): Promise<GenreStats[]> {
    await this.initialize();

    const genres: GenreStats[] = [];
    for (const [genre, ids] of this.genreIndex) {
      genres.push({ genre, count: ids.length });
    }

    return genres.sort((a, b) => b.count - a.count);
  }

  // Get index stats
  async getStats(): Promise<IndexStats | null> {
    await this.initialize();
    return this.stats;
  }

  // Check if initialized
  isReady(): boolean {
    return this.initialized;
  }

  // Get random books for discovery
  async getRandomBooks(count: number, filters?: { genre?: string, language?: string }): Promise<Book[]> {
    await this.initialize();

    let bookList = Array.from(this.books.values());

    // Apply filters
    if (filters?.genre) {
      const genreIds = new Set(this.genreIndex.get(filters.genre) || []);
      bookList = bookList.filter(b => genreIds.has(b.id));
    }
    if (filters?.language) {
      bookList = bookList.filter(b => b.language === filters.language);
    }

    // Shuffle and take count
    const shuffled = bookList.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  // Get top rated books
  async getTopRated(limit: number, genre?: string): Promise<Book[]> {
    await this.initialize();

    let bookList = Array.from(this.books.values());

    // Filter by genre if specified
    if (genre) {
      const genreIds = new Set(this.genreIndex.get(genre) || []);
      bookList = bookList.filter(b => genreIds.has(b.id));
    }

    // Only books with ratings
    bookList = bookList.filter(b => b.rating && b.rating >= 4);

    // Sort by rating descending
    bookList.sort((a, b) => (b.rating || 0) - (a.rating || 0));

    return bookList.slice(0, limit);
  }

  // Get all books in a series
  async getSeriesBooks(seriesName: string): Promise<Book[]> {
    await this.initialize();

    const books = Array.from(this.books.values())
      .filter(b => b.series === seriesName)
      .sort((a, b) => (a.seriesNum || 0) - (b.seriesNum || 0));

    return books;
  }

  // Get books by author
  async getAuthorBooks(authorLastName: string, limit?: number, excludeId?: number): Promise<Book[]> {
    await this.initialize();

    const normalized = this.normalize(authorLastName);
    const ids = this.authorIndex.get(normalized) || [];

    let books = ids
      .filter(id => id !== excludeId)
      .map(id => this.books.get(id)!)
      .filter(Boolean);

    if (limit) {
      books = books.slice(0, limit);
    }

    return books;
  }

  // Parse FB2 content into structured format for reading
  async parseBookContent(filePath: string): Promise<{
    chapters: { title: string, content: string }[],
    annotations?: string,
    coverImage?: string
  }> {
    const content = fs.readFileSync(filePath);

    // Detect encoding from XML declaration (peek first 200 bytes as ASCII)
    const header = content.slice(0, 200).toString('ascii');
    const encodingMatch = header.match(/encoding=["']([^"']+)["']/i);
    const encoding = encodingMatch ? encodingMatch[1].toLowerCase() : 'windows-1251';

    // Decode using detected encoding (default to windows-1251 for Russian FB2)
    const xml = iconv.decode(content, encoding === 'utf-8' ? 'utf-8' : 'win1251');

    const chapters: { title: string, content: string }[] = [];

    // Extract annotation
    const annotationMatch = xml.match(/<annotation[^>]*>([\s\S]*?)<\/annotation>/i);
    const annotations = annotationMatch
      ? annotationMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      : undefined;

    // Extract cover image (base64)
    const coverMatch = xml.match(/<binary[^>]*content-type="image\/[^"]*"[^>]*id="cover[^"]*"[^>]*>([\s\S]*?)<\/binary>/i);
    const coverImage = coverMatch ? coverMatch[1].replace(/\s/g, '') : undefined;

    // Extract sections/chapters
    const bodyMatch = xml.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) {
      const bodyContent = bodyMatch[1];

      // Try to find sections
      const sectionMatches = bodyContent.matchAll(/<section[^>]*>([\s\S]*?)<\/section>/gi);

      for (const match of sectionMatches) {
        const sectionContent = match[1];

        // Extract title
        const titleMatch = sectionContent.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        const title = titleMatch
          ? titleMatch[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
          : 'Untitled';

        // Extract text (remove title, keep paragraphs)
        let text = sectionContent
          .replace(/<title[^>]*>[\s\S]*?<\/title>/gi, '')
          .replace(/<p[^>]*>/gi, '\n')
          .replace(/<\/p>/gi, '\n')
          .replace(/<[^>]+>/g, '')
          .replace(/\n{3,}/g, '\n\n')
          .trim();

        if (text.length > 50) { // Skip very short sections
          chapters.push({ title, content: text });
        }
      }

      // If no sections found, treat whole body as one chapter
      if (chapters.length === 0) {
        const text = bodyContent
          .replace(/<p[^>]*>/gi, '\n')
          .replace(/<\/p>/gi, '\n')
          .replace(/<[^>]+>/g, '')
          .replace(/\n{3,}/g, '\n\n')
          .trim();

        chapters.push({ title: 'Full Text', content: text });
      }
    }

    return { chapters, annotations, coverImage };
  }

  // Get all available languages
  async getLanguages(): Promise<{ language: string, count: number }[]> {
    await this.initialize();

    if (!this.stats) return [];

    return Object.entries(this.stats.languages)
      .map(([language, count]) => ({ language, count }))
      .sort((a, b) => b.count - a.count);
  }

  // Get all series names
  async getSeries(limit?: number): Promise<{ series: string, count: number }[]> {
    await this.initialize();

    const seriesCount = new Map<string, number>();

    for (const book of this.books.values()) {
      if (book.series) {
        seriesCount.set(book.series, (seriesCount.get(book.series) || 0) + 1);
      }
    }

    const result = Array.from(seriesCount.entries())
      .map(([series, count]) => ({ series, count }))
      .sort((a, b) => b.count - a.count);

    return limit ? result.slice(0, limit) : result;
  }
}

export const bookIndex = new BookIndexService();
