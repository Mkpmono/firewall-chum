#!/bin/bash
# ╔══════════════════════════════════════════════════════════════╗
# ║  Hoxta Firewall — Virtualizor KVM Auto-Protection Hook      ║
# ║  Se instalează pe serverul Virtualizor Master                ║
# ║  Aplică protecție automată la fiecare VPS nou sau reinstall  ║
# ╚══════════════════════════════════════════════════════════════╝

set -e

# ── CONFIGURARE ──
HOXTA_API_URL="${HOXTA_API_URL:-https://api.hoxta.com/functions/v1}"
HOXTA_API_KEY="${HOXTA_API_KEY:-YOUR_SERVICE_ROLE_KEY}"
AGENT_INSTALL_URL="${AGENT_INSTALL_URL:-https://raw.githubusercontent.com/YOUR_REPO/main/self-host/hoxta-agent-install.sh}"
LOG_FILE="/var/log/hoxta-virtualizor-hook.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# ── FUNCȚII ──

install_agent_on_vps() {
    local VPS_IP="$1"
    local VPS_ID="$2"
    local VPS_HOSTNAME="$3"
    local CLIENT_EMAIL="$4"
    local OS_TYPE="$5"

    log "🚀 Instalare agent Hoxta pe VPS #${VPS_ID} (${VPS_IP}) - OS: ${OS_TYPE}"

    # Detectează dacă VPS-ul este online
    if ! ping -c 2 -W 3 "$VPS_IP" &>/dev/null; then
        log "⏳ VPS ${VPS_IP} nu este online încă, aștept 30s..."
        sleep 30
        if ! ping -c 2 -W 3 "$VPS_IP" &>/dev/null; then
            log "❌ VPS ${VPS_IP} tot nu răspunde. Se va reîncerca la următorul cron."
            return 1
        fi
    fi

    # Instalare agent prin SSH (Virtualizor are acces root pe VPS-uri)
    ssh -o StrictHostKeyChecking=no -o ConnectTimeout=10 "root@${VPS_IP}" bash -s << REMOTE_SCRIPT
#!/bin/bash
set -e

echo "╔══════════════════════════════════════════════════════════╗"
echo "║  🛡️  Hoxta Firewall Agent - Auto Install                ║"
echo "╚══════════════════════════════════════════════════════════╝"

# Detectare OS
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS_NAME="\$ID"
    OS_VERSION="\$VERSION_ID"
else
    OS_NAME="unknown"
    OS_VERSION="0"
fi

echo "[Hoxta] OS detectat: \$OS_NAME \$OS_VERSION"

# Instalare dependințe
if command -v apt-get &>/dev/null; then
    apt-get update -qq
    apt-get install -y -qq curl iptables ipset jq cron 2>/dev/null
elif command -v yum &>/dev/null; then
    yum install -y -q curl iptables ipset jq cronie 2>/dev/null
elif command -v dnf &>/dev/null; then
    dnf install -y -q curl iptables ipset jq cronie 2>/dev/null
fi

# Creare director Hoxta
mkdir -p /opt/hoxta
mkdir -p /var/log/hoxta

# Configurare
cat > /opt/hoxta/config.env << 'CONF'
HOXTA_API_URL=${HOXTA_API_URL}
HOXTA_API_KEY=${HOXTA_API_KEY}
VPS_ID=${VPS_ID}
VPS_IP=${VPS_IP}
VPS_HOSTNAME=${VPS_HOSTNAME}
CLIENT_EMAIL=${CLIENT_EMAIL}
PANEL_TYPE=virtualizor
CONF

# Script principal de sincronizare
cat > /opt/hoxta/sync.sh << 'SYNC'
#!/bin/bash
source /opt/hoxta/config.env

LOG="/var/log/hoxta/sync.log"
log() { echo "[\$(date '+%Y-%m-%d %H:%M:%S')] \$1" >> "\$LOG"; }

# Obține regulile de la API
RULES=\$(curl -sf -H "apikey: \${HOXTA_API_KEY}" \
    -H "Authorization: Bearer \${HOXTA_API_KEY}" \
    "\${HOXTA_API_URL}/firewall-sync?ip=\${VPS_IP}&format=json" 2>/dev/null)

if [ -z "\$RULES" ] || [ "\$RULES" = "null" ]; then
    log "⚠️ Nu s-au putut obține regulile"
    exit 1
fi

# Curăță regulile Hoxta existente (păstrează regulile de bază)
iptables -L HOXTA-INPUT -n 2>/dev/null && iptables -F HOXTA-INPUT || iptables -N HOXTA-INPUT
iptables -L HOXTA-OUTPUT -n 2>/dev/null && iptables -F HOXTA-OUTPUT || iptables -N HOXTA-OUTPUT

# Asigură chain-urile sunt în INPUT/OUTPUT
iptables -C INPUT -j HOXTA-INPUT 2>/dev/null || iptables -I INPUT 1 -j HOXTA-INPUT
iptables -C OUTPUT -j HOXTA-OUTPUT 2>/dev/null || iptables -I OUTPUT 1 -j HOXTA-OUTPUT

# Permite SSH întotdeauna (safety)
iptables -C HOXTA-INPUT -p tcp --dport 22 -j ACCEPT 2>/dev/null || iptables -A HOXTA-INPUT -p tcp --dport 22 -j ACCEPT

# Aplică regulile
echo "\$RULES" | jq -c '.rules[]?' 2>/dev/null | while read -r rule; do
    ACTION=\$(echo "\$rule" | jq -r '.action // "DROP"')
    PROTOCOL=\$(echo "\$rule" | jq -r '.protocol // "tcp"')
    SOURCE=\$(echo "\$rule" | jq -r '.source_ip // "0.0.0.0/0"')
    DEST=\$(echo "\$rule" | jq -r '.destination_ip // "0.0.0.0/0"')
    PORT=\$(echo "\$rule" | jq -r '.port // empty')
    PORT_RANGE=\$(echo "\$rule" | jq -r '.port_range // empty')
    DIRECTION=\$(echo "\$rule" | jq -r '.direction // "inbound"')

    CHAIN="HOXTA-INPUT"
    [ "\$DIRECTION" = "outbound" ] && CHAIN="HOXTA-OUTPUT"

    CMD="iptables -A \$CHAIN"
    [ "\$PROTOCOL" != "all" ] && CMD="\$CMD -p \$PROTOCOL"
    [ "\$SOURCE" != "0.0.0.0/0" ] && CMD="\$CMD -s \$SOURCE"
    [ "\$DEST" != "0.0.0.0/0" ] && CMD="\$CMD -d \$DEST"
    [ -n "\$PORT" ] && [ "\$PORT" != "null" ] && CMD="\$CMD --dport \$PORT"
    [ -n "\$PORT_RANGE" ] && [ "\$PORT_RANGE" != "null" ] && CMD="\$CMD --dport \$PORT_RANGE"

    ACTION_UPPER=\$(echo "\$ACTION" | tr '[:lower:]' '[:upper:]')
    CMD="\$CMD -j \$ACTION_UPPER"

    eval \$CMD 2>/dev/null
    log "✅ Regulă aplicată: \$CMD"
done

# Aplică IP bans
BANS=\$(echo "\$RULES" | jq -c '.bans[]?' 2>/dev/null)
echo "\$BANS" | while read -r ban; do
    IP=\$(echo "\$ban" | jq -r '.ip_address')
    [ -n "\$IP" ] && [ "\$IP" != "null" ] && {
        iptables -C HOXTA-INPUT -s "\$IP" -j DROP 2>/dev/null || iptables -I HOXTA-INPUT 1 -s "\$IP" -j DROP
        log "🚫 IP banat: \$IP"
    }
done

# Aplică GeoIP (dacă ipset e disponibil)
if command -v ipset &>/dev/null; then
    echo "\$RULES" | jq -c '.geoip_blocks[]?' 2>/dev/null | while read -r geo; do
        COUNTRY=\$(echo "\$geo" | jq -r '.country_code')
        [ -n "\$COUNTRY" ] && [ "\$COUNTRY" != "null" ] && {
            ZONE_URL="https://www.ipdeny.com/ipblocks/data/aggregated/\${COUNTRY,,}-aggregated.zone"
            ZONE_FILE="/tmp/hoxta-geo-\${COUNTRY,,}.zone"
            curl -sf "\$ZONE_URL" -o "\$ZONE_FILE" 2>/dev/null
            if [ -f "\$ZONE_FILE" ]; then
                ipset create "hoxta-geo-\${COUNTRY,,}" hash:net -exist
                ipset flush "hoxta-geo-\${COUNTRY,,}"
                while read -r cidr; do
                    [ -n "\$cidr" ] && ipset add "hoxta-geo-\${COUNTRY,,}" "\$cidr" 2>/dev/null
                done < "\$ZONE_FILE"
                iptables -C HOXTA-INPUT -m set --match-set "hoxta-geo-\${COUNTRY,,}" src -j DROP 2>/dev/null || \
                    iptables -A HOXTA-INPUT -m set --match-set "hoxta-geo-\${COUNTRY,,}" src -j DROP
                log "🌍 GeoIP blocat: \$COUNTRY"
                rm -f "\$ZONE_FILE"
            fi
        }
    done
fi

# DDoS null-route (dacă e activ)
echo "\$RULES" | jq -c '.ddos_nullroutes[]?' 2>/dev/null | while read -r nr; do
    SRC_IP=\$(echo "\$nr" | jq -r '.source_ip')
    [ -n "\$SRC_IP" ] && [ "\$SRC_IP" != "null" ] && {
        iptables -C HOXTA-INPUT -s "\$SRC_IP" -j DROP 2>/dev/null || iptables -I HOXTA-INPUT 1 -s "\$SRC_IP" -j DROP
        log "🛡️ DDoS null-route: \$SRC_IP"
    }
done

# Salvează regulile
iptables-save > /etc/iptables/rules.v4 2>/dev/null || iptables-save > /etc/sysconfig/iptables 2>/dev/null || true

# Raportează status
curl -sf -X POST -H "apikey: \${HOXTA_API_KEY}" \
    -H "Authorization: Bearer \${HOXTA_API_KEY}" \
    -H "Content-Type: application/json" \
    "\${HOXTA_API_URL}/agent-sync" \
    -d "{\"server_ip\":\"\${VPS_IP}\",\"hostname\":\"\${VPS_HOSTNAME}\",\"status\":\"synced\",\"panel_type\":\"virtualizor\",\"rules_count\":\$(iptables -L HOXTA-INPUT -n 2>/dev/null | tail -n +3 | wc -l)}" \
    2>/dev/null || true

log "✅ Sincronizare completă"
SYNC
chmod +x /opt/hoxta/sync.sh

# Script DDoS protection de bază
cat > /opt/hoxta/ddos-protect.sh << 'DDOS'
#!/bin/bash
source /opt/hoxta/config.env

# Rate limiting - SYN flood protection
iptables -C HOXTA-INPUT -p tcp --syn -m limit --limit 50/s --limit-burst 100 -j ACCEPT 2>/dev/null || \
    iptables -A HOXTA-INPUT -p tcp --syn -m limit --limit 50/s --limit-burst 100 -j ACCEPT
iptables -C HOXTA-INPUT -p tcp --syn -j DROP 2>/dev/null || \
    iptables -A HOXTA-INPUT -p tcp --syn -j DROP

# UDP flood protection
iptables -C HOXTA-INPUT -p udp -m limit --limit 100/s --limit-burst 200 -j ACCEPT 2>/dev/null || \
    iptables -A HOXTA-INPUT -p udp -m limit --limit 100/s --limit-burst 200 -j ACCEPT

# ICMP flood protection
iptables -C HOXTA-INPUT -p icmp --icmp-type echo-request -m limit --limit 10/s -j ACCEPT 2>/dev/null || \
    iptables -A HOXTA-INPUT -p icmp --icmp-type echo-request -m limit --limit 10/s -j ACCEPT

# Drop invalid packets
iptables -C HOXTA-INPUT -m state --state INVALID -j DROP 2>/dev/null || \
    iptables -A HOXTA-INPUT -m state --state INVALID -j DROP

# Salvează
iptables-save > /etc/iptables/rules.v4 2>/dev/null || true

echo "[Hoxta] DDoS protection de bază activat"
DDOS
chmod +x /opt/hoxta/ddos-protect.sh

# Activează DDoS protection de bază
/opt/hoxta/ddos-protect.sh

# Setup cron - sincronizare la fiecare 2 minute
(crontab -l 2>/dev/null | grep -v hoxta; echo "*/2 * * * * /opt/hoxta/sync.sh >> /var/log/hoxta/sync.log 2>&1") | crontab -

# Creează serviciu systemd
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

# Prima sincronizare
/opt/hoxta/sync.sh 2>/dev/null || true

echo "╔══════════════════════════════════════════════════════════╗"
echo "║  ✅ Hoxta Agent instalat cu succes!                     ║"
echo "║  📋 Config: /opt/hoxta/config.env                      ║"
echo "║  📋 Log:    /var/log/hoxta/sync.log                    ║"
echo "║  🔄 Cron:   la fiecare 2 minute                        ║"
echo "╚══════════════════════════════════════════════════════════╝"
REMOTE_SCRIPT

    if [ $? -eq 0 ]; then
        log "✅ Agent instalat pe VPS #${VPS_ID} (${VPS_IP})"
        
        # Înregistrează serverul în Hoxta
        curl -sf -X POST \
            -H "apikey: ${HOXTA_API_KEY}" \
            -H "Authorization: Bearer ${HOXTA_API_KEY}" \
            -H "Content-Type: application/json" \
            "${HOXTA_API_URL}/agent-sync" \
            -d "{\"action\":\"register\",\"server_ip\":\"${VPS_IP}\",\"hostname\":\"${VPS_HOSTNAME}\",\"panel_type\":\"virtualizor\",\"client_email\":\"${CLIENT_EMAIL}\",\"vps_id\":\"${VPS_ID}\"}" \
            2>/dev/null || true
    else
        log "❌ Eroare la instalarea agentului pe VPS #${VPS_ID} (${VPS_IP})"
        return 1
    fi
}

