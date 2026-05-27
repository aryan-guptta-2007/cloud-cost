import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Shield, 
  Terminal, 
  Cpu, 
  Play, 
  CheckCircle, 
  AlertTriangle,
  GitPullRequest,
  Sparkles
} from 'lucide-react';

interface PrebuiltScenario {
  id: string;
  name: string;
  rule: string;
  safetyTier: 'SAFE' | 'REVIEW_REQUIRED' | 'NONE';
  description: string;
  code: string;
  remediedCode: string;
  findingDetails: string;
  astExplain: string;
}

const PREBUILT_SCENARIOS: PrebuiltScenario[] = [
  {
    id: 's3',
    name: 'S3 Public Bucket ACL',
    rule: 'AWS_S3_PUBLIC',
    safetyTier: 'SAFE',
    description: 'S3 buckets exposed to the public internet via public-read ACLs represent the most common source of cloud data leaks.',
    code: `resource "aws_s3_bucket" "logs_bucket" {
  bucket = "sentra-data-logs-prod"
  acl    = "public-read"  # EXPOSES LOGS TO WIDE INTERNET
  force_destroy = true
}`,
    remediedCode: `resource "aws_s3_bucket" "logs_bucket" {
  bucket = "sentra-data-logs-prod"
  acl    = "private"  # REMEDIATED: PRIVATE ACL ENFORCED
  force_destroy = true
}`,
    findingDetails: '🚨 CRITICAL Finding: Public S3 ACL detected on main.tf:L3. Restrict ACL to private.',
    astExplain: 'AST Guard restricts updates solely to the "acl" attribute of resource "aws_s3_bucket.logs_bucket". All sibling resources remain untouched.'
  },
  {
    id: 'rds',
    name: 'RDS Storage Encryption',
    rule: 'AWS_DB_UNENCRYPTED',
    safetyTier: 'SAFE',
    description: 'Database storage encryption is required under compliance standards. Unencrypted volumes risk block storage data leakage.',
    code: `resource "aws_db_instance" "prod_database" {
  instance_class    = "db.t3.micro"
  engine            = "postgres"
  storage_encrypted = false  # INSECURE: STORAGE BLOCK PLAINTEXT
}`,
    remediedCode: `resource "aws_db_instance" "prod_database" {
  instance_class    = "db.t3.micro"
  engine            = "postgres"
  storage_encrypted = true   # REMEDIATED: ENCRYPTION ENABLED
}`,
    findingDetails: '🚨 HIGH Finding: Storage Encryption is disabled on database.tf:L4. Set storage_encrypted to true.',
    astExplain: 'AST Guard targets resource "aws_db_instance.prod_database" block, modifying only "storage_encrypted". All other db settings remain locked.'
  },
  {
    id: 'sg',
    name: 'Open Security Group SSH',
    rule: 'AWS_SG_OPEN',
    safetyTier: 'REVIEW_REQUIRED',
    description: 'Allowing SSH access (port 22) from any IP address (0.0.0.0/0) exposes your instances to global brute-force attacks.',
    code: `resource "aws_security_group" "ssh_sg" {
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"] # EXPOSES PORT 22 TO THE WORLD
  }
}`,
    remediedCode: `resource "aws_security_group" "ssh_sg" {
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["YOUR_TRUSTED_IP_RANGE"] # GATED TO SECURED NETWORKS
  }
}`,
    findingDetails: '⚠️ WARNING Finding: SG exposes Port 22 to 0.0.0.0/0 on security_groups.tf:L6. Restrict ingress access range.',
    astExplain: 'AST Guard isolates the "ingress" subnet array. Because this requires network-specific parameters, SentraAI tags the change for Review.'
  },
  {
    id: 'iam',
    name: 'Wildcard IAM Permissions',
    rule: 'AWS_IAM_WILDCARD',
    safetyTier: 'NONE',
    description: 'Wildcard policies allow arbitrary API actions, violating the principle of least privilege and risking container escalation.',
    code: `resource "aws_iam_policy" "wildcard_policy" {
  policy = jsonencode({
    Statement = [{
      Effect   = "Allow"
      Action   = "*" # EXTREME RISK: ADMINISTRATIVE ACCESS
      Resource = "*"
    }]
  })
}`,
    remediedCode: `# NO AUTOMATED REMEDIATION APPLIED.
# IAM policies containing wildcard actions cannot be refactored.
# Policy Restraint: Automated changes could cause backend service authorization failure.`,
    findingDetails: '🚨 CRITICAL Finding: Wildcard IAM Administrative action detected on policies.tf:L5.',
    astExplain: 'SentraAI Gated Governance: Policy engine refuses automated fix. Manual review required.'
  }
];

