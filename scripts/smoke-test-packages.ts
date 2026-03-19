import {spawnSync} from 'node:child_process'
import {cpSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {repoRoot, runCommand, workspacePackages, type WorkspacePackage} from './workspace-utils.js'

/**
 * npm major used with `bunx` when there is no system `npm`. npm's resolver is used for
 * installs instead of Bun's, which avoids indefinite "Resolving" stalls on some
 * networks (IPv6/DNS, VPN/tun, large peer graphs).
 */
const BUNX_NPM_VERSION = 'npm@10'

/**
 * How to install smoke-fixture dependencies. `auto` never uses `bun install` by
 * default—only system `npm` or `bunx npm@10`. Use `bun` only if you intentionally
 * want to exercise Bun's installer.
 */
type SmokeInstallTool = 'auto' | 'bun' | 'npm'

/**
 * Returns whether `npm` can be executed in this environment.
 */
function isNpmOnPath(env: NodeJS.ProcessEnv): boolean {
  return spawnSync('npm', ['-v'], {encoding: 'utf8', env, stdio: ['pipe', 'pipe', 'pipe']}).status === 0
}

/**
 * Reads `SMOKE_INSTALL_TOOL` or defaults to `auto`.
 */
function smokeInstallTool(): SmokeInstallTool {
  const raw = process.env['SMOKE_INSTALL_TOOL']?.toLowerCase()
  if (raw === 'bun' || raw === 'npm') {
    return raw
  }
  return 'auto'
}

const npmInstallFlags = ['install', '--no-audit', '--no-fund', '--ignore-scripts'] as const

/**
 * Installs dependencies for a copied smoke fixture.
 */
function installSmokeFixtureDependencies(fixtureDir: string, env: NodeJS.ProcessEnv) {
  const mergedEnv = {...process.env, ...env}
  const tool = smokeInstallTool()

  if (tool === 'bun') {
    runBunInstall(fixtureDir, mergedEnv)
    return
  }

  if (tool === 'npm') {
    if (!isNpmOnPath(mergedEnv)) {
      throw new Error('SMOKE_INSTALL_TOOL=npm but `npm` is not available on PATH.')
    }
    console.log('[smoke] npm install (SMOKE_INSTALL_TOOL=npm)')
    runCommand('npm', [...npmInstallFlags], {
      cwd: fixtureDir,
      env: mergedEnv,
    })
    return
  }

  if (isNpmOnPath(mergedEnv)) {
    console.log('[smoke] npm install (npm on PATH)')
    runCommand('npm', [...npmInstallFlags], {
      cwd: fixtureDir,
      env: mergedEnv,
    })
    return
  }

  console.log(
    `[smoke] ${BUNX_NPM_VERSION} via bunx (no system npm — avoids Bun install resolver stalls; set SMOKE_INSTALL_TOOL=bun to force bun install)`,
  )
  runCommand('bunx', [BUNX_NPM_VERSION, ...npmInstallFlags], {
    cwd: fixtureDir,
    env: mergedEnv,
  })
}

/**
 * Runs `bun install` with DNS and flags that sometimes avoid resolver stalls. Only used
 * when `SMOKE_INSTALL_TOOL=bun`.
 */
function runBunInstall(fixtureDir: string, env: NodeJS.ProcessEnv) {
  runCommand(
    'bun',
    [
      '--dns-result-order=ipv4first',
      'install',
      '--no-progress',
      '--ignore-scripts',
      '--registry=https://registry.npmjs.org/',
    ],
    {
      cwd: fixtureDir,
      env,
    },
  )
}

type SmokeFixture = {
  command: string[]
  dir: string
  name: 'core-consumer' | 'ui-consumer'
}

const smokeFixtures: readonly SmokeFixture[] = [
  {
    name: 'core-consumer',
    dir: join(repoRoot, 'smoke-tests/core-consumer'),
    command: ['bun', 'run', 'typecheck'],
  },
  {
    name: 'ui-consumer',
    dir: join(repoRoot, 'smoke-tests/ui-consumer'),
    command: ['bun', 'run', 'build'],
  },
] as const

function packWorkspacePackage(workspacePackage: WorkspacePackage): string {
  console.log(`Packing ${workspacePackage.name}...`)
  const result = runCommand('bun', ['pm', 'pack'], {
    cwd: workspacePackage.dir,
    stdio: 'pipe',
    encoding: 'utf8',
  })
  const output = (result.stdout ?? '').toString()
  const filename = output
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.endsWith('.tgz'))
    .at(-1)
  if (!filename) {
    throw new Error(`bun pm pack did not return a tarball for ${workspacePackage.name}.`)
  }

  return join(workspacePackage.dir, filename)
}

function rewriteFixturePackageManifest(fixtureDir: string, tarballsByPackageName: Map<string, string>) {
  const manifestPath = join(fixtureDir, 'package.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }

  for (const [packageName, tarballPath] of tarballsByPackageName) {
    if (manifest.dependencies?.[packageName] !== undefined) {
      manifest.dependencies[packageName] = `file:${tarballPath}`
    }
    if (manifest.devDependencies?.[packageName] !== undefined) {
      manifest.devDependencies[packageName] = `file:${tarballPath}`
    }
  }

  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
}

const tarballs = new Map<string, string>()
const tempDirs: string[] = []

try {
  for (const workspacePackage of workspacePackages) {
    tarballs.set(workspacePackage.name, packWorkspacePackage(workspacePackage))
  }

  for (const fixture of smokeFixtures) {
    const tempDir = mkdtempSync(join(tmpdir(), `chart-studio-${fixture.name}-`))
    const fixtureDir = join(tempDir, 'app')
    tempDirs.push(tempDir)
    cpSync(fixture.dir, fixtureDir, {recursive: true, force: true})
    rewriteFixturePackageManifest(fixtureDir, tarballs)

    console.log(`[smoke:${fixture.name}] install dependencies`)
    installSmokeFixtureDependencies(fixtureDir, {TMPDIR: tempDir})

    console.log(`[smoke:${fixture.name}] ${fixture.command.join(' ')}`)
    runCommand(fixture.command[0]!, fixture.command.slice(1), {
      cwd: fixtureDir,
      env: {TMPDIR: tempDir},
    })
  }
} finally {
  for (const tempDir of tempDirs) {
    rmSync(tempDir, {recursive: true, force: true})
  }
  for (const tarballPath of tarballs.values()) {
    unlinkSync(tarballPath)
  }
}
