import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, 
  ChevronDown, 
  Lock 
} from 'lucide-react';

interface FloatingAiAssistantProps {
  simState?: string;
}

interface AgentStatus {
  name: string;
  role: string;
  color: string;
}

const AGENTS: AgentStatus[] = [
  { name: 'AST Sentinel', role: 'Boundary isolation', color: '#10b981' },
  { name: 'DriftGuard', role: 'Drift/compliance', color: '#3b82f6' },
  { name: 'IAM Auditor', role: 'Privilege analysis', color: '#f59e0b' },
  { name: 'PatchSynth AI', role: 'Remediation synthesis', color: '#a855f7' },
  { name: 'ComplianceCore', role: '3-layer governance', color: '#14b8a6' }
];

export default function FloatingAiAssistant({ simState = 'idle' }: FloatingAiAssistantProps) {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [logs, setLogs] = useState<string[]>([
    '[SYSTEM] SentraAI Security Ecosystem online.',
    '[MONITOR] Listening for repository scan requests...',
    '[RBAC] Governance policy loaded (Human-in-the-loop).'
  ]);

  const logsEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll logs
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // Synchronize agent activity log stream with state changes
  useEffect(() => {
    const timestamp = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    switch (simState) {
      case 'scanning':
        setLogs(prev => [
          ...prev,
          `[${timestamp()}] [IAM Auditor] Initiating privilege audits...`,
          `[${timestamp()}] [AST Sentinel] Evaluating syntax configuration tree...`
        ].slice(-15));
        break;
      case 'highlighted':
        setLogs(prev => [
          ...prev,
          `[${timestamp()}] [IAM Auditor] Alert: Exposure found. Flagged critical finding.`,
          `[${timestamp()}] [AST Sentinel] Sibling nodes mapped. Preparing containment...`
        ].slice(-15));
        break;
      case 'expand':
        setLogs(prev => [
          ...prev,
          `[${timestamp()}] [IAM Auditor] Attack path analysis: Exposure threatens production RDS.`,
          `[${timestamp()}] [SYSTEM] Risk consequence flagged: Customer credential leak danger.`
        ].slice(-15));
        break;
      case 'ast_isolation':
        setLogs(prev => [
          ...prev,
          `[${timestamp()}] [AST Sentinel] AST Isolation boundary locked around targets.`,
          `[${timestamp()}] [AST Sentinel] Sibling assets isolated and secured.`
        ].slice(-15));
        break;
      case 'remediating':
        setLogs(prev => [
          ...prev,
          `[${timestamp()}] [PatchSynth AI] Refactoring HCL configurations...`,
          `[${timestamp()}] [PatchSynth AI] Synthesis check: generating green diff patch.`
        ].slice(-15));
        break;
      case 'remediated':
        setLogs(prev => [
          ...prev,
          `[${timestamp()}] [ComplianceCore] Dispatching 3-Layer Validation checks...`,
          `[${timestamp()}] [ComplianceCore] Syntax check: PASS | CLI validate: PASS | AST boundary: PASS.`
        ].slice(-15));
        break;
      case 'pr_opened':
        setLogs(prev => [
          ...prev,
          `[${timestamp()}] [DriftGuard] Remote branch sentraai/fix/iac opened.`,
          `[${timestamp()}] [ComplianceCore] Awaiting Human approval (/approve)...`
        ].slice(-15));
        break;
      case 'pr_approved':
        setLogs(prev => [
          ...prev,
          `[${timestamp()}] [DriftGuard] Authorization comment matched.`,
          `[${timestamp()}] [SYSTEM] Dry-run preview signature matched. Merging...`
        ].slice(-15));
        break;
      case 'pr_merged':
        setLogs(prev => [
          ...prev,
          `[${timestamp()}] [DriftGuard] Pull request merged. Config committed.`,
          `[${timestamp()}] [SYSTEM] Incident resolved. Core topology stabilized. ✅`
        ].slice(-15));
        break;
      case 'idle':
      default:
        // Do not add log if it was just reset
        break;
    }
  }, [simState]);

  // Periodic random heartbeat events when idle
  useEffect(() => {
    if (simState !== 'idle' && simState !== 'pr_merged') return;
    
    const ambientLogs = [
      'DriftGuard: State validation check OK (no drift).',
      'AST Sentinel: Background template integrity verified.',
      'IAM Auditor: Scanning IAM policy bounds (OK).',
      'ComplianceCore: Gated policy checks active.'
    ];

    const interval = setInterval(() => {
      const logMsg = ambientLogs[Math.floor(Math.random() * ambientLogs.length)];
      const timestampStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      
      setLogs(prev => {
        const nextLogs = [...prev, `[${timestampStr}] [AGENT] ${logMsg}`];
        return nextLogs.slice(-15);
      });
    }, 8000);

    return () => clearInterval(interval);
  }, [simState]);

  const getAgentState = (agentName: string, state: string) => {
    switch (agentName) {
      case 'AST Sentinel':
        if (state === 'scanning' || state === 'ast_isolation' || state === 'remediating') return 'active';
        if (state === 'remediated' || state === 'pr_opened' || state === 'pr_approved' || state === 'pr_merged') return 'success';
        return 'standby';
      case 'DriftGuard':
        if (state === 'pr_approved') return 'active';
        if (state === 'pr_merged') return 'success';
        return 'standby';
      case 'IAM Auditor':
        if (state === 'scanning' || state === 'highlighted' || state === 'expand') return 'active';
        if (state === 'ast_isolation' || state === 'remediating' || state === 'remediated' || state === 'pr_opened' || state === 'pr_approved' || state === 'pr_merged') return 'success';
        return 'standby';
      case 'PatchSynth AI':
        if (state === 'remediating') return 'active';
        if (state === 'remediated' || state === 'pr_opened' || state === 'pr_approved' || state === 'pr_merged') return 'success';
        return 'standby';
      case 'ComplianceCore':
        if (state === 'remediated') return 'active';
        if (state === 'pr_opened' || state === 'pr_approved' || state === 'pr_merged') return 'success';
        return 'standby';
      default:
        return 'standby';
    }
  };

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
            style={{ width: '340px' }}
          >
            {/* Header */}
            <div className="assistant-hud-header">
              <div className="assistant-hud-title">
                <div className="neural-pulse-core">
                  <div className="neural-pulse-ring"></div>
                </div>
                <span>SentraAI Agent Ecosystem</span>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
              >
                <ChevronDown size={16} />
              </button>
            </div>

            {/* Autonomous Agent List Grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.75rem', marginBottom: '0.25rem' }}>
              <div style={{ fontSize: '0.55rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                Active Agent Personalities
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                {AGENTS.map((agent) => {
                  const status = getAgentState(agent.name, simState);
                  return (
                    <div key={agent.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.65rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span 
                          className="status-indicator animate-pulse" 
                          style={{ 
                            width: '6px', 
                            height: '6px', 
                            background: status === 'active' ? agent.color : status === 'success' ? 'var(--success)' : 'rgba(255,255,255,0.15)',
                            boxShadow: status === 'active' ? `0 0 8px ${agent.color}` : 'none'
                          }}
                        ></span>
                        <span style={{ fontWeight: 600, color: status === 'active' ? '#fff' : 'var(--text-secondary)' }}>{agent.name}</span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.55rem' }}>({agent.role})</span>
                      </div>
                      <span style={{ 
                        fontSize: '0.55rem', 
                        color: status === 'active' ? agent.color : status === 'success' ? 'var(--success)' : 'var(--text-muted)', 
                        fontWeight: '700',
                        textTransform: 'uppercase',
                        letterSpacing: '0.02em'
                      }}>
                        {status}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Dynamic log stream */}
            <div className="assistant-hud-logs" style={{ height: '110px' }}>
              {logs.map((log, idx) => (
                <div 
                  key={idx} 
                  style={{ 
                    borderLeft: log.includes('[AGENT]') ? '1.5px solid rgba(99, 102, 241, 0.4)' : '1.5px solid rgba(16, 185, 129, 0.3)', 
                    paddingLeft: '5px',
                    color: log.includes('resolved') || log.includes('stabilized') ? 'var(--success)' : log.includes('Alert:') || log.includes('danger') ? '#fca5a5' : 'inherit'
                  }}
                >
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
