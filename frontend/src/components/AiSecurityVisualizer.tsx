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

interface Node3D {
  id: string;
  name: string;
  type: 'core' | 's3' | 'rds' | 'sg' | 'iam';
  // 3D coordinates relative to center (0,0,0)
  x3d: number;
  y3d: number;
  z3d: number;
  // Current projected screen coordinates
  x2d: number;
  y2d: number;
  scale2d: number;
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
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  // 3D topology nodes positioned in a sphere/orbital layout
  const [nodes, setNodes] = useState<Node3D[]>([
    { id: 'core', name: 'SentraAI Core', type: 'core', x3d: 0, y3d: 0, z3d: 0, x2d: 0, y2d: 0, scale2d: 1, status: 'clean', details: 'Remediation Core Active' },
    { id: 's3', name: 'aws_s3_bucket.logs', type: 's3', x3d: -140, y3d: -90, z3d: -60, x2d: 0, y2d: 0, scale2d: 1, status: 'clean', details: 'acl = "public-read"' },
    { id: 'rds', name: 'aws_db_instance.prod', type: 'rds', x3d: 140, y3d: -80, z3d: 60, x2d: 0, y2d: 0, scale2d: 1, status: 'clean', details: 'storage_encrypted = false' },
    { id: 'sg', name: 'aws_security_group.ssh', type: 'sg', x3d: -110, y3d: 90, z3d: 90, x2d: 0, y2d: 0, scale2d: 1, status: 'clean', details: 'cidr_blocks = ["0.0.0.0/0"]' },
    { id: 'iam', name: 'aws_iam_policy.wildcard', type: 'iam', x3d: 110, y3d: 80, z3d: -90, x2d: 0, y2d: 0, scale2d: 1, status: 'clean', details: 'action = "*"' }
  ]);

