import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, 
  Server, 
  Database, 
  Lock, 
  Terminal, 
  Cpu, 
  Play, 
  GitPullRequest,
  RefreshCw
} from 'lucide-react';

interface Node {
  id: string;
  name: string;
  type: 'core' | 's3' | 'rds' | 'sg' | 'iam';
  x: number;
  y: number;
  status: 'clean' | 'vulnerable' | 'remediating' | 'secured';
  details: string;
}

interface Connection {
  from: string;
  to: string;
  status: 'active' | 'warning' | 'remediating' | 'secured';
}

export default function AiSecurityVisualizer() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [animStatus, setAnimStatus] = useState<'idle' | 'scanning' | 'alert' | 'approved' | 'remediating' | 'secured'>('idle');
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [activeNodes, setActiveNodes] = useState<Node[]>([
    { id: 'core', name: 'SentraAI Brain', type: 'core', x: 250, y: 200, status: 'clean', details: 'Remediation Core Active' },
    { id: 's3', name: 'aws_s3_bucket.logs', type: 's3', x: 120, y: 100, status: 'clean', details: 'acl = "public-read"' },
    { id: 'rds', name: 'aws_db_instance.prod', type: 'rds', x: 380, y: 110, status: 'clean', details: 'storage_encrypted = false' },
    { id: 'sg', name: 'aws_security_group.ssh', type: 'sg', x: 130, y: 300, status: 'clean', details: 'cidr_blocks = ["0.0.0.0/0"]' },
    { id: 'iam', name: 'aws_iam_policy.wildcard', type: 'iam', x: 370, y: 290, status: 'clean', details: 'action = "*"' }
  ]);

  const [activeConns] = useState<Connection[]>([
    { from: 'core', to: 's3', status: 'active' },
    { from: 'core', to: 'rds', status: 'active' },
    { from: 'core', to: 'sg', status: 'active' },
    { from: 'core', to: 'iam', status: 'active' },
    { from: 's3', to: 'rds', status: 'active' },
    { from: 'sg', to: 'iam', status: 'active' }
  ]);

  // Terminal logging logic synchronized with states
  useEffect(() => {
    let logs: string[] = [];
    if (animStatus === 'idle') {
      logs = [
        '[SYSTEM] SentraAI Engine: STANDBY',
        '  - 3-Layer Validation: ACTIVE',
        '  - AST Boundary checking: ARMED',
        '  - Preview Hash locking: ENABLED',
        '👉 Click "Trigger Security Scan" to begin.'
      ];
    } else if (animStatus === 'scanning') {
      logs = [
        '[SCANNER] Initializing security scanning scan-8c3b7a...',
        '[SCANNER] Fetching HCL code structure...',
        '[SCANNER] Running AST security checks on 5 cloud assets...',
        '  -> Analyzing aws_s3_bucket.logs...',
        '  -> Analyzing aws_db_instance.prod...',
        '  -> Analyzing aws_security_group.ssh...',
        '  -> Analyzing aws_iam_policy.wildcard...'
      ];
    } else if (animStatus === 'alert') {
      logs = [
        '[ALERT] Scans finished: 4 findings identified!',
        '  🔴 AWS_S3_PUBLIC on aws_s3_bucket.logs (acl: public-read)',
        '  🔴 AWS_DB_UNENCRYPTED on aws_db_instance.prod (encrypted: false)',
        '  🟡 AWS_SG_OPEN on aws_security_group.ssh (port 22 open to world)',
        '  🟡 AWS_IAM_WILDCARD on aws_iam_policy.wildcard (admin wildcard)',
        '[SYSTEM] Inline PR comment generated with secure diff previews.',
        '👉 Action Required: Reply "/approve" to authorize fixes.'
      ];
    } else if (animStatus === 'approved') {
      logs = [
        '[GITOPS] Received webhook pull_request_review_comment',
        '[RBAC] Verified actor AryanGupta (Owner) -> AUTHORIZED',
        '[HASH] Verifying Dry-run Preview Hash... MATCHED ✅',
        '[GITOPS] Approval verified. Initiating validation...'
      ];
    } else if (animStatus === 'remediating') {
      logs = [
        '[VALIDATION] Running 3-Layer Safety Checks...',
        '  - Layer 1: HCL Syntax... PASSED ✅',
        '  - Layer 2: Terraform CLI Validate... PASSED ✅',
        '  - Layer 3: AST Resource Boundary Check... PASSED ✅',
        '[SYSTEM] Validation succeeded. Safe mutations confirmed.',
        '[MUTATION] Creating git branch sentraai/fix/aws-s3-public...',
        '[MUTATION] Committing secure refactored code (main.tf)...'
      ];
    } else if (animStatus === 'secured') {
      logs = [
        '[MUTATION] Pushing branch and opening remediation PR...',
        '[PR] Remediation Pull Request #115 opened successfully!',
        '👉 https://github.com/sentra-corp/production-infra/pull/115',
        '[SYSTEM] SentraAI: Cloud state is SECURED. Standby mode.'
      ];
    }
    setTerminalLogs(logs);
  }, [animStatus]);

  // Update node statuses during states
  useEffect(() => {
    setActiveNodes(nodes => nodes.map(node => {
      if (animStatus === 'idle') {
        return { ...node, status: 'clean' };
      } else if (animStatus === 'scanning') {
        return { ...node, status: 'clean' };
      } else if (animStatus === 'alert') {
        if (node.id === 's3' || node.id === 'rds') {
          return { ...node, status: 'vulnerable' };
        }
        return { ...node, status: 'clean' };
      } else if (animStatus === 'approved') {
        if (node.id === 's3' || node.id === 'rds') {
          return { ...node, status: 'vulnerable' };
        }
        return { ...node, status: 'clean' };
      } else if (animStatus === 'remediating') {
        if (node.id === 's3' || node.id === 'rds') {
          return { ...node, status: 'remediating' };
        }
        return { ...node, status: 'clean' };
      } else if (animStatus === 'secured') {
        if (node.id === 's3' || node.id === 'rds') {
          return { ...node, status: 'secured' };
        }
        return { ...node, status: 'clean' };
      }
      return node;
    }));
  }, [animStatus]);

  // Animation controller
  const startSimulation = async () => {
    if (animStatus !== 'idle' && animStatus !== 'secured') return;
    
    // 1. Scan
    setAnimStatus('scanning');
    await new Promise(r => setTimeout(r, 2500));
    
    // 2. Alert
    setAnimStatus('alert');
  };

  const approveFix = async () => {
    if (animStatus !== 'alert') return;
    
    // 3. Approved
    setAnimStatus('approved');
    await new Promise(r => setTimeout(r, 2000));
    
    // 4. Remediating
    setAnimStatus('remediating');
    await new Promise(r => setTimeout(r, 3000));
    
    // 5. Secured
    setAnimStatus('secured');
  };

  const resetAll = () => {
    setAnimStatus('idle');
  };

  // Canvas drawing loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let scanLineY = -50;
    const particles: Array<{ x: number; y: number; speed: number; progress: number; fromX: number; fromY: number; toX: number; toY: number; color: string }> = [];

    // Animation loop
    const render = () => {
      // Clear canvas with subtle transparency for trails
      ctx.fillStyle = 'rgba(10, 11, 13, 0.25)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 1. Draw grid background
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // 2. Draw Scanning laser line
      if (animStatus === 'scanning') {
        scanLineY += 3;
        if (scanLineY > canvas.height + 50) {
          scanLineY = -50;
        }

        // Draw scan beam gradient
        const grad = ctx.createLinearGradient(0, scanLineY - 20, 0, scanLineY + 20);
        grad.addColorStop(0, 'rgba(99, 102, 241, 0)');
        grad.addColorStop(0.5, 'rgba(99, 102, 241, 0.3)');
        grad.addColorStop(1, 'rgba(99, 102, 241, 0)');

        ctx.fillStyle = grad;
        ctx.fillRect(0, scanLineY - 20, canvas.width, 40);

        // Core laser light line
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, scanLineY);
        ctx.lineTo(canvas.width, scanLineY);
        ctx.stroke();
      }

      // 3. Draw connections
      activeConns.forEach(conn => {
        const fromNode = activeNodes.find(n => n.id === conn.from);
        const toNode = activeNodes.find(n => n.id === conn.to);
        if (!fromNode || !toNode) return;

        let strokeColor = 'rgba(255, 255, 255, 0.05)';
        let lineWidth = 1;

        if (animStatus === 'remediating' && (toNode.id === 's3' || toNode.id === 'rds') && fromNode.id === 'core') {
          strokeColor = 'rgba(16, 185, 129, 0.4)';
          lineWidth = 2.5;
        } else if (animStatus === 'secured' && (toNode.id === 's3' || toNode.id === 'rds') && fromNode.id === 'core') {
          strokeColor = 'rgba(16, 185, 129, 0.2)';
          lineWidth = 1.5;
        } else if ((animStatus === 'alert' || animStatus === 'approved') && (toNode.id === 's3' || toNode.id === 'rds') && fromNode.id === 'core') {
          strokeColor = 'rgba(239, 68, 68, 0.3)';
          lineWidth = 1.5;
        }

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        ctx.moveTo(fromNode.x, fromNode.y);
        ctx.lineTo(toNode.x, toNode.y);
        ctx.stroke();
      });

      // 4. Generate & Animate particles moving along connections
      if (Math.random() < 0.1 && (animStatus === 'remediating' || animStatus === 'scanning' || animStatus === 'idle')) {
        const conn = activeConns[Math.floor(Math.random() * activeConns.length)];
        const fromNode = activeNodes.find(n => n.id === conn.from);
        const toNode = activeNodes.find(n => n.id === conn.to);

        if (fromNode && toNode) {
          let pColor = 'rgba(99, 102, 241, 0.6)';
          if (animStatus === 'remediating' && (toNode.id === 's3' || toNode.id === 'rds')) {
            pColor = '#10b981';
          }
          particles.push({
            x: fromNode.x,
            y: fromNode.y,
            speed: 0.01 + Math.random() * 0.015,
            progress: 0,
            fromX: fromNode.x,
            fromY: fromNode.y,
            toX: toNode.x,
            toY: toNode.y,
            color: pColor
          });
        }
      }

      // Draw and update particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.progress += p.speed;

        if (p.progress >= 1) {
          particles.splice(i, 1);
          continue;
        }

        p.x = p.fromX + (p.toX - p.fromX) * p.progress;
        p.y = p.fromY + (p.toY - p.fromY) * p.progress;

        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();

        // Subtle glow around particle
        ctx.fillStyle = p.color.replace('0.6', '0.2');
        ctx.beginPath();
        ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx.fill();
      }

      // 5. Draw node visual feedback (outer rings, scanning indicator, alerts)
      activeNodes.forEach(node => {
        ctx.save();

        let baseColor = 'rgba(255, 255, 255, 0.4)';
        let glowColor = 'rgba(255, 255, 255, 0.05)';
        let outerRingSpeed = 0;

        if (node.type === 'core') {
          baseColor = '#6366f1';
          glowColor = 'rgba(99, 102, 241, 0.2)';
          outerRingSpeed = 0.015;
        } else if (node.status === 'vulnerable') {
          baseColor = '#ef4444';
          glowColor = 'rgba(239, 68, 68, 0.3)';
          outerRingSpeed = 0.03;
        } else if (node.status === 'remediating') {
          baseColor = '#3b82f6';
          glowColor = 'rgba(59, 130, 246, 0.4)';
          outerRingSpeed = 0.05;
        } else if (node.status === 'secured') {
          baseColor = '#10b981';
          glowColor = 'rgba(16, 185, 129, 0.3)';
          outerRingSpeed = 0.01;
        }

        // Draw outer pulsing glow circle
        ctx.shadowColor = baseColor;
        ctx.shadowBlur = (animStatus === 'remediating' || node.status === 'vulnerable') ? 15 + Math.sin(Date.now() * 0.005) * 5 : 8;

        ctx.fillStyle = glowColor;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.type === 'core' ? 24 : 16, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0; // Reset shadow

        // Draw node center border
        ctx.strokeStyle = baseColor;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.type === 'core' ? 18 : 12, 0, Math.PI * 2);
        ctx.stroke();

        // Draw rotating tech arches for AI core and active/remediating nodes
        if (outerRingSpeed > 0 || node.type === 'core') {
          const rotationAngle = (Date.now() * (outerRingSpeed || 0.005)) % (Math.PI * 2);
          ctx.strokeStyle = baseColor;
          ctx.lineWidth = 1.5;

          ctx.beginPath();
          ctx.arc(node.x, node.y, node.type === 'core' ? 28 : 20, rotationAngle, rotationAngle + Math.PI * 0.4);
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(node.x, node.y, node.type === 'core' ? 28 : 20, rotationAngle + Math.PI, rotationAngle + Math.PI * 1.4);
          ctx.stroke();
        }

        // Draw clean central dot
        ctx.fillStyle = baseColor;
        ctx.beginPath();
        ctx.arc(node.x, node.y, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      });

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [activeNodes, animStatus, activeConns]);

  return (
    <div className="visualizer-wrapper">
      {/* Visualization Grid Panel */}
      <div className="visualizer-graph-panel">
        {/* Glassmorphic overlay badge */}
        <div className="visualizer-badge">
          <span className="visualizer-badge-dot">
            <span 
              className="visualizer-badge-dot-ping" 
              style={{
                background: 
                  animStatus === 'idle' ? '#818cf8' :
                  animStatus === 'scanning' ? '#6366f1' :
                  animStatus === 'alert' ? '#f87171' :
                  animStatus === 'remediating' ? '#60a5fa' : '#34d399'
              }}
            ></span>
            <span 
              className="visualizer-badge-dot-core"
              style={{
                background: 
                  animStatus === 'idle' ? '#6366f1' :
                  animStatus === 'scanning' ? '#4f46e5' :
                  animStatus === 'alert' ? '#ef4444' :
                  animStatus === 'remediating' ? '#3b82f6' : '#10b981'
              }}
            ></span>
          </span>
          <span>System State: {animStatus}</span>
        </div>

        {/* Interactive controls */}
        <div className="visualizer-actions">
          {animStatus === 'idle' && (
            <button 
              onClick={startSimulation}
              className="btn btn-primary"
              style={{ padding: '0.35rem 0.85rem', fontSize: '0.75rem' }}
            >
              <Play size={12} /> Trigger Security Scan
            </button>
          )}
          {animStatus === 'alert' && (
            <button 
              onClick={approveFix}
              className="btn btn-primary"
              style={{ 
                padding: '0.35rem 0.85rem', 
                fontSize: '0.75rem',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                boxShadow: '0 0 15px rgba(16, 185, 129, 0.4)'
              }}
            >
              <GitPullRequest size={12} /> Reply `/approve`
            </button>
          )}
          {(animStatus === 'secured' || animStatus === 'scanning' || animStatus === 'approved' || animStatus === 'remediating') && (
            <button 
              onClick={resetAll}
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.85rem', fontSize: '0.75rem' }}
              disabled={animStatus === 'scanning' || animStatus === 'remediating' || animStatus === 'approved'}
            >
              <RefreshCw size={12} className={animStatus === 'scanning' || animStatus === 'remediating' ? 'spin' : ''} /> Reset Node State
            </button>
          )}
        </div>

        {/* Interactive Canvas Graph */}
        <canvas 
          ref={canvasRef} 
          width={500} 
          height={400} 
          style={{ width: '100%', maxWidth: '100%', borderRadius: '8px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.05)', boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.5)' }}
        />

        {/* Node metadata overlays (Floating details) */}
        <div className="node-details-grid">
          {activeNodes.map(node => (
            <div 
              key={node.id} 
              className={`node-detail-card ${
                node.status === 'vulnerable' ? 'vulnerable' :
                node.status === 'remediating' ? 'remediating' :
                node.status === 'secured' ? 'secured' : ''
              }`}
            >
              <div className="node-detail-title">
                {node.type === 'core' && <Cpu size={10} />}
                {node.type === 's3' && <Database size={10} />}
                {node.type === 'rds' && <Server size={10} />}
                {node.type === 'sg' && <Shield size={10} />}
                {node.type === 'iam' && <Lock size={10} />}
                <span>{node.name.replace('aws_', '')}</span>
              </div>
              <div className="node-detail-desc">{node.details}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Floating AI Command Center / Terminal logs */}
      <div className="visualizer-sidebar">
        {/* Terminal logs panel */}
        <div className="visualizer-terminal-panel">
          <div className="terminal-panel-header">
            <div className="terminal-header-title">
              <Terminal size={14} style={{ color: '#818cf8' }} />
              <span>SentraAI Security Agent logs</span>
            </div>
            <div className="terminal-header-dots">
              <span className="terminal-header-dot"></span>
              <span className="terminal-header-dot"></span>
              <span className="terminal-header-dot"></span>
            </div>
          </div>
          
          <div className="terminal-logs-content">
            <AnimatePresence mode="popLayout">
              {terminalLogs.map((log, index) => (
                <motion.div 
                  key={log + index}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25, delay: index * 0.05 }}
                  className={`terminal-log-line ${
                    log.includes('🔴') || log.includes('[ALERT]') ? 'alert' :
                    log.includes('🟡') ? 'warning' :
                    log.includes('✅') || log.includes('SECURED') ? 'success' :
                    log.includes('[MUTATION]') || log.includes('[GITOPS]') ? 'mutation' : ''
                  }`}
                >
                  {log}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Live Security Metrics & Telemetry Card */}
        <div className="visualizer-metrics-card">
          <div className="metrics-card-glow"></div>
          
          <div className="metrics-card-title">
            <Shield size={16} style={{ color: '#34d399', animation: 'pulse 2s infinite' }} />
            <span>Live Security Governance Status</span>
          </div>

          <div className="metrics-card-grid">
            <div className="metric-item">
              <span className="metric-item-label">Remediation Approval</span>
              <span className="metric-item-value">
                {animStatus === 'idle' ? 'STANDBY' :
                 animStatus === 'scanning' ? 'ANALYZING' :
                 animStatus === 'alert' ? 'GATED' :
                 animStatus === 'approved' ? 'VALIDATING' :
                 animStatus === 'remediating' ? 'MUTATING' : 'COMMITTED'}
              </span>
            </div>
            <div className="metric-item">
              <span className="metric-item-label">AST Protection Scope</span>
              <span className="metric-item-value" style={{ color: 'var(--success)' }}>RESTRICTED</span>
            </div>
          </div>

          {/* Quick instructions / dynamic action indicators */}
          <div className="visualizer-metrics-footer">
            {animStatus === 'idle' && (
              <span>⚡ **Idle**: Trigger a security scan to inspect current cloud templates for vulnerabilities.</span>
            )}
            {animStatus === 'scanning' && (
              <span style={{ color: '#a5b4fc' }}>🔍 **Scanning**: AST parser checking code block resource boundaries.</span>
            )}
            {animStatus === 'alert' && (
              <span style={{ color: '#f87171' }}>🚨 **Awaiting Approval**: Found exposures. Click **Reply `/approve`** to authorize safe commits.</span>
            )}
            {animStatus === 'approved' && (
              <span style={{ color: '#93c5fd' }}>🔑 **Hash Verified**: Authorization signature matched. Running 3-Layer checks.</span>
            )}
            {animStatus === 'remediating' && (
              <span style={{ color: '#60a5fa' }}>⚙️ **Remediating**: Modifying HCL trees within isolation boundary parameters.</span>
            )}
            {animStatus === 'secured' && (
              <span style={{ color: '#34d399' }}>🎉 **Secured**: Secure branch and pull request created! Threat resolved.</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
