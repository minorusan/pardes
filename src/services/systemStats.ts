import os from 'os';
import { logger, LogCategory } from '../logger/logger';
import { cacheService } from './cacheService';

export interface SystemStats {
  cpu: {
    model: string;
    cores: number;
    usage: number; // Percentage
  };
  memory: {
    total: number; // MB
    used: number; // MB
    free: number; // MB
    usagePercent: number;
  };
  uptime: number; // Seconds
  platform: string;
  nodeVersion: string;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  system: SystemStats;
  library: {
    totalBooks: number;
    servedThisSession: number;
    cacheSize: number; // MB
    extractedBooks: number;
  };
  extraction?: {
    inProgress: boolean;
    currentArchive?: string;
    percentComplete?: number;
    extractedMB?: number;
    expectedMB?: number;
  };
  sessionStart: string;
  currentTime: string;
}

class SystemStatsService {
  private servedBooksCount: number = 0;
  private extractedBooksCount: number = 0;

  public getCPUUsage(): Promise<number> {
    return new Promise((resolve) => {
      const startMeasure = this.cpuAverage();

      setTimeout(() => {
        const endMeasure = this.cpuAverage();
        const idleDiff = endMeasure.idle - startMeasure.idle;
        const totalDiff = endMeasure.total - startMeasure.total;
        const percentageCPU = 100 - Math.floor((100 * idleDiff) / totalDiff);
        resolve(percentageCPU);
      }, 100);
    });
  }

  private cpuAverage() {
    const cpus = os.cpus();
    let idleMs = 0;
    let totalMs = 0;

    cpus.forEach((cpu) => {
      for (const type in cpu.times) {
        totalMs += cpu.times[type as keyof typeof cpu.times];
      }
      idleMs += cpu.times.idle;
    });

    return { idle: idleMs / cpus.length, total: totalMs / cpus.length };
  }

  public getMemoryStats() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const usagePercent = Math.round((usedMem / totalMem) * 100);

    return {
      total: Math.round(totalMem / 1024 / 1024), // Convert to MB
      used: Math.round(usedMem / 1024 / 1024),
      free: Math.round(freeMem / 1024 / 1024),
      usagePercent
    };
  }

  public async getSystemStats(): Promise<SystemStats> {
    const cpus = os.cpus();
    const cpuUsage = await this.getCPUUsage();

    return {
      cpu: {
        model: cpus[0].model,
        cores: cpus.length,
        usage: cpuUsage
      },
      memory: this.getMemoryStats(),
      uptime: Math.floor(os.uptime()),
      platform: `${os.type()} ${os.release()} (${os.arch()})`,
      nodeVersion: process.version
    };
  }

  public incrementServedBooks(): void {
    this.servedBooksCount++;
    logger.debug(LogCategory.SYSTEM, `Books served this session: ${this.servedBooksCount}`);
  }

  public setExtractedBooksCount(count: number): void {
    this.extractedBooksCount = count;
    logger.info(LogCategory.SYSTEM, `Extracted books count set to: ${count}`);
  }

  public async getHealthStatus(sessionStart: Date): Promise<HealthStatus> {
    const systemStats = await this.getSystemStats();

    // Determine health status based on resource usage
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    if (systemStats.memory.usagePercent > 90 || systemStats.cpu.usage > 90) {
      status = 'unhealthy';
    } else if (systemStats.memory.usagePercent > 75 || systemStats.cpu.usage > 75) {
      status = 'degraded';
    }

    // Get cache stats from cache service
    const cacheStats = cacheService.getStats();
    const cacheSizeMB = Math.round(cacheStats.totalSize / 1024 / 1024);

    const health: HealthStatus = {
      status,
      system: systemStats,
      library: {
        totalBooks: 0, // Will be populated from database
        servedThisSession: this.servedBooksCount,
        cacheSize: cacheSizeMB,
        extractedBooks: cacheStats.totalFiles
      },
      sessionStart: sessionStart.toISOString(),
      currentTime: new Date().toISOString()
    };

    // Add extraction progress if in progress
    if (cacheStats.inProgress && cacheStats.currentArchiveProgress) {
      health.extraction = {
        inProgress: true,
        currentArchive: cacheStats.currentArchiveProgress.archive,
        percentComplete: cacheStats.currentArchiveProgress.percentComplete,
        extractedMB: Math.round(cacheStats.currentArchiveProgress.extractedSize / 1024 / 1024),
        expectedMB: Math.round(cacheStats.currentArchiveProgress.expectedSize / 1024 / 1024)
      };
    }

    return health;
  }
}

export const systemStatsService = new SystemStatsService();
