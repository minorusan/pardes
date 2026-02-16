# PARDES Project Status

**Last Updated:** 2026-02-16
**Phase:** Development Complete (Phase 2)

---

## Project Overview

**PARDES** (Paradise Library) is a complete Russian book library system consisting of:
1. **Backend API** - Node.js/Express REST API for the Flibusta book archive (~685,000 books)
2. **Client App** - Flutter desktop application for browsing and reading books

The system is designed to serve as a knowledge corpus provider for the **Egregor** personal AI system, enabling RAG (Retrieval-Augmented Generation) integration with a massive Russian literature collection.

---

## Backend API Status

### Technology Stack
| Component | Technology | Version |
|-----------|------------|---------|
| Runtime | Node.js | v20+ |
| Language | TypeScript | 5.9.3 |
| Framework | Express.js | 5.2.1 |
| Data Format | FB2 (FictionBook2) | - |
| Index Format | INPX (Flibusta) | - |

### Architecture (3,343 lines of TypeScript)

```
pardes-api/
├── src/
│   ├── server.ts              # Main entry point (168 lines)
│   ├── logger/                # File-only logging system
│   ├── middleware/            # Request logging
│   ├── types/                 # TypeScript interfaces
│   ├── routes/                # 9 route handlers
│   │   ├── books.ts           # Book search & download (339 lines)
│   │   ├── authors.ts         # Author browsing
│   │   ├── genres.ts          # Genre listing
│   │   ├── series.ts          # Series browsing
│   │   ├── languages.ts       # Language stats
│   │   ├── health.ts          # Health check
│   │   ├── stats.ts           # Index stats
│   │   ├── extraction.ts      # Progress tracking
│   │   └── inspect.ts         # Security scan
│   └── services/              # 7 core services
│       ├── bookIndex.ts       # Search + parsing engine (736 lines)
│       ├── cacheService.ts    # Smart cache manager (257 lines)
│       ├── extractionService.ts
│       ├── manifestService.ts
│       ├── processManager.ts
│       ├── systemStats.ts
│       └── securityInspector.ts
├── static/zips/               # ZIP archives (4.5GB)
├── .cache/                    # Extracted files + manifest
└── logs/                      # Session logs
```

### API Endpoints (20+ routes)

#### Core Book Operations
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/books` | GET | Search books (fuzzy search, filters) |
| `/books/random` | GET | Random book discovery |
| `/books/top` | GET | Top-rated books |
| `/books/:id` | GET | Full book metadata |
| `/books/:id/download` | GET | Download FB2 file |
| `/books/:id/cover` | GET | Extract cover image |
| `/books/:id/read` | GET | Parse chapters + content |
| `/books/:id/content` | GET | Raw text excerpt |

#### Browse & Discovery
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/genres` | GET | List all genres with counts |
| `/genres/:genre` | GET | Books in specific genre |
| `/authors/:name` | GET | Books by author |
| `/series` | GET | List all series |
| `/series/:name` | GET | Books in series |
| `/languages` | GET | Language statistics |

#### System & Health
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | API info + routes |
| `/health` | GET | System health (CPU, memory) |
| `/stats` | GET | Index statistics |
| `/extraction/progress` | GET | Extraction progress |
| `/inspect` | GET | Security file scan |

### Features Implemented

#### Search & Discovery
- [x] Full-text fuzzy search (titles + authors)
- [x] Levenshtein distance matching
- [x] Latin-to-Cyrillic transliteration ("tolstoy" → "толстой")
- [x] Genre filtering and browsing
- [x] Author-based discovery
- [x] Series browsing with ordering
- [x] Language filtering
- [x] Random book discovery
- [x] Top-rated books listing
- [x] Pagination (limit/offset)

#### Content Serving
- [x] Book metadata retrieval (JSON)
- [x] FB2 file downloads (binary)
- [x] Cover image extraction from FB2
- [x] Book content parsing (text from FB2 XML)
- [x] Chapter-based parsing

#### Caching & Performance
- [x] Smart cache with MD5 hash validation
- [x] Non-blocking extraction (server starts before completion)
- [x] Cache hit detection
- [x] Progress monitoring (real-time updates)
- [x] ~685k books indexed in <50ms search latency

#### System Operations
- [x] Pure Node.js extraction (cross-platform)
- [x] Zombie process cleanup on startup
- [x] File-only logging (no stdout pollution)
- [x] Security file scanning
- [x] Health monitoring (CPU, memory, uptime)
- [x] Graceful shutdown

#### Encoding Support
- [x] Windows-1251 (CP1251) to UTF-8
- [x] Automatic encoding detection
- [x] Full Cyrillic text support

