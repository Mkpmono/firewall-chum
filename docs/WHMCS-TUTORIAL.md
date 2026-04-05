# 🛡️ Hoxta Firewall — Tutorial Complet WHMCS

## Cuprins
1. [Pregătire](#1-pregătire)
2. [Instalare modul WHMCS](#2-instalare-modul-whmcs)
3. [Configurare modul](#3-configurare-modul)
4. [Testare conexiune](#4-testare-conexiune)
5. [Automatizare provisioning](#5-automatizare-provisioning)
6. [Client Area integration](#6-client-area-integration)
7. [Troubleshooting](#7-troubleshooting)

---

## 1. Pregătire

### Ce ai nevoie:
- WHMCS instalat și funcțional
- Acces admin la panoul Hoxta
- API URL-ul Hoxta (ex: `https://api.hoxta.com/functions/v1/whmcs-provision`)
- WHMCS API Secret (se generează din panoul Hoxta)

### Generare API Secret:
1. Intră în **Hoxta Admin Panel** → **WHMCS Module**
2. Click **Generează Secret** sau introdu unul manual (minim 32 caractere)
3. Copiază și secret-ul și URL-ul API — le vei folosi în WHMCS

---

## 2. Instalare modul WHMCS

### Pas 1: Descarcă modulul PHP

Din panoul Hoxta → WHMCS Module → click **📥 Descarcă modul PHP**.

Sau copiază codul PHP generat din secțiunea "Preview cod PHP".

### Pas 2: Upload pe server WHMCS

```bash
# Conectare SSH pe serverul WHMCS
ssh root@whmcs.exemplu.com

# Creează directorul modulului
mkdir -p /home/whmcs/public_html/modules/addons/hoxta/

# Copiază fișierul (sau folosește SCP/SFTP)
nano /home/whmcs/public_html/modules/addons/hoxta/hoxta.php
# Lipește codul PHP generat
```

**Structura trebuie să fie exact:**
```
modules/
└── addons/
    └── hoxta/
        └── hoxta.php     ← fișierul principal
```

### Pas 3: Setează permisiuni

```bash
chown -R whmcs:whmcs /home/whmcs/public_html/modules/addons/hoxta/
chmod 644 /home/whmcs/public_html/modules/addons/hoxta/hoxta.php
```

---

## 3. Configurare modul

### Pas 1: Activare în WHMCS

1. Login WHMCS Admin
2. **Setup** → **Addon Modules**
3. Găsește **"Hoxta Firewall Manager"** → Click **Activate**
4. Click **Configure**

### Pas 2: Completare setări

| Câmp | Valoare | Exemplu |
|------|---------|---------|
| **Hoxta API URL** | URL-ul API generat | `https://api.hoxta.com/functions/v1/whmcs-provision` |
| **API Secret** | Secret-ul generat | `aBcDeFgH123456...` |
| **Panel URL** | URL-ul panoului Hoxta | `https://firewall.hoxta.com` |
| **Max Reguli Default** | Nr. maxim reguli per client | `20` |
| **Auto Provision** | Da / Nu | `Da` (recomandat) |

### Pas 3: Setează access control

La **"Access Control"** → bifează rolurile admin care au acces la modul.

### Pas 4: Salvează

Click **Save Changes**.

---

## 4. Testare conexiune

1. Din WHMCS Admin → **Addons** → **Hoxta Firewall Manager**
2. Click tab-ul **🔧 Test Conexiune**
3. Dacă vezi ✅ — conexiunea funcționează
4. Dacă vezi ❌ — verifică:
   - API URL-ul este corect
   - API Secret se potrivește cu cel din Hoxta
   - Serverul WHMCS poate face request-uri HTTP externe (nu e blocat de firewall)

---

## 5. Automatizare provisioning

### Cum funcționează auto-provisioning:

Când un client WHMCS **activează un serviciu** (VPS, hosting, etc.):

1. WHMCS trimite hook-ul de activare
2. Modulul Hoxta creează automat un cont cu email-ul clientului
3. IP-ul dedicat din serviciul WHMCS se adaugă automat la contul Hoxta
4. Clientul primește acces la panoul firewall

### Acțiuni suportate:

| Acțiune WHMCS | Ce face în Hoxta |
|---------------|------------------|
| **Activate** | Creează cont + adaugă IP |
| **Suspend** | Dezactivează contul (regulile rămân dar nu se aplică) |
| **Unsuspend** | Reactivează contul |
| **Terminate** | Șterge contul + toate regulile |

### Provisionare manuală:

1. WHMCS Admin → Addons → Hoxta
2. Tab **➕ Provisionare**
3. Completează: email, parolă, IP, max reguli
4. Click **Creează cont**

---

## 6. Client Area integration

Clientul vede un link către panoul Hoxta în WHMCS Client Area:
- **My Services** → Click pe serviciu → **Manage Firewall**

Linkul duce la `https://firewall.hoxta.com` unde clientul se autentifică cu contul creat automat.

---

## 7. Troubleshooting

### Eroare: "cURL Error: Connection refused"
```bash
# Pe serverul WHMCS, verifică dacă poate accesa API-ul
curl -v https://api.hoxta.com/functions/v1/whmcs-provision
```

### Eroare: "Invalid API Secret"
- Verifică că secret-ul din WHMCS se potrivește cu cel salvat în Hoxta
- Regenerează secret-ul din ambele părți

### Eroare: "User already exists"
- Clientul are deja cont Hoxta cu acel email
- Modulul va face linkul automat la contul existent

### Provisionarea nu funcționează automat
```bash
# Verifică logurile WHMCS
tail -f /home/whmcs/public_html/storage/logs/activity.log

# Verifică logurile modulului din WHMCS Admin
# Addons → Hoxta → Tab "📜 Loguri"
```

### Resetare completă modul
```bash
# Dezactivează din WHMCS Admin → Setup → Addon Modules → Hoxta → Deactivate
# Apoi reactivează și reconfigurează
```

---

## Diagrama fluxului

```
Client cumpără VPS (WHMCS)
         │
         ▼
   ┌─────────────┐
   │  WHMCS Hook  │  (auto-provision activat)
   │  "Activate"   │
   └──────┬──────┘
          │
          ▼
   ┌─────────────────────┐
   │  hoxta_api_call()    │  POST → /whmcs-provision
   │  action: create      │
   └──────┬──────────────┘
          │
          ▼
   ┌─────────────────────┐
   │  Hoxta Backend       │
   │  - Creează user      │
   │  - Adaugă IP         │
   │  - Setează max_rules │
   └──────┬──────────────┘
          │
          ▼
   ┌─────────────────────┐
   │  Agent pe VPS        │  (instalat automat via Virtualizor hook)
   │  - Sync reguli       │
   │  - Aplică iptables   │
   └─────────────────────┘
```
