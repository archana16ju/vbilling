import { promises as fs } from 'fs'
import path from 'path'

export type UserRole = 'admin' | 'cashier'

export interface User {
  id: string
  username: string
  password?: string // optional so we can omit it when sending to client
  role: UserRole
  createdAt: number
}

const dataFilePath = path.join(process.cwd(), 'data', 'users.json')

const DEFAULT_USERS: User[] = [
  { id: 'u1', username: 'admin', password: 'admin', role: 'admin', createdAt: Date.now() },
  { id: 'u2', username: 'cashier', password: 'cashier123', role: 'cashier', createdAt: Date.now() }
]

async function ensureDataFile() {
  try {
    await fs.access(dataFilePath)
  } catch (e) {
    await fs.mkdir(path.dirname(dataFilePath), { recursive: true })
    await fs.writeFile(dataFilePath, JSON.stringify(DEFAULT_USERS, null, 2))
  }
}

export async function getUsers(): Promise<User[]> {
  await ensureDataFile()
  const data = await fs.readFile(dataFilePath, 'utf8')
  return JSON.parse(data)
}

export async function saveUsers(users: User[]): Promise<void> {
  await ensureDataFile()
  await fs.writeFile(dataFilePath, JSON.stringify(users, null, 2))
}
