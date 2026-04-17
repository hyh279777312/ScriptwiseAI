import { ReactNode } from "react";
import { motion } from "motion/react";

export interface CardProps {
  title: string;
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
  key?: any;
}

export function Card({ title, children, icon, className = "" }: CardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-[var(--surface)] border border-[var(--border)] rounded-md overflow-hidden ${className}`}
    >
      <div className="px-3 py-2 border-b border-[var(--border)] bg-[var(--surface)] flex items-center gap-2">
        {icon && <div className="text-[var(--accent)]">{icon}</div>}
        <h3 className="font-mono font-bold text-[var(--accent)] uppercase tracking-widest text-[10px]">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </motion.div>
  );
}

export function Badge({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-tighter bg-[var(--border)] text-[var(--text-dim)] ${className}`}>
      {children}
    </span>
  );
}

export function SectionTitle({ children, subtitle }: { children: ReactNode; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-xs font-bold text-[var(--accent)] uppercase tracking-[0.2em]">{children}</h2>
      {subtitle && <p className="text-[var(--text-dim)] mt-1 text-[11px] font-sans">{subtitle}</p>}
    </div>
  );
}
