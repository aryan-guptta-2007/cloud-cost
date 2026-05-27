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
  x3d: number;
  y3d: number;
  z3d: number;
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

interface AmbientNode {
  x3d: number;
  y3d: number;
  z3d: number;
  radius: number;
  speedY: number;
  speedX: number;
  activeType: 'faint' | 'semi' | 'critical';
}

interface AiSecurityVisualizerProps {
  simState: string;
  setSimState: (state: string) => void;
}

// Generate 45 ambient background nodes
const ambientNodesList: AmbientNode[] = [];
for (let i = 0; i < 45; i++) {
  const r = 130 + Math.random() * 140;
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos((Math.random() * 2) - 1);
  
  const x3d = r * Math.sin(phi) * Math.cos(theta);
  const y3d = r * Math.sin(phi) * Math.sin(theta);
  const z3d = r * Math.cos(phi);

  const rand = Math.random();
  let activeType: 'faint' | 'semi' | 'critical' = 'faint';
  if (rand > 0.95) {
    activeType = 'critical';
  } else if (rand > 0.78) {
    activeType = 'semi';
  }

  ambientNodesList.push({
    x3d,
    y3d,
    z3d,
    radius: activeType === 'critical' ? 3.5 : activeType === 'semi' ? 2 : 1.2,
    speedY: (0.0003 + Math.random() * 0.0004) * (Math.random() > 0.5 ? 1 : -1),
    speedX: (0.0001 + Math.random() * 0.0003) * (Math.random() > 0.5 ? 1 : -1),
    activeType
  });
}

