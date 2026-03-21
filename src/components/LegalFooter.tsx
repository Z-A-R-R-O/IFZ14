import { IDENTITY } from '../config/identity';

export default function LegalFooter({ className = '' }: { className?: string }) {
  return <footer className={`legal-footer ${className}`.trim()}>&copy; {IDENTITY.full}</footer>;
}
