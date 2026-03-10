import {spawnSync} from 'node:child_process'
import {rmSync} from 'node:fs'
import {resolve} from 'node:path'
import {fileURLToPath} from 'node:url'

const packageRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const distDir = resolve(packageRoot, 'dist')

/**
 * Build the standalone package into `dist/`.
 */
function buildPackage() {
  rmSync(distDir, {recursive: true, force: true})

  const buildProcess = spawnSync('tsc', ['-p', 'tsconfig.build.json'], {
    cwd: packageRoot,
    env: process.env,
    stdio: 'inherit',
  })

  if (buildProcess.status !== 0) {
    process.exit(buildProcess.status ?? 1)
  }
}

buildPackage()
