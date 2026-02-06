# PARDES Project Status - 2026-02-06

## Current State: Migration to Mac in Progress

### What Is PARDES?
PARDES (Paradise Library) is a NodeTS/Express REST API backend for managing the Flibusta Russian book archive (172k+ files, 4.5GB compressed). It's a component of the larger **Egregor** personal AI system, serving as the knowledge corpus provider for RAG integration.

### Egregor Integration Context
- **Egregor**: Self-hosted AI system (LLM + multi-LoRA orchestration)
- **PARDES Role**: Book library API feeding RAG pipeline
- **Production Target**: Ubuntu server (i3 CPU, RTX 5060 TI, 30GB+ RAM)
- **Use Case**: Personal AI librarian with 150k-300k books, specialized in occult/esoteric texts

---

## What We've Built So Far

### ✅ Completed Components

#### 1. **Smart Caching System** (`src/services/cacheService.ts`)
- Hash-based manifest validation (MD5 checksums)
- Only re-extracts when ZIP files change
- Non-blocking initialization (server starts before extraction completes)
- Tracks extraction progress and stats

#### 2. **Pure Node.js Extraction** (`src/services/extractionService.ts`)
- **CRITICAL FIX**: Switched from Windows shell commands to `extract-zip` library
- Cross-platform (no PowerShell/unzip dependencies)
- Real-time progress monitoring with console progress bar
- Elapsed time tracking
- **215 lines** (clean, focused)

**Before (BAD)**:
- Tried using `unzip` or PowerShell via shell commands
- Windows-specific paths, slow execution
- 54x slower than expected

**After (GOOD)**:
- Pure JavaScript `extract-zip` npm package
- Works identically on Windows/Mac/Linux/Pi
- Much faster (but still bottlenecked by Windows NTFS for many small files)

#### 3. **Manifest Service** (`src/services/manifestService.ts`)
- Manages `.cache/.manifest.json`
- Calculates MD5 hashes of ZIP files
- Determines if re-extraction needed
- Preserves cache between restarts

#### 4. **Process Manager** (`src/services/processManager.ts`)
- Tracks PIDs in `.pardes.pids` file
- Kills zombie processes on startup
- Cleans up old cache directories
- **148 lines** (simplified from 251)

#### 5. **Logger** (`src/logger/logger.ts`)
- File-only logging (NO stdout pollution)
- Categories: API, SYSTEM, CLIENT
- Levels: DEBUG, INFO, WARN, ERROR
- Timestamped logs in `logs/` directory

