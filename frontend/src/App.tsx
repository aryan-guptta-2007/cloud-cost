import { useState, useEffect } from 'react';
import { 
  Shield, 
  GitPullRequest, 
  CheckCircle2, 
  AlertTriangle, 
  Play, 
  Terminal, 
  Layers, 
  Database, 
  Lock, 
  RefreshCw, 
  TrendingUp, 
  Sparkles, 
  Clock, 
  User, 
  ChevronRight, 
  Info, 
  ExternalLink,
  Logs
} from 'lucide-react';

// Interface types
interface DashboardStats {
  total_scans: number;
  total_findings: number;
  total_suppressed: number;
  total_autofix_prs: number;
  total_gitops_approvals: number;
  avg_scan_time_seconds: number;
  estimated_hours_saved: number;
}

interface ScanLog {
  scan_id: string;
  repo_name: string;
  pr_number: number;
  head_sha: string;
  status: string;
  findings_count: number;
  suppressed_count: number;
  total_time: number;
  timestamp: string;
}

interface ApprovalLog {
  id: number;
  scan_id: string;
  repo_name: string;
  finding_id: string;
  actor: string;
  command: string;
  mode: string;
  pr_url: string;
  status: string;
  failure_reason: string;
  created_at: string;
}

interface AutofixLog {
  id: number;
  scan_id: string;
  repo_name: string;
  rule_id: string;
  file_path: string;
  branch_name: string;
  pr_url: string;
  pr_number: number;
  status: string;
  failure_reason: string;
  created_at: string;
}

// Fallback Mock Data for demo mode
const mockStats: DashboardStats = {
  total_scans: 148,
  total_findings: 24,
  total_suppressed: 12,
  total_autofix_prs: 18,
  total_gitops_approvals: 15,
  avg_scan_time_seconds: 0.42,
  estimated_hours_saved: 18.5
};

const mockScans: ScanLog[] = [
  {
    scan_id: "scan-9f93da18",
    repo_name: "sentra-corp/production-infra",
    pr_number: 114,
    head_sha: "4fba27d1",
    status: "COMPLETED",
    findings_count: 0,
    suppressed_count: 2,
    total_time: 0.38,
    timestamp: "2026-05-26 14:35:10"
  },
  {
    scan_id: "scan-4cfa5820",
    repo_name: "sentra-corp/production-infra",
    pr_number: 112,
    head_sha: "93df82ef",
    status: "COMPLETED",
    findings_count: 1,
    suppressed_count: 0,
    total_time: 0.45,
    timestamp: "2026-05-26 12:10:44"
  },
  {
    scan_id: "scan-bb41092a",
    repo_name: "sentra-corp/data-lake",
    pr_number: 89,
    head_sha: "d3fa9921",
    status: "COMPLETED",
    findings_count: 1,
    suppressed_count: 0,
    total_time: 0.51,
    timestamp: "2026-05-26 09:44:12"
  },
  {
    scan_id: "scan-ae3901bc",
    repo_name: "sentra-corp/s3-static-sites",
    pr_number: 45,
    head_sha: "c38ffda2",
    status: "PARTIAL",
    findings_count: 0,
    suppressed_count: 1,
    total_time: 0.22,
    timestamp: "2026-05-25 18:22:15"
  }
];

const mockApprovals: ApprovalLog[] = [
  {
    id: 1,
    scan_id: "scan-4cfa5820",
    repo_name: "sentra-corp/production-infra",
    finding_id: "AWS_S3_PUBLIC",
    actor: "AryanGupta",
    command: "/approve",
    mode: "approval_required",
    pr_url: "https://github.com/sentra-corp/production-infra/pull/113",
    status: "APPROVED",
    failure_reason: "",
    created_at: "2026-05-26 12:12:05"
  },
  {
    id: 2,
    scan_id: "scan-bb41092a",
    repo_name: "sentra-corp/data-lake",
    finding_id: "AWS_DB_UNENCRYPTED",
    actor: "sara-devops",
    command: "/approve",
    mode: "approval_required",
    pr_url: "https://github.com/sentra-corp/data-lake/pull/90",
    status: "APPROVED",
    failure_reason: "",
    created_at: "2026-05-26 09:46:18"
  },
  {
    id: 3,
    scan_id: "scan-4cfa5820",
    repo_name: "sentra-corp/production-infra",
    finding_id: "AWS_S3_PUBLIC",
    actor: "unauthorized-contributor",
    command: "/approve",
    mode: "approval_required",
    pr_url: "",
    status: "REJECTED",
    failure_reason: "Actor has no write permissions on the repository",
    created_at: "2026-05-26 12:11:15"
  },
  {
    id: 4,
    scan_id: "scan-ae3901bc",
    repo_name: "sentra-corp/s3-static-sites",
    finding_id: "AWS_S3_PUBLIC",
    actor: "AryanGupta",
    command: "/approve",
    mode: "approval_required",
    pr_url: "",
    status: "EXPIRED",
    failure_reason: "GitOps command timestamp exceeded the 24-hour limit",
    created_at: "2026-05-25 18:30:00"
  }
];

