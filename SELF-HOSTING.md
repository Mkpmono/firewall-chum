# 🛡️ Hoxta Firewall Manager - Self-Hosted Installation Guide

## Prerequisites
- VPS cu Ubuntu 22.04+ / Debian 12+ (minim 2GB RAM, 2 CPU)
- Domeniu (ex: `hoxta.domeniul-tau.com`) cu DNS configurat
- Acces root pe server

---

## Quick Install (Un singur script)

```bash
curl -sfL https://raw.githubusercontent.com/YOUR_REPO/main/self-host/install.sh | bash
```

Sau urmează pașii manual:

---

## Instalare Pas cu Pas

### 1. Pregătire server

```bash
apt update && apt upgrade -y
apt install -y docker.io docker-compose-plugin nginx certbot python3-certbot-nginx git curl
systemctl enable docker && systemctl start docker
```

### 2. Instalare Supabase Self-Hosted

```bash
# Clonează Supabase
cd /opt
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker

# Copiază configurația
cp .env.example .env
```

**Editează `/opt/supabase/docker/.env`** — schimbă OBLIGATORIU:

```env
# ⚠️ SCHIMBĂ ACESTE VALORI!
POSTGRES_PASSWORD=parola-ta-foarte-puternica-aici
JWT_SECRET=un-secret-jwt-de-minim-32-caractere-aleatorii
ANON_KEY=generat-cu-jwt-secret        # vezi mai jos
SERVICE_ROLE_KEY=generat-cu-jwt-secret # vezi mai jos
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=parola-dashboard

# Setează domeniul tău
SITE_URL=https://hoxta.domeniul-tau.com
API_EXTERNAL_URL=https://api.domeniul-tau.com

# Dezactivează telemetria
ENABLE_ANALYTICS=false
```

**Generare ANON_KEY și SERVICE_ROLE_KEY:**
```bash
# Instalează jwt-cli sau folosește https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys
# Cu node:
node -e "
const jwt = require('jsonwebtoken');
const SECRET = 'TU_PUI_JWT_SECRET_AICI';
console.log('ANON_KEY:', jwt.sign({ role: 'anon', iss: 'supabase', iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000) + 10*365*24*3600 }, SECRET));
console.log('SERVICE_ROLE_KEY:', jwt.sign({ role: 'service_role', iss: 'supabase', iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000) + 10*365*24*3600 }, SECRET));
"
```

**Pornește Supabase:**
```bash
cd /opt/supabase/docker
docker compose up -d
```

Verifică: `docker compose ps` — toate containerele trebuie să fie "running".

### 3. Aplică migrările bazei de date

```bash
# Conectează-te la PostgreSQL
docker compose exec db psql -U postgres -d postgres
```

Apoi rulează **fiecare fișier SQL** din `supabase/migrations/` în ordine cronologică. Le găsești în repo-ul GitHub al proiectului.

Alternativ, instalează Supabase CLI:
```bash
# Pe VPS
npm install -g supabase
cd /opt/hoxta
supabase db push --db-url postgresql://postgres:PAROLA_TA@localhost:5432/postgres
```

### 4. Clonează și build-uiește aplicația

```bash
cd /opt
git clone https://github.com/YOUR_USER/YOUR_REPO.git hoxta
cd hoxta

# Configurează environment
cat > .env << 'EOF'
VITE_SUPABASE_URL=https://api.domeniul-tau.com
VITE_SUPABASE_PUBLISHABLE_KEY=ANON_KEY_GENERAT_MAI_SUS
VITE_SUPABASE_PROJECT_ID=local
EOF

# Install & build
npm install
npm run build
```

### 5. Configurare Nginx

```bash
cat > /etc/nginx/sites-available/hoxta << 'NGINX'
# Frontend
server {
    listen 80;
    server_name hoxta.domeniul-tau.com;

    root /opt/hoxta/dist;
    index index.html;

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
}

# Supabase API proxy
server {
    listen 80;
    server_name api.domeniul-tau.com;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support (for Realtime)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
NGINX

ln -sf /etc/nginx/sites-available/hoxta /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

### 6. SSL cu Let's Encrypt

```bash
certbot --nginx -d hoxta.domeniul-tau.com -d api.domeniul-tau.com
```

### 7. Deploy Edge Functions

Edge Functions rulează prin Supabase Edge Runtime (inclus în Docker).

Alternativ, poți folosi Deno direct:
```bash
# Install Deno
curl -fsSL https://deno.land/install.sh | sh

# Rulează funcțiile ca server
cd /opt/hoxta
deno run --allow-net --allow-env supabase/functions/firewall-sync/index.ts &
deno run --allow-net --allow-env supabase/functions/agent-sync/index.ts &
```

Sau adaugă un serviciu systemd:
```bash
cat > /etc/systemd/system/hoxta-functions.service << 'EOF'
[Unit]
Description=Hoxta Edge Functions
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/hoxta
ExecStart=/root/.deno/bin/deno run --allow-net --allow-env --allow-read supabase/functions/agent-sync/index.ts
Restart=always
Environment=SUPABASE_URL=http://localhost:8000
Environment=SUPABASE_SERVICE_ROLE_KEY=SERVICE_ROLE_KEY_AICI

[Install]
WantedBy=multi-user.target
EOF

systemctl enable --now hoxta-functions
```

---

## Crearea primului Admin

```sql
-- Conectează-te la PostgreSQL
-- docker compose exec db psql -U postgres

-- 1. Găsește user_id-ul tău (după ce te-ai înregistrat)
SELECT id, email FROM auth.users;

-- 2. Setează-l ca admin
INSERT INTO public.user_roles (user_id, role)
VALUES ('USER_ID_AICI', 'admin');
```

---

## Backup & Restore

```bash
# Backup
docker compose exec db pg_dump -U postgres postgres > backup_$(date +%Y%m%d).sql

# Restore
docker compose exec -T db psql -U postgres postgres < backup_20260308.sql
```

---

## Actualizare

```bash
cd /opt/hoxta
git pull
npm install
npm run build
# Gata! Nginx servește automat noile fișiere din dist/
```

---

## Structura pe VPS

```
/opt/
├── supabase/docker/       # Supabase self-hosted (DB, Auth, Realtime, API)
│   ├── docker-compose.yml
│   └── .env
├── hoxta/                 # Aplicația ta
│   ├── dist/              # Build-ul frontend (servit de Nginx)
│   ├── supabase/functions/# Edge functions (rulate cu Deno)
│   └── .env               # Config frontend
/etc/nginx/sites-available/hoxta  # Nginx config
/var/log/hoxta-firewall.log       # Agent logs (pe serverele clienților)
```

---

## Porturi necesare

| Port | Serviciu | Notă |
|------|----------|------|
| 80   | Nginx HTTP | Redirect → HTTPS |
| 443  | Nginx HTTPS | Frontend + API |
| 5432 | PostgreSQL | ⚠️ NU expune public! |
| 8000 | Supabase Kong | Doar localhost |

---

## Troubleshooting

```bash
# Verifică statusul
docker compose -f /opt/supabase/docker/docker-compose.yml ps

# Loguri Supabase
docker compose -f /opt/supabase/docker/docker-compose.yml logs -f

# Loguri Nginx
tail -f /var/log/nginx/error.log

# Test conexiune DB
docker compose exec db psql -U postgres -c "SELECT count(*) FROM public.profiles;"
```