export default function AiSecurityVisualizer({ simState, setSimState }: AiSecurityVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [animStatus, setAnimStatus] = useState<'idle' | 'scanning' | 'alert' | 'approved' | 'remediating' | 'secured'>('idle');
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  const [nodes, setNodes] = useState<Node3D[]>([
    { id: 'core', name: 'SentraAI Core', type: 'core', x3d: 0, y3d: 0, z3d: 0, x2d: 0, y2d: 0, scale2d: 1, status: 'clean', details: 'Remediation Core Active' },
    { id: 's3', name: 'aws_s3_bucket.logs', type: 's3', x3d: -130, y3d: -85, z3d: -55, x2d: 0, y2d: 0, scale2d: 1, status: 'clean', details: 'acl = "public-read"' },
    { id: 'rds', name: 'aws_db_instance.prod', type: 'rds', x3d: 130, y3d: -75, z3d: 55, x2d: 0, y2d: 0, scale2d: 1, status: 'clean', details: 'storage_encrypted = false' },
    { id: 'sg', name: 'aws_security_group.ssh', type: 'sg', x3d: -105, y3d: 85, z3d: 85, x2d: 0, y2d: 0, scale2d: 1, status: 'clean', details: 'cidr_blocks = ["0.0.0.0/0"]' },
    { id: 'iam', name: 'aws_iam_policy.wildcard', type: 'iam', x3d: 105, y3d: 75, z3d: -85, x2d: 0, y2d: 0, scale2d: 1, status: 'clean', details: 'action = "*"' }
  ]);

  const [connections] = useState<Connection[]>([
    { from: 'core', to: 's3', status: 'active' },
    { from: 'core', to: 'rds', status: 'active' },
    { from: 'core', to: 'sg', status: 'active' },
    { from: 'core', to: 'iam', status: 'active' },
    { from: 's3', to: 'rds', status: 'active' },
    { from: 'sg', to: 'iam', status: 'active' }
  ]);

  const ambientNodes = useRef<AmbientNode[]>(ambientNodesList);

  // Sync internal animStatus with lifted simState prop
  useEffect(() => {
    if (simState === 'idle') setAnimStatus('idle');
    else if (simState === 'scanning') setAnimStatus('scanning');
    else if (simState === 'highlighted' || simState === 'expand' || simState === 'ast_isolation') setAnimStatus('alert');
    else if (simState === 'remediating' || simState === 'remediated') setAnimStatus('remediating');
    else if (simState === 'pr_opened') setAnimStatus('approved');
    else if (simState === 'pr_approved') setAnimStatus('remediating');
    else if (simState === 'pr_merged') setAnimStatus('secured');
  }, [simState]);

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
    if (simState !== 'idle' && simState !== 'pr_merged') return;
    setSimState('scanning');
  };

  const approveFix = async () => {
    if (simState !== 'pr_opened') return;
    setSimState('pr_approved');
  };

  const resetAll = () => {
    setSimState('idle');
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left - canvas.width / 2;
    const y = e.clientY - rect.top - canvas.height / 2;
    mouseRef.current.targetX = x * 0.12; 
    mouseRef.current.targetY = y * 0.12;
  };

  const handleMouseLeave = () => {
    mouseRef.current.targetX = 0;
    mouseRef.current.targetY = 0;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let rotationAngleY = 0.0012; 
    let rotationAngleX = 0.0006; 
    let scanLineY = -50;
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

    const perspective = 340;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    const render = () => {
      ctx.fillStyle = 'rgba(3, 3, 5, 0.22)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.06;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.06;

      const radY = mouseRef.current.x * 0.012;
      const radX = mouseRef.current.y * 0.012;

      const projectPoint = (x3d: number, y3d: number, z3d: number) => {
        let xRot = x3d * Math.cos(radY) - z3d * Math.sin(radY);
        let zRot = x3d * Math.sin(radY) + z3d * Math.cos(radY);
        let yRot = y3d * Math.cos(radX) - zRot * Math.sin(radX);
        let zProj = y3d * Math.sin(radX) + zRot * Math.cos(radX);

        const scale = perspective / (perspective + zProj + 140);
        return {
          x: centerX + xRot * scale,
          y: centerY + yRot * scale,
          scale,
          zProj
        };
      };

      const cloudRings = [
        { radius: 140, color: 'rgba(99, 102, 241, 0.05)', label: 'AWS VPC' },
        { radius: 210, color: 'rgba(59, 130, 246, 0.03)', label: 'GCP Project' },
        { radius: 280, color: 'rgba(16, 185, 129, 0.02)', label: 'Azure Tenant' }
      ];

      cloudRings.forEach(ring => {
        ctx.strokeStyle = ring.color;
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 10]);
        ctx.beginPath();
        
        for (let a = 0; a <= Math.PI * 2; a += 0.1) {
          const pt = projectPoint(ring.radius * Math.cos(a), 40, ring.radius * Math.sin(a));
          if (a === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
        ctx.closePath();
        ctx.stroke();
        ctx.setLineDash([]);
      });

      ambientNodes.current.forEach(an => {
        const cosY = Math.cos(an.speedY);
        const sinY = Math.sin(an.speedY);
        let x1 = an.x3d * cosY - an.z3d * sinY;
        let z1 = an.x3d * sinY + an.z3d * cosY;

        const cosX = Math.cos(an.speedX);
        const sinX = Math.sin(an.speedX);
        let y2 = an.y3d * cosX - z1 * sinX;
        let z2 = an.y3d * sinX + z1 * cosX;

        an.x3d = x1;
        an.y3d = y2;
        an.z3d = z2;

        const pt = projectPoint(an.x3d, an.y3d, an.z3d);

        let color = 'rgba(255, 255, 255, 0.03)';
        if (an.activeType === 'semi') {
          color = 'rgba(99, 102, 241, 0.15)';
        } else if (an.activeType === 'critical') {
          color = animStatus === 'alert' ? 'rgba(239, 68, 68, 0.35)' : 'rgba(255, 255, 255, 0.08)';
        }

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, an.radius * pt.scale, 0, Math.PI * 2);
        ctx.fill();
      });

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.008)';
      ctx.lineWidth = 0.5;
      for (let i = 0; i < ambientNodes.current.length; i += 3) {
        const pt1 = projectPoint(ambientNodes.current[i].x3d, ambientNodes.current[i].y3d, ambientNodes.current[i].z3d);
        for (let j = i + 1; j < Math.min(i + 4, ambientNodes.current.length); j++) {
          const pt2 = projectPoint(ambientNodes.current[j].x3d, ambientNodes.current[j].y3d, ambientNodes.current[j].z3d);
          const dist = Math.hypot(pt1.x - pt2.x, pt1.y - pt2.y);
          if (dist < 80) {
            ctx.beginPath();
            ctx.moveTo(pt1.x, pt1.y);
            ctx.lineTo(pt2.x, pt2.y);
            ctx.stroke();
          }
        }
      }

      const cosY = Math.cos(rotationAngleY);
      const sinY = Math.sin(rotationAngleY);
      const cosX = Math.cos(rotationAngleX);
      const sinX = Math.sin(rotationAngleX);

      setNodes(prevNodes => {
        return prevNodes.map(node => {
          if (node.id === 'core') {
            return {
              ...node,
              x2d: centerX + mouseRef.current.x,
              y2d: centerY + mouseRef.current.y,
              scale2d: 1
            };
          }

          let x1 = node.x3d * cosY - node.z3d * sinY;
          let z1 = node.x3d * sinY + node.z3d * cosY;
          let y2 = node.y3d * cosX - z1 * sinX;
          let z2 = node.y3d * sinX + z1 * cosX;

          const pt = projectPoint(x1, y2, z2);

          return {
            ...node,
            x3d: x1,
            y3d: y2,
            z3d: z2,
            x2d: pt.x,
            y2d: pt.y,
            scale2d: pt.scale
          };
        });
      });

      if (animStatus === 'scanning') {
        scanLineY += 3.5;
        if (scanLineY > canvas.height + 40) {
          scanLineY = -40;
        }

        const grad = ctx.createLinearGradient(0, scanLineY - 15, 0, scanLineY + 15);
        grad.addColorStop(0, 'rgba(99, 102, 241, 0)');
        grad.addColorStop(0.5, 'rgba(99, 102, 241, 0.28)');
        grad.addColorStop(1, 'rgba(99, 102, 241, 0)');

        ctx.fillStyle = grad;
        ctx.fillRect(0, scanLineY - 15, canvas.width, 30);

        ctx.strokeStyle = 'rgba(99, 102, 241, 0.75)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, scanLineY);
        ctx.lineTo(canvas.width, scanLineY);
        ctx.stroke();
      }

      const sortedNodes = [...nodes].sort((a, b) => b.z3d - a.z3d);

      connections.forEach(conn => {
        const fromNode = nodes.find(n => n.id === conn.from);
        const toNode = nodes.find(n => n.id === conn.to);
        if (!fromNode || !toNode) return;

        let strokeColor = 'rgba(255, 255, 255, 0.05)';
        let lineWidth = 1;

        const depthScale = (fromNode.scale2d + toNode.scale2d) / 2;

        if (animStatus === 'remediating' && (toNode.id === 's3' || toNode.id === 'rds') && fromNode.id === 'core') {
          strokeColor = `rgba(16, 185, 129, ${0.45 * depthScale})`;
          lineWidth = 3 * depthScale;
        } else if (animStatus === 'secured' && (toNode.id === 's3' || toNode.id === 'rds') && fromNode.id === 'core') {
          strokeColor = `rgba(16, 185, 129, ${0.2 * depthScale})`;
          lineWidth = 1.5 * depthScale;
        } else if ((animStatus === 'alert' || animStatus === 'approved') && (toNode.id === 's3' || toNode.id === 'rds') && fromNode.id === 'core') {
          const glowAmp = 0.35 + Math.sin(Date.now() * 0.01) * 0.15;
          strokeColor = `rgba(239, 68, 68, ${glowAmp * depthScale})`;
          lineWidth = 2.2 * depthScale;
        } else {
          strokeColor = `rgba(255, 255, 255, ${0.06 * depthScale})`;
        }

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        ctx.moveTo(fromNode.x2d, fromNode.y2d);
        ctx.lineTo(toNode.x2d, toNode.y2d);
        ctx.stroke();

        if ((animStatus === 'alert' || animStatus === 'approved') && fromNode.id === 'core' && (toNode.id === 's3' || toNode.id === 'rds')) {
          pulseProgress = (pulseProgress + 0.008) % 1;
          const pX = fromNode.x2d + (toNode.x2d - fromNode.x2d) * pulseProgress;
          const pY = fromNode.y2d + (toNode.y2d - fromNode.y2d) * pulseProgress;

          ctx.fillStyle = '#ef4444';
          ctx.shadowColor = '#ef4444';
          ctx.shadowBlur = 10;
          ctx.beginPath();
          ctx.arc(pX, pY, 3.5 * depthScale, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }

        if (animStatus === 'remediating' && fromNode.id === 'core' && (toNode.id === 's3' || toNode.id === 'rds')) {
          pulseProgress = (pulseProgress + 0.006) % 1;
          const pX = fromNode.x2d + (toNode.x2d - fromNode.x2d) * pulseProgress;
          const pY = fromNode.y2d + (toNode.y2d - fromNode.y2d) * pulseProgress;

          ctx.fillStyle = '#10b981';
          ctx.shadowColor = '#10b981';
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.arc(pX, pY, 4 * depthScale, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      });

      if (Math.random() < 0.12 && (animStatus === 'remediating' || animStatus === 'scanning' || animStatus === 'idle')) {
        const conn = connections[Math.floor(Math.random() * connections.length)];
        const fromNode = nodes.find(n => n.id === conn.from);
        const toNode = nodes.find(n => n.id === conn.to);

        if (fromNode && toNode) {
          let pColor = 'rgba(99, 102, 241, 0.4)';
          if (animStatus === 'remediating' && (toNode.id === 's3' || toNode.id === 'rds')) {
            pColor = '#10b981';
          }
          particles.push({
            x: fromNode.x2d,
            y: fromNode.y2d,
            z: fromNode.z3d,
            speed: 0.007 + Math.random() * 0.01,
            progress: 0,
            fromNode: fromNode.id,
            toNode: toNode.id,
            color: pColor
          });
        }
      }

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
          glowColor = 'rgba(239, 68, 68, 0.22)';
          outerRingSpeed = 0.025;
        } else if (node.status === 'remediating') {
          baseColor = '#3b82f6';
          glowColor = 'rgba(59, 130, 246, 0.32)';
          outerRingSpeed = 0.04;
        } else if (node.status === 'secured') {
          baseColor = '#10b981';
          glowColor = 'rgba(16, 185, 129, 0.22)';
          outerRingSpeed = 0.008;
        }

        const radius = node.type === 'core' ? 22 * node.scale2d : 13 * node.scale2d;
        const alpha = Math.min(1, Math.max(0.28, node.scale2d));
        ctx.globalAlpha = alpha;

        if ((node.status === 'remediating' || node.status === 'secured' || node.status === 'vulnerable') && node.id !== 'core') {
          const sphereRadius = radius * (1.8 + Math.sin(Date.now() * 0.005) * 0.15);
          const sphereColor = 
            node.status === 'vulnerable' ? 'rgba(239, 68, 68, 0.05)' :
            node.status === 'remediating' ? 'rgba(59, 130, 246, 0.08)' :
            'rgba(16, 185, 129, 0.06)';
          
          const sphereBorder = 
            node.status === 'vulnerable' ? 'rgba(239, 68, 68, 0.15)' :
            node.status === 'remediating' ? 'rgba(59, 130, 246, 0.25)' :
            'rgba(16, 185, 129, 0.2)';

          ctx.strokeStyle = sphereBorder;
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 4]);
          ctx.beginPath();
          ctx.arc(node.x2d, node.y2d, sphereRadius, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          
          ctx.fillStyle = sphereColor;
          ctx.beginPath();
          ctx.arc(node.x2d, node.y2d, sphereRadius, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.shadowColor = baseColor;
        ctx.shadowBlur = (animStatus === 'remediating' || node.status === 'vulnerable') ? (14 + Math.sin(Date.now() * 0.005) * 4) * node.scale2d : 6 * node.scale2d;

        ctx.fillStyle = glowColor;
        ctx.beginPath();
        ctx.arc(node.x2d, node.y2d, radius + 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.shadowBlur = 0;

        ctx.strokeStyle = baseColor;
        ctx.lineWidth = 1.8 * node.scale2d;
        ctx.beginPath();
        ctx.arc(node.x2d, node.y2d, radius, 0, Math.PI * 2);
        ctx.stroke();

        if (outerRingSpeed > 0 || node.type === 'core') {
          const rotationAngle = (Date.now() * (outerRingSpeed || 0.004)) % (Math.PI * 2);
          ctx.strokeStyle = baseColor;
          ctx.lineWidth = 1 * node.scale2d;

          ctx.beginPath();
          ctx.arc(node.x2d, node.y2d, radius + 6, rotationAngle, rotationAngle + Math.PI * 0.35);
          ctx.stroke();

          ctx.beginPath();
          ctx.arc(node.x2d, node.y2d, radius + 6, rotationAngle + Math.PI, rotationAngle + Math.PI * 1.35);
          ctx.stroke();
        }

        ctx.fillStyle = baseColor;
        ctx.beginPath();
        ctx.arc(node.x2d, node.y2d, 3.8 * node.scale2d, 0, Math.PI * 2);
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
          {simState === 'idle' && (
            <button 
              onClick={startSimulation}
              className="btn btn-primary"
              style={{ padding: '0.35rem 0.85rem', fontSize: '0.75rem' }}
            >
              <Play size={12} /> Trigger Security Scan
            </button>
          )}
          {simState === 'pr_opened' && (
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
              <GitPullRequest size={12} /> Approve PR Fix
            </button>
          )}
          {(simState === 'pr_merged' || simState === 'scanning' || simState === 'pr_approved' || simState === 'remediating') && (
            <button 
              onClick={resetAll}
              className="btn btn-secondary"
              style={{ padding: '0.35rem 0.85rem', fontSize: '0.75rem' }}
              disabled={simState === 'scanning' || simState === 'remediating' || simState === 'pr_approved'}
            >
              <RefreshCw size={12} className={simState === 'scanning' || simState === 'remediating' ? 'spin' : ''} /> Reset Node State
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

          {/* AI Trust Instrumentation Metrics */}
          <div className="metrics-card-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
            <div className="metric-item" style={{ padding: '0.4rem' }}>
              <span className="metric-item-label" style={{ fontSize: '0.5rem' }}>AST Containment</span>
              <span className="metric-item-value" style={{ fontSize: '0.75rem', color: animStatus === 'idle' ? 'var(--text-muted)' : 'var(--success)' }}>
                {animStatus === 'idle' ? '0.0%' : '99.8%'}
              </span>
            </div>
            <div className="metric-item" style={{ padding: '0.4rem' }}>
              <span className="metric-item-label" style={{ fontSize: '0.5rem' }}>Remediation Trust</span>
              <span className="metric-item-value" style={{ fontSize: '0.75rem', color: animStatus === 'idle' ? 'var(--text-muted)' : 'var(--success)' }}>
                {animStatus === 'idle' ? '0.0' : '98.2'}
              </span>
            </div>
            <div className="metric-item" style={{ padding: '0.4rem' }}>
              <span className="metric-item-label" style={{ fontSize: '0.5rem' }}>Blast Radius</span>
              <span className="metric-item-value" style={{ fontSize: '0.75rem', color: animStatus === 'alert' ? 'var(--error)' : animStatus === 'idle' ? 'var(--text-muted)' : 'var(--success)' }}>
                {animStatus === 'idle' ? 'STANDBY' : animStatus === 'alert' ? 'EXPANDING' : '0 SIBLING NODES'}
              </span>
            </div>
            <div className="metric-item" style={{ padding: '0.4rem' }}>
              <span className="metric-item-label" style={{ fontSize: '0.5rem' }}>Compliance Health</span>
              <span className="metric-item-value" style={{ fontSize: '0.75rem', color: animStatus === 'alert' ? 'var(--error)' : animStatus === 'idle' ? 'var(--text-muted)' : 'var(--success)' }}>
                {animStatus === 'idle' ? '100%' : animStatus === 'alert' ? '24% EXPOSED' : '100% SECURE'}
              </span>
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
              <span style={{ color: '#f87171' }}>🚨 **Awaiting Approval**: Found exposures. Click **Approve PR Fix** or comment `/approve` to authorize.</span>
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
