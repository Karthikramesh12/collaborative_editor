const { spawnSync, execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const localtunnel = require('localtunnel');

const servers = new Map();

function allocatePort() {
  const base = 41001;
  const max = 42000;
  for (let p = base; p <= max; p++) {
    if (![...servers.values()].some(s => s.port === p)) return p;
  }
  throw new Error("NO_FREE_VSCODE_PORTS");
}

async function checkServiceReady(port, maxAttempts = 30) {
  console.log(`Checking if service on port ${port} is ready...`);
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = execSync(`curl -s -o /dev/null -w "%{http_code}" http://localhost:${port} --max-time 5`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe']
      }).trim();
      
      console.log(`Attempt ${attempt}: HTTP ${result}`);
      
      if (result === '200' || result === '302' || result === '301') {
        console.log(`✅ Service on port ${port} is ready!`);
        return true;
      }
    } catch (error) {
      console.log(`Attempt ${attempt}: Service not ready yet...`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  
  throw new Error(`Service on port ${port} did not become ready after ${maxAttempts} attempts`);
}

// Create VS Code settings to DISABLE MERGE CONFLICTS but keep write capability
function createVSCodeSettings(workspacePath) {
  const vscodeDir = path.join(workspacePath, '.vscode');
  if (!fs.existsSync(vscodeDir)) {
    fs.mkdirSync(vscodeDir, { recursive: true });
  }
  
  const settings = {
    // ====== CRITICAL: DISABLE MERGE CONFLICT DETECTION ======
    "merge-conflict.decorators.enabled": false,
    "merge-conflict.codeLens.enabled": false,
    "merge-conflict.autoNavigateNextConflict.enabled": false,
    
    // Disable Git's automatic merge conflict detection
    "git.conflict.decorators.enabled": false,
    "git.mergeEditor": false,
    "git.rebaseWhenSync": false,
    
    // ====== Disable Git auto-refresh and conflict detection ======
    "git.enabled": false, // COMPLETELY DISABLE GIT - This is key!
    "git.autoRepositoryDetection": false,
    "git.autofetch": false,
    "git.autoRefresh": false,
    "git.confirmSync": false,
    "git.enableSmartCommit": false,
    "git.mergeConflicts": false,
    
    // ====== Keep write capabilities but tweak behavior ======
    "files.autoSave": "off", // Let your collaborative engine handle saves
    "files.refreshOnFileChange": false, // Don't auto-refresh on external changes
    "files.refreshOnStart": false,
    
    // ====== Disable VS Code's internal file watcher for external changes ======
    "files.useExperimentalFileWatcher": false,
    "files.watcherExclude": {
      "**/.git/objects/**": true,
      "**/.git/subtree-cache/**": true,
      "**/node_modules/*/**": true,
      "**/.hg/store/**": true
    },
    
    // ====== Disable source control UI ======
    "scm.diffDecorations": "none",
    "scm.alwaysShowRepositories": false,
    "scm.alwaysShowActions": false,
    
    // ====== Performance ======
    "editor.largeFileOptimizations": true,
    
    // ====== Disable notifications about file changes ======
    "workbench.editor.highlightModifiedTabs": false,
    "workbench.editor.decorations.badges": false,
    "workbench.editor.decorations.colors": false,
    
    // ====== Disable version control prompts ======
    "git.ignoreLegacyWarning": true,
    "git.ignoreMissingGitWarning": true,
    "git.openDiffOnClick": false,
    "git.showPushSuccessNotification": false,
    
    // ====== Editor behavior ======
    "editor.formatOnSave": false,
    "editor.codeActionsOnSave": {
      "source.organizeImports": false,
      "source.fixAll": false
    },
    
    // ====== Disable workspace trust prompts ======
    "security.workspace.trust.enabled": false,
    
    // ====== Telemetry ======
    "telemetry.enableTelemetry": false,
    "telemetry.enableCrashReporter": false
  };
  
  fs.writeFileSync(
    path.join(vscodeDir, 'settings.json'),
    JSON.stringify(settings, null, 2)
  );
  
  // ALSO create a .gitignore to ignore .git directory
  const gitignorePath = path.join(workspacePath, '.gitignore');
  if (!fs.existsSync(gitignorePath)) {
    fs.writeFileSync(gitignorePath, `# Ignore Git to prevent merge conflicts
.git/
*.orig
*.BACKUP
*.BASE
*.LOCAL
*.REMOTE
`);
  }
  
  console.log(`Created VS Code settings to disable merge conflicts`);
}

async function ensureVscode(workspaceId, mountPath) {
  if (servers.has(workspaceId)) {
    const existing = servers.get(workspaceId);
    if (existing.tunnel && existing.tunnel.connected) {
      try {
        execSync(`curl -s -f http://localhost:${existing.port} --max-time 3`);
        return existing;
      } catch {
        // Tunnel is stale, will recreate
      }
    }
  }

  // Create workspace directory
  if (!fs.existsSync(mountPath)) {
    fs.mkdirSync(mountPath, { recursive: true });
  }
  
  // Create files directory inside workspace
  const filesPath = path.join(mountPath, 'files');
  if (!fs.existsSync(filesPath)) {
    fs.mkdirSync(filesPath, { recursive: true });
    fs.writeFileSync(
      path.join(filesPath, 'README.md'),
      `# Workspace ${workspaceId}\n\nCreated at ${new Date().toISOString()}\n\n## Merge conflicts are disabled\nYour collaborative engine handles synchronization.`
    );
  }

  // Create VS Code settings to DISABLE merge conflicts
  createVSCodeSettings(filesPath);

  // Remove any .git directory to prevent Git detection
  const gitDir = path.join(filesPath, '.git');
  if (fs.existsSync(gitDir)) {
    console.log(`⚠️ Removing existing .git directory to prevent merge conflicts`);
    execSync(`rm -rf "${gitDir}"`);
  }

  const port = allocatePort();
  const container = `ws_${workspaceId}`;

  console.log(`🚀 Starting code-server for workspace ${workspaceId} (Merge conflicts DISABLED)...`);

  // Kill any existing container
  try {
    execSync(`docker rm -f ${container} 2>/dev/null || true`);
  } catch (error) {
    // Ignore errors
  }

  // Start code-server - KEEP WRITE CAPABILITY
  console.log(`📦 Starting Docker container on port ${port}...`);
  
  try {
    // IMPORTANT: KEEP write access (no :ro flag)
    execSync(`docker run -d --rm \
      --name ${container} \
      -p ${port}:8080 \
      -v "${mountPath}:/workspace" \
      -e PASSWORD='' \
      codercom/code-server:latest \
      code-server \
      --bind-addr 0.0.0.0:8080 \
      --auth none \
      --disable-telemetry \
      --disable-update-check \
      --disable-workspace-trust \
      --disable-getting-started-override \
      /workspace/files`, {
      stdio: 'inherit'
    });
  } catch (error) {
    console.error(`❌ Failed to start Docker container:`, error.message);
    throw new Error("FAILED_TO_START_VSCODE_CONTAINER");
  }

  console.log(`⏳ Waiting for code-server to start... (this may take 10-20 seconds)`);

  // Wait for code-server to be fully ready
  try {
    await checkServiceReady(port, 30);
  } catch (error) {
    console.error(`❌ Code-server failed to start:`, error.message);
    
    try {
      execSync(`docker rm -f ${container} 2>/dev/null || true`);
    } catch {}
    
    throw new Error("VSCODE_SERVICE_FAILED_TO_START");
  }

  console.log(`🔗 Creating tunnel for port ${port}...`);

  // Create localtunnel
  let tunnel;
  try {
    tunnel = await localtunnel({
      port: port,
      subdomain: `vscode-${workspaceId.substring(0, 12)}`,
      host: 'https://localtunnel.me'
    });
    
    console.log(`✅ Tunnel created: ${tunnel.url}`);
  } catch (tunnelError) {
    console.error(`❌ Failed to create tunnel:`, tunnelError.message);
    
    console.log(`🔄 Trying alternative tunnel configuration...`);
    
    try {
      tunnel = await localtunnel({
        port: port,
        host: 'https://loca.lt'
      });
      console.log(`✅ Tunnel created (alternative): ${tunnel.url}`);
    } catch (secondError) {
      console.error(`❌ All tunnel attempts failed`);
      
      try {
        execSync(`docker rm -f ${container} 2>/dev/null || true`);
      } catch {}
      
      throw new Error(`TUNNEL_CREATION_FAILED: ${secondError.message}`);
    }
  }

  // Setup tunnel event handlers
  tunnel.on('close', () => {
    console.log(`🔌 Tunnel closed for workspace ${workspaceId}`);
  });

  tunnel.on('error', (err) => {
    console.error(`⚠️ Tunnel error for ${workspaceId}:`, err.message);
  });

  const server = {
    workspaceId,
    port,
    container,
    tunnel,
    publicUrl: tunnel.url,
    localUrl: `http://localhost:${port}`,
    directUrl: `http://localhost:${port}`,
    startedAt: new Date(),
    mergeConflictsDisabled: true // Mark as having disabled merge conflicts
  };

  servers.set(workspaceId, server);

  // Start a periodic health check
  startHealthCheck(workspaceId, port, container);

  console.log(`🎉 Workspace ${workspaceId} is ready!`);
  console.log(`   Public URL: ${tunnel.url}`);
  console.log(`   Local URL: http://localhost:${port}`);
  console.log(`   Merge conflicts: DISABLED (Git disabled)`);
  
  return server;
}

function startHealthCheck(workspaceId, port, container) {
  const interval = setInterval(() => {
    try {
      execSync(`curl -s -f http://localhost:${port} --max-time 5`, { stdio: 'ignore' });
    } catch (error) {
      console.error(`❌ ${workspaceId} health check failed, restarting...`);
      
      try {
        execSync(`docker restart ${container}`);
        console.log(`🔄 ${workspaceId} container restarted`);
      } catch (restartError) {
        console.error(`💀 Failed to restart ${workspaceId}:`, restartError.message);
        clearInterval(interval);
        
        if (servers.has(workspaceId)) {
          const server = servers.get(workspaceId);
          if (server.tunnel) {
            server.tunnel.close();
          }
          servers.delete(workspaceId);
        }
      }
    }
  }, 30000);

  if (servers.has(workspaceId)) {
    servers.get(workspaceId).healthInterval = interval;
  }
}

function stopVsCode(workspaceId) {
  const s = servers.get(workspaceId);
  if (!s) {
    console.log(`ℹ️ Workspace ${workspaceId} not found`);
    return;
  }

  console.log(`🛑 Stopping workspace ${workspaceId}...`);

  if (s.healthInterval) {
    clearInterval(s.healthInterval);
  }

  if (s.tunnel) {
    s.tunnel.close();
  }

  try {
    execSync(`docker rm -f ${s.container} 2>/dev/null || true`);
    console.log(`✅ Container ${s.container} stopped`);
  } catch (error) {
    console.error(`⚠️ Error stopping container:`, error.message);
  }

  servers.delete(workspaceId);
  console.log(`✅ Workspace ${workspaceId} cleanup complete`);
}

// Cleanup on exit
process.on('SIGINT', () => {
  console.log('\n🧹 Cleaning up all workspaces before exit...');
  for (const [workspaceId] of servers.entries()) {
    stopVsCode(workspaceId);
  }
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🧹 Received SIGTERM, cleaning up...');
  for (const [workspaceId] of servers.entries()) {
    stopVsCode(workspaceId);
  }
  process.exit(0);
});

module.exports = { ensureVscode, stopVsCode };