const mockAutofixes: AutofixLog[] = [
  {
    id: 1,
    scan_id: "scan-4cfa5820",
    repo_name: "sentra-corp/production-infra",
    rule_id: "AWS_S3_PUBLIC",
    file_path: "main.tf",
    branch_name: "sentraai/fix/aws-s3-public-4cfa5820",
    pr_url: "https://github.com/sentra-corp/production-infra/pull/113",
    pr_number: 113,
    status: "CREATED",
    failure_reason: "",
    created_at: "2026-05-26 12:12:05"
  },
  {
    id: 2,
    scan_id: "scan-bb41092a",
    repo_name: "sentra-corp/data-lake",
    rule_id: "AWS_DB_UNENCRYPTED",
    file_path: "database.tf",
    branch_name: "sentraai/fix/aws-db-unencrypted-bb41092a",
    pr_url: "https://github.com/sentra-corp/data-lake/pull/90",
    pr_number: 90,
    status: "CREATED",
    failure_reason: "",
    created_at: "2026-05-26 09:46:18"
  }
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'landing' | 'dashboard'>('landing');
  const [isLive, setIsLive] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  // Real or mock data states
  const [stats, setStats] = useState<DashboardStats>(mockStats);
  const [scans, setScans] = useState<ScanLog[]>(mockScans);
  const [approvals, setApprovals] = useState<ApprovalLog[]>(mockApprovals);
  const [autofixes, setAutofixes] = useState<AutofixLog[]>(mockAutofixes);
  
  // Config mode state
  const [selectedMode, setSelectedMode] = useState<string>("approval_required");

  // Simulator state
  const [simStep, setSimStep] = useState<number>(0);
  const [simActive, setSimActive] = useState<boolean>(false);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const [typedCommand, setTypedCommand] = useState<string>("");
  const [isTyping, setIsTyping] = useState<boolean>(false);

  // Fetch SQLite live data from local FastAPI backend
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const statsRes = await fetch('http://localhost:8000/api/stats');
      const scansRes = await fetch('http://localhost:8000/api/scans');
      const approvalsRes = await fetch('http://localhost:8000/api/approvals');
      const autofixesRes = await fetch('http://localhost:8000/api/autofixes');

      if (statsRes.ok && scansRes.ok && approvalsRes.ok && autofixesRes.ok) {
        const statsData = await statsRes.json();
        const scansData = await scansRes.json();
        const approvalsData = await approvalsRes.json();
        const autofixesData = await autofixesRes.json();

        setStats(statsData);
        setScans(scansData);
        setApprovals(approvalsData);
        setAutofixes(autofixesData);
        setIsLive(true);
      } else {
        setIsLive(false);
      }
    } catch (e) {
      console.warn("Backend server not responding. Falling back to SQLite simulated Demo Mode.");
      setIsLive(false);
      // Keep using mock data defaults
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  // Simulator steps handler
  useEffect(() => {
    let timer: any;
    if (simActive) {
      if (simStep === 0) {
        setTerminalLogs(["[SYSTEM] Initializing scan payload..."]);
        timer = setTimeout(() => {
          setTerminalLogs(prev => [...prev, "[SCANNER] Downloading PR files in-memory...", "[SCANNER] Analyzing HCL syntax..."]);
          setSimStep(1);
        }, 1500);
      } else if (simStep === 1) {
        timer = setTimeout(() => {
          setTerminalLogs(prev => [...prev, "[WARNING] Found 1 Critical Alert: AWS_S3_PUBLIC on main.tf", "[SYSTEM] Posting inline PR comment with fix preview..."]);
        }, 800);
      } else if (simStep === 2) {
        // Typing developer command
        setIsTyping(true);
        let text = "/approve";
        let index = 0;
        const typingTimer = setInterval(() => {
          if (index < text.length) {
            setTypedCommand(text.slice(0, index + 1));
            index++;
          } else {
            clearInterval(typingTimer);
            setIsTyping(false);
            // Auto advance after typing
            timer = setTimeout(() => {
              setSimStep(3);
            }, 1000);
          }
        }, 150);
      } else if (simStep === 3) {
        setTerminalLogs([
          "[GITOPS] Received webhook pull_request_review_comment",
          "[RBAC] Verifying actor association: 'COLLABORATOR' -> AUTHORIZED",
          "[HASH] Verifying Dry-run Preview Hash... MATCHED (Anti-drift verified)",
          "[VALIDATION] Starting 3-Layer Safety Checks..."
        ]);
        timer = setTimeout(() => {
          setTerminalLogs(prev => [...prev, "  -> Layer 1: HCL Syntax Check... PASSED ✅"]);
          timer = setTimeout(() => {
            setTerminalLogs(prev => [...prev, "  -> Layer 2: Terraform CLI Validation... PASSED (Graceful skipped init) ✅"]);
            timer = setTimeout(() => {
              setTerminalLogs(prev => [...prev, "  -> Layer 3: AST Resource Boundary Check... PASSED (Zero unintended mutations) ✅"]);
              timer = setTimeout(() => {
                setSimStep(4);
              }, 1000);
            }, 800);
          }, 800);
        }, 800);
      } else if (simStep === 4) {
        setTerminalLogs(prev => [
          ...prev,
          "[BRANCH] Creating secure branch sentraai/fix/aws-s3-public-demo...",
          "[COMMIT] Committing patch: main.tf (acl changed public-read -> private)..."
        ]);
        timer = setTimeout(() => {
          setSimStep(5);
        }, 2000);
      } else if (simStep === 5) {
        setTerminalLogs(prev => [
          ...prev,
          "[PR] Dispatching GitHub API: Open Pull Request...",
          "[SUCCESS] Remediation PR opened: #113",
          "[SYSTEM] Posting approval confirmation to PR review thread!"
        ]);
        // Update stats ribbon dynamically for visual impact
        setStats(prev => ({
          ...prev,
          total_autofix_prs: prev.total_autofix_prs + 1,
          total_gitops_approvals: prev.total_gitops_approvals + 1,
          estimated_hours_saved: parseFloat((prev.estimated_hours_saved + 0.3).toFixed(1))
        }));
        setSimActive(false);
      }
    }
    return () => clearTimeout(timer);
  }, [simActive, simStep]);

  const resetSimulator = () => {
    setSimStep(0);
    setSimActive(false);
    setTerminalLogs([]);
    setTypedCommand("");
    setIsTyping(false);
  };

  const startSimulator = () => {
    resetSimulator();
    setSimActive(true);
  };

  return (
    <div className="app-container">
      <div className="bg-grid"></div>
      
      {/* Top sticky navbar */}
      <header className="navbar">
        <div className="logo">
          <Shield size={22} className="logo-glow" style={{ color: '#6366f1' }} />
          <span>Sentra<span className="logo-glow">AI</span></span>
        </div>
        <nav className="nav-links">
          <button 
            className={`nav-link ${activeTab === 'landing' ? 'active' : ''}`}
            onClick={() => setActiveTab('landing')}
          >
            Product
          </button>
          <button 
            className={`nav-link ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
          >
            Dashboard
          </button>
          <div style={{ marginLeft: '1rem' }}>
            {isLive ? (
              <span className="badge badge-success">
                <Database size={12} /> Live (SQLite)
              </span>
            ) : (
              <span className="badge badge-warning">
                <Database size={12} /> Demo Mode
              </span>
            )}
          </div>
        </nav>
        <div>
          <button className="btn btn-primary" onClick={() => setActiveTab('dashboard')}>
            Launch App
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ flex: 1 }}>
        {activeTab === 'landing' && (
          <div>
            {/* Hero Section */}
            <section className="landing-hero">
              <div className="hero-tag">
                <Sparkles size={13} />
                <span>GitOps-Native Cloud Remediation</span>
              </div>
              <h1 className="hero-title">
                Fix Cloud Security Risks Directly Inside GitHub
              </h1>
              <p className="hero-subtitle">
                Autonomous remediation that security teams trust and developers love.
                SentraAI generates, validates, and commits secure Terraform patches natively inside your PR review threads.
              </p>
              <div className="hero-actions">
                <button className="btn btn-primary" onClick={() => {
                  setActiveTab('dashboard');
                  document.documentElement.scrollTop = 0;
                }}>
                  View Live Dashboard <ChevronRight size={16} />
                </button>
                <button className="btn btn-secondary" onClick={() => {
                  const demoSection = document.getElementById('demo-section');
                  if (demoSection) demoSection.scrollIntoView({ behavior: 'smooth' });
                }}>
                  Watch Interactive Demo
                </button>
              </div>
            </section>

            {/* Interactive Demo Simulator Section */}
            <section className="demo-section" id="demo-section">
              <div className="section-header">
                <h2>Experience Governed Remediation</h2>
                <p>See how SentraAI bridges the gap between static analysis alerts and automated safe refactoring directly inside GitHub.</p>
              </div>

              <div className="demo-frame">
                {/* Left side: Step controller and status */}
                <div className="demo-controls">
                  <div className="demo-steps">
                    <div className={`demo-step ${simStep === 0 ? 'active' : ''}`}>
                      <div className="demo-step-num">1</div>
                      <div className="demo-step-content">
                        <h4>Commit Vulnerable IaC</h4>
                        <p>Developer opens a PR containing insecure infrastructure definition.</p>
                      </div>
                    </div>
                    
                    <div className={`demo-step ${simStep === 1 ? 'active' : ''}`}>
                      <div className="demo-step-num">2</div>
                      <div className="demo-step-content">
                        <h4>Inline Security Comment</h4>
                        <p>SentraAI posts a security finding with a recommended patch and a hidden dry-run validation hash.</p>
                      </div>
                    </div>

                    <div className={`demo-step ${simStep === 2 ? 'active' : ''}`}>
                      <div className="demo-step-num">3</div>
                      <div className="demo-step-content">
                        <h4>GitOps Developer Approval</h4>
                        <p>Authorized collaborator replies <code>/approve</code> inside the GitHub review thread.</p>
                      </div>
                    </div>

                    <div className={`demo-step ${simStep === 3 || simStep === 4 ? 'active' : ''}`}>
                      <div className="demo-step-num">4</div>
                      <div className="demo-step-content">
                        <h4>3-Layer Verification Check</h4>
                        <p>Runs HCL syntax, CLI validate, and AST resource boundary safety constraints.</p>
                      </div>
                    </div>

                    <div className={`demo-step ${simStep === 5 ? 'active' : ''}`}>
                      <div className="demo-step-num">5</div>
                      <div className="demo-step-content">
                        <h4>Remediation PR Opened</h4>
                        <p>Creates branch, commits secure file content, opens PR, and replies to the thread.</p>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                    <button className="btn btn-primary" onClick={startSimulator} disabled={simActive}>
                      <Play size={14} /> {simStep > 0 ? "Re-run Demo" : "Start Demo Simulator"}
                    </button>
                    {simStep === 1 && (
                      <button className="btn btn-secondary" style={{ borderColor: 'var(--success-border)', color: 'var(--success)' }} onClick={() => setSimStep(2)}>
                        Reply `/approve` <ChevronRight size={14} />
                      </button>
                    )}
                    {simStep > 0 && (
                      <button className="btn btn-secondary" onClick={resetSimulator}>
                        Reset
                      </button>
                    )}
                  </div>
                </div>

                {/* Right side: Interactive Visual Windows */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  {/* Mock code editor / GitHub view */}
                  {simStep === 0 && (
                    <div className="code-container">
                      <div className="code-header">
                        <div className="code-dots">
                          <span className="code-dot red"></span>
                          <span className="code-dot yellow"></span>
                          <span className="code-dot green"></span>
                        </div>
                        <span>main.tf (PR Branch)</span>
                      </div>
                      <pre className="code-body" style={{ color: '#888' }}>
                        <code>
                          resource "aws_s3_bucket" "public_bucket" &#123;<br />
                          &nbsp;&nbsp;bucket = "sentra-data-logs"<br />
                          <span style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.15)', display: 'block', width: '100%' }}>
                          -&nbsp;&nbsp;acl    = "public-read"
                          </span>
                          &#125;
                        </code>
                      </pre>
                    </div>
                  )}

                  {simStep === 1 && (
                    <div className="card" style={{ padding: '1rem', background: '#0e1117', border: '1px solid #30363d' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', borderBottom: '1px solid #21262d', paddingBottom: '0.5rem' }}>
                        <Shield size={16} style={{ color: '#6366f1' }} />
                        <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>SentraAI</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>posted an inline comment on main.tf:L3</span>
                      </div>
                      <div style={{ fontSize: '0.8rem', lineHeight: 1.5 }}>
                        <span className="badge badge-error" style={{ marginBottom: '0.5rem' }}>🚨 CRITICAL Security Finding</span>
                        <p style={{ margin: '0.35rem 0', fontWeight: 600 }}>Rule: <code>AWS_S3_PUBLIC</code></p>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>Public Internet exposure detected. Restrict ACL to private.</p>
                        
                        <div className="code-container" style={{ fontSize: '0.75rem', marginBottom: '0.75rem' }}>
                          <div className="code-body" style={{ padding: '0.5rem 1rem' }}>
                            <span style={{ color: '#888' }}>Proposed Fix:</span>
                            <pre style={{ color: 'var(--success)' }}>
                              -  acl = "public-read"<br />
                              +  acl = "private"
                            </pre>
                          </div>
                        </div>

                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                          💡 **Reply with <code>/approve</code>** to automatically open a remediation PR.
                        </p>
                      </div>
                    </div>
                  )}

                  {simStep === 2 && (
                    <div className="card" style={{ padding: '1.25rem', background: '#0e1117', border: '1px solid #30363d' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifySelf: 'center', color: '#fff', fontSize: '0.7rem', fontWeight: 'bold', justifyContent: 'center' }}>AG</div>
                        <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>AryanGupta</span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(Collaborator)</span>
                      </div>
                      <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: '6px', padding: '0.5rem 0.75rem', fontFamily: 'var(--font-sans)', fontSize: '0.85rem', display: 'flex', alignItems: 'center' }}>
                        <span style={{ borderRight: isTyping ? '2px solid #fff' : 'none', paddingRight: '2px' }}>
                          {typedCommand || <span style={{ color: 'var(--text-muted)' }}>Write a reply...</span>}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
                        <button className="btn btn-primary" style={{ padding: '0.35rem 0.85rem', fontSize: '0.75rem' }} disabled={isTyping}>
                          Comment
                        </button>
                      </div>
                    </div>
                  )}

                  {(simStep === 3 || simStep === 4) && (
                    <div className="code-container" style={{ background: '#08090d' }}>
                      <div className="code-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Terminal size={12} />
                          <span>SentraAI Governed Pipeline</span>
                        </div>
                      </div>
                      <div className="code-body" style={{ fontSize: '0.75rem', color: '#38ef7d', minHeight: '140px' }}>
                        {terminalLogs.map((log, i) => (
                          <div key={i} style={{ marginBottom: '0.35rem' }}>{log}</div>
                        ))}
                      </div>
                    </div>
                  )}

                  {simStep === 5 && (
                    <div className="card" style={{ padding: '1.25rem', borderLeft: '4px solid var(--success)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                        <CheckCircle2 style={{ color: 'var(--success)' }} size={20} />
                        <h4 style={{ color: '#ffffff' }}>Remediation PR Created Successfully!</h4>
                      </div>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                        The insecure configurations were refactored. The pipeline verified all trust checks.
                      </p>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', background: 'rgba(255,255,255,0.02)', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)', marginBottom: '1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Branch:</span>
                          <span style={{ fontFamily: 'monospace' }}>sentraai/fix/aws-s3-public-demo</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>PR Target:</span>
                          <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>sentra-corp/production-infra/pull/113</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <span className="badge badge-success">Syntax ✅</span>
                        <span className="badge badge-success">CLI Validate ✅</span>
                        <span className="badge badge-success">Boundary ✅</span>
                      </div>
                    </div>
                  )}

                  {/* Terminal log panel status */}
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Clock size={12} /> Expiration: 24h
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Lock size={12} /> RBAC Enforcement Active
                    </span>
                  </div>
                </div>
              </div>
            </section>

            {/* Why Trust SentraAI matrix */}
            <section className="trust-section">
              <div className="section-header">
                <h2>Built on Infrastructure Trust Boundaries</h2>
                <p>We designed SentraAI to address the real security engineering concern: loss of control over autonomous modifications.</p>
              </div>

              <div className="trust-grid">
                <div className="card">
                  <div className="feature-icon-wrapper" style={{ marginBottom: '1rem' }}>
                    <Lock size={20} />
                  </div>
                  <h3 style={{ marginBottom: '0.5rem', fontSize: '1.15rem' }}>Preview Hash Lock</h3>
                  <p style={{ fontSize: '0.85rem' }}>
                    Every recommendation generates a unique SHA256 diff hash. We verify that the HEAD state matches the hash exactly before committing, blocking time-of-check to time-of-use drift.
                  </p>
                </div>

                <div className="card">
                  <div className="feature-icon-wrapper" style={{ marginBottom: '1rem' }}>
                    <Layers size={20} />
                  </div>
                  <h3 style={{ marginBottom: '0.5rem', fontSize: '1.15rem' }}>AST Boundary Checks</h3>
                  <p style={{ fontSize: '0.85rem' }}>
                    Uses Abstract Syntax Trees to guarantee that only the specific resource containing the vulnerability is modified. Any silent block mutations trigger an immediate block.
                  </p>
                </div>

                <div className="card">
                  <div className="feature-icon-wrapper" style={{ marginBottom: '1rem' }}>
                    <CheckCircle2 size={20} />
                  </div>
                  <h3 style={{ marginBottom: '0.5rem', fontSize: '1.15rem' }}>3-Layer Verification</h3>
                  <p style={{ fontSize: '0.85rem' }}>
                    Validates HCL syntax in-memory, checks structural integrity with best-effort <code>terraform validate</code>, and checks resource boundaries to prevent broken deployments.
                  </p>
                </div>

                <div className="card">
                  <div className="feature-icon-wrapper" style={{ marginBottom: '1rem' }}>
                    <TrendingUp size={20} />
                  </div>
                  <h3 style={{ marginBottom: '0.5rem', fontSize: '1.15rem' }}>GitOps Governance</h3>
                  <p style={{ fontSize: '0.85rem' }}>
                    Enforces GitHub Role-Based Access Control. Only write/admin contributors can trigger fixes. Captures complete, persistent audit trails for compliance auditing.
                  </p>
                </div>
              </div>
            </section>

            {/* Operational Modes Grid */}
            <section className="demo-section">
              <div className="section-header" style={{ marginBottom: '2rem' }}>
                <h2>Flexible Governance Operational Modes</h2>
                <p>Scale trust over time. Onboard silently, preview risks, gate approvals, or transition to fully autonomous remediation.</p>
              </div>

              <div className="mode-visualizer">
                <div 
                  className={`mode-card ${selectedMode === 'comment_only' ? 'active' : ''}`}
                  onClick={() => setSelectedMode('comment_only')}
                >
                  <div className="mode-card-title">Comment Only</div>
                  <div className="mode-card-desc">Scan and report issues without offering HCL code blocks.</div>
                </div>

                <div 
                  className={`mode-card ${selectedMode === 'preview_only' ? 'active' : ''}`}
                  onClick={() => setSelectedMode('preview_only')}
                >
                  <div className="mode-card-title">Preview Only</div>
                  <div className="mode-card-desc">Generate secure patches and render diffs in comments for developer review.</div>
                </div>

                <div 
                  className={`mode-card ${selectedMode === 'approval_required' ? 'active' : ''}`}
                  onClick={() => setSelectedMode('approval_required')}
                >
                  <div className="mode-card-title">Approval Gated</div>
                  <div className="mode-card-desc">Human-in-the-loop. Patch is committed only when authorized developer replies /approve.</div>
                </div>

                <div 
                  className={`mode-card ${selectedMode === 'autonomous' ? 'active' : ''}`}
                  onClick={() => setSelectedMode('autonomous')}
                >
                  <div className="mode-card-title">Autonomous</div>
                  <div className="mode-card-desc">Zero intervention. Opens secure remediation pull requests immediately for safe rules.</div>
                </div>
              </div>

              <div className="card" style={{ marginTop: '1.5rem', background: 'rgba(255,255,255,0.01)', padding: '1.25rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <Info size={24} style={{ color: 'var(--primary)' }} />
                <div style={{ fontSize: '0.85rem' }}>
                  <strong>Current Environment Mode:</strong> <code>SENTRA_REMEDIATION_MODE={selectedMode}</code>.
                  {selectedMode === 'approval_required' && " Developers must explicitly review and authorize security refactoring by posting comments."}
                  {selectedMode === 'autonomous' && " Safe remediations are dispatched automatically. Cooldown controls restrict commits to one per 24 hours per file."}
                  {selectedMode === 'preview_only' && " Patton and CLI checks execute, but branch creation APIs are gated."}
                  {selectedMode === 'comment_only' && " Reports issues to security analytics only; inline comments contain explanations but no code blocks."}
                </div>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'dashboard' && (
          <div className="dashboard-container">
            {/* Dashboard top header */}
            <div className="dashboard-header">
              <div className="dashboard-title-group">
                <h1>Security Operations Console</h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Real-time cloud infrastructure validation statistics, GitOps logs, and audit trails.
                </p>
              </div>
              <button 
                className="btn btn-secondary" 
                onClick={fetchData} 
                disabled={isLoading}
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <RefreshCw size={14} className={isLoading ? "spin" : ""} style={{ animation: isLoading ? 'spin 1s linear infinite' : 'none' }} />
                <span>Refresh Data</span>
              </button>
            </div>

            {/* Stats Summary ribbon */}
            <section className="stats-ribbon">
              <div className="card stat-card">
                <span className="stat-label">Total Scans Run</span>
                <span className="stat-value">{stats.total_scans}</span>
                <span className="stat-footer">Across all GitHub repositories</span>
              </div>
              <div className="card stat-card">
                <span className="stat-label">Open Findings</span>
                <span className="stat-value" style={{ color: stats.total_findings > 0 ? 'var(--warning)' : '#ffffff' }}>
                  {stats.total_findings}
                </span>
                <span className="stat-footer">Requires remediation</span>
              </div>
              <div className="card stat-card">
                <span className="stat-label">Suppressed Alerts</span>
                <span className="stat-value" style={{ color: 'var(--info)' }}>{stats.total_suppressed}</span>
                <span className="stat-footer">Via sentra-ignore annotations</span>
              </div>
              <div className="card stat-card">
                <span className="stat-label">GitOps Approvals</span>
                <span className="stat-value" style={{ color: 'var(--success)' }}>{stats.total_gitops_approvals}</span>
                <span className="stat-footer">Approved via /approve comments</span>
              </div>
              <div className="card stat-card">
                <span className="stat-label">Autofix PRs Created</span>
                <span className="stat-value" style={{ color: 'var(--primary)' }}>{stats.total_autofix_prs}</span>
                <span className="stat-footer">Active secure branches opened</span>
              </div>
              <div className="card stat-card">
                <span className="stat-label">Developer Hours Saved</span>
                <span className="stat-value" style={{ color: 'var(--success)' }}>{stats.estimated_hours_saved}h</span>
                <span className="stat-footer">Automatic scans & PR refactors</span>
              </div>
            </section>

            {/* Split panel details */}
            <div className="dashboard-grid">
              
              {/* Left Panel: Recent Webhook Deliveries */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="card" style={{ padding: '1.25rem' }}>
                  <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <GitPullRequest size={16} /> Recent Webhook Scan Events
                  </h3>
                  
                  <div className="table-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Scan ID</th>
                          <th>Repository</th>
                          <th>PR #</th>
                          <th>Findings</th>
                          <th>Suppressed</th>
                          <th>Duration</th>
                          <th>Timestamp</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scans.length > 0 ? (
                          scans.map((scan) => (
                            <tr key={scan.scan_id}>
                              <td style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                                {scan.scan_id}
                              </td>
                              <td style={{ fontWeight: 500 }}>{scan.repo_name}</td>
                              <td>#{scan.pr_number}</td>
                              <td style={{ color: scan.findings_count > 0 ? 'var(--error)' : 'inherit', fontWeight: scan.findings_count > 0 ? 600 : 'normal' }}>
                                {scan.findings_count}
                              </td>
                              <td style={{ color: scan.suppressed_count > 0 ? 'var(--info)' : 'inherit' }}>
                                {scan.suppressed_count}
                              </td>
                              <td>{scan.total_time ? `${scan.total_time.toFixed(2)}s` : "0.00s"}</td>
                              <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{scan.timestamp}</td>
                              <td>
                                <span className={`badge ${
                                  scan.status === 'COMPLETED' ? 'badge-success' : 
                                  scan.status === 'PARTIAL' ? 'badge-warning' : 'badge-error'
                                }`}>
                                  {scan.status}
                                </span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                              No webhook deliveries recorded yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Bottom Left: Autofixes created */}
                <div className="card" style={{ padding: '1.25rem' }}>
                  <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <CheckCircle2 size={16} /> Auto-Fix Remediation PRs
                  </h3>
                  
                  <div className="table-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Rule ID</th>
                          <th>Repository</th>
                          <th>Target File</th>
                          <th>PR URL</th>
                          <th>Safety Tier</th>
                          <th>Timestamp</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {autofixes.length > 0 ? (
                          autofixes.map((fix) => (
                            <tr key={fix.id}>
                              <td><code>{fix.rule_id}</code></td>
                              <td>{fix.repo_name}</td>
                              <td>{fix.file_path}</td>
                              <td>
                                {fix.pr_url ? (
                                  <a href={fix.pr_url} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.2rem', textDecoration: 'none' }}>
                                    PR #{fix.pr_number} <ExternalLink size={12} />
                                  </a>
                                ) : "N/A"}
                              </td>
                              <td>
                                <span className="badge badge-success">SAFE</span>
                              </td>
                              <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{fix.created_at}</td>
                              <td>
                                <span className="badge badge-success">{fix.status}</span>
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                              No auto-fix PRs created yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Right Panel: GitOps human-in-the-loop approvals audit logs */}
              <div className="card" style={{ padding: '1.25rem' }}>
                <h3 style={{ marginBottom: '1rem', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Logs size={16} /> GitOps Governance Audit Trail
                </h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {approvals.length > 0 ? (
                    approvals.map((appr) => (
                      <div 
                        key={appr.id} 
                        style={{ 
                          padding: '1rem', 
                          borderRadius: '8px', 
                          border: '1px solid var(--border-color)', 
                          background: 'rgba(255,255,255,0.01)',
                          position: 'relative',
                          overflow: 'hidden'
                        }}
                      >
                        {/* Status sidebar highlight */}
                        <div style={{ 
                          position: 'absolute', 
                          top: 0, 
                          left: 0, 
                          bottom: 0, 
                          width: '4px', 
                          background: 
                            appr.status === 'APPROVED' ? 'var(--success)' : 
                            appr.status === 'REJECTED' ? 'var(--error)' : 
                            appr.status === 'DUPLICATE' ? 'var(--info)' : 'var(--warning)'
                        }}></div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', paddingLeft: '0.5rem' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <User size={12} style={{ color: 'var(--text-secondary)' }} />
                            @{appr.actor}
                          </span>
                          <span className={`badge ${
                            appr.status === 'APPROVED' ? 'badge-success' : 
                            appr.status === 'REJECTED' ? 'badge-error' : 
                            appr.status === 'DUPLICATE' ? 'badge-info' : 'badge-warning'
                          }`} style={{ fontSize: '0.7rem' }}>
                            {appr.status}
                          </span>
                        </div>

                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', paddingLeft: '0.5rem', lineHeight: 1.5 }}>
                          <div>Command: <code>{appr.command}</code></div>
                          <div>Rule ID: <code>{appr.finding_id}</code></div>
                          <div>Repo: <span style={{ fontWeight: 500 }}>{appr.repo_name}</span></div>
                          
                          {appr.pr_url && (
                            <div style={{ marginTop: '0.35rem' }}>
                              <a href={appr.pr_url} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}>
                                View Remediation PR <ExternalLink size={10} />
                              </a>
                            </div>
                          )}
                          
                          {appr.failure_reason && (
                            <div style={{ color: 'var(--error)', marginTop: '0.35rem', display: 'flex', alignItems: 'flex-start', gap: '0.25rem', fontSize: '0.75rem' }}>
                              <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: '2px' }} />
                              <span>{appr.failure_reason}</span>
                            </div>
                          )}
                        </div>

                        <div style={{ textAlign: 'right', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                          {appr.created_at}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No GitOps approvals audited yet.
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        )}
      </main>

      {/* Persistent global footer */}
      <footer className="footer">
        <p>© 2026 SentraAI — AI-Powered Governed Cloud Remediation Platform.</p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
          Configured with 3-Layer Validation, AST Boundary Enforcement, and Preview Hash drift locking.
        </p>
      </footer>
    </div>
  );
}
