import {cpSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {repoRoot, runCommand, workspacePackages, type WorkspacePackage} from './workspace-utils.js'

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

    console.log(`[smoke:${fixture.name}] bun install --no-progress`)
    runCommand('bun', ['install', '--no-progress'], {
      cwd: fixtureDir,
      env: {TMPDIR: tempDir},
    })

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
