import { promises as fs } from 'fs'
import path from 'path'
import os from 'os'

export type UserRole = 'admin' | 'cashier'

export interface User {
  id: string
  username: string
  password?: string
  role: UserRole
  createdAt: number
}

function getDataFilePath() {
  const dataDir = path.join(process.cwd(), 'data')
  return path.join(dataDir, 'users.json')
}

const DEFAULT_USERS: User[] = [
  { id: 'u1', username: 'admin', password: 'admin', role: 'admin', createdAt: Date.now() },
  { id: 'u2', username: 'cashier', password: 'cashier123', role: 'cashier', createdAt: Date.now() }
]

async function ensureDataFile(filePath: string) {
  try {
    await fs.access(filePath)
  } catch (e) {
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true })
      await fs.writeFile(filePath, JSON.stringify(DEFAULT_USERS, null, 2))
    } catch (err) {
      // Fallback to temp directory if process.cwd() is read-only
      const fallbackPath = path.join(os.tmpdir(), 'billing-software', 'users.json')
      await fs.mkdir(path.dirname(fallbackPath), { recursive: true })
      await fs.writeFile(fallbackPath, JSON.stringify(DEFAULT_USERS, null, 2))
      return fallbackPath
    }
  }
  return filePath
}

export async function getUsers(): Promise<User[]> {
  const targetPath = getDataFilePath()
  const filePath = await ensureDataFile(targetPath)
  const data = await fs.readFile(filePath, 'utf8')
  return JSON.parse(data)
}

export async function saveUsers(users: User[]): Promise<void> {
  const targetPath = getDataFilePath()
  const filePath = await ensureDataFile(targetPath)
  await fs.writeFile(filePath, JSON.stringify(users, null, 2))
}