const TIMELINE_STEPS = [
  { id: 'detect', label: 'DETECT', desc: 'Identify vulnerability' },
  { id: 'expand', label: 'EXPAND', desc: 'Assess threat path' },
  { id: 'isolate', label: 'ISOLATE', desc: 'Isolate AST node' },
  { id: 'synthesize', label: 'SYNTHESIZE', desc: 'Generate HCL patch' },
  { id: 'policy', label: 'POLICY', desc: 'Run 3-Layer checks' },
  { id: 'review', label: 'REVIEW', desc: 'Open GitOps PR' },
  { id: 'authorize', label: 'AUTHORIZE', desc: 'Human Approval' },
  { id: 'resolved', label: 'RESOLVED', desc: 'Merge & Stabilize' }
];

export default function LiveRemediationSimulator() {
  const [activeTab, setActiveTab] = useState<string>('s3');
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);
  const [customCode, setCustomCode] = useState<string>('');
  
  // Simulation Flow States: 'idle' | 'scanning' | 'highlighted' | 'expand' | 'ast_isolation' | 'remediating' | 'remediated' | 'pr_opened' | 'pr_approved' | 'pr_merged'
  const [simState, setSimState] = useState<string>('idle');
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [inputVal, setInputVal] = useState<string>('');

  const currentScenario = PREBUILT_SCENARIOS.find(s => s.id === activeTab) || PREBUILT_SCENARIOS[0];

  const getTimelineStepIndex = (state: string) => {
    switch (state) {
      case 'scanning':
      case 'highlighted':
        return 0; // DETECT
      case 'expand':
        return 1; // EXPAND
      case 'ast_isolation':
        return 2; // ISOLATE
      case 'remediating':
        return 3; // SYNTHESIZE
      case 'remediated':
        return 4; // POLICY
      case 'pr_opened':
        return 5; // REVIEW
      case 'pr_approved':
        return 6; // AUTHORIZE
      case 'pr_merged':
        return 7; // RESOLVED
      default:
        return -1; // IDLE
    }
  };

  const currentStepIdx = getTimelineStepIndex(simState);

  const getSourceCode = () => {
    if (isCustomMode) return customCode;
    return currentScenario.code;
  };

  const getTargetRemediationCode = () => {
    if (isCustomMode) {
      if (customCode.includes('aws_s3_bucket') && customCode.includes('public-read')) {
        return `resource "aws_s3_bucket" "custom_bucket" {\n  bucket = "custom-secure-data"\n  acl    = "private"  # REMEDIATED: PRIVATE ACL ENFORCED\n}`;
      }
      if (customCode.includes('aws_db_instance') && customCode.includes('false')) {
        return `resource "aws_db_instance" "custom_db" {\n  engine            = "postgres"\n  storage_encrypted = true   # REMEDIATED: ENCRYPTION ENABLED\n}`;
      }
      return `# GOVERNANCE MANUAL REVIEW TRIGGERED.\n# SentraAI Gated Refusal: This custom configuration pattern requires manual human verification.\n# Rationale: AST node structure is context-dependent and cannot be modified safely without drift confirmation.`;
    }
    return currentScenario.remediedCode;
  };

  const startSimulator = async () => {
    setSimState('scanning');
    setTerminalLogs([
      '[SYSTEM] Initializing scan pipeline...',
      '[SCANNER] Parsing HCL text block in-memory...',
      '[SCANNER] Checking rules registry...'
    ]);

    await new Promise(r => setTimeout(r, 1200));
    setSimState('highlighted');
    
    if (isCustomMode && !customCode.includes('aws_s3_bucket') && !customCode.includes('aws_db_instance')) {
      setTerminalLogs(prev => [
        ...prev,
        '[WARNING] Unrecognized custom infrastructure signature detected.',
        '[RESTRICTION] SentraAI Gated Governance Refusal: Manual review required.',
        '👉 Visualizing AST Refusal bounds.'
      ]);
      setSimState('ast_isolation');
      return;
    }

    setTerminalLogs(prev => [
      ...prev,
      isCustomMode ? '[ALERT] Identified vulnerability in custom config.' : `[ALERT] Identified vulnerability: ${currentScenario.rule} (CRITICAL)`,
      `  -> Location: ${isCustomMode ? 'custom_config.tf' : currentScenario.findingDetails}`,
      '👉 Assessing attack pathways & downstream propagation...'
    ]);

    // Stage 2: EXPAND (Assess threat path)
    await new Promise(r => setTimeout(r, 1200));
    setSimState('expand');
    setTerminalLogs(prev => [
      ...prev,
      '[SCANNER] Evaluating infrastructure network pathways...',
      `[ALERT] Potential attack path discovered: [Public Internet] -> [${isCustomMode ? 'custom_bucket' : currentScenario.id}] -> [aws_db_instance.prod]`,
      '⚠️ Downstream block storage breach vector active.',
      '👉 Isolating AST resource boundaries...'
    ]);

    // Stage 3: ISOLATE (Isolate AST node)
    await new Promise(r => setTimeout(r, 1200));
    setSimState('ast_isolation');
    setTerminalLogs(prev => [
      ...prev,
      '[AST] AST Isolation Guard: Isolated resource boundaries.',
      '  - Locked: Sibling configuration variables locked.',
      '  - Isolated: Attribute mutation zone targeted.',
      '👉 Initiating HCL patch generation...'
    ]);

    if (!isCustomMode && currentScenario.safetyTier === 'NONE') {
      // IAM Refused flow
      await new Promise(r => setTimeout(r, 1500));
      setTerminalLogs(prev => [
        ...prev,
        '[RESTRICTION] Fix safety classification: NONE.',
        '[RESTRICTION] Remediation refused. Manual code review requested.',
        '  - Reason: Wildcard privileges could cause microservice credentials failure.'
      ]);
      return;
    }

    // Stage 4: SYNTHESIZE (Generate HCL patch)
    await new Promise(r => setTimeout(r, 1500));
    setSimState('remediating');
    setTerminalLogs(prev => [
      ...prev,
      '[AI] Synthesizing remediation HCL block...',
      '[AI] Code patch refactoring complete.',
      '👉 Dispatching to 3-Layer Validation checks...'
    ]);

    // Stage 5: POLICY (Run 3-Layer checks)
    await new Promise(r => setTimeout(r, 1500));
    setSimState('remediated');
    setTerminalLogs(prev => [
      ...prev,
      '[VALIDATION] Initiating 3-Layer checks:',
      '  -> Layer 1: HCL Syntax... PASSED ✅',
      '  -> Layer 2: CLI Validate... PASSED ✅',
      '  -> Layer 3: AST Boundary... PASSED ✅',
      '[MUTATION] Code patch prepared and signed (SHA256 verified).',
      '👉 Ready to open GitHub Pull Request.'
    ]);
  };

  const openPR = async () => {
    // Stage 6: REVIEW (Open GitOps PR)
    setSimState('pr_opened');
    setTerminalLogs(prev => [
      ...prev,
      '[PR] Dispatching GitHub Pull Request API...',
      '[PR] Branch sentraai/fix/iac opened on remote.',
      '[PR] Pull Request #115 opened successfully!',
      '👉 Awaiting reviewer confirmation & final human authorization...'
    ]);
  };

  const handleApproveCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputVal.trim().toLowerCase() !== '/approve') return;
    setInputVal('');
    
    // Stage 7: AUTHORIZE (Human Approval)
    setSimState('pr_approved');
    setTerminalLogs(prev => [
      ...prev,
      '[GITOPS] Received comment reply: "/approve"',
      '[RBAC] Verifying actor AryanGupta (Owner)... AUTHORIZED ✅',
      '[HASH] Verifying Dry-run Preview Hash... MATCHED ✅',
      '[MUTATION] Validation checks verified. Dispatching Git Merge API...'
    ]);

    // Stage 8: RESOLVED (Merge & Stabilize)
    await new Promise(r => setTimeout(r, 1500));
    setSimState('pr_merged');
    setTerminalLogs(prev => [
      ...prev,
      '[SUCCESS] Pull Request #115 merged into main branch.',
      '[SYSTEM] SentraAI: Cloud state is SECURED. Operational standby.'
    ]);
  };

  const handleScenarioChange = (id: string) => {
    setIsCustomMode(false);
    setActiveTab(id);
    setSimState('idle');
    setTerminalLogs([]);
  };

  const handleCustomModeEnable = () => {
    setIsCustomMode(true);
    setActiveTab('custom');
    setCustomCode(`resource "aws_s3_bucket" "custom_bucket" {
  bucket = "sentra-unsecured-bucket"
  acl    = "public-read"
}`);
    setSimState('idle');
    setTerminalLogs([]);
  };

  return (
    <section className="simulator-section" id="demo-section">
      <div className="section-header">
        <div className="hero-tag" style={{ margin: '0 auto 0.75rem auto' }}>
          <Sparkles size={12} />
          <span>Interactive Simulation Console</span>
        </div>
        <h2>Living Remediation Simulator</h2>
        <p style={{ color: 'var(--text-secondary)' }}>
          Scan, isolate, and remediate cloud configuration vulnerabilities live. See how our 3-Layer validation prevents pipeline mutations.
        </p>
      </div>

      <div className="simulator-frame">
        {/* Step-by-Step Threat Storytelling Timeline HUD */}
        <div style={{ 
          gridColumn: '1 / -1', 
          display: 'flex', 
          justifyContent: 'space-between', 
          background: 'rgba(3, 3, 4, 0.6)', 
          border: '1px solid rgba(255, 255, 255, 0.05)', 
          borderRadius: '12px', 
          padding: '1rem 1.5rem', 
          marginBottom: '0.5rem',
          overflowX: 'auto',
          gap: '1rem',
          backdropFilter: 'blur(8px)'
        }}>
          {TIMELINE_STEPS.map((step, idx) => {
            const isActive = currentStepIdx === idx;
            const isCompleted = currentStepIdx > idx;
            return (
              <div key={step.id} style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                flex: 1, 
                minWidth: '90px',
                opacity: isActive ? 1 : isCompleted ? 0.75 : 0.25,
                transition: 'all 0.3s ease'
              }}>
                <div style={{ 
                  width: '26px', 
                  height: '26px', 
                  borderRadius: '50%', 
                  background: isActive ? 'var(--primary)' : isCompleted ? 'rgba(16, 185, 129, 0.1)' : 'transparent',
                  border: `2px solid ${isActive ? 'var(--primary)' : isCompleted ? 'var(--success)' : 'rgba(255,255,255,0.12)'}`,
                  color: isActive ? '#fff' : isCompleted ? 'var(--success)' : 'var(--text-muted)',
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  fontSize: '0.7rem',
                  fontWeight: '700',
                  boxShadow: isActive ? '0 0 15px rgba(99, 102, 241, 0.5)' : 'none'
                }}>
                  {isCompleted ? '✓' : idx + 1}
                </div>
                <span style={{ 
                  fontSize: '0.65rem', 
                  fontWeight: isActive ? 700 : 500, 
                  color: isActive ? '#fff' : isCompleted ? 'var(--success)' : 'var(--text-muted)',
                  marginTop: '0.4rem',
                  letterSpacing: '0.03em',
                  textAlign: 'center',
                  whiteSpace: 'nowrap'
                }}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Left Side: Code Editor HUD */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Tabs header */}
          <div style={{ display: 'flex', gap: '0.4rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.5rem', overflowX: 'auto' }}>
            {PREBUILT_SCENARIOS.map(s => (
              <button
                key={s.id}
                onClick={() => handleScenarioChange(s.id)}
                className={`btn ${!isCustomMode && activeTab === s.id ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.75rem', padding: '0.4rem 0.85rem' }}
              >
                {s.name}
              </button>
            ))}
            <button
              onClick={handleCustomModeEnable}
              className={`btn ${isCustomMode ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.75rem', padding: '0.4rem 0.85rem', background: isCustomMode ? 'var(--primary-gradient)' : 'rgba(255,255,255,0.02)' }}
            >
              Custom HCL Input
            </button>
          </div>

          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
            {isCustomMode ? 'Edit or paste your custom Terraform code below to test SentraAI’s AST-based isolation verification rules.' : currentScenario.description}
          </p>

          {/* Code Textarea/Viewer Panel */}
          <div className="code-container" style={{ position: 'relative' }}>
            <div className="code-header">
              <div className="code-dots">
                <span className="code-dot red"></span>
                <span className="code-dot yellow"></span>
                <span className="code-dot green"></span>
              </div>
              <span>{isCustomMode ? 'custom_config.tf' : `${currentScenario.id}_infra.tf`} (PR Branch)</span>
            </div>
            
            {/* Visual AST highlights and boundary overlays */}
            <div style={{ position: 'relative', background: '#0e0f14', padding: '1rem', overflow: 'hidden' }}>
              
              {simState === 'highlighted' && (
                <div className="ast-vulnerable-box">
                  <div className="ast-vulnerable-badge">Vulnerable AST Node</div>
                  <pre style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: '#ef4444' }}>
                    <code>{isCustomMode ? 'acl = "public-read"' : currentScenario.findingDetails}</code>
                  </pre>
                </div>
              )}

              {simState === 'ast_isolation' && (
                <div className="ast-isolation-box">
                  <div className="ast-isolation-badge">AST Isolation Boundary</div>
                  <pre style={{ margin: 0, fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: '#10b981' }}>
                    <code>{isCustomMode ? getTargetRemediationCode() : currentScenario.astExplain}</code>
                  </pre>
                </div>
              )}

              {simState !== 'highlighted' && simState !== 'ast_isolation' && (
                <textarea
                  value={getSourceCode()}
                  onChange={(e) => isCustomMode && setCustomCode(e.target.value)}
                  disabled={simState !== 'idle'}
                  style={{
                    width: '100%',
                    minHeight: '160px',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: '#e5e7eb',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.8rem',
                    resize: 'none',
                    lineHeight: '1.6'
                  }}
                />
              )}
            </div>
          </div>

          {/* Action trigger button */}
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            {simState === 'idle' && (
              <button onClick={startSimulator} className="btn btn-primary" style={{ flex: 1 }}>
                <Play size={14} /> Scan & Resolve IaC Vulnerability
              </button>
            )}

            {simState === 'remediated' && (
              <button onClick={openPR} className="btn btn-primary" style={{ flex: 1, background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
                <GitPullRequest size={14} /> Open Remediation Pull Request
              </button>
            )}

            {simState !== 'idle' && simState !== 'remediated' && (
              <button 
                onClick={() => { setSimState('idle'); setTerminalLogs([]); }} 
                className="btn btn-secondary" 
                style={{ flex: 1 }}
                disabled={simState === 'scanning' || simState === 'expand' || simState === 'remediating' || simState === 'pr_approved'}
              >
                Reset Simulator
              </button>
            )}
          </div>
        </div>

        {/* Right Side: Visual HUD Pipelines */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          
          {/* Operations terminal logs */}
          <div className="visualizer-terminal-panel" style={{ minHeight: '170px' }}>
            <div className="terminal-panel-header">
              <div className="terminal-header-title">
                <Terminal size={14} style={{ color: 'var(--primary)' }} />
                <span>SentraAI OS Pipeline logs</span>
              </div>
              <div className="terminal-header-dots">
                <span className="terminal-header-dot"></span>
                <span className="terminal-header-dot"></span>
                <span className="terminal-header-dot"></span>
              </div>
            </div>
            <div className="terminal-logs-content" style={{ maxHeight: '200px', overflowY: 'auto' }}>
              {terminalLogs.length > 0 ? (
                terminalLogs.map((log, i) => (
                  <div 
                    key={i} 
                    className={`terminal-log-line ${
                      log.includes('🔴') || log.includes('[ALERT]') ? 'alert' :
                      log.includes('⚠️') || log.includes('[WARNING]') ? 'warning' :
                      log.includes('✅') || log.includes('[SUCCESS]') ? 'success' :
                      log.includes('[MUTATION]') || log.includes('[AST]') ? 'mutation' : ''
                    }`}
                  >
                    {log}
                  </div>
                ))
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Pipeline standby. Trigger scan to run.</div>
              )}
            </div>
          </div>

          {/* Layered Interactive UI State Cards */}
          <AnimatePresence mode="wait">
            {/* 1. Scanning State indicator */}
            {simState === 'scanning' && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="holographic-card"
                style={{ borderLeft: '4px solid var(--primary)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Cpu className="spin" size={20} style={{ color: 'var(--primary)' }} />
                  <div>
                    <h4 style={{ fontSize: '0.85rem' }}>AST Code Scanner actively running...</h4>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Parsing Terraform structural semantics blocks.</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* 2. Downstream Expand path */}
            {simState === 'expand' && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="holographic-card"
                style={{ borderLeft: '4px solid var(--warning)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <AlertTriangle size={20} style={{ color: 'var(--warning)' }} />
                  <div>
                    <h4 style={{ fontSize: '0.85rem' }}>Evaluating Downstream Threat Path...</h4>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Identifying cloud nodes impacted by this vulnerability exposure.</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* 3. Vulnerability Highlighted State */}
            {simState === 'highlighted' && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="holographic-card"
                style={{ borderLeft: '4px solid var(--error)' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                  <AlertTriangle size={20} style={{ color: 'var(--error)' }} />
                  <div>
                    <h4 style={{ fontSize: '0.85rem', color: '#ffffff' }}>Vulnerability Identified ({isCustomMode ? 'CUSTOM' : currentScenario.rule})</h4>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Safety Governance Tier: {isCustomMode ? 'SAFE' : currentScenario.safetyTier}</p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* 4. AST Isolation verification */}
            {simState === 'ast_isolation' && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="holographic-card"
                style={{ borderLeft: '4px solid var(--success)' }}
              >
                <h4 style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.25rem' }}>
                  <Shield size={16} style={{ color: 'var(--success)' }} />
                  AST Bounding Box Verified
                </h4>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  {isCustomMode ? 'Analyzing isolated code nodes.' : currentScenario.astExplain}
                </p>
                
                {/* 3-Layer checklist simulation */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginTop: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem' }}>
                    <span>Layer 1: HCL Syntax</span>
                    <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>PASSED ✅</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem' }}>
                    <span>Layer 2: CLI Validate</span>
                    <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>PASSED ✅</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem' }}>
                    <span>Layer 3: AST Resource Boundary</span>
                    <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>PASSED ✅</span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* 5. Patch diff generated */}
            {simState === 'remediating' && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="code-container"
              >
                <div className="code-header">
                  <span>Remediation HCL Patch Diff Preview</span>
                </div>
                <div className="code-body" style={{ fontSize: '0.75rem', color: 'var(--success)' }}>
                  <pre style={{ margin: 0 }}>
                    {isCustomMode ? (
                      `+  acl = "private"`
                    ) : (
                      `+  ${currentScenario.remediedCode.split('\n')[2]?.trim() || ''}`
                    )}
                  </pre>
                </div>
              </motion.div>
            )}

            {/* 6. PR Opened / GitOps approval flow input (Collaborative comments) */}
            {(simState === 'pr_opened' || simState === 'pr_approved' || simState === 'pr_merged') && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="card"
                style={{ padding: '1rem', border: '1px solid rgba(99, 102, 241, 0.25)', background: 'rgba(8, 8, 12, 0.95)' }}
              >
                <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '0.5rem', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <GitPullRequest size={14} style={{ color: 'var(--primary)' }} />
                    <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Pull Request #115 (sentraai/remediate)</span>
                  </div>
                  <span className={`badge ${simState === 'pr_merged' ? 'badge-success' : 'badge-warning'}`} style={{ fontSize: '0.65rem' }}>
                    {simState === 'pr_merged' ? 'MERGED' : 'AWAITING APPROVAL'}
                  </span>
                </div>

                {/* Team Collaboration Comment Logs */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.75rem' }}>
                  
                  {/* Reviewers Badge Header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', fontSize: '0.6rem' }}>
                    <span style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>Reviewers:</span>
                    <span className="badge badge-success" style={{ fontSize: '0.55rem', padding: '0.1rem 0.3rem' }}>Compliance Bot: APPROVED ✅</span>
                    <span className="badge badge-success" style={{ fontSize: '0.55rem', padding: '0.1rem 0.3rem' }}>SecOps Sarah: APPROVED ✅</span>
                  </div>

                  {/* Comment 1: AI Compliance Bot */}
                  <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '6px', padding: '0.5rem' }}>
                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)', fontSize: '0.6rem', fontWeight: 'bold' }}>
                      AI
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.65rem', marginBottom: '0.15rem' }}>
                        <span style={{ fontWeight: 600, color: '#fff' }}>Compliance Bot (AI)</span>
                        <span style={{ color: 'var(--text-muted)' }}>12:14 PM</span>
                      </div>
                      <p style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.3' }}>
                        Isolated resource block AST nodes. Sibling configuration parameters are locked. Blast-radius containment check: <strong>SAFE</strong>.
                      </p>
                    </div>
                  </div>

                  {/* Comment 2: SecOps Lead Sarah */}
                  <div style={{ display: 'flex', gap: '0.5rem', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '6px', padding: '0.5rem' }}>
                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--success)', fontSize: '0.6rem', fontWeight: 'bold' }}>
                      SL
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.65rem', marginBottom: '0.15rem' }}>
                        <span style={{ fontWeight: 600, color: '#fff' }}>Sarah (SecOps Lead)</span>
                        <span style={{ color: 'var(--text-muted)' }}>12:15 PM</span>
                      </div>
                      <p style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', margin: 0, lineHeight: '1.3' }}>
                        AST boundary refactor diff looks clean. No unintended side effects found. Awaiting developer approval command.
                      </p>
                    </div>
                  </div>
                </div>

                {simState === 'pr_opened' && (
                  <form onSubmit={handleApproveCommand} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                      🔑 Type <code>/approve</code> in the comments below to merge the remediation patch.
                    </p>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <input 
                        type="text" 
                        placeholder="Reply comment..." 
                        value={inputVal} 
                        onChange={(e) => setInputVal(e.target.value)}
                        style={{
                          flex: 1,
                          background: 'rgba(0,0,0,0.3)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: '6px',
                          color: '#fff',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.75rem',
                          padding: '0.4rem'
                        }}
                      />
                      <button type="submit" className="btn btn-primary" style={{ padding: '0.4rem 1rem', fontSize: '0.75rem' }}>
                        Reply
                      </button>
                    </div>
                  </form>
                )}

                {simState === 'pr_approved' && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Cpu className="spin" size={12} />
                    <span>Verifying GitOps approval constraints...</span>
                  </div>
                )}

                {simState === 'pr_merged' && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <CheckCircle size={14} />
                    <span>Remediation PR Merged! AST changes committed.</span>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}
