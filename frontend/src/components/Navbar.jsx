import { Link } from 'react-router-dom';
import { useAuth } from '../context/BulkAuthContext';

const baseLinks = [
  { to: '/dashboard',    label: 'Dashboard'    },
  { to: '/whatsapp-bulk',label: 'WhatsApp'     },
  { to: '/notifications',label: 'Notifications'},
];

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <div className="nav">
      <div className="nav-title">WhatsApp Automation</div>
      <div className="nav-links">
        {baseLinks.map((item) => <Link key={item.to} to={item.to}>{item.label}</Link>)}
        {user?.roleId?.code === 'SUPER_ADMIN' && <Link to="/admin">Admin</Link>}
        <span>{user?.name} · {user?.roleId?.name}</span>
        <button onClick={logout}>Logout</button>
      </div>
    </div>
  );
}
