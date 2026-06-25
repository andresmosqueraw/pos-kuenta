#!/usr/bin/env bash
# Instalador del servidor de impresión térmica.
# Ejecutar UNA VEZ por computador:
#   curl -sSL https://TU_DOMINIO/downloads/instalar-impresora.sh | bash

set -e

APP_URL="${PRINT_APP_URL:-https://TU_DOMINIO}"
INSTALL_DIR="$HOME/.local/share/print-server"
SERVICE_NAME="print-server"
SERVICE_FILE="$HOME/.config/systemd/user/${SERVICE_NAME}.service"

echo "=== Instalador de impresora térmica ==="

# ── 1. Verificar Node.js ─────────────────────────────────────────────────────
if ! command -v node &>/dev/null; then
  echo "→ Instalando Node.js..."
  curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash - &>/dev/null
  sudo apt-get install -y nodejs &>/dev/null
  echo "  Node.js instalado: $(node -v)"
else
  echo "→ Node.js ya instalado: $(node -v)"
fi

# ── 2. Descargar el servidor ─────────────────────────────────────────────────
echo "→ Descargando servidor de impresión..."
mkdir -p "$INSTALL_DIR"
curl -sSL "${APP_URL}/downloads/print-server.js" -o "${INSTALL_DIR}/print-server.js"
echo "  Guardado en ${INSTALL_DIR}/print-server.js"

# ── 3. Permiso de escritura a la impresora ───────────────────────────────────
echo "→ Configurando permisos de impresora USB..."
UDEV_RULE='SUBSYSTEM=="usbmisc", KERNEL=="lp[0-9]*", ATTRS{idVendor}=="1fc9", ATTRS{idProduct}=="2016", MODE="0666"'
echo "$UDEV_RULE" | sudo tee /etc/udev/rules.d/99-thermal-printer.rules &>/dev/null
sudo udevadm control --reload-rules
sudo udevadm trigger --subsystem-match=usbmisc
echo "  Regla udev instalada"

# ── 4. Servicio systemd de usuario (sin necesitar sudo para el servicio) ──────
echo "→ Configurando inicio automático..."
mkdir -p "$(dirname "$SERVICE_FILE")"
cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=Servidor de impresión térmica
After=network.target

[Service]
ExecStart=$(command -v node) ${INSTALL_DIR}/print-server.js
Restart=always
RestartSec=3

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now "$SERVICE_NAME"

# Habilitar lingering para que el servicio arranque sin login
sudo loginctl enable-linger "$USER" 2>/dev/null || true

echo ""
echo "✓ Instalación completa."
echo "  El servidor de impresión arranca automáticamente con el computador."
echo "  Para verificar: systemctl --user status print-server"
