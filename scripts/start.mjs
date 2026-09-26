import { spawn } from 'node:child_process'
const server = spawn(process.execPath, ['--import', 'tsx', 'server/index.ts'], { stdio: 'inherit', env: { ...process.env, NODE_ENV: 'production' }, windowsHide: true })
server.on('exit', code => { process.exitCode = code ?? 0 })
process.on('SIGINT', () => server.kill())
process.on('SIGTERM', () => server.kill())
