#!/bin/bash
# ╔══════════════════════════════════════════════════════════════╗
# ║  Hoxta Firewall — GameCP & Pterodactyl Auto-Protection      ║
# ║  Detectare automată panel + instalare agent optimizat        ║
# ╚══════════════════════════════════════════════════════════════╝

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# ── CONFIGURARE ──
HOXTA_API_URL="${HOXTA_API_URL:-https://api.hoxta.com/functions/v1}"
HOXTA_API_KEY="${HOXTA_API_KEY:-YOUR_SERVICE_ROLE_KEY}"
LOG_FILE="/var/log/hoxta-panel-hook.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# ── DETECTARE PANEL ──

detect_panel() {
    if [ -d "/var/www/pterodactyl" ] || [ -d "/var/www/pelican" ] || systemctl is-active --quiet wings 2>/dev/null; then
        echo "pterodactyl"
    elif [ -d "/home/gamecp" ] || [ -d "/var/www/gamecp" ] || [ -f "/etc/gamecp/config.php" ]; then
        echo "gamecp"
    elif [ -f "/usr/local/cpanel/cpanel" ] || [ -d "/usr/local/cpanel" ]; then
        echo "cpanel"
    elif [ -f "/usr/local/virtualizor/virtualizor.php" ]; then
        echo "virtualizor"
    else
        echo "standalone"
    fi
}

# ── PROTECȚIE PTERODACTYL / PELICAN ──

install_pterodactyl_protection() {
    log "🎮 Instalare protecție Pterodactyl/Pelican..."

    # Porturi standard Pterodactyl
    # 8080 - Panel web
    # 2022 - SFTP
    # 25565-25575 - Minecraft
    # 27015-27030 - Source Engine (CS2, Garry's Mod, etc.)
    # 7777-7778 - ARK, Unreal
    # 19132 - Bedrock
    # 2456-2458 - Valheim
    # 5000-5100 - FiveM

    # Chain dedicat pentru game servers
    iptables -N HOXTA-GAMES 2>/dev/null || iptables -F HOXTA-GAMES

    # Permite panel + SFTP
    iptables -A HOXTA-GAMES -p tcp --dport 8080 -j ACCEPT
    iptables -A HOXTA-GAMES -p tcp --dport 443 -j ACCEPT
    iptables -A HOXTA-GAMES -p tcp --dport 2022 -j ACCEPT

    # Minecraft (TCP + UDP)
    iptables -A HOXTA-GAMES -p tcp --dport 25565:25575 -j ACCEPT
    iptables -A HOXTA-GAMES -p udp --dport 25565:25575 -j ACCEPT
    iptables -A HOXTA-GAMES -p udp --dport 19132 -j ACCEPT

    # Source Engine (CS2, GMod, TF2, etc.)
    iptables -A HOXTA-GAMES -p tcp --dport 27015:27030 -j ACCEPT
    iptables -A HOXTA-GAMES -p udp --dport 27015:27030 -j ACCEPT

    # ARK / Unreal Engine
    iptables -A HOXTA-GAMES -p udp --dport 7777:7778 -j ACCEPT

    # Valheim
    iptables -A HOXTA-GAMES -p udp --dport 2456:2458 -j ACCEPT

    # FiveM / RedM
    iptables -A HOXTA-GAMES -p tcp --dport 30120:30130 -j ACCEPT
    iptables -A HOXTA-GAMES -p udp --dport 30120:30130 -j ACCEPT

    # Rust
    iptables -A HOXTA-GAMES -p tcp --dport 28015:28016 -j ACCEPT
    iptables -A HOXTA-GAMES -p udp --dport 28015:28016 -j ACCEPT

    # Asigură chain-ul e în INPUT
    iptables -C INPUT -j HOXTA-GAMES 2>/dev/null || iptables -I INPUT 2 -j HOXTA-GAMES

    # DDoS protection specifică gaming
    # Rate limit UDP (principalul vector de atac pe game servers)
    iptables -A HOXTA-INPUT -p udp -m limit --limit 500/s --limit-burst 1000 -j ACCEPT 2>/dev/null || true
    
    # Protecție query flood (Source Engine)
    iptables -A HOXTA-INPUT -p udp --dport 27015 -m hashlimit \
        --hashlimit-name srcds_query \
        --hashlimit-above 100/s \
        --hashlimit-burst 200 \
        --hashlimit-mode srcip \
        -j DROP 2>/dev/null || true

    # Protecție Minecraft login flood
    iptables -A HOXTA-INPUT -p tcp --dport 25565 --syn -m hashlimit \
        --hashlimit-name mc_conn \
        --hashlimit-above 20/s \
        --hashlimit-burst 50 \
        --hashlimit-mode srcip \
        -j DROP 2>/dev/null || true

    # Pterodactyl Wings egg install hook
    if [ -d "/etc/pterodactyl" ]; then
        # Adaugă hook la Wings config pentru a re-aplica protecția la fiecare server nou
        cat > /opt/hoxta/pterodactyl-egg-hook.sh << 'EGGHOOK'
#!/bin/bash
# Se rulează când un server nou e creat în Pterodactyl
# Pterodactyl trimite: SERVER_UUID, SERVER_IP, GAME_PORT
source /opt/hoxta/config.env

GAME_PORT="${1:-25565}"

# Permite portul specific al serverului
iptables -C HOXTA-GAMES -p tcp --dport "$GAME_PORT" -j ACCEPT 2>/dev/null || \
    iptables -A HOXTA-GAMES -p tcp --dport "$GAME_PORT" -j ACCEPT
iptables -C HOXTA-GAMES -p udp --dport "$GAME_PORT" -j ACCEPT 2>/dev/null || \
    iptables -A HOXTA-GAMES -p udp --dport "$GAME_PORT" -j ACCEPT

iptables-save > /etc/iptables/rules.v4 2>/dev/null || true
echo "[$(date)] Port $GAME_PORT deschis pentru server nou" >> /var/log/hoxta/sync.log
EGGHOOK
        chmod +x /opt/hoxta/pterodactyl-egg-hook.sh
    fi

    log "✅ Protecție Pterodactyl configurată (porturi gaming deschise + DDoS protection)"
}

