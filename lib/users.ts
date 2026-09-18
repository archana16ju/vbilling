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
  // Use the user's home directory so the file is ALWAYS writable and persists across app updates
  try {
    const dataDir = path.join(os.homedir(), '.billing-software')
    return path.join(dataDir, 'users.json')
  } catch (err) {
    return path.join(os.tmpdir(), 'billing-software-users.json')
  }
}

const DEFAULT_USERS: User[] = [
  { id: 'u1', username: 'admin', password: 'admin', role: 'admin', createdAt: Date.now() },
  { id: 'u2', username: 'cashier', password: 'cashier123', role: 'cashier', createdAt: Date.now() }
]

async function ensureDataFile(filePath: string) {
  try {
    await fs.access(filePath)
  } catch (e) {
    // If it doesn't exist, create it in the writable home directory
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, JSON.stringify(DEFAULT_USERS, null, 2))
  }
  return filePath
}

export async function getUsers(): Promise<User[]> {
  const targetPath = getDataFilePath()
  const filePath = await ensureDataFile(targetPath)
  
  try {
    const data = await fs.readFile(filePath, 'utf8')
    if (!data || data.trim() === '') {
      return DEFAULT_USERS
    }
    return JSON.parse(data)
  } catch (err) {
    console.error('Failed to read or parse users.json, falling back to defaults:', err)
    return DEFAULT_USERS
  }
}

export async function saveUsers(users: User[]): Promise<void> {
  const targetPath = getDataFilePath()
  const filePath = await ensureDataFile(targetPath)
  await fs.writeFile(filePath, JSON.stringify(users, null, 2))
}
