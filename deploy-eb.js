#!/usr/bin/env node

/**
 * GT3 Elastic Beanstalk Deployment Script
 * 
 * Cross-platform Node.js script for packaging and deploying GT3 to AWS Elastic Beanstalk.
 * Uses EB CLI for deployment operations.
 * 
 * Usage:
 *   node deploy-eb.js [--env ENVIRONMENT_ID] [--app APP_NAME] [--skip-package]
 * 
 * Options:
 *   --env ENVIRONMENT_ID    EB Environment ID (default: e-xjiqsmuspc)
 *   --app APP_NAME          EB Application name (default: GT3_POC)
 *   --skip-package          Skip packaging step, use existing bundle
 *   --help                   Show this help message
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync, rmSync, cpSync, readFileSync, writeFileSync, createWriteStream } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

// Get current directory (ESM compatible)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const CONFIG = {
  appName: 'GT3_POC',
  envId: 'e-xjiqsmuspc',
  bundleDirName: 'eb_bundle',
  nodeModulesIncluded: true, // Set to false to let EB run npm install
};

// Parse command-line arguments
const args = process.argv.slice(2);
let skipPackage = false;
let envId = CONFIG.envId;
let appName = CONFIG.appName;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--help' || arg === '-h') {
    console.log(`
GT3 Elastic Beanstalk Deployment Script

Usage:
  node deploy-eb.js [options]

Options:
  --env ENVIRONMENT_ID    EB Environment ID (default: ${CONFIG.envId})
  --app APP_NAME          EB Application name (default: ${CONFIG.appName})
  --skip-package          Skip packaging step, use existing bundle
  --help                  Show this help message

Examples:
  node deploy-eb.js
  node deploy-eb.js --env e-xjiqsmuspc --app GT3_POC
  node deploy-eb.js --skip-package
`);
    process.exit(0);
  } else if (arg === '--env' && i + 1 < args.length) {
    envId = args[++i];
  } else if (arg === '--app' && i + 1 < args.length) {
    appName = args[++i];
  } else if (arg === '--skip-package') {
    skipPackage = true;
  }
}

// Utility functions
function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = {
    info: 'ℹ',
    success: '✅',
    error: '❌',
    warning: '⚠️',
    step: '→'
  }[type] || '•';
  console.log(`[${timestamp}] ${prefix} ${message}`);
}

function logStep(step, message) {
  log(`[Step ${step}] ${message}`, 'step');
}

function logError(message, error = null) {
  log(message, 'error');
  if (error) {
    if (error instanceof Error) {
      console.error(`   Error: ${error.message}`);
      if (error.stack && process.env.DEBUG) {
        console.error(error.stack);
      }
    } else {
      console.error(`   Details:`, error);
    }
  }
}

function execCommand(command, options = {}) {
  try {
    const output = execSync(command, {
      stdio: options.silent ? 'pipe' : 'inherit',
      encoding: 'utf-8',
      cwd: options.cwd || process.cwd(),
      ...options
    });
    return { success: true, output };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      code: error.status || error.code,
      output: error.stdout || error.stderr
    };
  }
}

function checkEBInstalled() {
  log('Checking if EB CLI is installed...', 'info');
  const result = execCommand('eb --version', { silent: true });
  if (!result.success) {
    logError(
      'EB CLI is not installed or not in PATH.',
      'Please install EB CLI: https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/eb-cli3-install.html'
    );
    process.exit(1);
  }
  log(`EB CLI found: ${result.output.trim()}`, 'success');
  return true;
}

function checkAWSConfig() {
  log('Checking AWS credentials configuration...', 'info');
  const result = execCommand('aws sts get-caller-identity', { silent: true });
  if (!result.success) {
    logError(
      'AWS credentials not configured or invalid.',
      'Please configure AWS credentials using:\n' +
      '  - AWS CLI: aws configure\n' +
      '  - Environment variables: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY\n' +
      '  - Or IAM role (if running on EC2)'
    );
    process.exit(1);
  }
  log('AWS credentials validated successfully', 'success');
  return true;
}

function checkNodeModules() {
  const nodeModulesPath = join(__dirname, 'node_modules');
  if (!existsSync(nodeModulesPath)) {
    log('node_modules not found. Installing dependencies...', 'warning');
    const result = execCommand('npm ci', { cwd: __dirname });
    if (!result.success) {
      logError('Failed to install dependencies. Please run "npm ci" manually.', result.error);
      process.exit(1);
    }
    log('Dependencies installed successfully', 'success');
  } else {
    log('node_modules found', 'success');
  }
}

async function checkArchiverAvailable() {
  try {
    await import('archiver');
    return true;
  } catch (error) {
    return false;
  }
}

async function createPackage() {
  logStep(1, 'Preparing package bundle');
  
  // Check archiver availability early
  const archiverAvailable = await checkArchiverAvailable();
  if (!archiverAvailable) {
    logError(
      'The "archiver" package is required for creating zip files.',
      'Please install it: npm install --save-dev archiver'
    );
    process.exit(1);
  }
  
  const rootDir = __dirname;
  const bundleDir = join(rootDir, CONFIG.bundleDirName);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const zipName = `${CONFIG.appName.toLowerCase().replace(/_/g, '-')}_eb_${timestamp}.zip`;
  const zipPath = join(rootDir, zipName);

  log(`Root directory: ${rootDir}`);
  log(`Bundle directory: ${bundleDir}`);
  log(`Output zip: ${zipPath}`);

  // Check required files
  const packageJsonPath = join(rootDir, 'package.json');
  if (!existsSync(packageJsonPath)) {
    logError('package.json not found in project root', `${rootDir}`);
    process.exit(1);
  }

  // Clean and create bundle directory
  if (existsSync(bundleDir)) {
    log('Cleaning existing bundle directory...', 'info');
    rmSync(bundleDir, { recursive: true, force: true });
  }
  mkdirSync(bundleDir, { recursive: true });

  // Copy core files
  log('Copying core files...', 'info');
  const filesToCopy = [
    { src: 'server.js', dest: 'server.js' },
    { src: 'package.json', dest: 'package.json' },
    { src: 'package-lock.json', dest: 'package-lock.json', optional: true }
  ];

  for (const file of filesToCopy) {
    const srcPath = join(rootDir, file.src);
    const destPath = join(bundleDir, file.dest);
    if (existsSync(srcPath)) {
      cpSync(srcPath, destPath, { force: true });
      log(`  ✓ ${file.src}`, 'success');
    } else if (!file.optional) {
      logError(`Required file not found: ${file.src}`);
      process.exit(1);
    } else {
      log(`  ⊘ ${file.src} (optional, skipped)`, 'warning');
    }
  }

  // Copy public directory
  const publicDir = join(rootDir, 'public');
  if (existsSync(publicDir)) {
    log('Copying public/ directory...', 'info');
    cpSync(publicDir, join(bundleDir, 'public'), { recursive: true, force: true });
    log('  ✓ public/', 'success');
  } else {
    log('  ⊘ public/ (not found, skipped)', 'warning');
  }

  // Copy build directory if exists
  const buildDir = join(rootDir, 'build');
  if (existsSync(buildDir)) {
    log('Copying build/ directory...', 'info');
    cpSync(buildDir, join(bundleDir, 'build'), { recursive: true, force: true });
    log('  ✓ build/', 'success');
  }

  // Copy node_modules if configured
  if (CONFIG.nodeModulesIncluded) {
    const nodeModulesDir = join(rootDir, 'node_modules');
    if (existsSync(nodeModulesDir)) {
      log('Copying node_modules/ (this may take a while)...', 'info');
      cpSync(nodeModulesDir, join(bundleDir, 'node_modules'), { recursive: true, force: true });
      log('  ✓ node_modules/', 'success');
    } else {
      log('  ⚠ node_modules/ not found; EB will run npm install on Linux', 'warning');
    }
  }

  // Create zip archive
  logStep(2, 'Creating zip archive');
  log('Creating zip file...', 'info');

  // Import archiver (dynamic import for ESM)
  let archiverModule;
  try {
    archiverModule = await import('archiver');
  } catch (error) {
    logError(
      'Failed to load archiver package.',
      'Please install it: npm install --save-dev archiver'
    );
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
      log(`  Location: ${zipPath}`);
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
  
  // Wait for zip to be created, then clean up bundle directory
  const createdZip = await zipPromise;
  log('Cleaning up bundle directory...', 'info');
  if (existsSync(bundleDir)) {
    rmSync(bundleDir, { recursive: true, force: true });
  }
  
  return createdZip;
}

async function deployToEB(envId, appName) {
  logStep(3, 'Deploying to Elastic Beanstalk');

  // Check if .elasticbeanstalk directory exists (EB CLI workspace)
  const ebConfigDir = join(__dirname, '.elasticbeanstalk');
  if (!existsSync(ebConfigDir)) {
    log('EB CLI workspace not initialized. Initializing...', 'warning');
    log('Running: eb init ' + appName, 'info');
    log('Note: You will be prompted to select a region and platform.', 'info');
    // Don't specify region - let EB CLI prompt the user or use default
    const result = execCommand(`eb init ${appName}`, { cwd: __dirname });
    if (!result.success) {
      logError('Failed to initialize EB CLI workspace', result.error);
      log('Please run "eb init" manually or check EB CLI configuration.', 'info');
      process.exit(1);
    }
    log('EB CLI workspace initialized', 'success');
  }

  log(`Deploying to environment: ${envId} (application: ${appName})`, 'info');
  log('Note: EB CLI will package from source directory (ignoring the zip we created).', 'info');
  log('The zip file created earlier is available for manual upload via AWS Console if needed.\n', 'info');
  
  log('Running: eb deploy ' + envId, 'info');
  const result = execCommand(`eb deploy ${envId}`, { cwd: __dirname });
  
  if (!result.success) {
    logError('Deployment failed', result.error);
    if (result.output) {
      console.error('\nDeployment error details:');
      console.error(result.output);
    }
    log('\nTroubleshooting tips:', 'info');
    log('  - Check AWS credentials: aws sts get-caller-identity', 'info');
    log('  - Check EB environment status: eb status ' + envId, 'info');
    log('  - Check EB logs: eb logs ' + envId, 'info');
    process.exit(1);
  }

  log('\nDeployment initiated successfully!', 'success');
  log('Monitor deployment with: eb status ' + envId, 'info');
  log('View logs with: eb logs ' + envId, 'info');
  
  return true;
}

// Main execution
async function main() {
  console.log('\n' + '='.repeat(60));
  log('GT3 Elastic Beanstalk Deployment Script', 'info');
  console.log('='.repeat(60) + '\n');

  try {
    // Prerequisites
    logStep(0, 'Checking prerequisites');
    checkEBInstalled();
    checkAWSConfig();
    checkNodeModules();

    // Package (if not skipped)
    let zipPath = null;
    if (!skipPackage) {
      zipPath = await createPackage();
      log(`\nPackage created: ${zipPath}`, 'success');
      log('(Note: EB CLI will package from source. This zip is available for manual upload if needed.)\n', 'info');
    } else {
      log('Skipping package creation (--skip-package flag)', 'warning');
    }

    // Deploy
    await deployToEB(envId, appName);

    log('\n' + '='.repeat(60), 'success');
    log('Deployment process completed!', 'success');
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    logError('Deployment script failed', error);
    process.exit(1);
  }
}

// Run main function
main().catch((error) => {
  logError('Unhandled error in deployment script', error);
  process.exit(1);
});
