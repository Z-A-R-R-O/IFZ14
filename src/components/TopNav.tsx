import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';

const links = [
  { to: '/', label: 'SYSTEM' },
  { to: '/daily', label: 'DAILY' },
  { to: '/tasks', label: 'WORK' },
  { to: '/analytics', label: 'ANALYTICS' },
  { to: '/goals', label: 'GOALS' },
  { to: '/reports', label: 'REPORTS' },
];

export default function TopNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <motion.nav
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className={`top-nav${isScrolled ? ' is-scrolled' : ''}`}
    >
      <div className="ifz14-canvas top-nav-inner">
        <button
          type="button"
          className="top-nav-brand"
          onClick={() => {
            if (location.pathname === '/') {
              window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
              navigate('/');
            }
          }}
        >
          IFZ14
        </button>

        <div className="top-nav-links">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              style={{ textDecoration: 'none' }}
            >
              {({ isActive }) => (
                <span className={`nav-item${isActive ? ' active' : ''}`}>
                  {link.label}
                  {isActive ? <motion.span layoutId="top-nav-indicator" className="nav-item-indicator" /> : null}
                </span>
              )}
            </NavLink>
          ))}
        </div>

        <div className="top-nav-spacer" aria-hidden="true" />
      </div>
    </motion.nav>
  );
}
