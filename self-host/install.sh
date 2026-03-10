#!/bin/bash
# ╔══════════════════════════════════════════════════════════════╗
# ║  Hoxta Firewall Manager - Self-Hosted Installer             ║
# ║  Instalează totul local: Supabase + App + Nginx + SSL       ║
# ║  Compatibil: Ubuntu 22.04+, Debian 12+                      ║
# ╚══════════════════════════════════════════════════════════════╝

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  🛡️  Hoxta Firewall Manager - Self-Hosted Installer        ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# ── Collect info ──
read -p "Domeniu pentru frontend (ex: hoxta.exemplu.com): " DOMAIN
read -p "Domeniu pentru API (ex: api.exemplu.com): " API_DOMAIN
read -p "Email pentru SSL (Let's Encrypt): " SSL_EMAIL
read -p "URL repo Git (ex: https://github.com/user/repo.git): " GIT_REPO
read -sp "Parola PostgreSQL: " DB_PASS
echo
read -sp "JWT Secret (minim 32 caractere): " JWT_SECRET
echo
read -sp "Parola dashboard Supabase: " DASH_PASS
echo

echo ""
echo -e "${YELLOW}[1/8] Instalare dependințe...${NC}"
apt update -qq
apt install -y docker.io docker-compose-plugin nginx certbot python3-certbot-nginx git curl nodejs npm iptables iptables-persistent ipset

systemctl enable docker && systemctl start docker

echo -e "${YELLOW}[1.5/8] Verificare și configurare iptables...${NC}"
# Verify iptables is working
if command -v iptables &>/dev/null; then
  echo -e "${GREEN}  ✅ iptables instalat: $(iptables --version)${NC}"
else
  echo -e "${RED}  ❌ iptables nu s-a instalat corect!${NC}"
  exit 1
fi

# Verify ipset
if command -v ipset &>/dev/null; then
  echo -e "${GREEN}  ✅ ipset instalat: $(ipset --version | head -1)${NC}"
else
  echo -e "${YELLOW}  ⚠️ ipset nu este disponibil - GeoIP blocking nu va funcționa${NC}"
fi

# Enable iptables persistence
if command -v netfilter-persistent &>/dev/null; then
  systemctl enable netfilter-persistent 2>/dev/null || true
  echo -e "${GREEN}  ✅ iptables persistence activat${NC}"
fi

# Set default policies (safe defaults)
iptables -P INPUT ACCEPT
iptables -P FORWARD ACCEPT
iptables -P OUTPUT ACCEPT

# Ensure SSH is always allowed first
iptables -C INPUT -p tcp --dport 22 -j ACCEPT 2>/dev/null || iptables -I INPUT 1 -p tcp --dport 22 -j ACCEPT

# Save current rules
iptables-save > /etc/iptables/rules.v4 2>/dev/null || true
echo -e "${GREEN}  ✅ iptables configurat și verificat${NC}"

echo -e "${YELLOW}[2/8] Instalare Supabase Self-Hosted...${NC}"
cd /opt
if [ ! -d "supabase" ]; then
  git clone --depth 1 https://github.com/supabase/supabase
fi
cd supabase/docker
cp .env.example .env

# Generate JWT keys
ANON_KEY=$(node -e "const jwt=require('jsonwebtoken');console.log(jwt.sign({role:'anon',iss:'supabase',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+315360000},'${JWT_SECRET}'))" 2>/dev/null || echo "GENERATE_MANUALLY")
SERVICE_KEY=$(node -e "const jwt=require('jsonwebtoken');console.log(jwt.sign({role:'service_role',iss:'supabase',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+315360000},'${JWT_SECRET}'))" 2>/dev/null || echo "GENERATE_MANUALLY")

# Update .env
sed -i "s|POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=${DB_PASS}|" .env
sed -i "s|JWT_SECRET=.*|JWT_SECRET=${JWT_SECRET}|" .env
sed -i "s|ANON_KEY=.*|ANON_KEY=${ANON_KEY}|" .env
sed -i "s|SERVICE_ROLE_KEY=.*|SERVICE_ROLE_KEY=${SERVICE_KEY}|" .env
sed -i "s|DASHBOARD_USERNAME=.*|DASHBOARD_USERNAME=admin|" .env
sed -i "s|DASHBOARD_PASSWORD=.*|DASHBOARD_PASSWORD=${DASH_PASS}|" .env
sed -i "s|SITE_URL=.*|SITE_URL=https://${DOMAIN}|" .env
sed -i "s|API_EXTERNAL_URL=.*|API_EXTERNAL_URL=https://${API_DOMAIN}|" .env

