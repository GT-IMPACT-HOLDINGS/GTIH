#!/usr/bin/env node

/**
 * GT3 Elastic Beanstalk Packaging Script
 * 
 * Creates a zip archive of the GT3 Node.js project ready for AWS EB deployment.
 * 
 * Usage:
 *   node pack-eb.js [options]
 * 
 * Options:
 *   --app-name NAME        Application name for zip filename (default: gt3-poc-node)
 *   --no-node-modules      Exclude node_modules (let EB run npm install)
 *   --include-node-modules Include node_modules (default behavior)
 *   --output PATH          Custom output path for zip file (default: auto-generated)
 *   --help                 Show this help message
 * 
 * Examples:
 *   node pack-eb.js
 *   node pack-eb.js --no-node-modules
 *   node pack-eb.js --app-name my-gt3-app
 */

import { createWriteStream, existsSync, mkdirSync, rmSync, cpSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get current directory (ESM compatible)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Default configuration
const DEFAULT_CONFIG = {
  appName: 'gt3-poc-node',
  includeNodeModules: true,
  bundleDirName: 'eb_bundle'
};

// Parse command-line arguments
const args = process.argv.slice(2);
let config = { ...DEFAULT_CONFIG };
let customOutputPath = null;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--help' || arg === '-h') {
    console.log(`
GT3 Elastic Beanstalk Packaging Script

Creates a zip archive ready for AWS EB deployment.

Usage:
  node pack-eb.js [options]

Options:
  --app-name NAME          Application name for zip filename (default: ${DEFAULT_CONFIG.appName})
  --no-node-modules        Exclude node_modules (let EB run npm install)
  --include-node-modules   Include node_modules (default)
  --output PATH            Custom output path for zip file
  --help                   Show this help message

Examples:
  node pack-eb.js
  node pack-eb.js --no-node-modules
  node pack-eb.js --app-name my-gt3-app --output ./dist/my-app.zip
`);
    process.exit(0);
  } else if (arg === '--app-name' && i + 1 < args.length) {
    config.appName = args[++i];
  } else if (arg === '--no-node-modules') {
    config.includeNodeModules = false;
  } else if (arg === '--include-node-modules') {
    config.includeNodeModules = true;
  } else if (arg === '--output' && i + 1 < args.length) {
    customOutputPath = args[++i];
  }
}

// Utility functions
function log(message, type = 'info') {
  const prefix = {
    info: 'ℹ',
    success: '✅',
    error: '❌',
    warning: '⚠️'
  }[type] || '•';
  console.log(`${prefix} ${message}`);
}

function logError(message, error = null) {
  log(message, 'error');
  if (error) {
    if (error instanceof Error) {
      console.error(`   ${error.message}`);
      if (error.stack && process.env.DEBUG) {
        console.error(error.stack);
      }
    } else {
      console.error(`   ${error}`);
    }
  }
}

// Check if archiver is available
async function checkArchiver() {
  try {
    await import('archiver');
    return true;
  } catch (error) {
    return false;
  }
}