# ── VIRTUALIZOR HOOKS ──

# Hook: După crearea unui VPS nou
hook_post_create() {
    local VPS_IP="$1"
    local VPS_ID="$2"
    local VPS_HOSTNAME="$3"
    local CLIENT_EMAIL="$4"
    local OS_TYPE="$5"

    log "📦 Hook POST_CREATE: VPS #${VPS_ID} (${VPS_IP})"
    
    # Așteaptă VPS-ul să booteze
    sleep 60
    
    install_agent_on_vps "$VPS_IP" "$VPS_ID" "$VPS_HOSTNAME" "$CLIENT_EMAIL" "$OS_TYPE"
}

# Hook: După reinstalare OS
hook_post_reinstall() {
    local VPS_IP="$1"
    local VPS_ID="$2"
    local VPS_HOSTNAME="$3"
    local CLIENT_EMAIL="$4"
    local OS_TYPE="$5"

    log "🔄 Hook POST_REINSTALL: VPS #${VPS_ID} (${VPS_IP})"
    
    # Așteaptă VPS-ul să booteze după reinstall
    sleep 90
    
    install_agent_on_vps "$VPS_IP" "$VPS_ID" "$VPS_HOSTNAME" "$CLIENT_EMAIL" "$OS_TYPE"
}

# Hook: La pornirea unui VPS (verifică dacă agentul e prezent)
hook_post_start() {
    local VPS_IP="$1"
    local VPS_ID="$2"

    log "▶️ Hook POST_START: VPS #${VPS_ID} (${VPS_IP})"
    
    # Verifică dacă agentul e instalat
    ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 "root@${VPS_IP}" \
        "test -f /opt/hoxta/sync.sh" 2>/dev/null
    
    if [ $? -ne 0 ]; then
        log "⚠️ Agent lipsă pe VPS #${VPS_ID}, reinstalare..."
        install_agent_on_vps "$VPS_IP" "$VPS_ID" "" "" ""
    else
        # Forțează o sincronizare
        ssh -o StrictHostKeyChecking=no -o ConnectTimeout=5 "root@${VPS_IP}" \
            "/opt/hoxta/sync.sh" 2>/dev/null || true
        log "✅ Agent verificat pe VPS #${VPS_ID}"
    fi
}