  const [connections] = useState<Connection[]>([
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
    setNodes(prev => prev.map(node => {
      if (animStatus === 'idle' || animStatus === 'scanning') {
        return { ...node, status: 'clean' };
      } else if (animStatus === 'alert' || animStatus === 'approved') {
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

  const startSimulation = async () => {
    if (animStatus !== 'idle' && animStatus !== 'secured') return;
    setAnimStatus('scanning');
    await new Promise(r => setTimeout(r, 2500));
    setAnimStatus('alert');
  };

  const approveFix = async () => {
    if (animStatus !== 'alert') return;
    setAnimStatus('approved');
    await new Promise(r => setTimeout(r, 2000));
    setAnimStatus('remediating');
    await new Promise(r => setTimeout(r, 3000));
    setAnimStatus('secured');
  };

  const resetAll = () => {
    setAnimStatus('idle');
  };

  // Mouse hover tracking for 3D parallax
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left - canvas.width / 2;
    const y = e.clientY - rect.top - canvas.height / 2;
    mouseRef.current.targetX = x * 0.08;
    mouseRef.current.targetY = y * 0.08;
  };

  const handleMouseLeave = () => {
    mouseRef.current.targetX = 0;
    mouseRef.current.targetY = 0;
  };

  // 3D Orbital Canvas drawing loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let angleY = 0.003; // Rotation speed Y
    let angleX = 0.001; // Rotation speed X
    let scanLineY = -50;
    
    // Remediation pulse path progress
    let pulseProgress = 0;

    const particles: Array<{
      x: number;
      y: number;
      z: number;
      speed: number;
      progress: number;
      fromNode: string;
      toNode: string;
      color: string;
    }> = [];

    // Projection constants
    const perspective = 300;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    const render = () => {
      // Deeper black background with trail blur
      ctx.fillStyle = 'rgba(2, 2, 5, 0.22)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Smooth mouse parallax easing
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.08;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.08;

      // 1. Draw 3D coordinate grid (spatial background topology)
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.02)';
      ctx.lineWidth = 1;
      const spacing = 50;
      for (let i = -200; i <= 200; i += spacing) {
        // Horizontal grid lines projected
        const xStart = i;
        const xEnd = i;
        const zStart = -200;
        const zEnd = 200;

        // Apply mouse parallax rotation offsets
        const radY = mouseRef.current.x * 0.015;
        const radX = mouseRef.current.y * 0.015;

        const projectPoint = (x3d: number, y3d: number, z3d: number) => {
          // Rotate around Y
          let xRot = x3d * Math.cos(radY) - z3d * Math.sin(radY);
          let zRot = x3d * Math.sin(radY) + z3d * Math.cos(radY);
          // Rotate around X
          let yRot = y3d * Math.cos(radX) - zRot * Math.sin(radX);
          let zProj = y3d * Math.sin(radX) + zRot * Math.cos(radX);

          const scale = perspective / (perspective + zProj + 150);
          return {
            x: centerX + xRot * scale,
            y: centerY + yRot * scale,
            scale
          };
        };

        const pt1 = projectPoint(xStart, 120, zStart);
        const pt2 = projectPoint(xEnd, 120, zEnd);

        ctx.beginPath();
        ctx.moveTo(pt1.x, pt1.y);
        ctx.lineTo(pt2.x, pt2.y);
        ctx.stroke();
      }

      // 2. Continuous 3D Node Rotation Calculations
      const cosY = Math.cos(angleY);
      const sinY = Math.sin(angleY);
      const cosX = Math.cos(angleX);
      const sinX = Math.sin(angleX);

      setNodes(prevNodes => {
        const updated = prevNodes.map(node => {
          if (node.id === 'core') {
            // Keep AI Core at absolute center (0,0,0)
            return {
              ...node,
              x2d: centerX + mouseRef.current.x,
              y2d: centerY + mouseRef.current.y,
              scale2d: 1
            };
          }

          // 1. Orbital rotation Y-axis
          let x1 = node.x3d * cosY - node.z3d * sinY;
          let z1 = node.x3d * sinY + node.z3d * cosY;

          // 2. Orbital rotation X-axis
          let y2 = node.y3d * cosX - z1 * sinX;
          let z2 = node.y3d * sinX + z1 * cosX;

          // 3. Easing mouse perspective skew
          const mouseRadY = mouseRef.current.x * 0.015;
          const mouseRadX = mouseRef.current.y * 0.015;

          let rx = x1 * Math.cos(mouseRadY) - z2 * Math.sin(mouseRadY);
          let rz = x1 * Math.sin(mouseRadY) + z2 * Math.cos(mouseRadY);
          let ry = y2 * Math.cos(mouseRadX) - rz * Math.sin(mouseRadX);
          let rzFinal = y2 * Math.sin(mouseRadX) + rz * Math.cos(mouseRadX);

          // 3D Perspective Projection Equation
          const scale = perspective / (perspective + rzFinal + 120);
          const screenX = centerX + rx * scale;
          const screenY = centerY + ry * scale;

          return {
            ...node,
            x3d: x1,
            y3d: y2,
            z3d: z2,
            x2d: screenX,
            y2d: screenY,
            scale2d: scale
          };
        });
        return updated;
      });

      // 3. Draw Scanning Beam Sweep
      if (animStatus === 'scanning') {
        scanLineY += 3;
        if (scanLineY > canvas.height + 40) {
          scanLineY = -40;
        }

        const grad = ctx.createLinearGradient(0, scanLineY - 15, 0, scanLineY + 15);
        grad.addColorStop(0, 'rgba(99, 102, 241, 0)');
        grad.addColorStop(0.5, 'rgba(99, 102, 241, 0.25)');
        grad.addColorStop(1, 'rgba(99, 102, 241, 0)');

        ctx.fillStyle = grad;
        ctx.fillRect(0, scanLineY - 15, canvas.width, 30);

        ctx.strokeStyle = 'rgba(99, 102, 241, 0.65)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, scanLineY);
        ctx.lineTo(canvas.width, scanLineY);
        ctx.stroke();
      }

      // Sort nodes by Z depth so we draw back-to-front (Depth Sorting)
      // This is crucial for rendering 3D volume occlusion correctly!
      const sortedNodes = [...nodes].sort((a, b) => b.z3d - a.z3d);

      // 4. Draw connections with depth weighting
      connections.forEach(conn => {
        const fromNode = nodes.find(n => n.id === conn.from);
        const toNode = nodes.find(n => n.id === conn.to);
        if (!fromNode || !toNode) return;

        let strokeColor = 'rgba(255, 255, 255, 0.05)';
        let lineWidth = 1;

        const depthScale = (fromNode.scale2d + toNode.scale2d) / 2;

        if (animStatus === 'remediating' && (toNode.id === 's3' || toNode.id === 'rds') && fromNode.id === 'core') {
          strokeColor = `rgba(16, 185, 129, ${0.4 * depthScale})`;
          lineWidth = 2.5 * depthScale;
        } else if (animStatus === 'secured' && (toNode.id === 's3' || toNode.id === 'rds') && fromNode.id === 'core') {
          strokeColor = `rgba(16, 185, 129, ${0.15 * depthScale})`;
          lineWidth = 1.2 * depthScale;
        } else if ((animStatus === 'alert' || animStatus === 'approved') && (toNode.id === 's3' || toNode.id === 'rds') && fromNode.id === 'core') {
          strokeColor = `rgba(239, 68, 68, ${0.35 * depthScale})`;
          lineWidth = 1.5 * depthScale;
        } else {
          strokeColor = `rgba(255, 255, 255, ${0.05 * depthScale})`;
        }

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        ctx.moveTo(fromNode.x2d, fromNode.y2d);
        ctx.lineTo(toNode.x2d, toNode.y2d);
        ctx.stroke();

        // Animated active remediation pulse wave propagating along links
        if (animStatus === 'remediating' && fromNode.id === 'core' && (toNode.id === 's3' || toNode.id === 'rds')) {
          pulseProgress = (pulseProgress + 0.005) % 1;
          const pX = fromNode.x2d + (toNode.x2d - fromNode.x2d) * pulseProgress;
          const pY = fromNode.y2d + (toNode.y2d - fromNode.y2d) * pulseProgress;

          ctx.fillStyle = '#10b981';
          ctx.shadowColor = '#10b981';
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(pX, pY, 4 * depthScale, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0; // Reset
        }
      });

      // 5. Generate particles moving along paths
      if (Math.random() < 0.12 && (animStatus === 'remediating' || animStatus === 'scanning' || animStatus === 'idle')) {
        const conn = connections[Math.floor(Math.random() * connections.length)];
        const fromNode = nodes.find(n => n.id === conn.from);
        const toNode = nodes.find(n => n.id === conn.to);

        if (fromNode && toNode) {
          let pColor = 'rgba(99, 102, 241, 0.5)';
          if (animStatus === 'remediating' && (toNode.id === 's3' || toNode.id === 'rds')) {
            pColor = '#10b981';
          }
          particles.push({
            x: fromNode.x2d,
            y: fromNode.y2d,
            z: fromNode.z3d,
            speed: 0.008 + Math.random() * 0.012,
            progress: 0,
            fromNode: fromNode.id,
            toNode: toNode.id,
            color: pColor
          });
        }
      }

      // Draw and update particles
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.progress += p.speed;

        const from = nodes.find(n => n.id === p.fromNode);
        const to = nodes.find(n => n.id === p.toNode);

        if (!from || !to || p.progress >= 1) {
          particles.splice(i, 1);
          continue;
        }

        const currX = from.x2d + (to.x2d - from.x2d) * p.progress;
        const currY = from.y2d + (to.y2d - from.y2d) * p.progress;
        const currScale = from.scale2d + (to.scale2d - from.scale2d) * p.progress;

        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(currX, currY, 2.5 * currScale, 0, Math.PI * 2);
        ctx.fill();
      }

      // 6. Draw Nodes based on sorted Z depth (Occlusion Rendering)
      sortedNodes.forEach(node => {
        ctx.save();

        let baseColor = 'rgba(255, 255, 255, 0.4)';
        let glowColor = 'rgba(255, 255, 255, 0.04)';
        let outerRingSpeed = 0;

        if (node.type === 'core') {
          baseColor = '#6366f1';
          glowColor = 'rgba(99, 102, 241, 0.15)';
          outerRingSpeed = 0.012;
        } else if (node.status === 'vulnerable') {
          baseColor = '#ef4444';
          glowColor = 'rgba(239, 68, 68, 0.25)';
          outerRingSpeed = 0.025;
        } else if (node.status === 'remediating') {
          baseColor = '#3b82f6';
          glowColor = 'rgba(59, 130, 246, 0.35)';
          outerRingSpeed = 0.04;
        } else if (node.status === 'secured') {
          baseColor = '#10b981';
          glowColor = 'rgba(16, 185, 129, 0.25)';
          outerRingSpeed = 0.008;
        }

        const radius = node.type === 'core' ? 20 * node.scale2d : 12 * node.scale2d;

        // Apply depth-based opacity (Depth Fog / Volumetric Easing)
        const alpha = Math.min(1, Math.max(0.25, node.scale2d));
        ctx.globalAlpha = alpha;

        // Bounding volumetric shadow core
        ctx.shadowColor = baseColor;
        ctx.shadowBlur = (animStatus === 'remediating' || node.status === 'vulnerable') ? (12 + Math.sin(Date.now() * 0.004) * 4) * node.scale2d : 6 * node.scale2d;

        ctx.fillStyle = glowColor;
        ctx.beginPath();
        ctx.arc(node.x2d, node.y2d, radius + 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0; // Reset shadow

        // Bounding border rings
        ctx.strokeStyle = baseColor;
        ctx.lineWidth = 1.5 * node.scale2d;
        ctx.beginPath();
        ctx.arc(node.x2d, node.y2d, radius, 0, Math.PI * 2);
        ctx.stroke();

        // Rotating technical arches representing AI thinking states
        if (outerRingSpeed > 0 || node.type === 'core') {
          const rotationAngle = (Date.now() * (outerRingSpeed || 0.005)) % (Math.PI * 2);
          ctx.strokeStyle = baseColor;
          ctx.lineWidth = 1 * node.scale2d;

          ctx.beginPath();
          ctx.arc(node.x2d, node.y2d, radius + 6, rotationAngle, rotationAngle + Math.PI * 0.35);
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(node.x2d, node.y2d, radius + 6, rotationAngle + Math.PI, rotationAngle + Math.PI * 1.35);
          ctx.stroke();
        }

        // Draw node center focus dot
        ctx.fillStyle = baseColor;
        ctx.beginPath();
        ctx.arc(node.x2d, node.y2d, 3.5 * node.scale2d, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      });

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [nodes, animStatus]);

  return (
    <div className="visualizer-wrapper">
      {/* Visualization Grid Panel */}
      <div 
        className="visualizer-graph-panel"
        style={{ cursor: 'grab' }}
      >
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
          <span>System state: {animStatus}</span>
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
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{ width: '100%', maxWidth: '100%', borderRadius: '8px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.05)', boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.5)' }}
        />

        {/* Node metadata overlays (Floating details) */}
        <div className="node-details-grid">
          {nodes.map(node => (
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
