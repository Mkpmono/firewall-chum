import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import {
  Shield, ArrowLeft, LogOut, Copy, Terminal, Server, Database,
  Globe, Lock, HardDrive, CheckCircle2, ChevronDown, ChevronUp,
} from "lucide-react";

const SelfHostSetup = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [domain, setDomain] = useState("");
  const [apiDomain, setApiDomain] = useState("");
  const [sslEmail, setSslEmail] = useState("");
  const [gitRepo, setGitRepo] = useState("");
  const [dbPass, setDbPass] = useState("");
  const [jwtSecret, setJwtSecret] = useState("");
  const [dashPass, setDashPass] = useState("");
  const [expandedStep, setExpandedStep] = useState<number | null>(0);

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiat în clipboard!" });
  };

  const hasConfig = domain && apiDomain && dbPass && jwtSecret;

  const steps = [
    {
      title: "Pregătire VPS",
      icon: <Server className="h-4 w-4" />,
      description: "Instalează Docker, Nginx și dependințele necesare",
      commands: [
        "apt update && apt upgrade -y",
        "apt install -y docker.io docker-compose-plugin nginx certbot python3-certbot-nginx git curl",
        "systemctl enable docker && systemctl start docker",
      ],
    },
    {
      title: "Instalare Supabase Self-Hosted",
      icon: <Database className="h-4 w-4" />,
      description: "Baza de date + Auth + Realtime — totul local",
      commands: [
        "cd /opt && git clone --depth 1 https://github.com/supabase/supabase",
        "cd /opt/supabase/docker && cp .env.example .env",
        ...(hasConfig ? [
          `# Editează /opt/supabase/docker/.env cu:`,
          `sed -i "s|POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${dbPass}|" /opt/supabase/docker/.env`,
          `sed -i "s|JWT_SECRET=.*|JWT_SECRET=${jwtSecret}|" /opt/supabase/docker/.env`,
          `sed -i "s|SITE_URL=.*|SITE_URL=https://${domain}|" /opt/supabase/docker/.env`,
          `sed -i "s|API_EXTERNAL_URL=.*|API_EXTERNAL_URL=https://${apiDomain}|" /opt/supabase/docker/.env`,
          ...(dashPass ? [`sed -i "s|DASHBOARD_PASSWORD=.*|DASHBOARD_PASSWORD=${dashPass}|" /opt/supabase/docker/.env`] : []),
        ] : [
          `# ⚠️ Completează configurația mai sus pentru a genera comenzile`,
        ]),
        "cd /opt/supabase/docker && docker compose up -d",
      ],
    },
    {
      title: "Generare JWT Keys",
      icon: <Lock className="h-4 w-4" />,
      description: "Generează ANON_KEY și SERVICE_ROLE_KEY",
      commands: [
        "apt install -y nodejs npm && npm install -g jsonwebtoken 2>/dev/null || true",
        ...(jwtSecret ? [
          `node -e "const jwt=require('jsonwebtoken');console.log('ANON_KEY='+jwt.sign({role:'anon',iss:'supabase',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+315360000},'${jwtSecret}'))"`,
          `node -e "const jwt=require('jsonwebtoken');console.log('SERVICE_ROLE_KEY='+jwt.sign({role:'service_role',iss:'supabase',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+315360000},'${jwtSecret}'))"`,
          `# Copiază output-ul și adaugă-l în /opt/supabase/docker/.env`,
          `# Apoi: cd /opt/supabase/docker && docker compose down && docker compose up -d`,
        ] : [
          `# ⚠️ Completează JWT Secret mai sus`,
        ]),
      ],
    },
    {
      title: "Clonare & Build Aplicație",
      icon: <Globe className="h-4 w-4" />,
      description: "Clonează repo-ul și construiește frontend-ul",
      commands: [
        ...(gitRepo ? [`cd /opt && git clone ${gitRepo} hoxta`] : [`cd /opt && git clone https://github.com/USER/REPO.git hoxta`]),
        "cd /opt/hoxta",
        ...(hasConfig ? [
          `cat > /opt/hoxta/.env << 'EOF'`,
          `VITE_SUPABASE_URL=https://${apiDomain}`,
          `VITE_SUPABASE_PUBLISHABLE_KEY=ANON_KEY_DE_LA_PASUL_3`,
          `VITE_SUPABASE_PROJECT_ID=local`,
          `EOF`,
        ] : [
          `# ⚠️ Completează configurația mai sus`,
        ]),
        "cd /opt/hoxta && npm install && npm run build",
      ],
    },
    {
      title: "Migrări Bază de Date",
      icon: <Database className="h-4 w-4" />,
      description: "Aplică schema bazei de date",
      commands: [
        "# Așteaptă 10 secunde ca DB să pornească complet",
        "sleep 10",
        `for f in /opt/hoxta/supabase/migrations/*.sql; do echo "Applying: $f"; docker compose -f /opt/supabase/docker/docker-compose.yml exec -T db psql -U postgres -d postgres < "$f"; done`,
      ],
    },
    {
      title: "Configurare Nginx",
      icon: <Globe className="h-4 w-4" />,
      description: "Proxy pentru frontend și API",
      commands: [
        ...(hasConfig ? [
          `cat > /etc/nginx/sites-available/hoxta << 'NGINX'`,
          `server {`,
          `    listen 80;`,
          `    server_name ${domain};`,
          `    root /opt/hoxta/dist;`,
          `    index index.html;`,
          `    location / { try_files $uri $uri/ /index.html; }`,
          `    gzip on;`,
          `    gzip_types text/plain text/css application/json application/javascript;`,
          `}`,
          ``,
          `server {`,
          `    listen 80;`,
          `    server_name ${apiDomain};`,
          `    location / {`,
          `        proxy_pass http://localhost:8000;`,
          `        proxy_set_header Host $host;`,
          `        proxy_set_header X-Real-IP $remote_addr;`,
          `        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`,
          `        proxy_set_header X-Forwarded-Proto $scheme;`,
          `        proxy_http_version 1.1;`,
          `        proxy_set_header Upgrade $http_upgrade;`,
          `        proxy_set_header Connection "upgrade";`,
          `    }`,
          `}`,
          `NGINX`,
        ] : [
          `# ⚠️ Completează domeniile mai sus`,
        ]),
        `ln -sf /etc/nginx/sites-available/hoxta /etc/nginx/sites-enabled/`,
        `rm -f /etc/nginx/sites-enabled/default`,
        `nginx -t && systemctl reload nginx`,
      ],
    },
    {
      title: "SSL (Let's Encrypt)",
      icon: <Lock className="h-4 w-4" />,
      description: "Certificat SSL gratuit",
      commands: [
        ...(domain && apiDomain ? [
          `certbot --nginx -d ${domain} -d ${apiDomain}${sslEmail ? ` --email ${sslEmail}` : ""} --agree-tos${sslEmail ? " --non-interactive" : ""}`,
        ] : [
          `# ⚠️ Completează domeniile mai sus`,
        ]),
      ],
    },
    {
      title: "Setup Edge Functions (Deno)",
      icon: <Terminal className="h-4 w-4" />,
      description: "Funcțiile backend pentru agent sync și firewall",
      commands: [
        `curl -fsSL https://deno.land/install.sh | sh`,
        `export PATH="$HOME/.deno/bin:$PATH"`,
        ``,
        `# Creează serviciu systemd pentru agent-sync`,
        `cat > /etc/systemd/system/hoxta-agent-sync.service << 'EOF'`,
        `[Unit]`,
        `Description=Hoxta Agent Sync`,
        `After=network.target docker.service`,
        `[Service]`,
        `Type=simple`,
        `WorkingDirectory=/opt/hoxta`,
        `ExecStart=/root/.deno/bin/deno run --allow-net --allow-env --allow-read supabase/functions/agent-sync/index.ts`,
        `Restart=always`,
        `RestartSec=5`,
        ...(hasConfig ? [
          `Environment=SUPABASE_URL=http://localhost:8000`,
          `Environment=SUPABASE_SERVICE_ROLE_KEY=SERVICE_ROLE_KEY_DE_LA_PASUL_3`,
        ] : []),
        `[Install]`,
        `WantedBy=multi-user.target`,
        `EOF`,
        ``,
        `# Creează serviciu systemd pentru firewall-sync`,
        `cat > /etc/systemd/system/hoxta-firewall-sync.service << 'EOF'`,
        `[Unit]`,
        `Description=Hoxta Firewall Sync`,
        `After=network.target docker.service`,
        `[Service]`,
        `Type=simple`,
        `WorkingDirectory=/opt/hoxta`,
        `ExecStart=/root/.deno/bin/deno run --allow-net --allow-env --allow-read supabase/functions/firewall-sync/index.ts`,
        `Restart=always`,
        `RestartSec=5`,
        ...(hasConfig ? [
          `Environment=SUPABASE_URL=http://localhost:8000`,
          `Environment=SUPABASE_SERVICE_ROLE_KEY=SERVICE_ROLE_KEY_DE_LA_PASUL_3`,
        ] : []),
        `[Install]`,
        `WantedBy=multi-user.target`,
        `EOF`,
        ``,
        `systemctl daemon-reload`,
        `systemctl enable --now hoxta-agent-sync hoxta-firewall-sync`,
      ],
    },
    {
      title: "Creare Admin",
      icon: <Shield className="h-4 w-4" />,
      description: "Înregistrează-te pe site, apoi setează-te ca admin",
      commands: [
        `# 1. Deschide https://${domain || "domeniul-tau.com"} și înregistrează-te`,
        `# 2. Găsește-ți user_id-ul:`,
        `docker compose -f /opt/supabase/docker/docker-compose.yml exec db psql -U postgres -c "SELECT id, email FROM auth.users;"`,
        ``,
        `# 3. Setează-te ca admin (înlocuiește USER_ID):`,
        `docker compose -f /opt/supabase/docker/docker-compose.yml exec db psql -U postgres -c "INSERT INTO public.user_roles (user_id, role) VALUES ('USER_ID_AICI', 'admin');"`,
      ],
    },
  ];

  const copyAllCommands = () => {
    const allCommands = steps.flatMap((step, i) => [
      `# ═══════════════════════════════════`,
      `# Pasul ${i + 1}: ${step.title}`,
      `# ═══════════════════════════════════`,
      ...step.commands,
      "",
    ]).join("\n");
    copy(allCommands);
    toast({ title: "Toate comenzile copiate!" });
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 glass sticky top-0 z-40">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin")} className="h-9 w-9 rounded-xl">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-bold text-foreground text-lg">
              Ho<span className="gradient-text">x</span>ta
            </span>
            <Badge className="gradient-btn text-primary-foreground border-0 text-xs">Self-Host Setup</Badge>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground hidden sm:block">{user?.email}</span>
            <Button variant="ghost" size="icon" onClick={() => signOut()} className="h-9 w-9 rounded-xl">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Config section */}
        <div className="glass rounded-2xl p-6 mb-8">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-primary" />
            Configurare VPS
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Completează datele VPS-ului tău. Comenzile de mai jos se vor actualiza automat.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Domeniu Frontend *</label>
              <Input value={domain} onChange={e => setDomain(e.target.value)} placeholder="hoxta.domeniul-tau.com" className="bg-muted/50 border-border/50 text-sm rounded-xl" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Domeniu API *</label>
              <Input value={apiDomain} onChange={e => setApiDomain(e.target.value)} placeholder="api.domeniul-tau.com" className="bg-muted/50 border-border/50 text-sm rounded-xl" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Parola PostgreSQL *</label>
              <Input type="password" value={dbPass} onChange={e => setDbPass(e.target.value)} placeholder="parola-puternică" className="bg-muted/50 border-border/50 text-sm rounded-xl" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">JWT Secret * (min 32 char)</label>
              <Input type="password" value={jwtSecret} onChange={e => setJwtSecret(e.target.value)} placeholder="secret-jwt-aleator" className="bg-muted/50 border-border/50 text-sm rounded-xl" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Email SSL (opțional)</label>
              <Input type="email" value={sslEmail} onChange={e => setSslEmail(e.target.value)} placeholder="email@exemplu.com" className="bg-muted/50 border-border/50 text-sm rounded-xl" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Parola Dashboard (opțional)</label>
              <Input type="password" value={dashPass} onChange={e => setDashPass(e.target.value)} placeholder="parola-dashboard" className="bg-muted/50 border-border/50 text-sm rounded-xl" />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">URL Repo Git (opțional)</label>
              <Input value={gitRepo} onChange={e => setGitRepo(e.target.value)} placeholder="https://github.com/user/repo.git" className="bg-muted/50 border-border/50 text-sm rounded-xl" />
            </div>
          </div>
          {hasConfig && (
            <div className="mt-4 flex gap-2">
              <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Configurație completă
              </Badge>
              <Button size="sm" variant="outline" onClick={copyAllCommands} className="rounded-xl text-xs">
                <Copy className="h-3 w-3 mr-1" /> Copiază toate comenzile
              </Button>
            </div>
          )}
        </div>

        {/* Steps */}
        <div className="space-y-3">
          {steps.map((step, i) => (
            <div key={i} className="glass rounded-2xl overflow-hidden">
              <button
                onClick={() => setExpandedStep(expandedStep === i ? null : i)}
                className="w-full p-4 flex items-center gap-3 text-left hover:bg-muted/30 transition-colors"
              >
                <div className="h-8 w-8 rounded-xl gradient-btn flex items-center justify-center text-primary-foreground text-sm font-bold shrink-0">
                  {i + 1}
                </div>
                <div className="text-primary">{step.icon}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{step.title}</p>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                </div>
                {expandedStep === i ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
              {expandedStep === i && (
                <div className="px-4 pb-4">
                  <div className="bg-muted/30 rounded-xl p-3 relative border border-border/50">
                    <Button
                      variant="ghost" size="icon"
                      className="absolute top-2 right-2 h-7 w-7 rounded-lg"
                      onClick={() => copy(step.commands.join("\n"))}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <pre className="text-xs font-mono text-foreground/90 whitespace-pre-wrap pr-8 overflow-x-auto">
                      {step.commands.join("\n")}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Post-install */}
        <div className="glass rounded-2xl p-6 mt-8">
          <h3 className="text-sm font-semibold text-foreground mb-3">🎉 După instalare</h3>
          <div className="text-xs text-muted-foreground space-y-2">
            <p>• <strong>Frontend:</strong> <code className="text-primary">https://{domain || "domeniul-tau.com"}</code></p>
            <p>• <strong>API:</strong> <code className="text-primary">https://{apiDomain || "api.domeniul-tau.com"}</code></p>
            <p>• <strong>Backup DB:</strong> <code className="text-primary">docker compose -f /opt/supabase/docker/docker-compose.yml exec db pg_dump -U postgres postgres &gt; backup.sql</code></p>
            <p>• <strong>Update app:</strong> <code className="text-primary">cd /opt/hoxta && git pull && npm run build</code></p>
            <p>• <strong>Loguri:</strong> <code className="text-primary">journalctl -u hoxta-agent-sync -f</code></p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default SelfHostSetup;
