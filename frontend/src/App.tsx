import { useState, useEffect } from 'react';
import AiSecurityVisualizer from './components/AiSecurityVisualizer';
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
  Logs,
  Plus
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
  const [activeTab, setActiveTab] = useState<'landing' | 'case-studies' | 'dashboard' | 'onboarding'>('landing');
  const [isLive, setIsLive] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  
  // Real or mock data states
  const [stats, setStats] = useState<DashboardStats>(mockStats);
  const [scans, setScans] = useState<ScanLog[]>(mockScans);
  const [approvals, setApprovals] = useState<ApprovalLog[]>(mockApprovals);
  const [autofixes, setAutofixes] = useState<AutofixLog[]>(mockAutofixes);
  
  // Config mode state
  const [selectedMode, setSelectedMode] = useState<string>("approval_required");

  // Onboarding wizard states
  const [wizardStep, setWizardStep] = useState<number>(0);
  const [selectedOrg, setSelectedOrg] = useState<string>("sentra-corp");
  const [selectedRepos, setSelectedRepos] = useState<string[]>([]);
  const [onboardingMode, setOnboardingMode] = useState<string>("approval_required");
  const [isLoadingWizard, setIsLoadingWizard] = useState<boolean>(false);

  // Case Studies state
  const [selectedCaseStudy, setSelectedCaseStudy] = useState<string>("s3");

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
            className={`nav-link ${activeTab === 'case-studies' ? 'active' : ''}`}
            onClick={() => setActiveTab('case-studies')}
          >
            Case Studies
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
              <div className="hero-content">
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

                {/* AI System Status Bar */}
                <div className="hero-status-panel" style={{ marginBottom: '2rem' }}>
                  <div className="status-item">
                    <span className="status-indicator"></span>
                    <span>AI Remediator: ACTIVE</span>
                  </div>
                  <div className="status-item">
                    <span className="status-indicator" style={{ background: '#3b82f6', boxShadow: '0 0 8px #3b82f6' }}></span>
                    <span>AST Guard: ENFORCED</span>
                  </div>
                  <div className="status-item">
                    <span className="status-indicator" style={{ background: '#10b981', boxShadow: '0 0 8px #10b981' }}></span>
                    <span>3-Layer Trust: VERIFIED</span>
                  </div>
                </div>

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
              </div>

              {/* Live Animated AI Security Visualization */}
              <div className="hero-visualizer-container">
                <AiSecurityVisualizer />
              </div>
            </section>

            {/* Target Ideal Customer Profile (ICP) Grid */}
            <section className="features-grid" style={{ marginBottom: '5rem', marginTop: '-2rem' }}>
              <div className="card feature-card">
                <div className="feature-icon-wrapper" style={{ background: 'rgba(99, 102, 241, 0.08)' }}>
                  <User size={18} />
                </div>
                <h3>Lean DevOps & Platform Teams</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  No dashboard dependencies or alert overhead. Automate security reviews and commit-level checks directly in GitHub without slowing your pipeline.
                </p>
              </div>

              <div className="card feature-card">
                <div className="feature-icon-wrapper" style={{ background: 'rgba(16, 185, 129, 0.08)', color: 'var(--success)', borderColor: 'var(--success-border)' }}>
                  <TrendingUp size={18} />
                </div>
                <h3>Cloud-Native Startups</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Deploy rapidly and maintain compliance. Safe automatic remediation checks guard production infra against human errors and unencrypted databases.
                </p>
              </div>

              <div className="card feature-card">
                <div className="feature-icon-wrapper" style={{ background: 'rgba(245, 158, 11, 0.08)', color: 'var(--warning)', borderColor: 'var(--warning-border)' }}>
                  <Layers size={18} />
                </div>
                <h3>Terraform-Heavy Ecosystems</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Instantly resolve static scanner findings. Convert static alert noise into clean, validated pull requests with a single click or comment.
                </p>
              </div>

              <div className="card feature-card">
                <div className="feature-icon-wrapper" style={{ background: 'rgba(99, 102, 241, 0.08)' }}>
                  <GitPullRequest size={18} />
                </div>
                <h3>GitOps-Native Workflows</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Designed specifically for developers. Grant approvals inside review comments (<code>/approve</code>) with zero context switching or credential exposure.
                </p>
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
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button 
                  className="btn btn-primary"
                  onClick={() => {
                    setWizardStep(0);
                    setActiveTab('onboarding');
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  <Plus size={14} />
                  <span>Connect Repository</span>
                </button>
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

        {/* Connect Repository Onboarding stepper wizard */}
        {activeTab === 'onboarding' && (
          <div style={{ maxWidth: '600px', margin: '3rem auto', padding: '1rem', width: '100%' }}>
            <div className="card" style={{ padding: '2rem' }}>
              <h2 style={{ marginBottom: '0.5rem', textAlign: 'center' }}>Connect GitHub Repository</h2>
              <p style={{ color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.9rem', marginBottom: '2rem' }}>
                Install the SentraAI GitHub App to enable automated security review and GitOps approvals.
              </p>
              
              {/* Stepper indicator */}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2.5rem', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '15px', left: '10%', right: '10%', height: '2px', background: 'var(--border-color)', zIndex: 1 }}></div>
                <div style={{ 
                  position: 'absolute', 
                  top: '15px', 
                  left: '10%', 
                  width: `${wizardStep * 20}%`, 
                  height: '2px', 
                  background: 'var(--primary)', 
                  zIndex: 2,
                  transition: 'width 0.35s cubic-bezier(0.16, 1, 0.3, 1)'
                }}></div>

                {[0, 1, 2, 3, 4].map((step) => (
                  <div key={step} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 3, position: 'relative' }}>
                    <div style={{ 
                      width: '32px', 
                      height: '32px', 
                      borderRadius: '50%', 
                      background: wizardStep >= step ? 'var(--primary)' : 'var(--bg-main)', 
                      border: `2px solid ${wizardStep >= step ? 'var(--primary)' : 'var(--border-color)'}`, 
                      color: wizardStep >= step ? '#fff' : 'var(--text-muted)',
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      fontSize: '0.8rem',
                      transition: 'background 0.35s, border-color 0.35s'
                    }}>
                      {step + 1}
                    </div>
                    <span style={{ fontSize: '0.7rem', color: wizardStep >= step ? 'var(--text-primary)' : 'var(--text-muted)', marginTop: '0.5rem', fontWeight: 500 }}>
                      {['Account', 'Org', 'App', 'Repo', 'Mode'][step]}
                    </span>
                  </div>
                ))}
              </div>

              {/* Step Contents */}
              {wizardStep === 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', padding: '1rem 0' }}>
                  <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)' }}>
                    <User size={28} />
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Authorize GitHub Access</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      SentraAI requires developer authorization to query organizations and install repositories.
                    </p>
                  </div>
                  <button 
                    className="btn btn-primary" 
                    style={{ width: '100%' }}
                    onClick={() => {
                      setIsLoadingWizard(true);
                      setTimeout(() => {
                        setIsLoadingWizard(false);
                        setWizardStep(1);
                      }, 1200);
                    }}
                    disabled={isLoadingWizard}
                  >
                    {isLoadingWizard ? "Connecting..." : "Connect GitHub Account"}
                  </button>
                </div>
              )}

              {wizardStep === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1rem 0' }}>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Select Organization</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      Choose the GitHub organization containing the repositories you want to protect.
                    </p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {[
                      { id: 'sentra-corp', name: 'sentra-corp', status: 'authorized' },
                      { id: 'personal-sandbox', name: 'personal-sandbox', status: 'authorized' },
                      { id: 'legacy-monolith', name: 'legacy-monolith (needs installation)', status: 'action_required' }
                    ].map((org) => (
                      <div 
                        key={org.id} 
                        className="card" 
                        style={{ 
                          padding: '1rem', 
                          cursor: 'pointer', 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center',
                          borderColor: selectedOrg === org.id ? 'var(--primary)' : 'var(--border-color)',
                          background: selectedOrg === org.id ? 'rgba(99, 102, 241, 0.03)' : 'var(--bg-card)'
                        }}
                        onClick={() => setSelectedOrg(org.id)}
                      >
                        <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{org.name}</span>
                        <span className={`badge ${org.status === 'authorized' ? 'badge-success' : 'badge-warning'}`}>
                          {org.status === 'authorized' ? 'Authorized' : 'Install App'}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                    <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setWizardStep(0)}>Back</button>
                    <button 
                      className="btn btn-primary" 
                      style={{ flex: 1 }} 
                      onClick={() => {
                        if (selectedOrg === 'legacy-monolith') {
                          setWizardStep(2);
                        } else {
                          setWizardStep(3);
                        }
                      }}
                      disabled={!selectedOrg}
                    >
                      Continue
                    </button>
                  </div>
                </div>
              )}

              {wizardStep === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1rem 0' }}>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Install SentraAI App</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                      Authorize the SentraAI GitHub application to access metadata, checks, and pull requests.
                    </p>
                    <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem', fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                        <CheckCircle2 size={14} style={{ color: 'var(--success)' }} />
                        <span>Read access to code metadata and configuration files</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                        <CheckCircle2 size={14} style={{ color: 'var(--success)' }} />
                        <span>Read & Write access to Pull Requests & Review Comments</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
                        <CheckCircle2 size={14} style={{ color: 'var(--success)' }} />
                        <span>Read & Write access to Check Runs API</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setWizardStep(1)}>Back</button>
                    <button 
                      className="btn btn-primary" 
                      style={{ flex: 2 }}
                      onClick={() => {
                        setIsLoadingWizard(true);
                        setTimeout(() => {
                          setIsLoadingWizard(false);
                          setWizardStep(3);
                        }, 1500);
                      }}
                      disabled={isLoadingWizard}
                    >
                      {isLoadingWizard ? "Installing App..." : "Install & Authorize App"}
                    </button>
                  </div>
                </div>
              )}

              {wizardStep === 3 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1rem 0' }}>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Select Repositories</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      Choose which repositories SentraAI should actively monitor and remediate.
                    </p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {[
                      'production-infra',
                      'data-lake',
                      's3-static-sites',
                      'networking-core',
                      'k8s-manifests'
                    ].map((repo) => (
                      <div 
                        key={repo}
                        className="card"
                        style={{ 
                          padding: '0.75rem 1rem', 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '0.75rem', 
                          cursor: 'pointer',
                          borderColor: selectedRepos.includes(repo) ? 'var(--primary)' : 'var(--border-color)',
                          background: selectedRepos.includes(repo) ? 'rgba(99, 102, 241, 0.03)' : 'var(--bg-card)'
                        }}
                        onClick={() => {
                          if (selectedRepos.includes(repo)) {
                            setSelectedRepos(selectedRepos.filter(r => r !== repo));
                          } else {
                            setSelectedRepos([...selectedRepos, repo]);
                          }
                        }}
                      >
                        <div style={{ 
                          width: '16px', 
                          height: '16px', 
                          borderRadius: '4px', 
                          border: '1px solid var(--border-color)', 
                          background: selectedRepos.includes(repo) ? 'var(--primary)' : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          fontSize: '0.65rem'
                        }}>
                          {selectedRepos.includes(repo) && "✓"}
                        </div>
                        <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{selectedOrg || 'sentra-corp'}/{repo}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setWizardStep(selectedOrg === 'legacy-monolith' ? 2 : 1)}>Back</button>
                    <button 
                      className="btn btn-primary" 
                      style={{ flex: 1 }} 
                      onClick={() => setWizardStep(4)}
                      disabled={selectedRepos.length === 0}
                    >
                      Continue
                    </button>
                  </div>
                </div>
              )}

              {wizardStep === 4 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', padding: '1rem 0' }}>
                  <div>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Select Remediation Mode</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      Configure the governance boundaries for security refactor commits.
                    </p>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {[
                      { id: 'comment_only', title: 'Comment Only', desc: 'Scan and report issues without automated code patches.' },
                      { id: 'preview_only', title: 'Preview Only', desc: 'Suggest code fixes as PR comments, but do not commit branch fixes.' },
                      { id: 'approval_required', title: 'Approval Gated', desc: 'Commit secure patches and open PRs only when developer types /approve.' },
                      { id: 'autonomous', title: 'Autonomous', desc: 'Open remediation PRs immediately for high-confidence security rules.' }
                    ].map((mode) => (
                      <div 
                        key={mode.id}
                        className="card"
                        style={{ 
                          padding: '1rem', 
                          cursor: 'pointer',
                          borderColor: onboardingMode === mode.id ? 'var(--primary)' : 'var(--border-color)',
                          background: onboardingMode === mode.id ? 'rgba(99, 102, 241, 0.03)' : 'var(--bg-card)'
                        }}
                        onClick={() => setOnboardingMode(mode.id)}
                      >
                        <div style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem', width: '100%' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{mode.title}</span>
                          <div style={{ width: '12px', height: '12px', borderRadius: '50%', border: '1px solid var(--border-color)', background: onboardingMode === mode.id ? 'var(--primary)' : 'transparent' }}></div>
                        </div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'left' }}>{mode.desc}</p>
                      </div>
                    ))}
                  </div>

                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setWizardStep(3)}>Back</button>
                    <button 
                      className="btn btn-primary" 
                      style={{ flex: 2 }}
                      onClick={() => {
                        setIsLoadingWizard(true);
                        setTimeout(() => {
                          setIsLoadingWizard(false);
                          
                          // Register new repositories inside the scans telemetry view
                          const newScans = selectedRepos.map((repo) => ({
                            scan_id: `scan-${Math.random().toString(36).substring(2, 10)}`,
                            repo_name: `${selectedOrg || 'sentra-corp'}/${repo}`,
                            pr_number: 1,
                            head_sha: `head${Math.random().toString(16).substring(2, 6)}`,
                            status: 'COMPLETED',
                            findings_count: 0,
                            suppressed_count: 0,
                            total_time: 0.35,
                            timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19)
                          }));

                          setScans(prev => [...newScans, ...prev]);
                          setStats(prev => ({
                            ...prev,
                            total_scans: prev.total_scans + selectedRepos.length
                          }));

                          setWizardStep(5);
                        }, 1200);
                      }}
                      disabled={isLoadingWizard}
                    >
                      {isLoadingWizard ? "Saving Configuration..." : "Activate Repository Protection"}
                    </button>
                  </div>
                </div>
              )}

              {wizardStep === 5 && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem', padding: '1rem 0', textAlign: 'center' }}>
                  <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'var(--success-bg)', border: '1px solid var(--success-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--success)' }}>
                    <CheckCircle2 size={32} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Repository Protection Activated!</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: '400px', margin: '0 auto 1.5rem auto' }}>
                      SentraAI is now actively protecting <strong>{selectedRepos.length}</strong> repositories under the <strong>{selectedOrg}</strong> organization.
                    </p>
                    <div style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.75rem 1rem', fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'inline-block', fontFamily: 'monospace' }}>
                      Active Mode: SENTRA_REMEDIATION_MODE={onboardingMode.toUpperCase()}
                    </div>
                  </div>
                  <button 
                    className="btn btn-primary" 
                    style={{ width: '100%' }}
                    onClick={() => {
                      setWizardStep(0);
                      setSelectedRepos([]);
                      setActiveTab('dashboard');
                    }}
                  >
                    Go to Security Operations Console
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Case Studies View */}
        {activeTab === 'case-studies' && (
          <div className="dashboard-container">
            <div className="dashboard-header" style={{ marginBottom: '1.5rem' }}>
              <div className="dashboard-title-group">
                <h1>Governed Remediation Case Studies</h1>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Explore interactive before/after security refactoring patterns, including validation gates, audit trails, and strict safety restraints.
                </p>
              </div>
            </div>

            {/* Horizontal selector tabs */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', overflowX: 'auto', paddingBottom: '0.5rem', width: '100%' }}>
              {[
                { id: 's3', title: 'S3 Public Bucket ACL', rule: 'AWS_S3_PUBLIC', tier: 'SAFE' },
                { id: 'rds', title: 'RDS Storage Encryption', rule: 'AWS_DB_UNENCRYPTED', tier: 'SAFE' },
                { id: 'sg', title: 'Open Security Group SSH', rule: 'AWS_SG_OPEN', tier: 'REVIEW_REQUIRED' },
                { id: 'iam', title: 'Wildcard IAM Permissions', rule: 'AWS_IAM_WILDCARD', tier: 'NONE' }
              ].map((cs) => (
                <button
                  key={cs.id}
                  className={`btn ${selectedCaseStudy === cs.id ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setSelectedCaseStudy(cs.id)}
                  style={{ fontSize: '0.8rem', padding: '0.5rem 1rem' }}
                >
                  <span>{cs.title}</span>
                  <span className={`badge ${
                    cs.tier === 'SAFE' ? 'badge-success' : 
                    cs.tier === 'REVIEW_REQUIRED' ? 'badge-warning' : 'badge-error'
                  }`} style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', marginLeft: '0.5rem' }}>
                    {cs.tier}
                  </span>
                </button>
              ))}
            </div>

            {/* Main Case Study details card */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.25fr 1fr', gap: '1.5rem', width: '100%' }}>
              
              {/* Left pane: HCL Diffs and explanation */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="card">
                  <h3 style={{ marginBottom: '1rem' }}>
                    {selectedCaseStudy === 's3' && "Case Study 1: Secure S3 Bucket ACL"}
                    {selectedCaseStudy === 'rds' && "Case Study 2: Encrypted RDS Storage"}
                    {selectedCaseStudy === 'sg' && "Case Study 3: Restricted Security Group Ingress"}
                    {selectedCaseStudy === 'iam' && "Case Study 4: Wildcard IAM Policy Blocked (Safety Restraint)"}
                  </h3>

                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                    {selectedCaseStudy === 's3' && "S3 buckets exposed to the public internet via public-read ACLs represent the most common source of cloud data leaks. SentraAI detects this issue and swaps it with a private ACL."}
                    {selectedCaseStudy === 'rds' && "Database storage encryption is required under HIPAA, PCI-DSS, and general compliance guidelines. Enabling it encrypts active data blocks and snapshot volumes automatically."}
                    {selectedCaseStudy === 'sg' && "Allowing SSH access from any IP address (0.0.0.0/0) exposes your infrastructure directly to network brute-forcing. SentraAI flags this as high-severity and replaces it with a warning and a custom VPC CIDR block."}
                    {selectedCaseStudy === 'iam' && "Wildcard permissions allow arbitrary resources and actions, creating huge IAM privilege risks. Because IAM logic is context-dependent, SentraAI intentionally refuses automated remediation here to prevent breaking applications."}
                  </p>

                  {/* Code comparison panel */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {/* Before Code Block */}
                    <div className="code-container">
                      <div className="code-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span className="code-dot red"></span>
                          <span>Vulnerable Configuration (Before)</span>
                        </div>
                      </div>
                      <pre className="code-body" style={{ color: '#ef4444', background: 'rgba(239,68,68,0.02)' }}>
                        <code>
                          {selectedCaseStudy === 's3' && (
`resource "aws_s3_bucket" "insecure_bucket" {
  bucket = "sentra-insecure-data-leak"
  acl    = "public-read"  # EXPOSES BUCKET TO THE INTERNET
}`
                          )}
                          {selectedCaseStudy === 'rds' && (
`resource "aws_db_instance" "insecure_db" {
  instance_class    = "db.t3.micro"
  engine            = "postgres"
  storage_encrypted = false  # INSECURE: STORAGE NOT ENCRYPTED
}`
                          )}
                          {selectedCaseStudy === 'sg' && (
`resource "aws_security_group" "insecure_sg" {
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]  # EXPOSES PORT 22 TO THE ENTIRE WORLD
  }
}`
                          )}
                          {selectedCaseStudy === 'iam' && (
`resource "aws_iam_policy" "insecure_policy" {
  policy = <<EOF
{
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "*",      # HIGH RISK: WILDCARD ACTION
      "Resource": "*"    # HIGH RISK: WILDCARD RESOURCE
    }
  ]
}
EOF
}`
                          )}
                        </code>
                      </pre>
                    </div>

                    {/* After Code Block */}
                    <div className="code-container">
                      <div className="code-header">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span className="code-dot green"></span>
                          <span>
                            {selectedCaseStudy === 'iam' ? "Remediation Refused (Safety Restraint)" : "Remediated Configuration (After Patch)"}
                          </span>
                        </div>
                      </div>
                      <pre className="code-body" style={{ 
                        color: selectedCaseStudy === 'iam' ? 'var(--text-secondary)' : 'var(--success)', 
                        background: selectedCaseStudy === 'iam' ? 'rgba(255,255,255,0.01)' : 'rgba(16,185,129,0.02)' 
                      }}>
                        <code>
                          {selectedCaseStudy === 's3' && (
`resource "aws_s3_bucket" "insecure_bucket" {
  bucket = "sentra-insecure-data-leak"
  acl    = "private"  # REMEDIATED: BUCKET MADE PRIVATE
}`
                          )}
                          {selectedCaseStudy === 'rds' && (
`resource "aws_db_instance" "insecure_db" {
  instance_class    = "db.t3.micro"
  engine            = "postgres"
  storage_encrypted = true  # REMEDIATED: STORAGE ENCRYPTION ENABLED
}`
                          )}
                          {selectedCaseStudy === 'sg' && (
`resource "aws_security_group" "insecure_sg" {
  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["YOUR_TRUSTED_IP_RANGE"]  # REMEDIATED: GATED TO VPC CIDR
  }
}`
                          )}
                          {selectedCaseStudy === 'iam' && (
`# NO AUTOMATED FIX APPLIED.
# IAM policy wildcard remediations are blocked.
# Reason: Context-dependent. Modifying IAM permissions automatically
# poses a high risk of silently breaking running container applications.`
                          )}
                        </code>
                      </pre>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right pane: Governance, validation audit details */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <h3>Remediation Quality & Trust</h3>
                  
                  <div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Rule Definition</span>
                    <div style={{ fontSize: '0.85rem', fontWeight: 500, marginTop: '0.2rem' }}>
                      {selectedCaseStudy === 's3' && "AWS_S3_PUBLIC — Public S3 Bucket Detected"}
                      {selectedCaseStudy === 'rds' && "AWS_DB_UNENCRYPTED — Unencrypted RDS Database Detected"}
                      {selectedCaseStudy === 'sg' && "AWS_SG_OPEN — Ingress Open to 0.0.0.0/0 on Sensitive Port"}
                      {selectedCaseStudy === 'iam' && "AWS_IAM_WILDCARD — Wildcard IAM Permissions Policy"}
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Safety Governance Tier</span>
                    <div style={{ marginTop: '0.2rem' }}>
                      {selectedCaseStudy === 's3' && <span className="badge badge-success">SAFE (Zero Risk AutoFix)</span>}
                      {selectedCaseStudy === 'rds' && <span className="badge badge-success">SAFE (Zero Risk AutoFix)</span>}
                      {selectedCaseStudy === 'sg' && <span className="badge badge-warning">REVIEW REQUIRED (IP Range Check)</span>}
                      {selectedCaseStudy === 'iam' && <span className="badge badge-error">NONE (Intentionally Refused)</span>}
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>3-Layer Verification Checks</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.4rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '0.25rem 0.5rem', borderRadius: '4px', background: 'rgba(255,255,255,0.01)' }}>
                        <span>Layer 1: HCL Syntax Check</span>
                        <span style={{ color: 'var(--success)', fontWeight: 600 }}>PASSED ✅</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '0.25rem 0.5rem', borderRadius: '4px', background: 'rgba(255,255,255,0.01)' }}>
                        <span>Layer 2: Terraform CLI Validate</span>
                        <span style={{ color: selectedCaseStudy === 'iam' ? 'var(--text-muted)' : 'var(--success)', fontWeight: 600 }}>
                          {selectedCaseStudy === 'iam' ? "N/A" : "PASSED ✅"}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '0.25rem 0.5rem', borderRadius: '4px', background: 'rgba(255,255,255,0.01)' }}>
                        <span>Layer 3: AST Resource Boundary Check</span>
                        <span style={{ color: selectedCaseStudy === 'iam' ? 'var(--text-muted)' : 'var(--success)', fontWeight: 600 }}>
                          {selectedCaseStudy === 'iam' ? "N/A" : "PASSED (Zero unintended mutations) ✅"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-secondary)' }}>PR Governance & Audit Trail</span>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: '0.4rem', background: 'rgba(255,255,255,0.01)', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                      {selectedCaseStudy === 's3' && (
                        <>
                          <div><strong>Developer Approval:</strong> Aryangupta replied <code>/approve</code> inside thread</div>
                          <div><strong>Drift Prevention:</strong> Preview hash verified, locking HEAD state</div>
                          <div><strong>Remediation Branch:</strong> <code>sentraai/fix/aws-s3-public-...</code></div>
                          <div><strong>Remediation PR:</strong> Auto-merged upon approval</div>
                        </>
                      )}
                      {selectedCaseStudy === 'rds' && (
                        <>
                          <div><strong>Developer Approval:</strong> sara-devops replied <code>/approve</code> inside thread</div>
                          <div><strong>Drift Prevention:</strong> Preview hash verified, locking HEAD state</div>
                          <div><strong>Remediation Branch:</strong> <code>sentraai/fix/aws-db-unencrypted-...</code></div>
                          <div><strong>Remediation PR:</strong> Auto-merged upon approval</div>
                        </>
                      )}
                      {selectedCaseStudy === 'sg' && (
                        <>
                          <div><strong>Developer Approval:</strong> Aryangupta replied <code>/approve</code> inside thread</div>
                          <div><strong>Drift Prevention:</strong> Preview hash verified</div>
                          <div><strong>Warning Flags:</strong> Remediation contains placeholder IP range. Requires manual edit.</div>
                          <div><strong>Remediation PR:</strong> Opened. Human merge required.</div>
                        </>
                      )}
                      {selectedCaseStudy === 'iam' && (
                        <>
                          <div><strong>Status:</strong> Security review comment posted.</div>
                          <div><strong>Restraint Applied:</strong> Auto-fix engine refused execution.</div>
                          <div><strong>Rationale:</strong> Wildcard actions <code>"*"</code> require context-dependent IAM policies. Automated changes could cause backend service authorization failure.</div>
                        </>
                      )}
                    </div>
                  </div>
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
