import {runCommand} from './workspace-utils.js'

runCommand('bunx', ['tsc', '--noEmit', '-p', 'tsconfig.json'])
runCommand('bun', ['run', './scripts/typecheck-packages.ts'])
