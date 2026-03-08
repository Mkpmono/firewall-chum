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
  Download, FileCode,
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
  const [showFullScript, setShowFullScript] = useState(false);

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiat în clipboard!" });
  };

  const hasConfig = domain && apiDomain && dbPass && jwtSecret;

  const generateFullScript = () => {
    const repo = gitRepo || "https://github.com/USER/REPO.git";
    const email = sslEmail || "admin@" + domain;
    const dashPassword = dashPass || "admin123";

    return `#!/bin/bash
# ╔══════════════════════════════════════════════════════════════╗
# ║  🛡️  Hoxta Firewall Manager — Script Complet de Instalare   ║
# ║  Generat automat din panoul Hoxta                            ║
# ║                                                              ║
# ║  ⚠️  RULEAZĂ CA ROOT PE UN VPS CURAT                         ║
# ║  Compatibil: Ubuntu 22.04+ / Debian 12+                     ║
# ╚══════════════════════════════════════════════════════════════╝

set -e

# ═══════════════════════════════════════
# CONFIGURARE — Valorile tale pre-completate
# ═══════════════════════════════════════
DOMAIN="${domain}"
API_DOMAIN="${apiDomain}"
SSL_EMAIL="${email}"
GIT_REPO="${repo}"
DB_PASS="${dbPass}"
JWT_SECRET="${jwtSecret}"
DASH_PASS="${dashPassword}"

RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
CYAN='\\033[0;36m'
NC='\\033[0m'

echo -e "\${CYAN}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  🛡️  Hoxta Firewall Manager — Instalare Automată           ║"
echo "║  Domeniu: \${DOMAIN}"
echo "║  API:     \${API_DOMAIN}"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "\${NC}"

# ═══════════════════════════════════════
# PASUL 1: Instalare dependințe
# ═══════════════════════════════════════
echo -e "\${YELLOW}[1/9] Instalare dependințe sistem...\${NC}"
apt update -qq
apt install -y docker.io docker-compose-plugin nginx certbot python3-certbot-nginx git curl
systemctl enable docker && systemctl start docker

# Instalare Node.js 20 (pentru build + JWT)
if ! command -v node &>/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 18 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
fi
echo -e "\${GREEN}✅ Dependințe instalate!\${NC}"

# ═══════════════════════════════════════
# PASUL 2: Instalare Supabase Self-Hosted
# ═══════════════════════════════════════
echo -e "\${YELLOW}[2/9] Instalare Supabase Docker...\${NC}"
cd /opt
if [ ! -d "supabase" ]; then
  git clone --depth 1 https://github.com/supabase/supabase
fi
cd /opt/supabase/docker
cp .env.example .env

# Configurare .env
sed -i "s|POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=\${DB_PASS}|" .env
sed -i "s|JWT_SECRET=.*|JWT_SECRET=\${JWT_SECRET}|" .env
sed -i "s|DASHBOARD_USERNAME=.*|DASHBOARD_USERNAME=admin|" .env
sed -i "s|DASHBOARD_PASSWORD=.*|DASHBOARD_PASSWORD=\${DASH_PASS}|" .env
sed -i "s|SITE_URL=.*|SITE_URL=https://\${DOMAIN}|" .env
sed -i "s|API_EXTERNAL_URL=.*|API_EXTERNAL_URL=https://\${API_DOMAIN}|" .env
sed -i "s|ENABLE_ANALYTICS=.*|ENABLE_ANALYTICS=false|" .env
echo -e "\${GREEN}✅ Supabase configurat!\${NC}"

# ═══════════════════════════════════════
# PASUL 3: Generare JWT Keys
# ═══════════════════════════════════════
echo -e "\${YELLOW}[3/9] Generare JWT keys (ANON + SERVICE_ROLE)...\${NC}"
npm install -g jsonwebtoken 2>/dev/null || npm install jsonwebtoken 2>/dev/null || true

ANON_KEY=$(node -e "try{const jwt=require('jsonwebtoken');console.log(jwt.sign({role:'anon',iss:'supabase',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+315360000},'\${JWT_SECRET}'))}catch(e){console.error('JWT generation failed:',e.message);process.exit(1)}")
SERVICE_KEY=$(node -e "try{const jwt=require('jsonwebtoken');console.log(jwt.sign({role:'service_role',iss:'supabase',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+315360000},'\${JWT_SECRET}'))}catch(e){console.error('JWT generation failed:',e.message);process.exit(1)}")

if [ -z "\$ANON_KEY" ] || [ "\$ANON_KEY" = "undefined" ]; then
  echo -e "\${RED}❌ Eroare la generarea JWT keys! Verifică Node.js și jsonwebtoken.\${NC}"
  exit 1
fi

# Actualizare .env cu cheile generate
sed -i "s|ANON_KEY=.*|ANON_KEY=\${ANON_KEY}|" /opt/supabase/docker/.env
sed -i "s|SERVICE_ROLE_KEY=.*|SERVICE_ROLE_KEY=\${SERVICE_KEY}|" /opt/supabase/docker/.env

echo -e "\${GREEN}✅ JWT keys generate și adăugate în .env!\${NC}"
echo -e "  ANON_KEY: \${ANON_KEY:0:30}..."
echo -e "  SERVICE_KEY: \${SERVICE_KEY:0:30}..."

# ═══════════════════════════════════════
# PASUL 4: Pornire Supabase
# ═══════════════════════════════════════
echo -e "\${YELLOW}[4/9] Pornire Supabase Docker...\${NC}"
cd /opt/supabase/docker
docker compose up -d

# Așteaptă ca DB-ul să fie gata
echo "  Așteptare pornire DB..."
for i in {1..30}; do
  if docker compose exec -T db pg_isready -U postgres &>/dev/null; then
    break
  fi
  sleep 2
  echo "  Încă se pornește... (\$i/30)"
done
echo -e "\${GREEN}✅ Supabase pornit!\${NC}"

# ═══════════════════════════════════════
# PASUL 5: Clonare și Build Aplicație
# ═══════════════════════════════════════
echo -e "\${YELLOW}[5/9] Clonare și build aplicație...\${NC}"
cd /opt
if [ ! -d "hoxta" ]; then
  git clone "\${GIT_REPO}" hoxta
else
  cd hoxta && git pull && cd /opt
fi
cd /opt/hoxta

cat > .env << EOF
VITE_SUPABASE_URL=https://\${API_DOMAIN}
VITE_SUPABASE_PUBLISHABLE_KEY=\${ANON_KEY}
VITE_SUPABASE_PROJECT_ID=local
EOF

npm install
npm run build
echo -e "\${GREEN}✅ Build complet!\${NC}"

# ═══════════════════════════════════════
# PASUL 6: Aplicare Migrări DB
# ═══════════════════════════════════════
echo -e "\${YELLOW}[6/9] Aplicare migrări bază de date...\${NC}"
MIGRATION_COUNT=0
for f in /opt/hoxta/supabase/migrations/*.sql; do
  if [ -f "\$f" ]; then
    echo "  Applying: \$(basename \$f)"
    docker compose -f /opt/supabase/docker/docker-compose.yml exec -T db psql -U postgres -d postgres < "\$f" 2>/dev/null || true
    MIGRATION_COUNT=\$((MIGRATION_COUNT + 1))
  fi
done
echo -e "\${GREEN}✅ \${MIGRATION_COUNT} migrări aplicate!\${NC}"

# ═══════════════════════════════════════
# PASUL 7: Configurare Nginx
# ═══════════════════════════════════════
echo -e "\${YELLOW}[7/9] Configurare Nginx...\${NC}"
cat > /etc/nginx/sites-available/hoxta << 'NGINX'
# Hoxta Frontend
server {
    listen 80;
    server_name DOMAIN_PLACEHOLDER;

    root /opt/hoxta/dist;
    index index.html;

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Gzip
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript image/svg+xml;
}

# Supabase API Proxy
server {
    listen 80;
    server_name API_DOMAIN_PLACEHOLDER;

    client_max_body_size 100M;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support (Realtime)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
NGINX

# Înlocuiește placeholder-ele cu domeniile reale
sed -i "s|DOMAIN_PLACEHOLDER|\${DOMAIN}|g" /etc/nginx/sites-available/hoxta
sed -i "s|API_DOMAIN_PLACEHOLDER|\${API_DOMAIN}|g" /etc/nginx/sites-available/hoxta

ln -sf /etc/nginx/sites-available/hoxta /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
echo -e "\${GREEN}✅ Nginx configurat!\${NC}"

# ═══════════════════════════════════════
# PASUL 8: SSL cu Let's Encrypt
# ═══════════════════════════════════════
echo -e "\${YELLOW}[8/9] Obținere certificat SSL...\${NC}"
certbot --nginx -d "\${DOMAIN}" -d "\${API_DOMAIN}" --email "\${SSL_EMAIL}" --agree-tos --non-interactive || {
  echo -e "\${RED}⚠️  SSL eșuat! Verifică:"
  echo "  - DNS-ul pentru \${DOMAIN} și \${API_DOMAIN} trebuie să indice spre acest server"
  echo "  - Porturile 80 și 443 trebuie să fie deschise"
  echo -e "  Poți rula manual: certbot --nginx -d \${DOMAIN} -d \${API_DOMAIN}\${NC}"
}

# ═══════════════════════════════════════
# PASUL 9: Setup Edge Functions (Deno)
# ═══════════════════════════════════════
echo -e "\${YELLOW}[9/9] Instalare Deno + Edge Functions...\${NC}"
if ! command -v deno &>/dev/null; then
  curl -fsSL https://deno.land/install.sh | sh
  export PATH="\$HOME/.deno/bin:\$PATH"
  echo 'export PATH="\$HOME/.deno/bin:\$PATH"' >> ~/.bashrc
fi

DENO_PATH="\$(which deno 2>/dev/null || echo "\$HOME/.deno/bin/deno")"

# Serviciu: Agent Sync
cat > /etc/systemd/system/hoxta-agent-sync.service << EOF
[Unit]
Description=Hoxta Agent Sync Function
After=network.target docker.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/hoxta
ExecStart=\${DENO_PATH} run --allow-net --allow-env --allow-read supabase/functions/agent-sync/index.ts
Restart=always
RestartSec=5
Environment=SUPABASE_URL=http://localhost:8000
Environment=SUPABASE_SERVICE_ROLE_KEY=\${SERVICE_KEY}

[Install]
WantedBy=multi-user.target
EOF

# Serviciu: Firewall Sync
cat > /etc/systemd/system/hoxta-firewall-sync.service << EOF
[Unit]
Description=Hoxta Firewall Sync Function
After=network.target docker.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/hoxta
ExecStart=\${DENO_PATH} run --allow-net --allow-env --allow-read supabase/functions/firewall-sync/index.ts
Restart=always
RestartSec=5
Environment=SUPABASE_URL=http://localhost:8000
Environment=SUPABASE_SERVICE_ROLE_KEY=\${SERVICE_KEY}

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now hoxta-agent-sync hoxta-firewall-sync 2>/dev/null || true
echo -e "\${GREEN}✅ Edge Functions configurate!\${NC}"

# ═══════════════════════════════════════
# FINALIZARE
# ═══════════════════════════════════════
echo ""
echo -e "\${GREEN}╔══════════════════════════════════════════════════════════════╗\${NC}"
echo -e "\${GREEN}║  🎉 HOXTA INSTALAT CU SUCCES!                              ║\${NC}"
echo -e "\${GREEN}╚══════════════════════════════════════════════════════════════╝\${NC}"
echo ""
echo -e "  🌐 Frontend:    \${CYAN}https://\${DOMAIN}\${NC}"
echo -e "  🔌 API:         \${CYAN}https://\${API_DOMAIN}\${NC}"
echo -e "  📊 Dashboard:   \${CYAN}http://localhost:8000\${NC} (admin / \${DASH_PASS})"
echo ""
echo -e "  \${YELLOW}═══ PAȘI URMĂTORI ═══\${NC}"
echo ""
echo -e "  1. Deschide \${CYAN}https://\${DOMAIN}\${NC} și creează-ți un cont"
echo ""
echo -e "  2. Setează-te ca admin:"
echo -e "     \${CYAN}docker compose -f /opt/supabase/docker/docker-compose.yml exec db psql -U postgres -c \\"SELECT id, email FROM auth.users;\\"\${NC}"
echo -e "     \${CYAN}docker compose -f /opt/supabase/docker/docker-compose.yml exec db psql -U postgres -c \\"INSERT INTO public.user_roles (user_id, role) VALUES ('USER_ID_AICI', 'admin');\\"\${NC}"
echo ""
echo -e "  \${YELLOW}═══ COMENZI UTILE ═══\${NC}"
echo ""
echo -e "  Backup DB:     \${CYAN}docker compose -f /opt/supabase/docker/docker-compose.yml exec db pg_dump -U postgres postgres > backup_\\$(date +%Y%m%d).sql\${NC}"
echo -e "  Update app:    \${CYAN}cd /opt/hoxta && git pull && npm install && npm run build\${NC}"
echo -e "  Loguri agent:  \${CYAN}journalctl -u hoxta-agent-sync -f\${NC}"
echo -e "  Loguri firewall:\${CYAN}journalctl -u hoxta-firewall-sync -f\${NC}"
echo -e "  Status Docker: \${CYAN}docker compose -f /opt/supabase/docker/docker-compose.yml ps\${NC}"
echo -e "  Restart tot:   \${CYAN}docker compose -f /opt/supabase/docker/docker-compose.yml restart && systemctl restart hoxta-agent-sync hoxta-firewall-sync\${NC}"
echo ""
`;
  };

  const generateUninstallScript = () => {
    return `#!/bin/bash
# ╔══════════════════════════════════════════════════════════════╗
# ║  🗑️  Hoxta Firewall Manager — Dezinstalare Completă         ║
# ╚══════════════════════════════════════════════════════════════╝

set -e

RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
NC='\\033[0m'

echo -e "\${RED}⚠️  ATENȚIE: Acest script va șterge TOTUL (DB, aplicație, config)!\${NC}"
read -p "Ești sigur? (scrie 'DA' pentru confirmare): " CONFIRM
if [ "\$CONFIRM" != "DA" ]; then
  echo "Anulat."
  exit 0
fi

echo -e "\${YELLOW}[1/5] Oprire Edge Functions...\${NC}"
systemctl stop hoxta-agent-sync hoxta-firewall-sync 2>/dev/null || true
systemctl disable hoxta-agent-sync hoxta-firewall-sync 2>/dev/null || true
rm -f /etc/systemd/system/hoxta-agent-sync.service
rm -f /etc/systemd/system/hoxta-firewall-sync.service
systemctl daemon-reload

echo -e "\${YELLOW}[2/5] Oprire Supabase Docker...\${NC}"
cd /opt/supabase/docker 2>/dev/null && docker compose down -v || true

echo -e "\${YELLOW}[3/5] Ștergere fișiere...\${NC}"
rm -rf /opt/hoxta
rm -rf /opt/supabase

echo -e "\${YELLOW}[4/5] Ștergere config Nginx...\${NC}"
rm -f /etc/nginx/sites-enabled/hoxta
rm -f /etc/nginx/sites-available/hoxta
nginx -t && systemctl reload nginx 2>/dev/null || true

echo -e "\${YELLOW}[5/5] Ștergere certificate SSL...\${NC}"
certbot delete --cert-name ${domain || "domeniul-tau.com"} --non-interactive 2>/dev/null || true
certbot delete --cert-name ${apiDomain || "api.domeniul-tau.com"} --non-interactive 2>/dev/null || true

echo -e "\${GREEN}✅ Hoxta dezinstalat complet!\${NC}"
echo -e "  Docker și Nginx rămân instalate. Dezinstalează manual dacă vrei:"
echo -e "  apt remove -y docker.io docker-compose-plugin nginx certbot"
`;
  };

  const generateHealthCheckScript = () => {
    return `#!/bin/bash
# ╔══════════════════════════════════════════════════════════════╗
# ║  🩺 Hoxta Health Check — Verificare Status Servicii          ║
# ╚══════════════════════════════════════════════════════════════╝

GREEN='\\033[0;32m'
RED='\\033[0;31m'
YELLOW='\\033[1;33m'
NC='\\033[0m'

echo "🩺 Verificare status Hoxta..."
echo ""

# Docker
if docker compose -f /opt/supabase/docker/docker-compose.yml ps 2>/dev/null | grep -q "running"; then
  echo -e "  ✅ \${GREEN}Supabase Docker — Rulează\${NC}"
else
  echo -e "  ❌ \${RED}Supabase Docker — OPRIT\${NC}"
  echo -e "     Fix: \${YELLOW}cd /opt/supabase/docker && docker compose up -d\${NC}"
fi

# PostgreSQL
if docker compose -f /opt/supabase/docker/docker-compose.yml exec -T db pg_isready -U postgres &>/dev/null; then
  echo -e "  ✅ \${GREEN}PostgreSQL — Gata\${NC}"
else
  echo -e "  ❌ \${RED}PostgreSQL — NU răspunde\${NC}"
fi

# Nginx
if systemctl is-active --quiet nginx; then
  echo -e "  ✅ \${GREEN}Nginx — Rulează\${NC}"
else
  echo -e "  ❌ \${RED}Nginx — OPRIT\${NC}"
  echo -e "     Fix: \${YELLOW}systemctl start nginx\${NC}"
fi

# Edge Functions
if systemctl is-active --quiet hoxta-agent-sync; then
  echo -e "  ✅ \${GREEN}Agent Sync — Rulează\${NC}"
else
  echo -e "  ❌ \${RED}Agent Sync — OPRIT\${NC}"
  echo -e "     Fix: \${YELLOW}systemctl start hoxta-agent-sync\${NC}"
fi

if systemctl is-active --quiet hoxta-firewall-sync; then
  echo -e "  ✅ \${GREEN}Firewall Sync — Rulează\${NC}"
else
  echo -e "  ❌ \${RED}Firewall Sync — OPRIT\${NC}"
  echo -e "     Fix: \${YELLOW}systemctl start hoxta-firewall-sync\${NC}"
fi

# SSL
if [ -f "/etc/letsencrypt/live/${domain || "domeniul-tau.com"}/fullchain.pem" ]; then
  EXPIRY=$(openssl x509 -enddate -noout -in "/etc/letsencrypt/live/${domain || "domeniul-tau.com"}/fullchain.pem" 2>/dev/null | cut -d= -f2)
  echo -e "  ✅ \${GREEN}SSL — Valid (expiră: \$EXPIRY)\${NC}"
else
  echo -e "  ⚠️  \${YELLOW}SSL — Certificat negăsit\${NC}"
fi

# Disk space
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}')
echo -e "  💾 Disk usage: \${DISK_USAGE}"

# Memory
MEM_USAGE=$(free -m | awk 'NR==2 {printf "%dMB / %dMB (%.0f%%)", $3, $2, $3/$2*100}')
echo -e "  🧠 RAM: \${MEM_USAGE}"

echo ""
echo "Done! 🩺"
`;
  };

  const downloadScript = (content: string, filename: string) => {
    const blob = new Blob([content], { type: "text/x-shellscript" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: `${filename} descărcat!` });
  };

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
            Completează datele VPS-ului tău. Comenzile și scripturile se vor actualiza automat.
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
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Configurație completă
              </Badge>
              <Button size="sm" variant="outline" onClick={copyAllCommands} className="rounded-xl text-xs">
                <Copy className="h-3 w-3 mr-1" /> Copiază comenzile pas cu pas
              </Button>
            </div>
          )}
        </div>

        {/* SCRIPTURI COMPLETE - new section */}
        {hasConfig && (
          <div className="glass rounded-2xl p-6 mb-8 border border-primary/20">
            <h2 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
              <FileCode className="h-5 w-5 text-primary" />
              📦 Scripturi Complete (gata de rulat)
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              Scripturile de mai jos conțin TOȚI pașii combinați. Descarcă sau copiază, apoi rulează pe VPS.
            </p>

            <div className="grid sm:grid-cols-3 gap-3 mb-4">
              {/* Install script */}
              <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
                <div className="flex items-center gap-2 mb-2">
                  <Download className="h-4 w-4 text-emerald-400" />
                  <span className="text-sm font-semibold text-foreground">install.sh</span>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Instalare completă automată — 9 pași într-un singur script
                </p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => downloadScript(generateFullScript(), "hoxta-install.sh")} className="rounded-xl text-xs gradient-btn text-primary-foreground border-0">
                    <Download className="h-3 w-3 mr-1" /> Descarcă
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => copy(generateFullScript())} className="rounded-xl text-xs">
                    <Copy className="h-3 w-3 mr-1" /> Copiază
                  </Button>
                </div>
              </div>

              {/* Uninstall script */}
              <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
                <div className="flex items-center gap-2 mb-2">
                  <Download className="h-4 w-4 text-red-400" />
                  <span className="text-sm font-semibold text-foreground">uninstall.sh</span>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Dezinstalare completă — șterge tot de pe VPS
                </p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => downloadScript(generateUninstallScript(), "hoxta-uninstall.sh")} className="rounded-xl text-xs" variant="destructive">
                    <Download className="h-3 w-3 mr-1" /> Descarcă
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => copy(generateUninstallScript())} className="rounded-xl text-xs">
                    <Copy className="h-3 w-3 mr-1" /> Copiază
                  </Button>
                </div>
              </div>

              {/* Health check script */}
              <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
                <div className="flex items-center gap-2 mb-2">
                  <Download className="h-4 w-4 text-blue-400" />
                  <span className="text-sm font-semibold text-foreground">health-check.sh</span>
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  Verificare rapidă — status servicii, disk, RAM
                </p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => downloadScript(generateHealthCheckScript(), "hoxta-health-check.sh")} className="rounded-xl text-xs bg-blue-600 hover:bg-blue-700 text-white border-0">
                    <Download className="h-3 w-3 mr-1" /> Descarcă
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => copy(generateHealthCheckScript())} className="rounded-xl text-xs">
                    <Copy className="h-3 w-3 mr-1" /> Copiază
                  </Button>
                </div>
              </div>
            </div>

            {/* Quick usage */}
            <div className="bg-muted/30 rounded-xl p-3 border border-border/50">
              <p className="text-xs font-semibold text-foreground mb-2">🚀 Utilizare rapidă:</p>
              <pre className="text-xs font-mono text-muted-foreground">
{`# Pe VPS (ca root):
# 1. Upload sau paste scriptul, apoi:
chmod +x hoxta-install.sh
./hoxta-install.sh

# Sau direct cu curl + paste:
bash -c "$(cat << 'SCRIPT'
... paste script content here ...
SCRIPT
)"`}
              </pre>
            </div>

            {/* Show full script preview */}
            <Button
              variant="ghost"
              size="sm"
              className="mt-3 text-xs text-muted-foreground"
              onClick={() => setShowFullScript(!showFullScript)}
            >
              {showFullScript ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
              {showFullScript ? "Ascunde" : "Previzualizare"} install.sh
            </Button>

            {showFullScript && (
              <div className="mt-3 bg-muted/30 rounded-xl p-3 border border-border/50 max-h-96 overflow-auto relative">
                <Button
                  variant="ghost" size="icon"
                  className="absolute top-2 right-2 h-7 w-7 rounded-lg"
                  onClick={() => copy(generateFullScript())}
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
                <pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap pr-8">
                  {generateFullScript()}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* Steps */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Terminal className="h-5 w-5 text-primary" />
            Pași individuali (detaliat)
          </h2>
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