# ── PROTECȚIE GAMECP ──

install_gamecp_protection() {
    log "🎮 Instalare protecție GameCP..."

    iptables -N HOXTA-GAMES 2>/dev/null || iptables -F HOXTA-GAMES

    # GameCP Panel
    iptables -A HOXTA-GAMES -p tcp --dport 3000 -j ACCEPT  # GameCP web
    iptables -A HOXTA-GAMES -p tcp --dport 443 -j ACCEPT
    iptables -A HOXTA-GAMES -p tcp --dport 80 -j ACCEPT

    # Game ports - same as Pterodactyl
    iptables -A HOXTA-GAMES -p tcp --dport 25565:25575 -j ACCEPT
    iptables -A HOXTA-GAMES -p udp --dport 25565:25575 -j ACCEPT
    iptables -A HOXTA-GAMES -p udp --dport 19132 -j ACCEPT
    iptables -A HOXTA-GAMES -p tcp --dport 27015:27030 -j ACCEPT
    iptables -A HOXTA-GAMES -p udp --dport 27015:27030 -j ACCEPT
    iptables -A HOXTA-GAMES -p udp --dport 7777:7778 -j ACCEPT
    iptables -A HOXTA-GAMES -p udp --dport 2456:2458 -j ACCEPT
    iptables -A HOXTA-GAMES -p tcp --dport 30120:30130 -j ACCEPT
    iptables -A HOXTA-GAMES -p udp --dport 30120:30130 -j ACCEPT
    iptables -A HOXTA-GAMES -p tcp --dport 28015:28016 -j ACCEPT
    iptables -A HOXTA-GAMES -p udp --dport 28015:28016 -j ACCEPT

    iptables -C INPUT -j HOXTA-GAMES 2>/dev/null || iptables -I INPUT 2 -j HOXTA-GAMES

    # DDoS protection gaming
    iptables -A HOXTA-INPUT -p udp -m limit --limit 500/s --limit-burst 1000 -j ACCEPT 2>/dev/null || true
    
    # GameCP callback hook
    if [ -d "/home/gamecp" ]; then
        GAMECP_HOOKS="/home/gamecp/hooks"
        mkdir -p "$GAMECP_HOOKS"
        cat > "${GAMECP_HOOKS}/post_install.sh" << 'GCHOOK'
#!/bin/bash
source /opt/hoxta/config.env
GAME_PORT="${1:-25565}"
iptables -C HOXTA-GAMES -p tcp --dport "$GAME_PORT" -j ACCEPT 2>/dev/null || \
    iptables -A HOXTA-GAMES -p tcp --dport "$GAME_PORT" -j ACCEPT
iptables -C HOXTA-GAMES -p udp --dport "$GAME_PORT" -j ACCEPT 2>/dev/null || \
    iptables -A HOXTA-GAMES -p udp --dport "$GAME_PORT" -j ACCEPT
iptables-save > /etc/iptables/rules.v4 2>/dev/null || true
GCHOOK
        chmod +x "${GAMECP_HOOKS}/post_install.sh"
    fi

    log "✅ Protecție GameCP configurată"
}

