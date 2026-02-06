import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger, LogCategory } from '../logger/logger';

const execAsync = promisify(exec);

interface ProcessRecord {
  pid: number;
  startedAt: string;
}

/**
 * Simple process manager - tracks PIDs and kills zombies on startup
 * No Windows-specific overkill, just basic cleanup
 */
class ProcessManager {
  private pidFilePath: string;
  private mainPid: number;

  constructor() {
    this.mainPid = process.pid;
    this.pidFilePath = path.join(process.cwd(), '.pardes.pids');
    logger.info(LogCategory.SYSTEM, `Process manager init (PID: ${this.mainPid})`);
  }

  /**
   * Initialize - kill zombies from previous runs
   */
  public async initialize(): Promise<void> {
    logger.info(LogCategory.SYSTEM, 'Checking for zombie processes...');

    try {
      // Clean up old broken cache directories
      await this.cleanupOldCaches();

      // Kill zombies from previous run
      await this.killZombiesFromPidFile();

      // Create new PID file
      this.savePids();
    } catch (error) {
      logger.error(LogCategory.SYSTEM, 'Process cleanup failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Kill zombies listed in old PID file
   */
  private async killZombiesFromPidFile(): Promise<void> {
    if (!fs.existsSync(this.pidFilePath)) {
      logger.debug(LogCategory.SYSTEM, 'No previous PID file');
      return;
    }

    try {
      const content = fs.readFileSync(this.pidFilePath, 'utf8');
      const records: ProcessRecord[] = JSON.parse(content);

      logger.info(LogCategory.SYSTEM, `Found ${records.length} process(es) from previous run`);

      for (const record of records) {
        await this.killIfExists(record.pid);
      }

      fs.unlinkSync(this.pidFilePath);
      logger.info(LogCategory.SYSTEM, 'Zombie cleanup complete');
    } catch (error) {
      logger.warn(LogCategory.SYSTEM, 'Could not read/clean PID file');
    }
  }

  /**
   * Kill process if it exists
   */
  private async killIfExists(pid: number): Promise<void> {
    try {
      if (process.platform === 'win32') {
        const { stdout } = await execAsync(`tasklist /FI "PID eq ${pid}" /NH`);
        if (stdout.includes(pid.toString())) {
          await execAsync(`taskkill /F /PID ${pid}`);
          logger.info(LogCategory.SYSTEM, `Killed zombie PID ${pid}`);
        }
      } else {
        process.kill(pid, 0); // Check exists
        process.kill(pid, 'SIGTERM');
        logger.info(LogCategory.SYSTEM, `Killed zombie PID ${pid}`);
      }
    } catch {
      // Process already dead, ignore
    }
  }

  /**
   * Clean up old broken cache directories
   */
  private async cleanupOldCaches(): Promise<void> {
    const oldDirs = ['.cache.old', '.cache.broken'];

    for (const dir of oldDirs) {
      const fullPath = path.join(process.cwd(), dir);
      if (fs.existsSync(fullPath)) {
        try {
          await fs.promises.rm(fullPath, { recursive: true, force: true });
          logger.info(LogCategory.SYSTEM, `Cleaned up ${dir}`);
        } catch {
          logger.debug(LogCategory.SYSTEM, `Could not remove ${dir}`);
        }
      }
    }
  }

  /**
   * Save current PID to file
   */
  private savePids(): void {
    try {
      const record: ProcessRecord = {
        pid: this.mainPid,
        startedAt: new Date().toISOString()
      };

      fs.writeFileSync(this.pidFilePath, JSON.stringify([record], null, 2));
    } catch (error) {
      logger.error(LogCategory.SYSTEM, 'Failed to save PID file');
    }
  }

  /**
   * Cleanup on shutdown
   */
  public async cleanup(): Promise<void> {
    logger.info(LogCategory.SYSTEM, 'Process manager cleanup');

    try {
      if (fs.existsSync(this.pidFilePath)) {
        fs.unlinkSync(this.pidFilePath);
      }
    } catch (error) {
      logger.warn(LogCategory.SYSTEM, 'PID file cleanup failed');
    }
  }
}

export const processManager = new ProcessManager();