# ── INSTALARE HOOK ÎN VIRTUALIZOR ──

install_virtualizor_hooks() {
    log "📦 Instalare hooks Virtualizor..."
    
    HOOK_DIR="/usr/local/virtualizor/hooks"
    mkdir -p "$HOOK_DIR"

    # Hook post-create
    cat > "${HOOK_DIR}/post_create_vps.sh" << 'HOOK'
#!/bin/bash
# Virtualizor trimite: $1=vpsid $2=vps_ip $3=hostname $4=email $5=os_template
source /opt/hoxta-virtualizor/config.env
/opt/hoxta-virtualizor/hook.sh post_create "$2" "$1" "$3" "$4" "$5" &
HOOK
    chmod +x "${HOOK_DIR}/post_create_vps.sh"

    # Hook post-reinstall
    cat > "${HOOK_DIR}/post_reinstall_vps.sh" << 'HOOK'
#!/bin/bash
source /opt/hoxta-virtualizor/config.env
/opt/hoxta-virtualizor/hook.sh post_reinstall "$2" "$1" "$3" "$4" "$5" &
HOOK
    chmod +x "${HOOK_DIR}/post_reinstall_vps.sh"

    # Hook post-start
    cat > "${HOOK_DIR}/post_start_vps.sh" << 'HOOK'
#!/bin/bash
source /opt/hoxta-virtualizor/config.env
/opt/hoxta-virtualizor/hook.sh post_start "$2" "$1" &
HOOK
    chmod +x "${HOOK_DIR}/post_start_vps.sh"

    log "✅ Hooks Virtualizor instalate în ${HOOK_DIR}"
}