# ── PROTECȚIE CPANEL / WHM ──

install_cpanel_protection() {
    log "🌐 Instalare protecție cPanel/WHM..."

    iptables -N HOXTA-WEB 2>/dev/null || iptables -F HOXTA-WEB

    # cPanel / WHM porturi
    iptables -A HOXTA-WEB -p tcp --dport 80 -j ACCEPT     # HTTP
    iptables -A HOXTA-WEB -p tcp --dport 443 -j ACCEPT    # HTTPS
    iptables -A HOXTA-WEB -p tcp --dport 2082 -j ACCEPT   # cPanel
    iptables -A HOXTA-WEB -p tcp --dport 2083 -j ACCEPT   # cPanel SSL
    iptables -A HOXTA-WEB -p tcp --dport 2086 -j ACCEPT   # WHM
    iptables -A HOXTA-WEB -p tcp --dport 2087 -j ACCEPT   # WHM SSL
    iptables -A HOXTA-WEB -p tcp --dport 2095 -j ACCEPT   # Webmail
    iptables -A HOXTA-WEB -p tcp --dport 2096 -j ACCEPT   # Webmail SSL
    iptables -A HOXTA-WEB -p tcp --dport 21 -j ACCEPT     # FTP
    iptables -A HOXTA-WEB -p tcp --dport 25 -j ACCEPT     # SMTP
    iptables -A HOXTA-WEB -p tcp --dport 465 -j ACCEPT    # SMTPS
    iptables -A HOXTA-WEB -p tcp --dport 587 -j ACCEPT    # Submission
    iptables -A HOXTA-WEB -p tcp --dport 993 -j ACCEPT    # IMAPS
    iptables -A HOXTA-WEB -p tcp --dport 995 -j ACCEPT    # POP3S
    iptables -A HOXTA-WEB -p tcp --dport 53 -j ACCEPT     # DNS
    iptables -A HOXTA-WEB -p udp --dport 53 -j ACCEPT     # DNS UDP
    iptables -A HOXTA-WEB -p tcp --dport 3306 -j ACCEPT   # MySQL (local only preferabil)

    iptables -C INPUT -j HOXTA-WEB 2>/dev/null || iptables -I INPUT 2 -j HOXTA-WEB

    # HTTP rate limiting
    iptables -A HOXTA-INPUT -p tcp --dport 80 --syn -m hashlimit \
        --hashlimit-name http_conn \
        --hashlimit-above 50/s \
        --hashlimit-burst 100 \
        --hashlimit-mode srcip \
        -j DROP 2>/dev/null || true

    iptables -A HOXTA-INPUT -p tcp --dport 443 --syn -m hashlimit \
        --hashlimit-name https_conn \
        --hashlimit-above 50/s \
        --hashlimit-burst 100 \
        --hashlimit-mode srcip \
        -j DROP 2>/dev/null || true

    # cPanel/WHM brute force protection
    iptables -A HOXTA-INPUT -p tcp -m multiport --dports 2082,2083,2086,2087 --syn -m hashlimit \
        --hashlimit-name cpanel_login \
        --hashlimit-above 5/min \
        --hashlimit-burst 10 \
        --hashlimit-mode srcip \
        -j DROP 2>/dev/null || true

    # Integrare cu CSF dacă e instalat
    if [ -f "/etc/csf/csf.conf" ]; then
        log "📋 CSF detectat — Hoxta va lucra în paralel (chain-uri separate)"
    fi

    log "✅ Protecție cPanel/WHM configurată"
}