### Performance Characteristics
| Metric | Value |
|--------|-------|
| Index memory | ~50-100MB |
| Search latency | <50ms |
| Cache load | <100ms |
| Full INPX parse | 30-60 seconds |
| ZIP extraction | 30-60 minutes |
| Archive size | ~4.5GB |
| Extracted size | ~5-6GB |

---

## Client App Status

### Technology Stack
| Component | Technology | Version |
|-----------|------------|---------|
| Framework | Flutter | Stable channel |
| Language | Dart | ^3.7.2 |
| HTTP Client | http | ^1.6.0 |
| XML Parser | xml | ^6.5.0 |
| Archive | archive | ^4.0.7 |

### Platforms
- **macOS** - Primary development platform
- **Windows** - Supported
- **iOS/Android** - Infrastructure exists

### Application Structure (1,997 lines of Dart)

```
client/lib/main.dart
├── PardesColors              # Dark theme color scheme
├── PardesApp                 # Root MaterialApp
├── PardesApi                 # API service layer
├── ServerScanner             # Network discovery
├── ConnectionWrapper         # Connection management
├── HomeScreen                # Main layout (sidebar + content)
├── DiscoverScreen            # Random book grid
├── SearchScreen              # Full-text search
├── GenresScreen              # Genre browser
├── SeriesScreen              # Series browser
├── TopRatedScreen            # Top-rated books
├── BookDetailScreen          # Book details + actions
├── GenreBooksScreen          # Books by genre
├── SeriesBooksScreen         # Books in series
├── ReaderScreen              # E-reader with chapters
├── BookCard                  # Grid card widget
└── BookListTile              # List item widget
```

### Features Implemented

#### Server Discovery
- [x] Automatic network scanning
- [x] Priority IP scanning (common gateways)
- [x] Full subnet scanning (255 IPs)
- [x] Timeout handling (5 seconds)
- [x] Auto-retry on connection failure
- [x] Localhost + network modes

#### Content Browsing
- [x] Discover screen (20-book random grid)
- [x] Search screen with transliteration
- [x] Genres screen (50+ Russian genres)
- [x] Series screen with book counts
- [x] Top-rated screen with sorting

#### Book Details
- [x] Full metadata display
- [x] Star ratings (visual 5-star)
- [x] "More by this author" section
- [x] Series information
- [x] Genre tags (Russian localized)

#### E-Reader
- [x] Chapter-based reading
- [x] Chapter sidebar navigation
- [x] Font size adjustment (12-24pt)
- [x] Selectable text
- [x] Chapter progression indicators
- [x] Previous/Next navigation

#### File Management
- [x] FB2 download to Downloads folder
- [x] Filename sanitization
- [x] Progress notifications
- [x] Save confirmation feedback

#### UI/UX
- [x] Dark theme with purple/magenta accents
- [x] Sidebar navigation with stats
- [x] Real-time library statistics
- [x] Visual selection states

### Color Scheme
| Element | Color | Hex |
|---------|-------|-----|
| Primary | Purple | #8B5CF6 |
| Secondary | Magenta | #D946EF |
| Background | Deep dark | #0F0F1A |
| Surface | Card bg | #1A1A2E |
| Surface Light | Lighter | #252542 |
| Accent | Gold/amber | #F59E0B |
| Text Primary | Light gray | #F8FAFC |
| Text Secondary | Blue-gray | #94A3B8 |

### Genre Support
100+ Russian-language literary genres including:
- Science fiction (научная фантастика, киберпанк, постапокалипсис)
- Detective (детектив, полицейский, шпионский)
- Prose (классическая, современная, историческая)
- Love novels (любовные романы)
- Adventure, children's, poetry, dramaturgy
- Scientific literature (история, психология, философия)
- Technical (компьютеры, программирование)

---

## Telegram Bot Status

**Bot Name:** Книги Без Хуйни (КБХ)
**Username:** @nobsbooksbot
**Status:** Operational

### Technology Stack
| Component | Technology | Version |
|-----------|------------|---------|
| Runtime | Node.js | v20+ |
| Language | TypeScript | 5.7.3 |
| Bot Framework | Telegraf | 4.16.3 |
| MTProto Client | telegram | 2.26.16 |

### Architecture

```
tg-bot/
├── src/
│   ├── index.ts              # Entry point
│   ├── config.ts             # Environment config
│   ├── types.ts              # TypeScript types
│   ├── host.ts               # BotHost - manages multiple bots
│   ├── services/
│   │   └── pardes.ts         # PARDES API client
│   └── bots/
│       ├── kbh/
│       │   ├── index.ts      # KBH bot setup
│       │   └── handlers.ts   # Command handlers
│       └── client/
│           └── index.ts      # MTProto client (placeholder)
├── .env                      # Bot token + API URL (gitignored)
├── .env.example
├── package.json
└── tsconfig.json
```

