import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { logger, LogCategory } from '../logger/logger';

const execAsync = promisify(exec);

interface ProcessRecord {
  pid: number;
  type: 'extraction' | 'main';
  startedAt: string;
}

class ProcessManager {
  private pidFilePath: string;
  private childPids: Set<number> = new Set();
  private mainPid: number;

  constructor() {
    this.mainPid = process.pid;
    this.pidFilePath = path.join(process.cwd(), '.pardes.pids');

    logger.info(LogCategory.SYSTEM, `Process manager initialized (PID: ${this.mainPid})`);
  }

  /**
   * Initialize - clean up any zombie processes from previous runs
   */
  public async initialize(): Promise<void> {
    logger.info(LogCategory.SYSTEM, 'Checking for zombie processes from previous runs...');

    try {
      // Clean up old broken cache directories
      await this.cleanupOldCaches();

      // Read old PID file if it exists
      if (fs.existsSync(this.pidFilePath)) {
        const content = fs.readFileSync(this.pidFilePath, 'utf8');
        const records: ProcessRecord[] = JSON.parse(content);

        logger.info(LogCategory.SYSTEM, `Found ${records.length} process record(s) from previous run`);

        for (const record of records) {
          await this.killProcessIfExists(record.pid, record.type);
        }

        // Delete old PID file
        fs.unlinkSync(this.pidFilePath);
        logger.info(LogCategory.SYSTEM, 'Old PID file cleaned up');
      } else {
        logger.debug(LogCategory.SYSTEM, 'No previous PID file found');
      }

      // Also check for orphaned PowerShell extraction processes
      await this.killOrphanedExtractionProcesses();

      // Create new PID file with current process
      this.savePids();
    } catch (error) {
      logger.error(LogCategory.SYSTEM, 'Failed to clean up zombie processes', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      // Don't throw - continue startup even if cleanup fails
    }
  }

  /**
   * Clean up old broken cache directories automatically
   */
  private async cleanupOldCaches(): Promise<void> {
    const baseDir = process.cwd();
    const oldCacheDirs = ['.cache.old', '.cache.broken'];

    for (const dir of oldCacheDirs) {
      const fullPath = path.join(baseDir, dir);
      if (fs.existsSync(fullPath)) {
        logger.info(LogCategory.SYSTEM, `Removing old cache directory: ${dir}`);
        try {
          // Try to remove - if it fails, just log and continue
          await execAsync(`${process.platform === 'win32' ? 'rmdir /s /q' : 'rm -rf'} "${fullPath}"`);
          logger.info(LogCategory.SYSTEM, `Cleaned up ${dir}`);
        } catch (error) {
          logger.warn(LogCategory.SYSTEM, `Could not remove ${dir}, will try again next startup`, {
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    }
  }

  /**
   * Kill a process if it still exists
   */
  private async killProcessIfExists(pid: number, type: string): Promise<void> {
    try {
      if (process.platform === 'win32') {
        // Check if process exists
        const { stdout } = await execAsync(`tasklist /FI "PID eq ${pid}" /NH`);

        if (stdout.includes(pid.toString())) {
          logger.warn(LogCategory.SYSTEM, `Killing zombie ${type} process: ${pid}`);
          await execAsync(`taskkill /F /PID ${pid}`);
          logger.info(LogCategory.SYSTEM, `Killed zombie process ${pid}`);
        } else {
          logger.debug(LogCategory.SYSTEM, `Process ${pid} already terminated`);
        }
      } else {
        // Unix: send kill signal
        try {
          process.kill(pid, 0); // Check if exists
          logger.warn(LogCategory.SYSTEM, `Killing zombie ${type} process: ${pid}`);
          process.kill(pid, 'SIGTERM');
          logger.info(LogCategory.SYSTEM, `Killed zombie process ${pid}`);
        } catch {
          logger.debug(LogCategory.SYSTEM, `Process ${pid} already terminated`);
        }
      }
    } catch (error) {
      logger.debug(LogCategory.SYSTEM, `Could not check/kill process ${pid}`, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Find and kill orphaned PowerShell processes running Expand-Archive
   */
  private async killOrphanedExtractionProcesses(): Promise<void> {
    try {
      if (process.platform === 'win32') {
        // Find PowerShell processes with high memory usage (likely extraction)
        const { stdout } = await execAsync('tasklist /FI "IMAGENAME eq powershell.exe" /FO CSV');

        const lines = stdout.split('\n').slice(1); // Skip header
        let killedCount = 0;

        for (const line of lines) {
          const match = line.match(/"powershell\.exe","(\d+)","[^"]*","[^"]*","([^"]+)/);
          if (match) {
            const pid = parseInt(match[1]);
            const memoryStr = match[2].replace(/[^\d]/g, ''); // Remove commas and 'K'
            const memoryKB = parseInt(memoryStr);

            // Kill PowerShell processes using > 50MB (likely extraction zombies)
            if (memoryKB > 50000) {
              logger.warn(LogCategory.SYSTEM, `Found orphaned PowerShell process: PID ${pid} (${Math.round(memoryKB / 1024)}MB)`);
              await execAsync(`taskkill /F /PID ${pid}`);
              killedCount++;
              logger.info(LogCategory.SYSTEM, `Killed orphaned extraction process ${pid}`);
            }
          }
        }

        if (killedCount > 0) {
          logger.info(LogCategory.SYSTEM, `Cleaned up ${killedCount} orphaned extraction process(es)`);
        } else {
          logger.debug(LogCategory.SYSTEM, 'No orphaned extraction processes found');
        }
      }
    } catch (error) {
      logger.debug(LogCategory.SYSTEM, 'Could not check for orphaned processes', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Register a child process PID
   */
  public registerChildProcess(pid: number, type: 'extraction' | 'main' = 'extraction'): void {
    this.childPids.add(pid);
    this.savePids();
    logger.debug(LogCategory.SYSTEM, `Registered child process: ${pid} (${type})`);
  }

  /**
   * Unregister a child process PID
   */
  public unregisterChildProcess(pid: number): void {
    this.childPids.delete(pid);
    this.savePids();
    logger.debug(LogCategory.SYSTEM, `Unregistered child process: ${pid}`);
  }

  /**
   * Save PIDs to file
   */
  private savePids(): void {
    try {
      const records: ProcessRecord[] = [
        {
          pid: this.mainPid,
          type: 'main',
          startedAt: new Date().toISOString()
        },
        ...Array.from(this.childPids).map(pid => ({
          pid,
          type: 'extraction' as const,
          startedAt: new Date().toISOString()
        }))
      ];

      fs.writeFileSync(this.pidFilePath, JSON.stringify(records, null, 2), 'utf8');
    } catch (error) {
      logger.error(LogCategory.SYSTEM, 'Failed to save PIDs', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Clean up on shutdown
   */
  public async cleanup(): Promise<void> {
    logger.info(LogCategory.SYSTEM, 'Process manager cleanup...');

    try {
      // Kill all registered child processes
      for (const pid of this.childPids) {
        await this.killProcessIfExists(pid, 'extraction');
      }

      // Remove PID file
      if (fs.existsSync(this.pidFilePath)) {
        fs.unlinkSync(this.pidFilePath);
        logger.debug(LogCategory.SYSTEM, 'PID file removed');
      }
    } catch (error) {
      logger.error(LogCategory.SYSTEM, 'Failed to clean up processes', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get main process PID
   */
  public getMainPid(): number {
    return this.mainPid;
  }

  /**
   * Get all child PIDs
   */
  public getChildPids(): number[] {
    return Array.from(this.childPids);
  }
}

export const processManager = new ProcessManager();
