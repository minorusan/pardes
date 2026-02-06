import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { logger, LogCategory } from '../logger/logger';

export interface SecurityReport {
  totalFiles: number;
  scannedFiles: number;
  fileTypes: Record<string, number>;
  suspiciousFiles: SuspiciousFile[];
  largeSamples: FileSample[];
  randomSamples: FileSample[];
  hash: string;
}

export interface SuspiciousFile {
  path: string;
  reason: string;
  size: number;
  extension: string;
}

export interface FileSample {
  path: string;
  size: number;
  extension: string;
  firstBytes: string; // Hex representation
}

class SecurityInspector {
  private readonly MAX_SAMPLES = 10;
  private readonly SUSPICIOUS_EXTENSIONS = [
    '.exe', '.bat', '.cmd', '.sh', '.ps1', '.vbs',
    '.dll', '.so', '.dylib', '.app', '.scr', '.com'
  ];

  /**
   * Perform comprehensive security inspection of cache directory
   */
  public async inspectCache(cacheDir: string): Promise<SecurityReport> {
    logger.info(LogCategory.SYSTEM, 'Starting security inspection of cache');

    const report: SecurityReport = {
      totalFiles: 0,
      scannedFiles: 0,
      fileTypes: {},
      suspiciousFiles: [],
      largeSamples: [],
      randomSamples: [],
      hash: ''
    };

    try {
      const allFiles = await this.getAllFiles(cacheDir);
      report.totalFiles = allFiles.length;

      logger.info(LogCategory.SYSTEM, `Found ${allFiles.length} files to inspect`);

      // Scan all files
      for (const filePath of allFiles) {
        await this.scanFile(filePath, cacheDir, report);
        report.scannedFiles++;
      }

      // Get largest files for inspection
      const sortedBySize = [...allFiles].sort((a, b) => {
        const sizeA = fs.statSync(a).size;
        const sizeB = fs.statSync(b).size;
        return sizeB - sizeA;
      });

      report.largeSamples = await Promise.all(
        sortedBySize.slice(0, this.MAX_SAMPLES).map(f => this.getSample(f, cacheDir))
      );

      // Get random samples
      const shuffled = [...allFiles].sort(() => Math.random() - 0.5);
      report.randomSamples = await Promise.all(
        shuffled.slice(0, this.MAX_SAMPLES).map(f => this.getSample(f, cacheDir))
      );

      // Generate hash of file structure
      report.hash = this.generateStructureHash(report.fileTypes);

      logger.info(LogCategory.SYSTEM, 'Security inspection complete', {
        totalFiles: report.totalFiles,
        suspiciousCount: report.suspiciousFiles.length,
        fileTypes: report.fileTypes
      });

      return report;
    } catch (error) {
      logger.error(LogCategory.SYSTEM, 'Security inspection failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Recursively get all files in directory
   */
  private async getAllFiles(dir: string): Promise<string[]> {
    const files: string[] = [];

    const processDirectory = async (currentDir: string) => {
      const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          await processDirectory(fullPath);
        } else {
          files.push(fullPath);
        }
      }
    };

    await processDirectory(dir);
    return files;
  }

  /**
   * Scan individual file for security issues
   */
  private async scanFile(filePath: string, baseDir: string, report: SecurityReport): Promise<void> {
    const stats = fs.statSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const relativePath = path.relative(baseDir, filePath);

    // Count file types
    report.fileTypes[ext] = (report.fileTypes[ext] || 0) + 1;

    // Check for suspicious extensions
    if (this.SUSPICIOUS_EXTENSIONS.includes(ext)) {
      report.suspiciousFiles.push({
        path: relativePath,
        reason: `Suspicious extension: ${ext}`,
        size: stats.size,
        extension: ext
      });
      logger.warn(LogCategory.SYSTEM, `SUSPICIOUS: ${relativePath} has extension ${ext}`);
    }

    // Check for path traversal attempts in filename
    if (relativePath.includes('..')) {
      report.suspiciousFiles.push({
        path: relativePath,
        reason: 'Path contains directory traversal (..)' ,
        size: stats.size,
        extension: ext
      });
      logger.warn(LogCategory.SYSTEM, `SUSPICIOUS: ${relativePath} contains path traversal`);
    }

    // Check for hidden files (Unix style)
    const basename = path.basename(filePath);
    if (basename.startsWith('.') && basename !== '.') {
      logger.debug(LogCategory.SYSTEM, `Hidden file found: ${relativePath}`);
    }

    // Check for unusually large files (>100MB - unusual for ebooks)
    if (stats.size > 100 * 1024 * 1024) {
      logger.warn(LogCategory.SYSTEM, `Large file: ${relativePath} (${Math.round(stats.size / 1024 / 1024)}MB)`);
    }
  }

  /**
   * Get file sample with header bytes
   */
  private async getSample(filePath: string, baseDir: string): Promise<FileSample> {
    const stats = fs.statSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const relativePath = path.relative(baseDir, filePath);

    // Read first 16 bytes for file type detection
    const buffer = Buffer.alloc(16);
    const fd = fs.openSync(filePath, 'r');
    const bytesRead = fs.readSync(fd, buffer, 0, 16, 0);
    fs.closeSync(fd);

    const firstBytes = buffer.slice(0, bytesRead).toString('hex');

    return {
      path: relativePath,
      size: stats.size,
      extension: ext,
      firstBytes
    };
  }

  /**
   * Generate hash of file structure for change detection
   */
  private generateStructureHash(fileTypes: Record<string, number>): string {
    const sorted = Object.keys(fileTypes).sort();
    const structure = sorted.map(ext => `${ext}:${fileTypes[ext]}`).join('|');
    return crypto.createHash('sha256').update(structure).digest('hex').substring(0, 16);
  }

  /**
   * Check if file appears to be a valid book format based on magic bytes
   */
  public identifyFileType(firstBytes: string): string {
    // Common book format magic bytes
    const magicBytes: Record<string, string> = {
      '504b0304': 'ZIP/EPUB (PK format)',
      '3c3f786d': 'XML/FB2 (<?xml)',
      '3c464963': 'FB2 (<FictionBook)',
      '255044462d': 'PDF (%PDF-)',
      '1f8b08': 'GZIP',
      '425a68': 'BZIP2',
    };

    const header = firstBytes.toLowerCase().substring(0, 10);

    for (const [magic, type] of Object.entries(magicBytes)) {
      if (header.startsWith(magic)) {
        return type;
      }
    }

    return 'Unknown';
  }
}

export const securityInspector = new SecurityInspector();
