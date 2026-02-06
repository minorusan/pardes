/**
 * Populate manifest for existing extracted cache
 * Run this after manual extraction to avoid re-extraction on next startup
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

interface CacheManifest {
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

/**
 * Calculate MD5 hash of a file
 */
async function calculateFileHash(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5');
    const stream = fs.createReadStream(filePath);

    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

/**
 * Count files recursively
 */
async function countFiles(dir: string): Promise<number> {
  let count = 0;

  const processDirectory = async (currentDir: string) => {
    const entries = await fs.promises.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        await processDirectory(fullPath);
      } else {
        count++;
      }
    }
  };

  await processDirectory(dir);
  return count;
}

async function main() {
  const cacheDir = path.join(process.cwd(), '.cache');
  const staticDir = path.join(process.cwd(), 'static', 'zips');
  const manifestPath = path.join(cacheDir, '.manifest.json');

  console.log('🔧 Populating manifest for existing cache...\n');

  // Find all zip files
  const zipFiles = fs.readdirSync(staticDir).filter(f => f.endsWith('.zip'));

  if (zipFiles.length === 0) {
    console.error('❌ No zip files found in static/zips');
    process.exit(1);
  }

  const manifest: CacheManifest = {
    version: '1.0.0',
    lastUpdate: new Date().toISOString(),
    archives: {}
  };

  for (const zipFile of zipFiles) {
    const zipPath = path.join(staticDir, zipFile);
    const extractName = path.parse(zipFile).name;
    const extractPath = path.join(cacheDir, extractName);

    console.log(`📦 Processing: ${zipFile}`);

    // Check if extracted directory exists
    if (!fs.existsSync(extractPath)) {
      console.log(`  ⚠️  Extraction directory not found: ${extractName}`);
      console.log(`     Skipping...`);
      continue;
    }

    // Calculate hash
    console.log('  🔐 Calculating hash...');
    const hash = await calculateFileHash(zipPath);
    console.log(`     Hash: ${hash.substring(0, 16)}...`);

    // Count files
    console.log('  📊 Counting files...');
    const fileCount = await countFiles(extractPath);
    console.log(`     Files: ${fileCount.toLocaleString()}`);

    // Get size
    const stats = fs.statSync(zipPath);
    const sizeMB = Math.round(stats.size / 1024 / 1024);
    console.log(`     Size: ${sizeMB}MB`);

    // Add to manifest
    manifest.archives[zipFile] = {
      hash,
      size: stats.size,
      extractedAt: new Date().toISOString(),
      fileCount
    };

    console.log(`  ✅ Added to manifest\n`);
  }

  // Save manifest
  const manifestContent = JSON.stringify(manifest, null, 2);
  fs.writeFileSync(manifestPath, manifestContent, 'utf8');

  console.log('✨ Manifest created successfully!');
  console.log(`📄 Location: ${manifestPath}`);
  console.log(`\n📋 Summary:`);
  console.log(`   Archives: ${Object.keys(manifest.archives).length}`);
  console.log(`   Total files: ${Object.values(manifest.archives).reduce((sum, a) => sum + a.fileCount, 0).toLocaleString()}`);
  console.log(`\n🚀 Next startup will skip extraction!`);
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
