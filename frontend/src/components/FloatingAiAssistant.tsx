import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, 
  ChevronDown, 
  Lock 
} from 'lucide-react';

export default function FloatingAiAssistant() {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [logs, setLogs] = useState<string[]>([
    '[SYSTEM] SentraAI Assistant online.',
    '[MONITOR] Listening for repository webhooks...',
    '[RBAC] Governance policy loaded (Human-in-the-loop).'
  ]);
  const [stats, setStats] = useState({
    activeScans: 0,
    securedNodes: 24,
    healthIndex: 100
  });

  const logsEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll logs
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // Periodic visual background activity logs simulator
  useEffect(() => {
    const liveScans = [
      'Scanning production-infra/main.tf...',
      'Validating AWS_S3_PUBLIC AST structures...',
      'Verifying PR review credentials on collaborator list...',
      'Analyzing repository data-lake for drift...',
      'AST boundary check: OK on aws_security_group.ssh',
      'Telemetry audit compiled. Code Health: 100% ✅',
      'Idempotency validation complete for PR #114.'
    ];

    const interval = setInterval(() => {
      // Randomly add a background scan log
      const logMsg = liveScans[Math.floor(Math.random() * liveScans.length)];
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      
      setLogs(prev => {
        const nextLogs = [...prev, `[${timestamp}] ${logMsg}`];
        // Keep last 15 logs to prevent memory leaks
        return nextLogs.slice(-15);
      });

      // Fluctuate active scans between 0 and 2 for visual operational realism
      setStats(prev => ({
        ...prev,
        activeScans: Math.random() > 0.6 ? Math.floor(Math.random() * 3) : prev.activeScans,
        securedNodes: Math.random() > 0.85 ? prev.securedNodes + 1 : prev.securedNodes,
        healthIndex: Math.random() > 0.9 ? 99 + Math.floor(Math.random() * 2) : prev.healthIndex
      }));

    }, 6000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="floating-assistant-container">
      <AnimatePresence>
        {isOpen ? (
          <motion.div 
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className="assistant-hud-panel"
          >
            {/* Header */}
            <div className="assistant-hud-header">
              <div className="assistant-hud-title">
                <div className="neural-pulse-core">
                  <div className="neural-pulse-ring"></div>
                </div>
                <span>SentraAI Operations Assistant</span>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                <ChevronDown size={16} />
              </button>
            </div>

            {/* Live Stats */}
            <div className="assistant-hud-stats">
              <div className="hud-stat-item">
                <span className="hud-stat-label">Active Scans</span>
                <span className="hud-stat-value" style={{ color: stats.activeScans > 0 ? 'var(--primary)' : 'var(--text-secondary)' }}>
                  {stats.activeScans}
                </span>
              </div>
              <div className="hud-stat-item">
                <span className="hud-stat-label">System Health</span>
                <span className="hud-stat-value" style={{ color: 'var(--success)' }}>
                  {stats.healthIndex}%
                </span>
              </div>
            </div>

            {/* Dynamic log stream */}
            <div className="assistant-hud-logs">
              {logs.map((log, idx) => (
                <div key={idx} style={{ borderLeft: '1.5px solid rgba(99, 102, 241, 0.2)', paddingLeft: '4px' }}>
                  {log}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>

            {/* AI HUD Footer */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.6rem', color: 'var(--text-muted)', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '0.5rem' }}>
              <Lock size={10} />
              <span>AST Bounding Guard Activated</span>
            </div>
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={() => setIsOpen(true)}
            className="assistant-hud-minimized animate-pulse"
          >
            <Shield size={20} style={{ animation: 'pulse 2.5s infinite' }} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
