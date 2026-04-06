import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Copy, Download, Key, Server, Shield, CheckCircle2,
  ChevronDown, ChevronUp, Globe, FileCode, RefreshCw,
} from "lucide-react";

interface WhmcsModuleProps {
  whmcsApiSecret: string;
  onSecretChange: (secret: string) => void;
}

export const WhmcsModule = ({ whmcsApiSecret, onSecretChange }: WhmcsModuleProps) => {
  const { toast } = useToast();
  const [hoxtaUrl, setHoxtaUrl] = useState("https://api-fw.hoxta.com");
  const [showPhpPreview, setShowPhpPreview] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiat în clipboard!" });
  };

  const generateSecret = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < 48; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    onSecretChange(result);
  };

  const hasConfig = whmcsApiSecret && hoxtaUrl;

  const generatePhpModule = () => {
    const apiUrl = hoxtaUrl
      ? `${hoxtaUrl.replace(/\/$/, "")}/functions/v1/whmcs-provision`
      : "https://api-fw.hoxta.com/functions/v1/whmcs-provision";
    const secret = whmcsApiSecret || "YOUR_WHMCS_API_SECRET";

    return `<?php
/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  Hoxta Firewall Manager — WHMCS Addon Module                ║
 * ║  Provisioning: Create / Suspend / Unsuspend / Terminate      ║
 * ║  Auto IP Allocation from WHMCS Dedicated IP                  ║
 * ║  Admin Area: Manage all Hoxta clients                        ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * INSTALARE:
 * 1. Creează folder: modules/addons/hoxta/
 * 2. Copiază acest fișier ca: modules/addons/hoxta/hoxta.php
 * 3. WHMCS Admin → Setup → Addon Modules → Activate "Hoxta Firewall Manager"
 * 4. Configure → setează access pentru admin roles
 * 5. Va apărea în meniu: Addons → Hoxta Firewall Manager
 */

if (!defined("WHMCS")) die("This file cannot be accessed directly");

use WHMCS\\Database\\Capsule;

/**
 * Addon module configuration
 */
function hoxta_config() {
    return [
        'name'        => 'Hoxta Firewall Manager',
        'description' => 'Gestionare completă firewall: provisionare conturi, IP management, reguli firewall, GeoIP blocking, protecție DDoS.',
        'version'     => '2.0',
        'author'      => 'Hoxta',
        'fields'      => [
            'api_url' => [
                'FriendlyName' => 'Hoxta API URL',
                'Type'         => 'text',
                'Size'         => '60',
                'Default'      => '${apiUrl}',
                'Description'  => 'URL-ul API Hoxta (Supabase URL + /functions/v1/whmcs-provision)',
            ],
            'api_secret' => [
                'FriendlyName' => 'API Secret',
                'Type'         => 'password',
                'Size'         => '60',
                'Default'      => '${secret}',
                'Description'  => 'Secret-ul partajat cu Hoxta backend (WHMCS_API_SECRET)',
            ],
            'panel_url' => [
                'FriendlyName' => 'Panel URL',
                'Type'         => 'text',
                'Size'         => '60',
                'Default'      => '${hoxtaUrl || "https://firewall.hoxta.com"}',
                'Description'  => 'URL-ul panoului Hoxta (pentru linkul din Client Area)',
            ],
            'default_max_rules' => [
                'FriendlyName' => 'Max Reguli Default',
                'Type'         => 'text',
                'Size'         => '5',
                'Default'      => '20',
                'Description'  => 'Numărul maxim de reguli firewall per client (default)',
            ],
            'auto_provision' => [
                'FriendlyName' => 'Auto Provision',
                'Type'         => 'yesno',
                'Default'      => 'yes',
                'Description'  => 'Creează automat cont Hoxta la activarea serviciului',
            ],
        ],
    ];
}

/**
 * Addon activation — create necessary DB tables
 */
function hoxta_activate() {
    try {
        if (!Capsule::schema()->hasTable('mod_hoxta_clients')) {
            Capsule::schema()->create('mod_hoxta_clients', function(\$table) {
                \$table->increments('id');
                \$table->integer('client_id')->unsigned();
                \$table->integer('service_id')->unsigned()->nullable();
                \$table->string('hoxta_user_id', 64)->nullable();
                \$table->string('email', 255);
                \$table->string('status', 20)->default('active');
                \$table->integer('max_rules')->default(20);
                \$table->boolean('ddos_protection')->default(false);
                \$table->timestamps();
                \$table->unique(['client_id', 'service_id']);
            });
        }

        if (!Capsule::schema()->hasTable('mod_hoxta_logs')) {
            Capsule::schema()->create('mod_hoxta_logs', function(\$table) {
                \$table->increments('id');
                \$table->integer('client_id')->unsigned()->nullable();
                \$table->string('action', 50);
                \$table->text('details')->nullable();
                \$table->string('status', 20);
                \$table->integer('admin_id')->unsigned()->nullable();
                \$table->timestamp('created_at')->useCurrent();
            });
        }

        return ['status' => 'success', 'description' => 'Hoxta Firewall Manager activat cu succes!'];
    } catch (\\Exception \$e) {
        return ['status' => 'error', 'description' => 'Eroare: ' . \$e->getMessage()];
    }
}

/**
 * Addon deactivation — cleanup
 */
function hoxta_deactivate() {
    try {
        Capsule::schema()->dropIfExists('mod_hoxta_clients');
        Capsule::schema()->dropIfExists('mod_hoxta_logs');
        return ['status' => 'success', 'description' => 'Hoxta dezactivat. Tabelele au fost șterse.'];
    } catch (\\Exception \$e) {
        return ['status' => 'error', 'description' => 'Eroare: ' . \$e->getMessage()];
    }
}

/**
 * Addon upgrade
 */
function hoxta_upgrade(\$vars) {
    // Future migrations go here
    return [];
}

/**
 * API call helper
 */
function hoxta_api_call(\$action, \$params = [], \$vars = []) {
    \$apiUrl = \$vars['api_url'] ?? '${apiUrl}';
    \$apiSecret = \$vars['api_secret'] ?? '${secret}';

    \$data = array_merge(['action' => \$action], \$params);

    \$ch = curl_init(\$apiUrl);
    curl_setopt_array(\$ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode(\$data),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 30,
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            'x-whmcs-key: ' . \$apiSecret,
        ],
    ]);

    \$response = curl_exec(\$ch);
    \$httpCode = curl_getinfo(\$ch, CURLINFO_HTTP_CODE);
    \$error = curl_error(\$ch);
    curl_close(\$ch);

    if (\$error) return ['success' => false, 'error' => "cURL Error: \$error"];

    \$result = json_decode(\$response, true);

    if (\$httpCode !== 200 || !isset(\$result['success']) || !\$result['success']) {
        return [
            'success' => false,
            'error'   => \$result['error'] ?? "HTTP \$httpCode - Unknown error",
        ];
    }

    return \$result;
}

/**
 * Log an action
 */
function hoxta_log(\$action, \$details, \$status, \$clientId = null, \$adminId = null) {
    try {
        Capsule::table('mod_hoxta_logs')->insert([
            'client_id'  => \$clientId,
            'action'     => \$action,
            'details'    => \$details,
            'status'     => \$status,
            'admin_id'   => \$adminId,
            'created_at' => date('Y-m-d H:i:s'),
        ]);
    } catch (\\Exception \$e) {
        // Non-critical
    }
}

/**
 * Get client's dedicated IP from WHMCS service
 */
function hoxta_get_dedicated_ip(\$serviceId) {
    try {
        \$service = Capsule::table('tblhosting')->where('id', \$serviceId)->first();
        if (\$service && !empty(\$service->dedicatedip)) {
            return \$service->dedicatedip;
        }
        // Check assigned IPs
        if (\$service && !empty(\$service->assignedips)) {
            \$ips = explode("\\n", \$service->assignedips);
            return trim(\$ips[0]);
        }
    } catch (\\Exception \$e) {}
    return null;
}

/**
 * ═══════════════════════════════════════════
 * ADMIN AREA OUTPUT — Main addon page
 * ═══════════════════════════════════════════
 */
function hoxta_output(\$vars) {
    \$moduleLink = \$vars['modulelink'];
    \$action = isset(\$_REQUEST['a']) ? \$_REQUEST['a'] : 'list';

    echo '<style>
        .hoxta-wrap { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        .hoxta-header { background: linear-gradient(135deg, #0ea5e9, #06b6d4); padding: 20px; border-radius: 12px; color: #fff; margin-bottom: 20px; }
        .hoxta-header h2 { margin: 0; font-size: 22px; }
        .hoxta-header p { margin: 5px 0 0; opacity: 0.85; font-size: 14px; }
        .hoxta-card { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 20px; margin-bottom: 15px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
        .hoxta-btn { display: inline-block; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; text-decoration: none; border: none; }
        .hoxta-btn-primary { background: #0ea5e9; color: #fff; }
        .hoxta-btn-primary:hover { background: #0284c7; }
        .hoxta-btn-success { background: #10b981; color: #fff; }
        .hoxta-btn-danger { background: #ef4444; color: #fff; }
        .hoxta-btn-warning { background: #f59e0b; color: #fff; }
        .hoxta-btn-sm { padding: 4px 10px; font-size: 11px; }
        .hoxta-table { width: 100%; border-collapse: collapse; }
        .hoxta-table th { background: #f8fafc; padding: 10px 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #64748b; border-bottom: 2px solid #e2e8f0; }
        .hoxta-table td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
        .hoxta-table tr:hover { background: #f8fafc; }
        .hoxta-badge { display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; }
        .hoxta-badge-active { background: #d1fae5; color: #059669; }
        .hoxta-badge-suspended { background: #fef3c7; color: #d97706; }
        .hoxta-badge-terminated { background: #fee2e2; color: #dc2626; }
        .hoxta-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 20px; }
        .hoxta-stat { background: #fff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 15px; text-align: center; }
        .hoxta-stat-num { font-size: 28px; font-weight: 700; color: #0ea5e9; }
        .hoxta-stat-label { font-size: 12px; color: #64748b; margin-top: 4px; }
        .hoxta-nav { display: flex; gap: 8px; margin-bottom: 20px; }
        .hoxta-nav a { padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 500; color: #64748b; text-decoration: none; border: 1px solid #e5e7eb; }
        .hoxta-nav a.active, .hoxta-nav a:hover { background: #0ea5e9; color: #fff; border-color: #0ea5e9; }
    </style>';

    echo '<div class="hoxta-wrap">';
    echo '<div class="hoxta-header">';
    echo '<h2>🛡️ Hoxta Firewall Manager</h2>';
    echo '<p>Gestionare completă: conturi client, IP-uri, reguli firewall, protecție DDoS</p>';
    echo '</div>';

    // Navigation
    echo '<div class="hoxta-nav">';
    echo '<a href="' . \$moduleLink . '&a=list" class="' . (\$action === 'list' ? 'active' : '') . '">📋 Clienți</a>';
    echo '<a href="' . \$moduleLink . '&a=provision" class="' . (\$action === 'provision' ? 'active' : '') . '">➕ Provisionare</a>';
    echo '<a href="' . \$moduleLink . '&a=logs" class="' . (\$action === 'logs' ? 'active' : '') . '">📜 Loguri</a>';
    echo '<a href="' . \$moduleLink . '&a=test" class="' . (\$action === 'test' ? 'active' : '') . '">🔧 Test Conexiune</a>';
    echo '</div>';

    switch (\$action) {
        case 'provision':
            hoxta_admin_provision(\$vars);
            break;
        case 'suspend':
            hoxta_admin_suspend(\$vars);
            break;
        case 'unsuspend':
            hoxta_admin_unsuspend(\$vars);
            break;
        case 'terminate':
            hoxta_admin_terminate(\$vars);
            break;
        case 'status':
            hoxta_admin_status(\$vars);
            break;
        case 'logs':
            hoxta_admin_logs(\$vars);
            break;
        case 'test':
            hoxta_admin_test(\$vars);
            break;
        default:
            hoxta_admin_list(\$vars);
            break;
    }

    echo '</div>';
}

/**
 * Admin: List all Hoxta clients
 */
function hoxta_admin_list(\$vars) {
    \$moduleLink = \$vars['modulelink'];

    // Stats
    \$total = Capsule::table('mod_hoxta_clients')->count();
    \$active = Capsule::table('mod_hoxta_clients')->where('status', 'active')->count();
    \$suspended = Capsule::table('mod_hoxta_clients')->where('status', 'suspended')->count();
    \$terminated = Capsule::table('mod_hoxta_clients')->where('status', 'terminated')->count();

    echo '<div class="hoxta-stats">';
    echo '<div class="hoxta-stat"><div class="hoxta-stat-num">' . \$total . '</div><div class="hoxta-stat-label">Total Clienți</div></div>';
    echo '<div class="hoxta-stat"><div class="hoxta-stat-num" style="color:#10b981">' . \$active . '</div><div class="hoxta-stat-label">Activi</div></div>';
    echo '<div class="hoxta-stat"><div class="hoxta-stat-num" style="color:#f59e0b">' . \$suspended . '</div><div class="hoxta-stat-label">Suspendați</div></div>';
    echo '<div class="hoxta-stat"><div class="hoxta-stat-num" style="color:#ef4444">' . \$terminated . '</div><div class="hoxta-stat-label">Terminați</div></div>';
    echo '</div>';

    // Client list
    \$clients = Capsule::table('mod_hoxta_clients')
        ->leftJoin('tblclients', 'mod_hoxta_clients.client_id', '=', 'tblclients.id')
        ->select('mod_hoxta_clients.*', 'tblclients.firstname', 'tblclients.lastname', 'tblclients.email as client_email')
        ->orderBy('mod_hoxta_clients.id', 'desc')
        ->get();

    echo '<div class="hoxta-card">';
    echo '<table class="hoxta-table">';
    echo '<thead><tr>';
    echo '<th>ID</th><th>Client</th><th>Email Hoxta</th><th>Status</th><th>Max Reguli</th><th>DDoS</th><th>Acțiuni</th>';
    echo '</tr></thead><tbody>';

    foreach (\$clients as \$c) {
        \$statusClass = 'hoxta-badge-' . \$c->status;
        \$statusLabel = ucfirst(\$c->status);

        echo '<tr>';
        echo '<td>' . \$c->id . '</td>';
        echo '<td>' . htmlspecialchars(\$c->firstname . ' ' . \$c->lastname) . '<br><small style="color:#94a3b8">#' . \$c->client_id . '</small></td>';
        echo '<td><code style="font-size:12px">' . htmlspecialchars(\$c->email) . '</code></td>';
        echo '<td><span class="hoxta-badge ' . \$statusClass . '">' . \$statusLabel . '</span></td>';
        echo '<td>' . \$c->max_rules . '</td>';
        echo '<td>' . (\$c->ddos_protection ? '🛡️ Premium' : 'Standard') . '</td>';
        echo '<td>';

        if (\$c->status === 'active') {
            echo '<a href="' . \$moduleLink . '&a=suspend&client_id=' . \$c->client_id . '" class="hoxta-btn hoxta-btn-warning hoxta-btn-sm" onclick="return confirm(\'Suspendare client?\')">Suspendă</a> ';
            echo '<a href="' . \$moduleLink . '&a=terminate&client_id=' . \$c->client_id . '" class="hoxta-btn hoxta-btn-danger hoxta-btn-sm" onclick="return confirm(\'Terminare cont?\')">Termină</a> ';
        } elseif (\$c->status === 'suspended') {
            echo '<a href="' . \$moduleLink . '&a=unsuspend&client_id=' . \$c->client_id . '" class="hoxta-btn hoxta-btn-success hoxta-btn-sm">Reactivează</a> ';
        }

        echo '<a href="' . \$moduleLink . '&a=status&email=' . urlencode(\$c->email) . '" class="hoxta-btn hoxta-btn-primary hoxta-btn-sm">Status</a>';
        echo '</td>';
        echo '</tr>';
    }

    echo '</tbody></table>';
    echo '</div>';
}

/**
 * Admin: Manual provision form
 */
function hoxta_admin_provision(\$vars) {
    \$moduleLink = \$vars['modulelink'];

    if (\$_SERVER['REQUEST_METHOD'] === 'POST' && isset(\$_POST['email'])) {
        \$email = trim(\$_POST['email']);
        \$password = \$_POST['password'] ?: bin2hex(random_bytes(12));
        \$displayName = trim(\$_POST['display_name']);
        \$ip = trim(\$_POST['ip_address']);
        \$maxRules = intval(\$_POST['max_rules']) ?: intval(\$vars['default_max_rules']) ?: 20;
        \$clientId = intval(\$_POST['client_id']) ?: 0;
        \$serviceId = intval(\$_POST['service_id']) ?: null;

        \$result = hoxta_api_call('create_account', [
            'email'        => \$email,
            'password'     => \$password,
            'display_name' => \$displayName,
            'ip_address'   => \$ip ?: null,
            'ip_label'     => \$ip ? "WHMCS #" . \$serviceId . " - " . \$ip : null,
            'max_rules'    => \$maxRules,
        ], \$vars);

        if (\$result['success']) {
            // Save to local DB
            Capsule::table('mod_hoxta_clients')->updateOrInsert(
                ['client_id' => \$clientId, 'service_id' => \$serviceId],
                [
                    'email'         => \$email,
                    'hoxta_user_id' => \$result['user_id'] ?? null,
                    'status'        => 'active',
                    'max_rules'     => \$maxRules,
                    'created_at'    => date('Y-m-d H:i:s'),
                    'updated_at'    => date('Y-m-d H:i:s'),
                ]
            );
            hoxta_log('create_account', "Email: \$email, IP: \$ip", 'success', \$clientId, \$_SESSION['adminid'] ?? null);
            echo '<div style="background:#d1fae5;color:#059669;padding:12px;border-radius:8px;margin-bottom:15px">✅ Cont creat cu succes! User ID: ' . (\$result['user_id'] ?? 'N/A') . '</div>';
        } else {
            hoxta_log('create_account', "Email: \$email - Error: " . (\$result['error'] ?? 'unknown'), 'error', \$clientId);
            echo '<div style="background:#fee2e2;color:#dc2626;padding:12px;border-radius:8px;margin-bottom:15px">❌ Eroare: ' . htmlspecialchars(\$result['error'] ?? 'Unknown') . '</div>';
        }
    }

    echo '<div class="hoxta-card">';
    echo '<h3 style="margin-top:0">➕ Provisionare manuală cont Hoxta</h3>';
    echo '<form method="POST" action="' . \$moduleLink . '&a=provision">';
    echo '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:15px">';
    echo '<div><label style="font-size:12px;color:#64748b">Email *</label><input type="email" name="email" required style="width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px"></div>';
    echo '<div><label style="font-size:12px;color:#64748b">Parolă (lăsați gol pt auto)</label><input type="text" name="password" style="width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px"></div>';
    echo '<div><label style="font-size:12px;color:#64748b">Nume complet</label><input type="text" name="display_name" style="width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px"></div>';
    echo '<div><label style="font-size:12px;color:#64748b">IP Dedicat</label><input type="text" name="ip_address" placeholder="185.x.x.x" style="width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px"></div>';
    echo '<div><label style="font-size:12px;color:#64748b">Max Reguli</label><input type="number" name="max_rules" value="' . (\$vars['default_max_rules'] ?? 20) . '" style="width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px"></div>';
    echo '<div><label style="font-size:12px;color:#64748b">Client ID WHMCS</label><input type="number" name="client_id" style="width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px"></div>';
    echo '<div><label style="font-size:12px;color:#64748b">Service ID WHMCS</label><input type="number" name="service_id" style="width:100%;padding:8px;border:1px solid #e2e8f0;border-radius:8px;font-size:13px"></div>';
    echo '</div>';
    echo '<button type="submit" class="hoxta-btn hoxta-btn-primary">🚀 Creează Cont</button>';
    echo '</form>';
    echo '</div>';
}

/**
 * Admin: Suspend
 */
function hoxta_admin_suspend(\$vars) {
    \$clientId = intval(\$_REQUEST['client_id']);
    \$client = Capsule::table('mod_hoxta_clients')->where('client_id', \$clientId)->first();
    if (!\$client) { echo '<div style="color:red">Client negăsit!</div>'; return; }

    \$result = hoxta_api_call('suspend_account', ['email' => \$client->email], \$vars);
    if (\$result['success']) {
        Capsule::table('mod_hoxta_clients')->where('client_id', \$clientId)->update(['status' => 'suspended', 'updated_at' => date('Y-m-d H:i:s')]);
        hoxta_log('suspend', "Client #\$clientId suspendat", 'success', \$clientId, \$_SESSION['adminid'] ?? null);
        echo '<div style="background:#fef3c7;color:#d97706;padding:12px;border-radius:8px">⚠️ Client suspendat cu succes.</div>';
    } else {
        echo '<div style="background:#fee2e2;color:#dc2626;padding:12px;border-radius:8px">❌ Eroare: ' . htmlspecialchars(\$result['error'] ?? 'Unknown') . '</div>';
    }
    echo '<br><a href="' . \$vars['modulelink'] . '" class="hoxta-btn hoxta-btn-primary">← Înapoi</a>';
}

/**
 * Admin: Unsuspend
 */
function hoxta_admin_unsuspend(\$vars) {
    \$clientId = intval(\$_REQUEST['client_id']);
    \$client = Capsule::table('mod_hoxta_clients')->where('client_id', \$clientId)->first();
    if (!\$client) { echo '<div style="color:red">Client negăsit!</div>'; return; }

    \$result = hoxta_api_call('unsuspend_account', ['email' => \$client->email], \$vars);
    if (\$result['success']) {
        Capsule::table('mod_hoxta_clients')->where('client_id', \$clientId)->update(['status' => 'active', 'updated_at' => date('Y-m-d H:i:s')]);
        hoxta_log('unsuspend', "Client #\$clientId reactivat", 'success', \$clientId, \$_SESSION['adminid'] ?? null);
        echo '<div style="background:#d1fae5;color:#059669;padding:12px;border-radius:8px">✅ Client reactivat!</div>';
    } else {
        echo '<div style="background:#fee2e2;color:#dc2626;padding:12px;border-radius:8px">❌ Eroare: ' . htmlspecialchars(\$result['error'] ?? 'Unknown') . '</div>';
    }
    echo '<br><a href="' . \$vars['modulelink'] . '" class="hoxta-btn hoxta-btn-primary">← Înapoi</a>';
}

/**
 * Admin: Terminate
 */
function hoxta_admin_terminate(\$vars) {
    \$clientId = intval(\$_REQUEST['client_id']);
    \$client = Capsule::table('mod_hoxta_clients')->where('client_id', \$clientId)->first();
    if (!\$client) { echo '<div style="color:red">Client negăsit!</div>'; return; }

    \$result = hoxta_api_call('terminate_account', ['email' => \$client->email], \$vars);
    if (\$result['success']) {
        Capsule::table('mod_hoxta_clients')->where('client_id', \$clientId)->update(['status' => 'terminated', 'updated_at' => date('Y-m-d H:i:s')]);
        hoxta_log('terminate', "Client #\$clientId terminat", 'success', \$clientId, \$_SESSION['adminid'] ?? null);
        echo '<div style="background:#fee2e2;color:#dc2626;padding:12px;border-radius:8px">🗑️ Cont terminat.</div>';
    } else {
        echo '<div style="background:#fee2e2;color:#dc2626;padding:12px;border-radius:8px">❌ Eroare: ' . htmlspecialchars(\$result['error'] ?? 'Unknown') . '</div>';
    }
    echo '<br><a href="' . \$vars['modulelink'] . '" class="hoxta-btn hoxta-btn-primary">← Înapoi</a>';
}

/**
 * Admin: View client status from Hoxta API
 */
function hoxta_admin_status(\$vars) {
    \$email = \$_REQUEST['email'] ?? '';
    \$result = hoxta_api_call('get_status', ['email' => \$email], \$vars);

    echo '<div class="hoxta-card">';
    echo '<h3 style="margin-top:0">📊 Status: ' . htmlspecialchars(\$email) . '</h3>';

    if (\$result['success']) {
        echo '<table class="hoxta-table">';
        echo '<tr><td><strong>User ID</strong></td><td>' . (\$result['user_id'] ?? 'N/A') . '</td></tr>';
        echo '<tr><td><strong>Status</strong></td><td>' . (\$result['status'] === 'active' ? '✅ Activ' : '⚠️ ' . \$result['status']) . '</td></tr>';
        \$ips = array_map(function(\$ip) { return \$ip['ip_address']; }, \$result['ips'] ?? []);
        echo '<tr><td><strong>IP-uri</strong></td><td>' . (implode(', ', \$ips) ?: 'Niciun IP') . '</td></tr>';
        echo '<tr><td><strong>Reguli</strong></td><td>' . (\$result['rules']['enabled'] ?? 0) . '/' . (\$result['rules']['total'] ?? 0) . ' active</td></tr>';
        echo '<tr><td><strong>DDoS</strong></td><td>' . ((\$result['ddos_protection'] ?? false) ? '🛡️ Premium' : 'Standard') . '</td></tr>';
        echo '</table>';
    } else {
        echo '<div style="background:#fee2e2;color:#dc2626;padding:12px;border-radius:8px">❌ ' . htmlspecialchars(\$result['error'] ?? 'Error') . '</div>';
    }

    echo '</div>';
    echo '<a href="' . \$vars['modulelink'] . '" class="hoxta-btn hoxta-btn-primary">← Înapoi</a>';
}

/**
 * Admin: Logs
 */
function hoxta_admin_logs(\$vars) {
    \$logs = Capsule::table('mod_hoxta_logs')->orderBy('id', 'desc')->limit(100)->get();

    echo '<div class="hoxta-card">';
    echo '<h3 style="margin-top:0">📜 Ultimele 100 Loguri</h3>';
    echo '<table class="hoxta-table">';
    echo '<thead><tr><th>Data</th><th>Acțiune</th><th>Client</th><th>Detalii</th><th>Status</th></tr></thead><tbody>';

    foreach (\$logs as \$log) {
        \$statusColor = \$log->status === 'success' ? '#059669' : '#dc2626';
        echo '<tr>';
        echo '<td><small>' . \$log->created_at . '</small></td>';
        echo '<td><code style="font-size:11px">' . htmlspecialchars(\$log->action) . '</code></td>';
        echo '<td>' . (\$log->client_id ? '#' . \$log->client_id : '-') . '</td>';
        echo '<td style="max-width:300px;overflow:hidden;text-overflow:ellipsis"><small>' . htmlspecialchars(\$log->details ?? '') . '</small></td>';
        echo '<td style="color:' . \$statusColor . ';font-weight:600">' . \$log->status . '</td>';
        echo '</tr>';
    }

    echo '</tbody></table>';
    echo '</div>';
}

/**
 * Admin: Test connection
 */
function hoxta_admin_test(\$vars) {
    echo '<div class="hoxta-card">';
    echo '<h3 style="margin-top:0">🔧 Test Conexiune API</h3>';

    \$result = hoxta_api_call('get_status', ['email' => 'test@nonexistent.com'], \$vars);

    echo '<table class="hoxta-table">';
    echo '<tr><td><strong>API URL</strong></td><td><code>' . htmlspecialchars(\$vars['api_url'] ?? 'N/A') . '</code></td></tr>';
    echo '<tr><td><strong>Status</strong></td><td>';

    if (isset(\$result['error']) && strpos(\$result['error'], 'not found') !== false) {
        echo '<span style="color:#059669;font-weight:600">✅ Conexiune OK!</span> (user test nu există — normal)';
    } elseif (\$result['success']) {
        echo '<span style="color:#059669;font-weight:600">✅ Conexiune reușită!</span>';
    } else {
        echo '<span style="color:#dc2626;font-weight:600">❌ Eroare: ' . htmlspecialchars(\$result['error'] ?? 'Unknown') . '</span>';
    }

    echo '</td></tr>';
    echo '</table>';
    echo '</div>';

    echo '<div class="hoxta-card">';
    echo '<h3 style="margin-top:0">📋 Informații configurare</h3>';
    echo '<p style="font-size:13px;color:#64748b">API URL: <code>' . htmlspecialchars(\$vars['api_url'] ?? '') . '</code></p>';
    echo '<p style="font-size:13px;color:#64748b">Panel URL: <code>' . htmlspecialchars(\$vars['panel_url'] ?? '') . '</code></p>';
    echo '<p style="font-size:13px;color:#64748b">Max Reguli Default: <code>' . htmlspecialchars(\$vars['default_max_rules'] ?? '20') . '</code></p>';
    echo '<p style="font-size:13px;color:#64748b">Auto Provision: <code>' . (\$vars['auto_provision'] === 'on' ? 'Da' : 'Nu') . '</code></p>';
    echo '</div>';
}

/**
 * ═══════════════════════════════════════════
 * HOOKS — Auto-provision on service events
 * ═══════════════════════════════════════════
 */

// Hook: Service activated → auto create
add_hook('AfterModuleCreate', 1, function(\$params) {
    \$addonConfig = hoxta_get_addon_config();
    if (!(\$addonConfig['auto_provision'] ?? false)) return;

    \$client = Capsule::table('tblclients')->where('id', \$params['userid'])->first();
    if (!\$client) return;

    \$ip = hoxta_get_dedicated_ip(\$params['serviceid']);

    \$result = hoxta_api_call('create_account', [
        'email'        => \$client->email,
        'password'     => bin2hex(random_bytes(12)),
        'display_name' => \$client->firstname . ' ' . \$client->lastname,
        'ip_address'   => \$ip,
        'ip_label'     => "WHMCS #" . \$params['serviceid'] . " - " . (\$ip ?: 'no IP'),
        'max_rules'    => intval(\$addonConfig['default_max_rules'] ?? 20),
    ], \$addonConfig);

    if (\$result['success']) {
        Capsule::table('mod_hoxta_clients')->updateOrInsert(
            ['client_id' => \$params['userid'], 'service_id' => \$params['serviceid']],
            ['email' => \$client->email, 'hoxta_user_id' => \$result['user_id'] ?? null, 'status' => 'active', 'max_rules' => intval(\$addonConfig['default_max_rules'] ?? 20), 'created_at' => date('Y-m-d H:i:s'), 'updated_at' => date('Y-m-d H:i:s')]
        );
        hoxta_log('auto_create', "Auto-provision for service #" . \$params['serviceid'], 'success', \$params['userid']);
    }
});

// Hook: Service suspended
add_hook('AfterModuleSuspend', 1, function(\$params) {
    \$addonConfig = hoxta_get_addon_config();
    \$client = Capsule::table('tblclients')->where('id', \$params['userid'])->first();
    if (!\$client) return;

    hoxta_api_call('suspend_account', ['email' => \$client->email], \$addonConfig);
    Capsule::table('mod_hoxta_clients')->where('client_id', \$params['userid'])->update(['status' => 'suspended', 'updated_at' => date('Y-m-d H:i:s')]);
    hoxta_log('auto_suspend', "Service #" . \$params['serviceid'], 'success', \$params['userid']);
});

// Hook: Service unsuspended
add_hook('AfterModuleUnsuspend', 1, function(\$params) {
    \$addonConfig = hoxta_get_addon_config();
    \$client = Capsule::table('tblclients')->where('id', \$params['userid'])->first();
    if (!\$client) return;

    hoxta_api_call('unsuspend_account', ['email' => \$client->email], \$addonConfig);
    Capsule::table('mod_hoxta_clients')->where('client_id', \$params['userid'])->update(['status' => 'active', 'updated_at' => date('Y-m-d H:i:s')]);
    hoxta_log('auto_unsuspend', "Service #" . \$params['serviceid'], 'success', \$params['userid']);
});

// Hook: Service terminated
add_hook('AfterModuleTerminate', 1, function(\$params) {
    \$addonConfig = hoxta_get_addon_config();
    \$client = Capsule::table('tblclients')->where('id', \$params['userid'])->first();
    if (!\$client) return;

    hoxta_api_call('terminate_account', ['email' => \$client->email], \$addonConfig);
    Capsule::table('mod_hoxta_clients')->where('client_id', \$params['userid'])->update(['status' => 'terminated', 'updated_at' => date('Y-m-d H:i:s')]);
    hoxta_log('auto_terminate', "Service #" . \$params['serviceid'], 'success', \$params['userid']);
});

/**
 * Helper: Get addon config values
 */
function hoxta_get_addon_config() {
    try {
        \$settings = Capsule::table('tbladdonmodules')->where('module', 'hoxta')->pluck('value', 'setting');
        return \$settings->toArray();
    } catch (\\Exception \$e) {
        return [];
    }
}

/**
 * CLIENT AREA — Shows "Manage Firewall" link
 */
function hoxta_clientarea(\$vars) {
    \$panelUrl = \$vars['panel_url'] ?? '${hoxtaUrl || "https://firewall.hoxta.com"}';

    return [
        'pagetitle'    => 'Hoxta Firewall Manager',
        'breadcrumb'   => ['index.php?m=hoxta' => 'Hoxta Firewall'],
        'templatefile' => '',
        'vars'         => [],
        'requirelogin' => true,
    ];
}
`;
  };

  const downloadPhpModule = () => {
    const content = generatePhpModule();
    const blob = new Blob([content], { type: "application/x-php" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "hoxta.php";
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "hoxta.php descărcat!" });
  };

  const testConnection = async () => {
    if (!hoxtaUrl || !whmcsApiSecret) {
      toast({ title: "Completează URL-ul și API Secret", variant: "destructive" });
      return;
    }
    setTesting(true);
    setTestResult(null);

    try {
      const apiUrl = `${hoxtaUrl.replace(/\/$/, "")}/functions/v1/whmcs-provision`;
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-whmcs-key": whmcsApiSecret,
        },
        body: JSON.stringify({ action: "get_status", email: "test@nonexistent.com" }),
      });

      if (res.status === 401) {
        setTestResult("❌ API Secret invalid");
      } else if (res.status === 404) {
        setTestResult("✅ Conexiune OK! (user test nu există — normal)");
      } else if (res.status === 500) {
        const data = await res.json().catch(() => ({}));
        setTestResult(`⚠️ Eroare server: ${data.error || "unknown"}`);
      } else {
        setTestResult("✅ Conexiune reușită!");
      }
    } catch (err: any) {
      setTestResult(`❌ Eroare conexiune: ${err.message}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Config */}
      <div className="glass rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
          <Server className="h-5 w-5 text-primary" />
          Configurare WHMCS Addon
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Conectează WHMCS la Hoxta printr-un <strong>Addon Module</strong> — apare în Addons → Hoxta Firewall Manager.
        </p>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className="text-xs text-muted-foreground mb-1 block">URL API Hoxta (Supabase URL) *</label>
            <Input
              value={hoxtaUrl}
              onChange={e => setHoxtaUrl(e.target.value)}
              placeholder="https://xxxxx.supabase.co"
              className="bg-muted/50 border-border/50 text-sm rounded-xl font-mono"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Pentru self-hosted: https://api.domeniul-tau.com
            </p>
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs text-muted-foreground mb-1 block">WHMCS API Secret *</label>
            <div className="flex gap-2">
              <Input
                value={whmcsApiSecret}
                onChange={e => onSecretChange(e.target.value)}
                placeholder="secret-lung-aleator"
                className="bg-muted/50 border-border/50 text-sm rounded-xl font-mono flex-1"
              />
              <Button size="sm" variant="outline" onClick={generateSecret} className="rounded-xl text-xs shrink-0">
                <Key className="h-3 w-3 mr-1" /> Generează
              </Button>
              <Button size="sm" variant="outline" onClick={() => copy(whmcsApiSecret)} className="rounded-xl text-xs shrink-0" disabled={!whmcsApiSecret}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Acest secret trebuie setat ca variabilă de mediu <code className="text-primary">WHMCS_API_SECRET</code> în backend.
            </p>
          </div>
        </div>

        {hasConfig && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30">
              <CheckCircle2 className="h-3 w-3 mr-1" /> Configurare completă
            </Badge>
            <Button size="sm" variant="outline" onClick={testConnection} disabled={testing} className="rounded-xl text-xs">
              <RefreshCw className={`h-3 w-3 mr-1 ${testing ? "animate-spin" : ""}`} />
              {testing ? "Se testează..." : "Test conexiune"}
            </Button>
          </div>
        )}

        {testResult && (
          <div className="mt-3 bg-muted/30 rounded-xl p-3 border border-border/50 text-sm">
            {testResult}
          </div>
        )}
      </div>

      {/* Download module */}
      <div className="glass rounded-2xl p-6 border border-primary/20">
        <h3 className="text-lg font-semibold text-foreground mb-2 flex items-center gap-2">
          <FileCode className="h-5 w-5 text-primary" />
          📦 Addon Module WHMCS (PHP)
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Descarcă modulul PHP și instalează-l în WHMCS ca <strong>Addon Module</strong>. Va apărea în Setup → Addon Modules.
        </p>

        <div className="grid sm:grid-cols-2 gap-4 mb-4">
          <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
            <p className="text-sm font-semibold text-foreground mb-1">🔧 Funcționalități Addon:</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li>✅ Panou admin complet cu statistici</li>
              <li>✅ Auto-provision la activarea serviciului</li>
              <li>✅ Suspend / Unsuspend / Terminate automat</li>
              <li>✅ Provisionare manuală din addon</li>
              <li>✅ IP dedicat din WHMCS → Hoxta automat</li>
              <li>✅ Log complet acțiuni cu istoric</li>
              <li>✅ Test conexiune API din admin</li>
              <li>✅ Tabel local clienți Hoxta (mod_hoxta_clients)</li>
            </ul>
          </div>

          <div className="bg-muted/30 rounded-xl p-4 border border-border/50">
            <p className="text-sm font-semibold text-foreground mb-1">📋 Instalare în WHMCS:</p>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Creează folder <code className="text-primary">modules/addons/hoxta/</code></li>
              <li>Upload <code className="text-primary">hoxta.php</code> în acel folder</li>
              <li>WHMCS Admin → Setup → Addon Modules</li>
              <li>Găsește <strong>Hoxta Firewall Manager</strong> → Activate</li>
              <li>Configure → completează API URL & Secret</li>
              <li>Accesează din meniu: Addons → Hoxta</li>
            </ol>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button onClick={downloadPhpModule} className="rounded-xl text-xs gradient-btn text-primary-foreground border-0">
            <Download className="h-3 w-3 mr-1" /> Descarcă hoxta.php
          </Button>
          <Button variant="outline" onClick={() => copy(generatePhpModule())} className="rounded-xl text-xs">
            <Copy className="h-3 w-3 mr-1" /> Copiază cod PHP
          </Button>
          <Button
            variant="ghost" size="sm"
            onClick={() => setShowPhpPreview(!showPhpPreview)}
            className="text-xs text-muted-foreground"
          >
            {showPhpPreview ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
            {showPhpPreview ? "Ascunde" : "Previzualizare"} cod
          </Button>
        </div>

        {showPhpPreview && (
          <div className="mt-3 bg-muted/30 rounded-xl p-3 border border-border/50 max-h-96 overflow-auto relative">
            <Button
              variant="ghost" size="icon"
              className="absolute top-2 right-2 h-7 w-7 rounded-lg"
              onClick={() => copy(generatePhpModule())}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
            <pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap pr-8">
              {generatePhpModule()}
            </pre>
          </div>
        )}
      </div>

      {/* API Reference */}
      <div className="glass rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Globe className="h-4 w-4 text-primary" />
          API Reference
        </h3>
        <div className="bg-muted/30 rounded-xl p-3 border border-border/50">
          <pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap">{`POST ${hoxtaUrl || "https://YOUR_URL"}/functions/v1/whmcs-provision
Header: x-whmcs-key: ${whmcsApiSecret || "YOUR_SECRET"}
Content-Type: application/json

── Acțiuni disponibile ──

▸ create_account
  { "action": "create_account", "email": "client@email.com", 
    "password": "pass123", "display_name": "Ion Popescu",
    "ip_address": "185.1.2.3", "ip_label": "VPS #123", "max_rules": 20 }

▸ suspend_account
  { "action": "suspend_account", "email": "client@email.com" }

▸ unsuspend_account
  { "action": "unsuspend_account", "email": "client@email.com" }

▸ terminate_account
  { "action": "terminate_account", "email": "client@email.com" }

▸ get_status
  { "action": "get_status", "email": "client@email.com" }

▸ add_ip
  { "action": "add_ip", "email": "client@email.com",
    "ip_address": "185.1.2.4", "ip_label": "Extra IP" }

▸ remove_ip
  { "action": "remove_ip", "email": "client@email.com",
    "ip_address": "185.1.2.4" }`}</pre>
        </div>
      </div>
    </div>
  );
};