# ── MAIN ──

case "${1:-install}" in
    post_create)
        hook_post_create "$2" "$3" "$4" "$5" "$6"
        ;;
    post_reinstall)
        hook_post_reinstall "$2" "$3" "$4" "$5" "$6"
        ;;
    post_start)
        hook_post_start "$2" "$3"
        ;;
    install)
        echo -e "\033[0;36m"
        echo "╔══════════════════════════════════════════════════════════════╗"
        echo "║  🛡️  Hoxta — Virtualizor KVM Auto-Protection Setup         ║"
        echo "╚══════════════════════════════════════════════════════════════╝"
        echo -e "\033[0m"

        # Colectare configurare
        read -p "Hoxta API URL (ex: https://api.hoxta.com/functions/v1): " INPUT_API_URL
        read -p "Hoxta Service Role Key: " INPUT_API_KEY

        HOXTA_API_URL="${INPUT_API_URL:-$HOXTA_API_URL}"
        HOXTA_API_KEY="${INPUT_API_KEY:-$HOXTA_API_KEY}"

        # Instalare
        mkdir -p /opt/hoxta-virtualizor
        cp "$0" /opt/hoxta-virtualizor/hook.sh
        chmod +x /opt/hoxta-virtualizor/hook.sh

        cat > /opt/hoxta-virtualizor/config.env << EOF