// Main packaging function
async function createPackage() {
  const rootDir = __dirname;
  const bundleDir = join(rootDir, config.bundleDirName);
  
  // Generate zip filename
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const zipName = customOutputPath || `${config.appName}_eb_${timestamp}.zip`;
  const zipPath = customOutputPath ? join(rootDir, zipName) : join(rootDir, zipName);

  console.log('\n' + '='.repeat(60));
  log('GT3 Elastic Beanstalk Packaging', 'info');
  console.log('='.repeat(60) + '\n');
  
  log(`Root directory: ${rootDir}`);
  log(`Bundle directory: ${bundleDir}`);
  log(`Output zip: ${zipPath}`);
  log(`Include node_modules: ${config.includeNodeModules}`);
  console.log('');

  // Check for required files
  const packageJsonPath = join(rootDir, 'package.json');
  if (!existsSync(packageJsonPath)) {
    logError('package.json not found in project root');
    process.exit(1);
  }

  const serverJsPath = join(rootDir, 'server.js');
  if (!existsSync(serverJsPath)) {
    logError('server.js not found in project root');
    process.exit(1);
  }

  // Check archiver availability
  log('Checking dependencies...');
  const archiverAvailable = await checkArchiver();
  if (!archiverAvailable) {
    logError(
      'The "archiver" package is required.',
      'Please install it: npm install --save-dev archiver'
    );
    process.exit(1);
  }
  log('Dependencies OK', 'success');
  console.log('');

  // Clean and create bundle directory
  log('Preparing bundle directory...');
  if (existsSync(bundleDir)) {
    rmSync(bundleDir, { recursive: true, force: true });
  }
  mkdirSync(bundleDir, { recursive: true });
  log('Bundle directory ready', 'success');
  console.log('');

  // Copy core files
  log('Copying core files...');
  const filesToCopy = [
    { src: 'server.js', dest: 'server.js', required: true },
    { src: 'package.json', dest: 'package.json', required: true },
    { src: 'package-lock.json', dest: 'package-lock.json', required: false }
  ];

  for (const file of filesToCopy) {
    const srcPath = join(rootDir, file.src);
    const destPath = join(bundleDir, file.dest);
    if (existsSync(srcPath)) {
      cpSync(srcPath, destPath, { force: true });
      log(`  ✓ ${file.src}`, 'success');
    } else if (file.required) {
      logError(`Required file not found: ${file.src}`);
      process.exit(1);
    } else {
      log(`  ⊘ ${file.src} (optional, skipped)`, 'warning');
    }
  }
  console.log('');

  // Copy public directory
  log('Copying static assets...');
  const publicDir = join(rootDir, 'public');
  if (existsSync(publicDir)) {
    cpSync(publicDir, join(bundleDir, 'public'), { recursive: true, force: true });
    log('  ✓ public/', 'success');
  } else {
    log('  ⊘ public/ (not found, skipped)', 'warning');
  }

  // Server libs + agent-runtime install script (EB npm install runs postinstall)
  const dirsToCopy = [
    { src: 'lib', dest: 'lib', required: true },
    { src: 'scripts', dest: 'scripts', required: true },
    { src: '.ebextensions', dest: '.ebextensions', required: false },
    { src: 'Expression_skills', dest: 'Expression_skills', required: false },
    { src: 'GT3_Expression_specs', dest: 'GT3_Expression_specs', required: false }
  ];
  for (const dir of dirsToCopy) {
    const srcPath = join(rootDir, dir.src);
    if (existsSync(srcPath)) {
      cpSync(srcPath, join(bundleDir, dir.dest), { recursive: true, force: true });
      log(`  ✓ ${dir.src}/`, 'success');
    } else if (dir.required) {
      logError(`Required directory not found: ${dir.src}`);
      process.exit(1);
    } else {
      log(`  ⊘ ${dir.src}/ (optional, skipped)`, 'warning');
    }
  }

  // Never ship a host-built agent runtime (Windows/Linux mismatch); EB postinstall rebuilds it.
  const agentRuntimeDir = join(bundleDir, '.gt3-agent-runtime');
  if (existsSync(agentRuntimeDir)) {
    rmSync(agentRuntimeDir, { recursive: true, force: true });
    log('  ⊘ stripped .gt3-agent-runtime/ (rebuild on EB via postinstall)', 'info');
  }

  // Copy build directory if exists
  const buildDir = join(rootDir, 'build');
  if (existsSync(buildDir)) {
    cpSync(buildDir, join(bundleDir, 'build'), { recursive: true, force: true });
    log('  ✓ build/', 'success');
  }

  console.log('');

  // Copy node_modules if configured
  // Note: prefer --no-node-modules so EB runs Linux npm install (+ agent-runtime postinstall)
  if (config.includeNodeModules) {
    const nodeModulesDir = join(rootDir, 'node_modules');
    if (existsSync(nodeModulesDir)) {
      log('Copying node_modules/ (this may take a while)...');
      cpSync(nodeModulesDir, join(bundleDir, 'node_modules'), { recursive: true, force: true });
      log('  ✓ node_modules/', 'success');
    } else {
      log('  ⚠ node_modules/ not found; EB will run npm install on deployment', 'warning');
    }
    console.log('');
  } else {
    log('Skipping node_modules/ (EB will run npm install on deployment)', 'info');
    console.log('');
  }

  // Create zip archive
  log('Creating zip archive...');
  
  // Import archiver
  let archiverModule;
  try {
    archiverModule = await import('archiver');
  } catch (error) {
    logError('Failed to load archiver package', error);
    process.exit(1);
  }

  const zipPromise = new Promise((resolve, reject) => {
    const output = createWriteStream(zipPath);
    const archive = archiverModule.default('zip', {
      zlib: { level: 9 } // Maximum compression
    });

    output.on('close', () => {
      const sizeMB = (archive.pointer() / 1024 / 1024).toFixed(2);
      log(`Zip archive created successfully (${sizeMB} MB)`, 'success');
      log(`Location: ${zipPath}`, 'success');
      resolve(zipPath);
    });

    archive.on('error', (err) => {
      logError('Error creating zip archive', err);
      reject(err);
    });

    archive.on('warning', (err) => {
      if (err.code === 'ENOENT') {
        log(`Warning: ${err.message}`, 'warning');
      } else {
        logError('Archive warning', err);
      }
    });

    archive.pipe(output);

    // Add all files from bundle directory
    // Using false as the second parameter means files are added at the root of the archive
    archive.directory(bundleDir, false);
    
    archive.finalize();
  });
  
  // Wait for zip to be created
  const createdZip = await zipPromise;
  
  // Clean up bundle directory
  log('Cleaning up bundle directory...');
  if (existsSync(bundleDir)) {
    rmSync(bundleDir, { recursive: true, force: true });
  }
  
  console.log('');
  console.log('='.repeat(60));
  log('Packaging completed successfully!', 'success');
  console.log('='.repeat(60));
  console.log('');
  log(`Package ready for AWS Elastic Beanstalk upload:`, 'info');
  log(`  ${createdZip}`, 'info');
  console.log('');
  log('You can now upload this zip file via:', 'info');
  log('  - AWS Console: Elastic Beanstalk → Upload and Deploy', 'info');
  log('  - EB CLI: eb deploy --source zip', 'info');
  console.log('');
  
  return createdZip;
}

// Main execution
async function main() {
  try {
    await createPackage();
  } catch (error) {
    logError('Packaging failed', error);
    process.exit(1);
  }
}

// Run main function
main().catch((error) => {
  logError('Unhandled error in packaging script', error);
  process.exit(1);
});
