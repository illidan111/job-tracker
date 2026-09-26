import { spawn } from 'node:child_process'
try { process.loadEnvFile() } catch (error) { if (error.code !== 'ENOENT') throw error }
const children = [
  spawn(process.execPath, ['--import', 'tsx', ...(process.env.WAYPOINT_E2E ? [] : ['--watch']), 'server/index.ts'], { stdio: 'inherit', env: process.env, windowsHide: true }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', process.env.VITE_PORT || '5173', '--strictPort'], { stdio: 'inherit', env: process.env, windowsHide: true }),
]
let stopping = false
function stop(code = 0) { if (stopping) return; stopping = true; children.forEach(child => child.kill()); process.exitCode = code }
children.forEach(child => { child.on('exit', code => stop(code ?? 0)); child.on('error', error => { console.error(error.message); stop(1) }) })
process.on('SIGINT', () => stop())
process.on('SIGTERM', () => stop())