### Features Implemented

#### Commands
- [x] `/start` - Welcome message
- [x] `/stats` - Library statistics (685k books, 128k authors, 25k genres)
- [x] `/random` - Get 5 random books
- [x] Text search - Fuzzy search by title/author

#### Book Display
- [x] Title with Markdown formatting
- [x] Author names (LastName FirstName MiddleName)
- [x] Star ratings
- [x] Series info with sequence number
- [x] Inline download button

#### Downloads
- [x] FB2 format download via PARDES API
- [x] Proper filename from Content-Disposition

### Multi-Bot Architecture

The `BotHost` class manages two bots:

1. **KBH Bot** (Telegraf) - Public Telegram bot for book search/download
2. **Client Bot** (MTProto) - Service user for future automation (TBD)

### Configuration (.env)

```
KBH_BOT_TOKEN=<telegram_bot_token>
TG_API_ID=<mtproto_api_id>
TG_API_HASH=<mtproto_api_hash>
TG_PHONE=<service_phone>
PARDES_API_URL=http://192.168.0.12:3001
```

### Future Work
- [ ] Multiple download formats (epub, mobi, pdf via calibre)
- [ ] Inline search mode
- [ ] Client bot functionality (channel posting, automation)
- [ ] Integration with PARDES startup

---

## Data Assets

### Book Archive
| Archive | Contents | Size |
|---------|----------|------|
| lib.a.attached.zip | Book covers (JPG) | ~950MB |
| lib.b.attached.zip | Book files (FB2) | ~3.5GB |
| flibusta_fb2_local.inpx | Metadata index | ~25MB |

### SQL Dumps (for future PostgreSQL)
| Dump | Description |
|------|-------------|
| lib.libbook.sql.gz | Main books table |
| lib.libavtor.sql.gz | Authors table |
| lib.libgenre.sql.gz | Book-to-genre relationships |
| lib.librate.sql.gz | User ratings |
| lib.reviews.sql.gz | Full-text reviews (135MB) |
| lib.librecs.sql.gz | Recommendation graph |
| lib.annotations*.sql.gz | Book descriptions |

---

## Integration: Egregor AI System

PARDES serves as a knowledge corpus for RAG integration:

```
Egregor Query                      PARDES API
       │                              │
       ├─ "chaos magic books" ──→ /books?q=chaos+magic
       │  ← [Book list + ratings]─────┤
       │
       ├─ "Get content" ──────────→ /books/{id}/content
       │  ← [Text excerpt]────────────┤
       │
       └─ "Recommendations" ──────→ /books/top?genre=occult
                                     ← [Top books]─────
```

---

## What's NOT Implemented (Future Work)

### Backend
- [ ] PostgreSQL integration (connection pooling)
- [ ] Advanced caching (Redis)
- [ ] Rate limiting / API key auth
- [ ] Response compression (gzip)
- [ ] Docker containerization
- [ ] Full-text search optimization (pg_trgm)
- [ ] Recommendations engine

### Client
- [ ] Offline reading mode
- [ ] Bookmarks / reading progress
- [ ] Annotation support
- [ ] Export to other formats
- [ ] iOS/Android polish
- [ ] User preferences persistence

---

## Running the Project

### Backend
```bash
cd pardes-api
npm install
npm run dev          # Development (ts-node)
npm run build        # Compile TypeScript
npm start            # Production
```

### Client
```bash
cd client
flutter pub get
flutter run -d macos
```

### Telegram Bot
```bash
cd tg-bot
cp .env.example .env   # Then edit with your bot token
npm install
npm run dev            # Development (ts-node)
npm run build          # Compile TypeScript
npm start              # Production
```

### Environment Variables (.env)
```
PORT=3000
NODE_ENV=development
CACHE_DIR=./cache
STATIC_DIR=./static/zips
```

---

## Current Git Status

**Branch:** main

**Modified Files:**
- `client/lib/main.dart` (staged)
- `client/macos/Runner.xcodeproj/project.pbxproj` (unstaged)
- `client/pubspec.lock` (unstaged)

**Recent Commits:**
- e7b0289 Added torrent
- 9ae946e Client app
- 782bc73 Add STATUS.md - project state and Mac migration guide
- 1c9f6a7 Initial commit: PARDES Library API

---

## Summary

PARDES is a **feature-complete** Russian digital library system with:
- **Backend:** 20+ REST API endpoints, 685k books indexed, <50ms search
- **Client:** Full-featured Flutter desktop app with dark theme
- **Integration Ready:** Designed for Egregor AI RAG pipeline

Both components are production-ready for local deployment. PostgreSQL integration and advanced features remain for future phases.
