import { getAllUsers, getUserRole } from '@/app/login/actions';
export default async function TestPage() {
  let err = '';
  let users: any = [];
  let role: any = '';
  try {
    users = await getAllUsers();
    role = await getUserRole();
  } catch(e: any) {
    err = e.message;
  }
  return <div><h1>TEST PAGE</h1><p>Error: {err}</p><p>Role: {role || 'none'}</p><pre>{JSON.stringify(users, null, 2)}</pre></div>;
}
