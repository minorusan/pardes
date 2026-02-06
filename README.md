# 🌳 PARDES API

**Paradise Library** - A RESTful API for managing the Flibusta book collection.

## Etymology

**PARDES** (פרדס) means "Paradise" or "Orchard" in Hebrew. In Kabbalistic tradition, it represents the four levels of Torah interpretation:

- **P**eshat (פשט) - Surface meaning
- **R**emez (רמז) - Hinted meaning
- **D**erash (דרש) - Interpretive meaning
- **S**od (סוד) - Secret/Mystical meaning

Like the four levels of knowledge, PARDES provides layered access to a vast library of texts.

## Features

- ✨ **Health Monitoring** - Real-time system stats (CPU, RAM, books served)
- 📝 **File-based Logging** - Categorized logs (API, SYSTEM, CLIENT) with no stdout pollution
- 🗜️ **Smart Caching** - Extracts book archives on startup, cleans up on shutdown
- 🌐 **RESTful API** - Clean endpoints for library management
- 🔄 **Snapshot-ready** - Designed for easy library updates

## Project Structure

```
pardes-api/
├── src/
│   ├── logger/          # Logging system
│   ├── middleware/      # Express middleware
│   ├── routes/          # API endpoints
│   ├── services/        # Business logic
│   └── server.ts        # Main entry point
├── static/
│   └── zips/            # Book archives (lib.a.attached.zip, etc.)
├── cache/               # Temporary extracted books (auto-cleaned)
├── logs/                # Session logs
└── dist/                # Compiled JavaScript
```

## Installation

```bash
npm install
```

## Configuration

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Edit `.env` with your settings.

## Usage

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm start
```

## API Endpoints

### `GET /`
Root endpoint - API information and available routes

### `GET /health`
System health check with comprehensive stats:
- CPU usage and core count
- Memory usage (total, used, free, percentage)
- Books served this session
- Extracted books count
- Cache size
- Session start time
- Current system status (healthy/degraded/unhealthy)

**Example Response:**
```json
{
  "status": "healthy",
  "system": {
    "cpu": {
      "model": "Intel(R) Core(TM) i7-9750H CPU @ 2.60GHz",
      "cores": 12,
      "usage": 23
    },
    "memory": {
      "total": 16384,
      "used": 8192,
      "free": 8192,
      "usagePercent": 50
    },
    "uptime": 86400,
    "platform": "Windows_NT 10.0.19045 (x64)",
    "nodeVersion": "v20.11.0"
  },
  "library": {
    "totalBooks": 0,
    "servedThisSession": 42,
    "cacheSize": 1024,
    "extractedBooks": 150000
  },
  "sessionStart": "2026-02-05T12:00:00.000Z",
  "currentTime": "2026-02-05T14:30:00.000Z"
}
```

## Logging

All logs are written to `logs/pardes-[timestamp].log` with **NO stdout output** (except startup banner).

Log categories:
- `API` - HTTP requests, responses, endpoints
- `SYSTEM` - Server lifecycle, cache management, file operations
- `CLIENT` - Client-side events (future use)

## Architecture

### Startup Sequence
1. Initialize logger (create session log file)
2. Extract book archives from `static/zips/` to `cache/`
3. Connect to PostgreSQL database
4. Start Express server
5. Log health status

### Shutdown Sequence
1. Receive SIGTERM/SIGINT
2. Log shutdown signal
3. Clean up `cache/` directory
4. Close database connections
5. Finalize logs and exit

## Integration with Egregor

PARDES API is designed as the library management layer for the Egregor personalization system:
- Provides book metadata for RAG retrieval
- Serves book content to vector embedding pipeline
- Manages genre filtering for specialized LoRAs (occult, LHP, etc.)
- Tracks reading recommendations and ratings

## Features ✅

- [x] Smart caching with hash-based extraction (only extracts when ZIPs change)
- [x] Automatic manifest creation (no manual steps needed)
- [x] Zombie process cleanup on startup
- [x] Old cache directory auto-cleanup
- [x] Extraction progress monitoring
- [x] Security scanning of extracted files
- [x] Health monitoring with system stats

## TODO
- [ ] Database service (PostgreSQL connection)
- [ ] Book search endpoints
- [ ] Genre filtering
- [ ] Ratings and reviews endpoints
- [ ] Recommendations engine
- [ ] File serving (FB2, EPUB)

## License

ISC

---

*"Four rabbis entered Pardes. One died, one went mad, one became a heretic, and only Rabbi Akiva emerged safely."*
*May your journey through this library be as enlightening as Rabbi Akiva's.* 🌳