docker compose up -d
echo -e "${GREEN}✅ Supabase pornit!${NC}"

echo -e "${YELLOW}[3/8] Clonare și build aplicație...${NC}"
cd /opt
if [ ! -d "hoxta" ]; then
  git clone "$GIT_REPO" hoxta
fi
cd hoxta

cat > .env << EOF
VITE_SUPABASE_URL=https://${API_DOMAIN}
VITE_SUPABASE_PUBLISHABLE_KEY=${ANON_KEY}
VITE_SUPABASE_PROJECT_ID=local
EOF

npm install
npm run build
echo -e "${GREEN}✅ Build complet!${NC}"

echo -e "${YELLOW}[4/8] Aplicare migrări DB...${NC}"
# Wait for DB to be ready
sleep 5
for f in supabase/migrations/*.sql; do
  echo "  Applying: $f"
  docker compose -f /opt/supabase/docker/docker-compose.yml exec -T db psql -U postgres -d postgres < "$f" 2>/dev/null || true
done
echo -e "${GREEN}✅ Migrări aplicate!${NC}"

echo -e "${YELLOW}[5/7] Configurare Nginx...${NC}"
cat > /etc/nginx/sites-available/hoxta << NGINX
server {
    listen 80;
    server_name ${DOMAIN};
    root /opt/hoxta/dist;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
}

server {
    listen 80;
    server_name ${API_DOMAIN};

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
NGINX

ln -sf /etc/nginx/sites-available/hoxta /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
echo -e "${GREEN}✅ Nginx configurat!${NC}"

echo -e "${YELLOW}[6/7] SSL cu Let's Encrypt...${NC}"
certbot --nginx -d "${DOMAIN}" -d "${API_DOMAIN}" --email "${SSL_EMAIL}" --agree-tos --non-interactive || echo -e "${RED}⚠️ SSL eșuat - verifică DNS-ul${NC}"

echo -e "${YELLOW}[7/7] Setup Edge Functions cu Deno...${NC}"
if ! command -v deno &>/dev/null; then
  curl -fsSL https://deno.land/install.sh | sh
  export PATH="$HOME/.deno/bin:$PATH"
fi

# Create systemd services for edge functions
cat > /etc/systemd/system/hoxta-agent-sync.service << EOF
[Unit]
Description=Hoxta Agent Sync Function
After=network.target docker.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/hoxta
ExecStart=$HOME/.deno/bin/deno run --allow-net --allow-env --allow-read supabase/functions/agent-sync/index.ts
Restart=always
RestartSec=5
Environment=SUPABASE_URL=http://localhost:8000
Environment=SUPABASE_SERVICE_ROLE_KEY=${SERVICE_KEY}

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/hoxta-firewall-sync.service << EOF
[Unit]
Description=Hoxta Firewall Sync Function
After=network.target docker.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/hoxta
ExecStart=$HOME/.deno/bin/deno run --allow-net --allow-env --allow-read supabase/functions/firewall-sync/index.ts
Restart=always
RestartSec=5
Environment=SUPABASE_URL=http://localhost:8000
Environment=SUPABASE_SERVICE_ROLE_KEY=${SERVICE_KEY}

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now hoxta-agent-sync hoxta-firewall-sync 2>/dev/null || true

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ Hoxta instalat cu succes!                              ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  🌐 Frontend:  ${CYAN}https://${DOMAIN}${NC}"
echo -e "  🔌 API:       ${CYAN}https://${API_DOMAIN}${NC}"
echo -e "  📊 Dashboard: ${CYAN}http://localhost:8000${NC} (admin / ${DASH_PASS})"
echo ""
echo -e "  ${YELLOW}Pași următori:${NC}"
echo -e "  1. Înregistrează-te pe https://${DOMAIN}"
echo -e "  2. Setează-te ca admin:"
echo -e "     ${CYAN}docker compose -f /opt/supabase/docker/docker-compose.yml exec db psql -U postgres -c \"INSERT INTO public.user_roles (user_id, role) VALUES ('USER_ID', 'admin');\"${NC}"
echo ""
echo -e "  ${YELLOW}Comenzi utile:${NC}"
echo -e "  Backup DB:  ${CYAN}docker compose -f /opt/supabase/docker/docker-compose.yml exec db pg_dump -U postgres postgres > backup.sql${NC}"
echo -e "  Update app: ${CYAN}cd /opt/hoxta && git pull && npm run build${NC}"
echo -e "  Loguri:     ${CYAN}journalctl -u hoxta-agent-sync -f${NC}"
