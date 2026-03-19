import {spawnSync, type SpawnSyncOptions} from 'node:child_process'
import {readFileSync} from 'node:fs'
import {join, resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

export type WorkspacePackageId = 'core' | 'ui'

export type WorkspacePackage = {
  id: WorkspacePackageId
  dir: string
  manifestPath: string
  name: '@matthieumordrel/chart-studio' | '@matthieumordrel/chart-studio-ui'
}

export type PackageManifest = {
  dependencies?: Record<string, string>
  exports?: Record<string, string | {default?: string; import?: string; types?: string}>
  main?: string
  name: string
  optionalDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  publishConfig?: {access?: string}
  types?: string
  version: string
}

export const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))

export const workspacePackages: readonly WorkspacePackage[] = [
  {
    id: 'core',
    name: '@matthieumordrel/chart-studio',
    dir: join(repoRoot, 'packages/chart-studio'),
    manifestPath: join(repoRoot, 'packages/chart-studio/package.json'),
  },
  {
    id: 'ui',
    name: '@matthieumordrel/chart-studio-ui',
    dir: join(repoRoot, 'packages/chart-studio-ui'),
    manifestPath: join(repoRoot, 'packages/chart-studio-ui/package.json'),
  },
] as const

export function readJsonFile<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf8')) as T
}

export function readWorkspaceManifest(workspacePackage: WorkspacePackage): PackageManifest {
  return readJsonFile<PackageManifest>(workspacePackage.manifestPath)
}

export function runCommand(
  command: string,
  args: string[],
  options: SpawnSyncOptions & {cwd?: string; encoding?: BufferEncoding} = {},
) {
  const child = spawnSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    env: {
      ...process.env,
      ...(options.env ?? {}),
    },
    stdio: options.stdio ?? 'inherit',
    encoding: options.encoding,
  })

  if (child.status !== 0) {
    const rendered = [command, ...args].join(' ')
    throw new Error(`Command failed in ${options.cwd ?? repoRoot}: ${rendered}`)
  }

  return child
}
