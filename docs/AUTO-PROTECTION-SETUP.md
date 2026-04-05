# 🛡️ Hoxta — Ghid Instalare Protecție Automată pe Servere

## Cuprins
1. [Virtualizor KVM — Auto-protection la VPS nou/reinstall](#1-virtualizor-kvm)
2. [cPanel / WHM — Web Hosting](#2-cpanel--whm)
3. [Pterodactyl / Pelican — Game Servers](#3-pterodactyl--pelican)
4. [GameCP — Game Servers](#4-gamecp)
5. [Servere Dedicate](#5-servere-dedicate)

---

## 1. Virtualizor KVM

### Instalare (pe serverul Master Virtualizor):

```bash
curl -sfL https://raw.githubusercontent.com/YOUR_REPO/main/self-host/virtualizor-hook.sh | bash
```

**Ce face:**
- Instalează hook-uri Virtualizor (post_create, post_reinstall, post_start)
- La fiecare VPS nou → instalează automat agentul Hoxta
- La reinstall OS → reinstalează automat agentul
- La pornire VPS → verifică dacă agentul e prezent
- Cron la 10 minute verifică toate VPS-urile

### Configurare:
```
Hoxta API URL: https://api.hoxta.com/functions/v1
Hoxta API Key: [SERVICE_ROLE_KEY din panoul Hoxta Admin]
```

### Fișiere instalate:
```
/opt/hoxta-virtualizor/
├── hook.sh              # Script principal hooks
├── config.env           # Configurare API
└── check-all.sh         # Verificare periodică toate VPS-urile

/usr/local/virtualizor/hooks/
├── post_create_vps.sh   # Hook: VPS nou creat
├── post_reinstall_vps.sh # Hook: Reinstall OS
└── post_start_vps.sh    # Hook: VPS pornit
```

### Pe fiecare VPS se instalează:
```
/opt/hoxta/
├── config.env           # Configurare specifică VPS
├── sync.sh              # Script sincronizare reguli
└── ddos-protect.sh      # Protecție DDoS de bază

/var/log/hoxta/
└── sync.log             # Log sincronizare
```

---

## 2. cPanel / WHM

### Instalare (pe serverul WHM):

```bash
curl -sfL https://raw.githubusercontent.com/YOUR_REPO/main/self-host/gamecp-pterodactyl-hook.sh | bash
```

La promptul de selecție, alege **3) cpanel**.

**Ce protejează automat:**
- Porturi web: 80, 443
- cPanel: 2082, 2083
- WHM: 2086, 2087
- Webmail: 2095, 2096
- Email: 25, 465, 587, 993, 995
- FTP: 21
- DNS: 53
- MySQL: 3306

**Protecție extra:**
- Rate limiting HTTP/HTTPS (50 conn/s per IP)
- Brute force protection pe cPanel/WHM login (5/min per IP)
- Compatibil cu CSF (chain-uri separate)

---

## 3. Pterodactyl / Pelican

### Instalare (pe serverul Wings/daemon):

```bash
curl -sfL https://raw.githubusercontent.com/YOUR_REPO/main/self-host/gamecp-pterodactyl-hook.sh | bash
```

La promptul de selecție, alege **1) pterodactyl** sau lasă auto-detect.

**Porturi gaming deschise automat:**

| Joc | Port(uri) | Protocol |
|-----|-----------|----------|
| Minecraft Java | 25565-25575 | TCP+UDP |
| Minecraft Bedrock | 19132 | UDP |
| CS2 / Source Engine | 27015-27030 | TCP+UDP |
| ARK / Unreal | 7777-7778 | UDP |
| Valheim | 2456-2458 | UDP |
| FiveM / RedM | 30120-30130 | TCP+UDP |
| Rust | 28015-28016 | TCP+UDP |

**Protecție gaming specifică:**
- Source Engine query flood protection (100/s per IP)
- Minecraft login flood protection (20 SYN/s per IP)
- UDP rate limiting global (500/s)

**Egg install hook:**
Când un server nou e creat în Pterodactyl, portul lui se deschide automat.

---

## 4. GameCP

### Instalare:

```bash
curl -sfL https://raw.githubusercontent.com/YOUR_REPO/main/self-host/gamecp-pterodactyl-hook.sh | bash
```

La promptul de selecție, alege **2) gamecp**.

Aceleași porturi gaming ca la Pterodactyl, plus:
- GameCP web panel (port 3000)
- Hook post_install pentru servere noi

---

## 5. Servere Dedicate

### Instalare manuală (orice server Linux):

```bash
curl -sfL https://raw.githubusercontent.com/YOUR_REPO/main/self-host/gamecp-pterodactyl-hook.sh | bash
```

Alege **4) standalone** — instalează doar protecția de bază + sincronizare.

### Sau cu auto-detect:

```bash
curl -sfL https://raw.githubusercontent.com/YOUR_REPO/main/self-host/gamecp-pterodactyl-hook.sh | bash -s -- --auto
```

Detectează automat panelul instalat și aplică configurarea corectă.

---

## Cum funcționează sincronizarea

```
┌──────────────┐          ┌──────────────┐          ┌──────────────┐
│  Panou Hoxta  │          │  Hoxta API    │          │  Agent VPS    │
│  (Admin/Client)│          │  (Backend)    │          │  (iptables)   │
└──────┬───────┘          └──────┬───────┘          └──────┬───────┘
       │                         │                         │
       │  Adaugă regulă         │                         │
       │ ─────────────────────▶ │                         │
       │                         │  Salvează în DB         │
       │                         │ ──────────┐             │
       │                         │ ◀─────────┘             │
       │                         │                         │
       │                         │     Cron (2 min)        │
       │                         │ ◀───────────────────── │  GET /firewall-sync
       │                         │                         │
       │                         │  Răspunde cu reguli    │
       │                         │ ──────────────────────▶ │
       │                         │                         │
       │                         │                         │  Aplică iptables
       │                         │                         │ ──────────┐
       │                         │                         │ ◀─────────┘
       │                         │                         │
       │                         │     Status sync        │
       │                         │ ◀───────────────────── │  POST /agent-sync
       │                         │                         │
```

---

## Comenzi utile (pe orice server protejat)

```bash
# Sincronizare manuală
/opt/hoxta/sync.sh

# Vezi regulile Hoxta active
iptables -L HOXTA-INPUT -n --line-numbers
iptables -L HOXTA-GAMES -n --line-numbers  # doar pe game servers
iptables -L HOXTA-WEB -n --line-numbers    # doar pe web servers

# Log sincronizare
tail -f /var/log/hoxta/sync.log

# Reconfigurare
nano /opt/hoxta/config.env

# Dezinstalare completă
iptables -D INPUT -j HOXTA-INPUT 2>/dev/null
iptables -D INPUT -j HOXTA-GAMES 2>/dev/null
iptables -D INPUT -j HOXTA-WEB 2>/dev/null
iptables -F HOXTA-INPUT 2>/dev/null
iptables -X HOXTA-INPUT 2>/dev/null
crontab -l | grep -v hoxta | crontab -
rm -rf /opt/hoxta
```
