#!/usr/bin/env bash
# Instalador de impresora térmica ESC/POS para Linux.
# Ejecutar UNA VEZ por computador:
#   curl -sSL https://TU_DOMINIO/downloads/instalar-impresora.sh | bash

set -e

echo "=== Instalador de impresora térmica ==="
echo ""

# ── Detectar gestor de paquetes ───────────────────────────────────────────────
if command -v apt-get &>/dev/null; then
  PKG_INSTALL="sudo apt-get install -y"
  PKG_UPDATE="sudo apt-get update -qq"
elif command -v pacman &>/dev/null; then
  PKG_INSTALL="sudo pacman -S --noconfirm"
  PKG_UPDATE=""
elif command -v dnf &>/dev/null; then
  PKG_INSTALL="sudo dnf install -y"
  PKG_UPDATE=""
elif command -v yum &>/dev/null; then
  PKG_INSTALL="sudo yum install -y"
  PKG_UPDATE=""
else
  echo "✗ Gestor de paquetes no reconocido. Instala CUPS manualmente y vuelve a ejecutar."
  exit 1
fi

# ── 1. Instalar CUPS ──────────────────────────────────────────────────────────
if ! command -v lpstat &>/dev/null; then
  echo "→ Instalando CUPS..."
  [ -n "$PKG_UPDATE" ] && $PKG_UPDATE &>/dev/null
  $PKG_INSTALL cups &>/dev/null
  echo "  CUPS instalado"
else
  echo "→ CUPS ya instalado"
fi

sudo systemctl enable --now cups &>/dev/null
echo "→ CUPS activo"

# ── 2. Detectar impresora USB automáticamente ─────────────────────────────────
echo "→ Buscando impresora térmica USB..."
sleep 2  # dar tiempo a CUPS de iniciar

PRINTER_URI=$(lpinfo -v 2>/dev/null | grep -i "usb://" | head -1 | awk '{print $2}')

if [ -z "$PRINTER_URI" ]; then
  echo "  ✗ No se encontró ninguna impresora USB."
  echo "    Asegúrate de que la impresora esté conectada y encendida, luego vuelve a ejecutar."
  exit 1
fi

echo "  Encontrada: $PRINTER_URI"

# ── 3. Registrar en CUPS como impresora raw (ESC/POS directo) ────────────────
PRINTER_NAME="ThermalPrinter"

if lpstat -a 2>/dev/null | grep -q "^${PRINTER_NAME}"; then
  echo "→ Impresora ya registrada en CUPS"
else
  echo "→ Registrando impresora en CUPS..."
  sudo lpadmin -p "$PRINTER_NAME" -E -v "$PRINTER_URI" -m raw 2>/dev/null || true
  echo "  Registrada como '${PRINTER_NAME}'"
fi

# ── 4. Instalar QZ Tray ───────────────────────────────────────────────────────
if [ -f /opt/qz-tray/qz-tray ]; then
  echo "→ QZ Tray ya instalado"
else
  echo "→ Descargando QZ Tray..."

  QZ_VERSION=$(curl -sSL "https://api.github.com/repos/qzind/tray/releases/latest" \
    | grep '"tag_name"' | head -1 | cut -d'"' -f4)

  if command -v dpkg &>/dev/null; then
    QZ_PKG="qz-tray_${QZ_VERSION}_amd64.deb"
    QZ_URL="https://github.com/qzind/tray/releases/download/${QZ_VERSION}/${QZ_PKG}"
    curl -sSL "$QZ_URL" -o "/tmp/${QZ_PKG}"
    sudo dpkg -i "/tmp/${QZ_PKG}" &>/dev/null
    rm "/tmp/${QZ_PKG}"
  elif command -v rpm &>/dev/null; then
    QZ_PKG="qz-tray-${QZ_VERSION}.x86_64.rpm"
    QZ_URL="https://github.com/qzind/tray/releases/download/${QZ_VERSION}/${QZ_PKG}"
    curl -sSL "$QZ_URL" -o "/tmp/${QZ_PKG}"
    sudo rpm -i "/tmp/${QZ_PKG}" &>/dev/null
    rm "/tmp/${QZ_PKG}"
  else
    QZ_PKG="qz-tray_${QZ_VERSION}.run"
    QZ_URL="https://github.com/qzind/tray/releases/download/${QZ_VERSION}/${QZ_PKG}"
    curl -sSL "$QZ_URL" -o "/tmp/${QZ_PKG}"
    chmod +x "/tmp/${QZ_PKG}"
    sudo "/tmp/${QZ_PKG}" --quiet
    rm "/tmp/${QZ_PKG}"
  fi

  echo "  QZ Tray instalado"
fi

# ── 5. Configurar QZ Tray para iniciar con el sistema ─────────────────────────
AUTOSTART_DIR="$HOME/.config/autostart"
mkdir -p "$AUTOSTART_DIR"
cat > "${AUTOSTART_DIR}/qz-tray.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=QZ Tray
Exec=/opt/qz-tray/qz-tray
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
DESKTOP

echo "→ QZ Tray configurado para iniciar automáticamente"

# ── 6. Iniciar QZ Tray ahora ─────────────────────────────────────────────────
if ! pgrep -f "qz-tray.jar" &>/dev/null; then
  /opt/qz-tray/qz-tray &>/dev/null &
  echo "→ QZ Tray iniciado"
fi

echo ""
echo "✓ Instalación completa."
echo "  La impresora '${PRINTER_NAME}' quedó configurada."
echo "  QZ Tray arranca automáticamente con el computador."
echo "  Recarga la página del POS y prueba el botón Imprimir Recibo."