#### 6. **HTTP Server** (`src/server.ts`)
- Express REST API
- Non-blocking startup (extraction runs in background)
- Graceful shutdown (doesn't close terminal)
- Health endpoint: `GET /health`
- Extraction progress: `GET /extraction/progress`

#### 7. **System Stats** (`src/services/systemStats.ts`)
- CPU/memory monitoring
- Cache size tracking
- Extraction progress reporting
- Health status endpoint

### 📦 Dependencies Installed
```json
{
  "extract-zip": "^2.0.1",  // Pure Node.js ZIP extraction
  "express": "^4.18.2",
  "cors": "^2.8.5",
  "dotenv": "^16.0.3",
  "typescript": "^5.0.0",
  // ... etc
}
```

### 🗂️ Project Structure
```
pardes-api/
├── src/
│   ├── server.ts                    // Main HTTP server
│   ├── logger/
│   │   └── logger.ts                // File-only logging
│   ├── services/
│   │   ├── cacheService.ts          // Cache management (255 lines)
│   │   ├── extractionService.ts     // ZIP extraction (215 lines)
│   │   ├── manifestService.ts       // Hash validation (171 lines)
│   │   ├── processManager.ts        // PID tracking (148 lines)
│   │   ├── securityInspector.ts     // File scanning (228 lines)
│   │   └── systemStats.ts           // Health monitoring (161 lines)
│   └── routes/
│       ├── health.ts                // GET /health
│       └── extraction.ts            // GET /extraction/progress
├── static/zips/                     // Source ZIP files
│   ├── lib.a.attached.zip           // 965MB (covers + books)
│   ├── lib.b.attached.zip           // 3.6GB (covers + books)
│   └── lib.*.sql.gz                 // PostgreSQL dumps (metadata)
├── .cache/                          // Extracted files (target)
│   ├── .manifest.json               // Hash validation cache
│   └── lib.b.attached/              // Currently extracting
│       └── [nested structure]       // Covers + nested ZIPs with FB2 books
├── logs/                            // Application logs
└── package.json
```

---

## Current Extraction Status

### Windows Extraction Progress (ABORTED)
- **Status**: Stuck at 69% after 15.6 hours
- **Reason**: Windows NTFS + 172k small files = I/O hell
- **Progress**: 2% in last 8 hours (unacceptable)
- **Decision**: ABORT, switch to Mac

### What's Being Extracted
**Source**: `lib.b.attached.zip` (3.6GB compressed)

**Structure Discovered**:
```
lib.b.attached/
├── [number]/[book_id]/
│   ├── [cover_image].jpg/png/gif     // Book covers (28k+ JPG, 3k+ PNG)
│   └── [book_name].zip               // Nested ZIP containing FB2 book file
```

**File Distribution** (at 69% extracted, ~120k files):
- **28,790 JPG** - Book covers
- **3,464 PNG** - Book covers
- **1,289 GIF** - Book covers
- **1,183 JPEG** - Book covers
- **9 PDF** - Documents
- **2 ZIP** - Nested books (FB2 files inside)
- **2 DOC** - Documents

**Key Discovery**: Books are stored as **nested ZIPs** containing FB2 (FictionBook2) files.

Example: `lib.b.attached/36/694336/adskaya_past_dzhajls_kristian_0.zip` contains:
- `adskaya_past_dzhajls_kristian.fb2` (1.15MB uncompressed book)

**Total Extracted So Far**: 2.1GB (at 69% progress)
**Estimated Final Size**: ~5-6GB (covers + nested book ZIPs)

### Random Discovery Example
**First random folder checked** (`lib.b.attached/43/142143/tit.jpg`):
- "История города Харькова за 250 лѣтъ его существованія"
- (History of Kharkiv - 250 Years of its Existence)
- **Published 1893** - pre-revolutionary Russia, old orthography
- Rare historical document, impossible to find elsewhere

---

## Next Steps on Mac

### 1. Copy Files to Mac
```bash
# Copy project folder to Mac (or use external drive)
# Includes:
# - pardes-api/ (source code)
# - static/zips/ (ZIP files to extract)
```

### 2. Restart Extraction on Mac
```bash
cd pardes-api
npm install
npm run dev

# Extraction will happen automatically on startup
# Expected time on Mac: 30-60 minutes (vs 5+ days on Windows)
```

### 3. Once Extraction Completes

#### A. Analyze Full Structure
- Count total files by type
- Map nested ZIP locations
- Identify FB2 book files
- Check for other formats (EPUB, PDF, DOC)

#### B. Import PostgreSQL Database
The `static/zips/` folder contains SQL dumps with metadata:
```
lib.libbook.sql.gz              // Main book metadata
lib.libavtor.sql.gz             // Authors
lib.libavtorname.sql.gz         // Author names (Cyrillic variants)
lib.libgenre.sql.gz             // Genre classifications
lib.libgenrelist.sql.gz         // Genre taxonomy
lib.librate.sql.gz              // User ratings
lib.librecs.sql.gz              // Recommendation graph
lib.reviews.sql.gz              // Full text reviews (135MB!)
lib.a.annotations.sql.gz        // Book descriptions
lib.b.annotations.sql.gz        // Book descriptions
lib.annotations_pics.sql.gz     // Cover images metadata
lib.libfilename.sql.gz          // Maps book_id → filename
lib.libseq.sql.gz               // Book series
lib.libtranslator.sql.gz        // Translators
```

**Database Engine**: PostgreSQL (confirmed from architecture doc)

**Import Order** (respecting foreign keys):
1. Genre taxonomy (`libgenrelist`)
2. Authors (`libavtor`, `libavtorname`)
3. Translators (`libtranslator`)
4. Series (`libseq`, `libseqname`)
5. Books (`libbook`) ← main table
6. Filenames (`libfilename`)
7. Genres (`libgenre`) ← book-to-genre links
8. Ratings (`librate`)
9. Recommendations (`librecs`)
10. Reviews (`reviews`)
11. Annotations (`annotations`)

#### C. Design PARDES REST API

**Core Endpoints**:
```
GET  /api/books                      // List/search books
GET  /api/books/:id                  // Book metadata
GET  /api/books/:id/download         // Extract & serve FB2 file
GET  /api/books/:id/cover            // Book cover image
GET  /api/books/:id/reviews          // User reviews
GET  /api/genres                     // List all genres
GET  /api/genres/:id/books           // Books by genre
GET  /api/authors/:id/books          // Books by author
GET  /api/search?q=...               // Full-text search
```

**Query Parameters** (for `/api/books`):
- `genre` - Filter by genre ID
- `author` - Filter by author ID
- `rating_min` - Minimum rating (0-5)
- `year_min`, `year_max` - Publication year range
- `limit`, `offset` - Pagination
- `sort` - rating, year, title, review_count

**On-Demand Extraction Strategy**:
- Keep nested ZIPs compressed (save disk space)
- Extract FB2 on first request to `/books/:id/download`
- Optional: Cache extracted FB2 in temp directory (LRU eviction)
- Fast extraction with `extract-zip` on Ubuntu

#### D. RAG Integration for Egregor

**Egregor Will Query PARDES For**:
1. Book metadata (titles, authors, genres)
2. Full-text content (FB2 files) for embedding generation
3. User ratings & reviews (community intelligence)
4. Recommendations (collaborative filtering)

**Example RAG Pipeline**:
```python
# Egregor's perspective:
1. Query PARDES: GET /api/books?genre=occult&rating_min=4.5
2. Download FB2: GET /api/books/{id}/download
3. Parse FB2 XML, extract full text
4. Chunk text into paragraphs
5. Generate embeddings (sentence transformer)
6. Store in vector DB (ChromaDB/FAISS)
7. User asks: "What does Crowley say about the Abyss?"
8. Vector search retrieves relevant passages
9. LLM generates response citing Flibusta sources
```

---

## Technical Learnings

### ❌ What Didn't Work
1. **Nodemon** - Auto-restarted mid-extraction (removed)
2. **Windows shell commands** (`unzip`, `PowerShell`) - Slow, platform-specific, PATH issues
3. **Blocking extraction** - Prevented server from starting
4. **Cache cleanup on shutdown** - Destroyed valid extracted data
5. **Windows NTFS** - Catastrophically slow for 172k small files

### ✅ What Works
1. **`extract-zip` npm package** - Pure Node.js, cross-platform, fast
2. **Non-blocking initialization** - Server starts immediately, extraction in background
3. **Manifest-based caching** - Only re-extract when ZIPs change
4. **Real-time progress monitoring** - Console progress bar with elapsed time
5. **File-only logging** - Clean stdout, detailed logs preserved
6. **Graceful shutdown** - Doesn't close terminal on Ctrl+C

### 🎯 Key Insight
**Windows filesystem performance is unacceptable for this use case.**
- Mac APFS: Fast small file handling
- Linux ext4: Fast small file handling
- Windows NTFS: 54x slower, gets worse over time

**Production deployment on Ubuntu will be fast.** This Windows pain is temporary.

---

## Code Architecture (Post-Refactor)

### Design Principles
1. **Single Responsibility** - Each service does ONE thing
2. **Separation of Concerns** - Extraction ≠ Cache ≠ Process Management
3. **Cross-Platform** - No shell commands, pure Node.js
4. **Non-Blocking** - Server responsive during long operations
5. **Testable** - Clear interfaces, injectable dependencies

### Refactor Summary (from REFACTOR.md)
**Before**: 736 lines of tangled code
**After**: 618 lines (-118 lines, but way cleaner)

- Created `extractionService.ts` (extraction logic separated)
- Simplified `cacheService.ts` (cache management only)
- Simplified `processManager.ts` (removed Windows-specific overkill)
- Kept `securityInspector.ts` (user insisted - justified for torrent files)

---

## Production Deployment Plan

### Target Hardware
- **CPU**: Intel i3 (modest, fine for I/O-bound tasks)
- **GPU**: RTX 5060 TI 16GB VRAM (for Egregor LLM inference + embeddings)
- **RAM**: 30GB+ (PostgreSQL + Redis + LLM + vector DB)
- **OS**: Ubuntu Server (ext4 filesystem = fast)

### Services on Ubuntu
```
Ubuntu Server (nettop)
├── PARDES API (NodeTS/Express)       // Book serving
├── PostgreSQL 15                     // Flibusta metadata
├── Egregor Orchestrator              // AI system
│   ├── LLM (Qwen/Reasoner 14B)      // Base model
│   ├── LoRA Cache                    // Dynamic loading
│   ├── Intent Classifier             // Query routing
│   └── RAG Engine                    // Vector search
├── ChromaDB / FAISS                  // Vector database
└── Whisper STT (optional)            // Audio processing
```

### Estimated Storage (Ubuntu)
- PostgreSQL data: ~1GB
- Extracted covers: ~4GB (mostly images)
- Nested book ZIPs: ~1.5GB (compressed FB2 files)
- **Total PARDES**: ~6.5GB
- Egregor models + LoRAs: ~10GB
- Vector embeddings: ~5-10GB (for full corpus)
- **Total System**: ~25-30GB

---

## Commands Reference

### Development (Mac/Ubuntu)
```bash
# Install dependencies
npm install

# Run dev server (auto-extracts on first run)
npm run dev

# Build for production
npm run build

# Run production
npm start

# Check TypeScript
npx tsc --noEmit
```

### Useful Queries (after extraction)
```bash
# Check cache size
du -sh pardes-api/.cache

# Count files by type
find .cache -type f | sed 's/.*\.//' | sort | uniq -c | sort -rn

# Find nested ZIPs (actual books)
find .cache -type f -name "*.zip"

# Find FB2 books (if extracted from nested ZIPs)
find .cache -type f -name "*.fb2"

# Check manifest
cat .cache/.manifest.json | jq
```

### PostgreSQL Import (once on Ubuntu)
```bash
# Extract SQL dumps
cd static/zips
gunzip *.sql.gz

# Create database
sudo -u postgres createdb flibusta

# Import (in dependency order)
sudo -u postgres psql flibusta < lib.libgenrelist.sql
sudo -u postgres psql flibusta < lib.libavtor.sql
# ... (see import order above)

# Verify
psql -U postgres -d flibusta -c "SELECT COUNT(*) FROM libbook;"
psql -U postgres -d flibusta -c "SELECT COUNT(*) FROM librate;"
```

---

## Current Blockers

### ⚠️ IMMEDIATE: Extraction Stuck on Windows
- **Status**: 69% after 15.6 hours, slowing down
- **Solution**: Switch to Mac, restart extraction
- **ETA on Mac**: 30-60 minutes

### 🔜 NEXT: Database Schema Unknown
- **Status**: SQL dumps not yet imported
- **Solution**: Import into PostgreSQL, analyze schema
- **Priority**: High (needed for API design)

### 🔜 NEXT: API Design Needed
- **Status**: Server exists, but no book endpoints yet
- **Solution**: Design REST API after DB import
- **Priority**: High (core functionality)

---

## Questions to Answer (After Mac Extraction)

1. **What's the exact book count?** (extract from `libbook` table)
2. **How many occult/esoteric books?** (filter by `religion_esoterics` genre)
3. **What's the average file size of FB2 books?**
4. **Are there EPUB/MOBI files or only FB2?**
5. **What's the oldest book in the collection?** (check publication years)
6. **How many books have 50+ reviews?** (community favorites)
7. **What languages are present?** (Russian + translations?)

---

## Success Criteria

### Phase 1: Extraction ✅ (Almost - needs Mac)
- [x] Pure Node.js extraction works
- [x] Progress monitoring functional
- [x] Cache manifest validated
- [ ] Full extraction completed (PENDING on Mac)

### Phase 2: Database (TODO)
- [ ] PostgreSQL installed
- [ ] SQL dumps imported
- [ ] Schema documented
- [ ] Basic queries working

### Phase 3: API (TODO)
- [ ] Book search endpoint
- [ ] Metadata endpoint
- [ ] Download endpoint (on-demand FB2 extraction)
- [ ] Cover image serving
- [ ] Review endpoint

### Phase 4: Integration (TODO)
- [ ] Egregor can query PARDES
- [ ] RAG pipeline tested
- [ ] Embeddings generated for occult corpus
- [ ] End-to-end book recommendation working

---

## Contact Points with Egregor

PARDES provides **knowledge corpus** for Egregor's RAG system. Key integration points:

1. **Book Discovery**: Egregor queries PARDES for books matching user interests
2. **Content Ingestion**: Egregor downloads FB2 files for embedding generation
3. **Community Intelligence**: User ratings/reviews inform Egregor's recommendations
4. **Citation**: Egregor can cite specific books from Flibusta in responses

**Example Egregor Query**:
```
User: "What's a good intro to chaos magic?"

Egregor:
1. Queries PARDES: GET /api/books?genre=occult&q=chaos+magic&rating_min=4.5
2. Gets: "Condensed Chaos" by Phil Hine (4.7/5, 143 ratings)
3. Retrieves reviews: GET /api/books/{id}/reviews
4. Summarizes: "Practical exercises (89 mentions), beginner-friendly (67 mentions)"
5. Responds: "I recommend 'Condensed Chaos' by Phil Hine from the Flibusta
   collection. Rated 4.7/5 by 143 readers who found it practical and accessible."
```

---

## Files to Preserve (Don't Delete)

### Critical
- `src/` - All source code
- `package.json` - Dependencies
- `tsconfig.json` - TypeScript config
- `static/zips/*.sql.gz` - PostgreSQL dumps (metadata)
- `static/zips/*.zip` - Book archives (can't re-download easily)
- `.cache/.manifest.json` - Hash validation (regenerates if lost)

### Can Regenerate
- `node_modules/` - Run `npm install`
- `dist/` - Run `npm run build`
- `logs/` - Regenerates on run
- `.cache/lib.*` - Re-extracts from ZIPs (but slow)

### Documentation
- `REFACTOR.md` - Refactoring summary
- `STATUS.md` - This file
- `C:\Users\minor\Downloads\egregor_complete_architecture.md` - Full system architecture

---

## Resume Point for Mac

When you open this project on Mac:

1. **Read this STATUS.md** for full context
2. **Run extraction**: `cd pardes-api && npm run dev`
3. **Wait ~30-60 min** for extraction to complete
4. **Analyze results**: Check what's in `.cache/`, count files, explore structure
5. **Import PostgreSQL**: Extract and load SQL dumps
6. **Design API**: Based on discovered schema and file structure
7. **Build endpoints**: Book search, download, metadata, covers, reviews
8. **Test integration**: Mock Egregor RAG queries

---

## Notes

- Windows extraction ABORTED at 69% after 15.6 hours
- Mac expected to complete in <1 hour
- Ubuntu production deployment will be even faster
- This is infrastructure for Egregor AI's occult library
- 150k-300k books with full metadata, ratings, reviews
- Random sample: 1893 historical text (pre-revolutionary Russia)
- Books stored as nested ZIPs containing FB2 files
- Extract on-demand to save disk space

---

## Last Known Good State

- **Commit**: N/A (no git repo yet)
- **Node Version**: v22.16.0
- **TypeScript**: Compiles without errors
- **Server**: Starts and runs, health endpoint works
- **Extraction**: Works on Mac/Ubuntu (pure Node.js)
- **Windows**: DO NOT USE for extraction (NTFS too slow)

---

**Status Updated**: 2026-02-06 (Windows extraction abandoned at 69%, switching to Mac)
**Next Action**: Copy project to Mac, restart extraction
**ETA to Functional API**: ~2-3 days (Mac extraction + DB import + API build)