export HOXTA_API_URL="${HOXTA_API_URL}"
export HOXTA_API_KEY="${HOXTA_API_KEY}"
EOF

        install_virtualizor_hooks

        # Cron: verifică toate VPS-urile la fiecare 10 minute
        cat > /opt/hoxta-virtualizor/check-all.sh << 'CHECK'
#!/bin/bash
source /opt/hoxta-virtualizor/config.env

# Obține lista de VPS-uri active din Virtualizor API
VPS_LIST=$(mysql -u root virtualizor -N -e "SELECT vpsid, ips, hostname, email FROM vps WHERE status=1" 2>/dev/null)

while IFS=$'\t' read -r vpsid ip hostname email; do
    [ -z "$ip" ] && continue
    PRIMARY_IP=$(echo "$ip" | head -1)
    
    ssh -o StrictHostKeyChecking=no -o ConnectTimeout=3 "root@${PRIMARY_IP}" \
        "test -f /opt/hoxta/sync.sh" 2>/dev/null
    
    if [ $? -ne 0 ]; then
        echo "[$(date)] Agent lipsă pe VPS #${vpsid} (${PRIMARY_IP}), instalare..."
        /opt/hoxta-virtualizor/hook.sh post_create "$PRIMARY_IP" "$vpsid" "$hostname" "$email" "" &
    fi
done <<< "$VPS_LIST"
CHECK
        chmod +x /opt/hoxta-virtualizor/check-all.sh
        (crontab -l 2>/dev/null | grep -v hoxta-virtualizor; echo "*/10 * * * * /opt/hoxta-virtualizor/check-all.sh >> /var/log/hoxta-virtualizor-hook.log 2>&1") | crontab -

        echo ""
        echo -e "\033[0;32m✅ Hoxta Virtualizor hooks instalate cu succes!\033[0m"
        echo ""
        echo "  📂 Config:  /opt/hoxta-virtualizor/config.env"
        echo "  📂 Hooks:   /usr/local/virtualizor/hooks/"
        echo "  📂 Log:     /var/log/hoxta-virtualizor-hook.log"
        echo ""
        echo "  La fiecare VPS nou creat sau reinstalat, agentul Hoxta"
        echo "  se instalează automat și începe sincronizarea regulilor."
        ;;
    *)
        echo "Usage: $0 {install|post_create|post_reinstall|post_start}"
        ;;
esac