# ── INSTALARE UNIVERSALĂ ──

install_universal_agent() {
    local PANEL_TYPE="$1"
    
    log "📦 Instalare agent universal pentru: ${PANEL_TYPE}"

    # Creare directoare
    mkdir -p /opt/hoxta /var/log/hoxta

    # Config
    cat > /opt/hoxta/config.env << EOF
HOXTA_API_URL=${HOXTA_API_URL}
HOXTA_API_KEY=${HOXTA_API_KEY}
VPS_IP=$(hostname -I | awk '{print $1}')
VPS_HOSTNAME=$(hostname -f 2>/dev/null || hostname)
PANEL_TYPE=${PANEL_TYPE}
EOF

    # Instalare dependințe
    if command -v apt-get &>/dev/null; then
        apt-get update -qq
        apt-get install -y -qq curl iptables ipset jq 2>/dev/null
    elif command -v yum &>/dev/null; then
        yum install -y -q curl iptables ipset jq 2>/dev/null
    fi

    # Chain-uri iptables de bază
    iptables -N HOXTA-INPUT 2>/dev/null || iptables -F HOXTA-INPUT
    iptables -N HOXTA-OUTPUT 2>/dev/null || iptables -F HOXTA-OUTPUT
    iptables -C INPUT -j HOXTA-INPUT 2>/dev/null || iptables -I INPUT 1 -j HOXTA-INPUT
    iptables -C OUTPUT -j HOXTA-OUTPUT 2>/dev/null || iptables -I OUTPUT 1 -j HOXTA-OUTPUT

    # SSH always allowed
    iptables -C HOXTA-INPUT -p tcp --dport 22 -j ACCEPT 2>/dev/null || iptables -A HOXTA-INPUT -p tcp --dport 22 -j ACCEPT

    # Protecție specifică panelului
    case "$PANEL_TYPE" in
        pterodactyl)
            install_pterodactyl_protection
            ;;
        gamecp)
            install_gamecp_protection
            ;;
        cpanel)
            install_cpanel_protection
            ;;
        *)
            log "⚠️ Panel necunoscut, doar protecție de bază"
            ;;
    esac

    # DDoS protection de bază (toți)
    iptables -A HOXTA-INPUT -p tcp --syn -m limit --limit 100/s --limit-burst 200 -j ACCEPT 2>/dev/null || true
    iptables -A HOXTA-INPUT -m state --state INVALID -j DROP 2>/dev/null || true

    # Script sincronizare (copiat din virtualizor-hook)
    cat > /opt/hoxta/sync.sh << 'SYNC'
#!/bin/bash
source /opt/hoxta/config.env

LOG="/var/log/hoxta/sync.log"
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG"; }

