import { resolve } from 'node:path'
import { config } from './config'
import { openDatabase } from './database'
import { createApp } from './app'

const db = openDatabase(config.databasePath)
const server = createApp(db, { ...config, staticDir: process.env.NODE_ENV === 'production' ? resolve('dist') : undefined }).listen(config.port, '127.0.0.1', () => console.log(`Waypoint API ready at http://127.0.0.1:${config.port}`))
function close() { server.close(() => { db.close(); process.exit(0) }) }
process.on('SIGINT', close)
process.on('SIGTERM', close)
