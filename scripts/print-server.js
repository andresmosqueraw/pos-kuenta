#!/usr/bin/env node
/**
 * Servidor de impresión local para impresora térmica ESC/POS.
 * Ejecutar en la máquina donde está conectada la impresora:
 *   node scripts/print-server.js
 *
 * Variables de entorno opcionales:
 *   PRINT_PORT=6543       Puerto a escuchar (default: 6543)
 *   PRINTER_DEVICE=/dev/usb/lp0   Dispositivo USB (default: /dev/usb/lp0)
 */

const { Buffer } = require('node:buffer');
const fs = require('node:fs');
const http = require('node:http');

const PORT = Number(process.env.PRINT_PORT ?? 6543);
const DEVICE = process.env.PRINTER_DEVICE ?? '/dev/usb/lp0';

// ── ESC/POS helpers ──────────────────────────────────────────────────────────

const ESC = 0x1B;
const GS = 0x1D;

const INIT = Buffer.from([ESC, 0x40]);
const ALIGN_CENTER = Buffer.from([ESC, 0x61, 0x01]);
const ALIGN_LEFT = Buffer.from([ESC, 0x61, 0x00]);
const BOLD_ON = Buffer.from([ESC, 0x45, 0x01]);
const BOLD_OFF = Buffer.from([ESC, 0x45, 0x00]);
const SIZE_DOUBLE = Buffer.from([GS, 0x21, 0x11]);
const SIZE_NORMAL = Buffer.from([GS, 0x21, 0x00]);
const FEED_CUT = Buffer.from([GS, 0x56, 0x41, 0x03]);

const LINE = '--------------------------------\n';

function text(s) {
  return Buffer.from(s, 'latin1');
}

function padLine(left, right, width = 32) {
  const spaces = width - left.length - right.length;
  return `${left + ' '.repeat(Math.max(1, spaces)) + right}\n`;
}

function formatCOP(amount) {
  return `$${amount.toLocaleString('es-CO')}`;
}

function buildReceipt({ restaurante, cart, total, receiptNumber, date, mesaNumero }) {
  const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);

  const chunks = [
    INIT,
    ALIGN_CENTER,
    SIZE_DOUBLE,
    BOLD_ON,
    text(`${restaurante?.nombre ?? 'MI RESTAURANTE'}\n`),
    BOLD_OFF,
    SIZE_NORMAL,
  ];

  if (restaurante?.nit) {
    chunks.push(text(`NIT: ${restaurante.nit.toLocaleString('es-CO')}\n`));
  }
  if (restaurante?.direccion) {
    chunks.push(text(`${restaurante.direccion}\n`));
  }
  if (restaurante?.telefono) {
    chunks.push(text(`Tel: ${restaurante.telefono}\n`));
  }

  chunks.push(
    text('\n'),
    BOLD_ON,
    text('FACTURA DE VENTA\n'),
    BOLD_OFF,
    text(`Recibo #${receiptNumber}\n`),
    text(LINE),
    ALIGN_LEFT,
    text(padLine('Fecha:', date)),
  );

  if (mesaNumero) {
    chunks.push(text(padLine('Mesa:', mesaNumero)));
  }

  chunks.push(text(padLine('Cliente:', 'Consumidor Final')), text(LINE));

  for (const item of cart) {
    chunks.push(text(padLine(`${item.quantity} x ${item.name}`, formatCOP(item.price * item.quantity))));
    chunks.push(text(`   ${formatCOP(item.price)} c/u\n`));
  }

  chunks.push(
    text(LINE),
    text(padLine(`${totalItems} ${totalItems === 1 ? 'articulo' : 'articulos'}`, '')),
    text(padLine('Subtotal:', formatCOP(total))),
    BOLD_ON,
    text(padLine('TOTAL:', formatCOP(total))),
    BOLD_OFF,
    text(LINE),
    ALIGN_CENTER,
    text('Forma de pago: Efectivo\n'),
    text('Gracias por su compra!\n'),
    text('\n\n\n'),
    FEED_CUT,
  );

  return Buffer.concat(chunks);
}

// ── HTTP server ───────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const server = http.createServer((req, res) => {
  Object.entries(CORS_HEADERS).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/print') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const receipt = buildReceipt(data);
        fs.writeFileSync(DEVICE, receipt);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Servidor de impresión escuchando en http://localhost:${PORT}/print`);
  console.log(`Dispositivo: ${DEVICE}`);
});