RULES=$(curl -sf -H "apikey: ${HOXTA_API_KEY}" \
    -H "Authorization: Bearer ${HOXTA_API_KEY}" \
    "${HOXTA_API_URL}/firewall-sync?ip=${VPS_IP}&format=json" 2>/dev/null)

if [ -z "$RULES" ] || [ "$RULES" = "null" ]; then
    log "⚠️ Nu s-au putut obține regulile"
    exit 1
fi

# Flush doar chain-urile Hoxta (nu afectează reguli panel-specifice)
iptables -F HOXTA-INPUT 2>/dev/null || true
iptables -F HOXTA-OUTPUT 2>/dev/null || true

# SSH safety
iptables -A HOXTA-INPUT -p tcp --dport 22 -j ACCEPT

# Aplică reguli
echo "$RULES" | jq -c '.rules[]?' 2>/dev/null | while read -r rule; do
    ACTION=$(echo "$rule" | jq -r '.action // "DROP"')
    PROTOCOL=$(echo "$rule" | jq -r '.protocol // "tcp"')
    SOURCE=$(echo "$rule" | jq -r '.source_ip // "0.0.0.0/0"')
    PORT=$(echo "$rule" | jq -r '.port // empty')
    DIRECTION=$(echo "$rule" | jq -r '.direction // "inbound"')

    CHAIN="HOXTA-INPUT"
    [ "$DIRECTION" = "outbound" ] && CHAIN="HOXTA-OUTPUT"

    CMD="iptables -A $CHAIN"
    [ "$PROTOCOL" != "all" ] && CMD="$CMD -p $PROTOCOL"
    [ "$SOURCE" != "0.0.0.0/0" ] && CMD="$CMD -s $SOURCE"
    [ -n "$PORT" ] && [ "$PORT" != "null" ] && CMD="$CMD --dport $PORT"

    ACTION_UPPER=$(echo "$ACTION" | tr '[:lower:]' '[:upper:]')
    CMD="$CMD -j $ACTION_UPPER"

    eval $CMD 2>/dev/null
done

# Aplică bans + GeoIP + null-routes (same logic)
echo "$RULES" | jq -c '.bans[]?' 2>/dev/null | while read -r ban; do
    IP=$(echo "$ban" | jq -r '.ip_address')
    [ -n "$IP" ] && [ "$IP" != "null" ] && {
        iptables -I HOXTA-INPUT 1 -s "$IP" -j DROP 2>/dev/null
    }
done

echo "$RULES" | jq -c '.ddos_nullroutes[]?' 2>/dev/null | while read -r nr; do
    SRC_IP=$(echo "$nr" | jq -r '.source_ip')
    [ -n "$SRC_IP" ] && [ "$SRC_IP" != "null" ] && {
        iptables -I HOXTA-INPUT 1 -s "$SRC_IP" -j DROP 2>/dev/null
    }
done

iptables-save > /etc/iptables/rules.v4 2>/dev/null || true

# Report
curl -sf -X POST -H "apikey: ${HOXTA_API_KEY}" \
    -H "Authorization: Bearer ${HOXTA_API_KEY}" \
    -H "Content-Type: application/json" \
    "${HOXTA_API_URL}/agent-sync" \
    -d "{\"server_ip\":\"${VPS_IP}\",\"hostname\":\"${VPS_HOSTNAME}\",\"status\":\"synced\",\"panel_type\":\"${PANEL_TYPE}\",\"rules_count\":$(iptables -L HOXTA-INPUT -n 2>/dev/null | tail -n +3 | wc -l)}" \
    2>/dev/null || true

log "✅ Sincronizare completă (${PANEL_TYPE})"
SYNC
    chmod +x /opt/hoxta/sync.sh

    # Cron
    (crontab -l 2>/dev/null | grep -v hoxta; echo "*/2 * * * * /opt/hoxta/sync.sh >> /var/log/hoxta/sync.log 2>&1") | crontab -

    # Systemd service
    cat > /etc/systemd/system/hoxta-agent.service << 'SVC'
