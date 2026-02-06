import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { logger, LogCategory } from '../logger/logger';

export interface CacheManifest {
  version: string;
  lastUpdate: string;
  archives: {
    [filename: string]: {
      hash: string;
      size: number;
      extractedAt: string;
      fileCount: number;
    };
  };
}

class ManifestService {
  private manifestPath: string;
  private manifest: CacheManifest;

  constructor(cacheDir: string) {
    this.manifestPath = path.join(cacheDir, '.manifest.json');
    this.manifest = this.loadManifest();
  }

  /**
   * Load existing manifest or create new one
   */
  private loadManifest(): CacheManifest {
    try {
      if (fs.existsSync(this.manifestPath)) {
        const content = fs.readFileSync(this.manifestPath, 'utf8');
        logger.debug(LogCategory.SYSTEM, 'Loaded existing cache manifest');
        return JSON.parse(content);
      }
    } catch (error) {
      logger.warn(LogCategory.SYSTEM, 'Failed to load manifest, creating new one', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    return {
      version: '1.0.0',
      lastUpdate: new Date().toISOString(),
      archives: {}
    };
  }

  /**
   * Save manifest to disk
   */
  private saveManifest(): void {
    try {
      const content = JSON.stringify(this.manifest, null, 2);
      fs.writeFileSync(this.manifestPath, content, 'utf8');
      logger.debug(LogCategory.SYSTEM, 'Manifest saved successfully');
    } catch (error) {
      logger.error(LogCategory.SYSTEM, 'Failed to save manifest', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Calculate MD5 hash of a file
   */
  public async calculateFileHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('md5');
      const stream = fs.createReadStream(filePath);

      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /**
   * Check if archive needs extraction
   * Returns true if cache is valid (no extraction needed)
   */
  public async isCacheValid(filename: string, filePath: string): Promise<boolean> {
    try {
      // Check if archive exists in manifest
      if (!this.manifest.archives[filename]) {
        logger.info(LogCategory.SYSTEM, `Archive not in manifest: ${filename} - needs extraction`);
        return false;
      }

      // Calculate current hash
      logger.debug(LogCategory.SYSTEM, `Calculating hash for: ${filename}`);
      const currentHash = await this.calculateFileHash(filePath);

      const manifestHash = this.manifest.archives[filename].hash;

      if (currentHash === manifestHash) {
        logger.info(LogCategory.SYSTEM, `Cache valid for ${filename} (hash: ${currentHash.substring(0, 8)}...)`);
        return true;
      } else {
        logger.info(LogCategory.SYSTEM, `Hash mismatch for ${filename} - needs re-extraction`, {
          old: manifestHash.substring(0, 8),
          new: currentHash.substring(0, 8)
        });
        return false;
      }
    } catch (error) {
      logger.error(LogCategory.SYSTEM, `Failed to validate cache for ${filename}`, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Update manifest after successful extraction
   */
  public updateArchive(filename: string, filePath: string, hash: string, fileCount: number): void {
    const stats = fs.statSync(filePath);

    this.manifest.archives[filename] = {
      hash,
      size: stats.size,
      extractedAt: new Date().toISOString(),
      fileCount
    };

    this.manifest.lastUpdate = new Date().toISOString();
    this.saveManifest();

    logger.info(LogCategory.SYSTEM, `Manifest updated for ${filename}`, {
      hash: hash.substring(0, 8),
      fileCount
    });
  }

  /**
   * Remove archive from manifest
   */
  public removeArchive(filename: string): void {
    if (this.manifest.archives[filename]) {
      delete this.manifest.archives[filename];
      this.manifest.lastUpdate = new Date().toISOString();
      this.saveManifest();
      logger.info(LogCategory.SYSTEM, `Removed ${filename} from manifest`);
    }
  }

  /**
   * Get manifest data
   */
  public getManifest(): CacheManifest {
    return this.manifest;
  }

  /**
   * Clear manifest (for testing or forced re-extraction)
   */
  public clearManifest(): void {
    this.manifest = {
      version: '1.0.0',
      lastUpdate: new Date().toISOString(),
      archives: {}
    };
    this.saveManifest();
    logger.info(LogCategory.SYSTEM, 'Manifest cleared');
  }
}

export default ManifestService;