[Unit]
Description=Hoxta Firewall Agent
After=network.target

[Service]
Type=oneshot
ExecStart=/opt/hoxta/sync.sh
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
SVC
    systemctl daemon-reload
    systemctl enable hoxta-agent 2>/dev/null || true

    # Salvează reguli
    mkdir -p /etc/iptables
    iptables-save > /etc/iptables/rules.v4 2>/dev/null || true

    # Prima sincronizare
    /opt/hoxta/sync.sh 2>/dev/null || true

    log "✅ Agent universal instalat pentru ${PANEL_TYPE}"
}

# ── MAIN ──

echo -e "${CYAN}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  🛡️  Hoxta Firewall — Auto-Protection Installer            ║"
echo "║  Suportă: Pterodactyl · GameCP · cPanel/WHM · Standalone   ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Auto-detect panel
DETECTED=$(detect_panel)
echo -e "  Panel detectat: ${GREEN}${DETECTED}${NC}"
echo ""

if [ "$1" = "--auto" ]; then
    PANEL_TYPE="$DETECTED"
else
    echo "  Paneluri disponibile:"
    echo "    1) pterodactyl  - Pterodactyl / Pelican (game servers)"
    echo "    2) gamecp       - GameCP (game servers)"
    echo "    3) cpanel       - cPanel / WHM (web hosting)"
    echo "    4) standalone   - Server fără panel"
    echo "    5) auto         - Folosește detecția automată (${DETECTED})"
    echo ""
    read -p "  Alege panelul [1-5, default=5]: " CHOICE

    case "${CHOICE:-5}" in
        1) PANEL_TYPE="pterodactyl" ;;
        2) PANEL_TYPE="gamecp" ;;
        3) PANEL_TYPE="cpanel" ;;
        4) PANEL_TYPE="standalone" ;;
        *) PANEL_TYPE="$DETECTED" ;;
    esac
fi

echo -e "  Instalare pentru: ${CYAN}${PANEL_TYPE}${NC}"
echo ""

# Colectare API config (dacă nu e setat)
if [ "$HOXTA_API_URL" = "https://api.hoxta.com/functions/v1" ] || [ -z "$HOXTA_API_KEY" ] || [ "$HOXTA_API_KEY" = "YOUR_SERVICE_ROLE_KEY" ]; then
    read -p "  Hoxta API URL: " INPUT_API_URL
    read -p "  Hoxta API Key: " INPUT_API_KEY
    [ -n "$INPUT_API_URL" ] && HOXTA_API_URL="$INPUT_API_URL"
    [ -n "$INPUT_API_KEY" ] && HOXTA_API_KEY="$INPUT_API_KEY"
fi

install_universal_agent "$PANEL_TYPE"

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ Hoxta Agent instalat cu succes!                         ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  🎯 Panel:     ${CYAN}${PANEL_TYPE}${NC}"
echo -e "  📂 Config:    ${CYAN}/opt/hoxta/config.env${NC}"
echo -e "  📋 Log:       ${CYAN}/var/log/hoxta/sync.log${NC}"
echo -e "  🔄 Sync:      ${CYAN}la fiecare 2 minute (cron)${NC}"
echo -e "  🛡️ Chains:    ${CYAN}HOXTA-INPUT, HOXTA-OUTPUT$([ "$PANEL_TYPE" != "standalone" ] && echo ", HOXTA-GAMES/WEB")${NC}"
echo ""
echo -e "  ${YELLOW}Comenzi utile:${NC}"
echo -e "  Sync manual:    ${CYAN}/opt/hoxta/sync.sh${NC}"
echo -e "  Vezi reguli:    ${CYAN}iptables -L HOXTA-INPUT -n --line-numbers${NC}"
echo -e "  Vezi log:       ${CYAN}tail -f /var/log/hoxta/sync.log${NC}"
echo -e "  Reconfigurare:  ${CYAN}nano /opt/hoxta/config.env${NC}"
