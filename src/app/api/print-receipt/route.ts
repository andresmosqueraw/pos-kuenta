import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import net from 'node:net';
import { NextResponse } from 'next/server';

type CartItem = {
  id: number;
  name: string;
  price: number;
  quantity: number;
};

type PrintRequest = {
  restaurante: {
    nombre: string;
    nit?: number | null;
    direccion?: string | null;
    telefono?: string | null;
  } | null;
  cart: CartItem[];
  total: number;
  receiptNumber: string;
  date: string;
  mesaNumero?: string | null;
};

const ESC = 0x1B;
const GS = 0x1D;

function cmd(...bytes: number[]): Buffer {
  return Buffer.from(bytes);
}

const INIT = cmd(ESC, 0x40);
const ALIGN_CENTER = cmd(ESC, 0x61, 0x01);
const ALIGN_LEFT = cmd(ESC, 0x61, 0x00);
const BOLD_ON = cmd(ESC, 0x45, 0x01);
const BOLD_OFF = cmd(ESC, 0x45, 0x00);
const SIZE_DOUBLE = cmd(GS, 0x21, 0x11);
const SIZE_NORMAL = cmd(GS, 0x21, 0x00);
const FEED_CUT = cmd(GS, 0x56, 0x41, 0x03);

const LINE = '--------------------------------\n';

function text(s: string): Buffer {
  return Buffer.from(s, 'latin1');
}

function padLine(left: string, right: string, width = 32): string {
  const spaces = width - left.length - right.length;
  return `${left + ' '.repeat(Math.max(1, spaces)) + right}\n`;
}

function formatCOP(amount: number): string {
  return `$${amount.toLocaleString('es-CO')}`;
}

function buildReceipt(body: PrintRequest): Buffer {
  const { restaurante, cart, total, receiptNumber, date, mesaNumero } = body;
  const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);

  const chunks: Buffer[] = [
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

  chunks.push(
    text(padLine('Cliente:', 'Consumidor Final')),
    text(LINE),
  );

  for (const item of cart) {
    const itemLine = `${item.quantity} x ${item.name}`;
    const itemPrice = formatCOP(item.price * item.quantity);
    chunks.push(text(padLine(itemLine, itemPrice)));
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

function printViaTCP(data: Buffer, ip: string, port: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: ip, port, timeout: 5000 }, () => {
      socket.write(data, (err) => {
        if (err) {
          socket.destroy();
          reject(err);
        } else {
          socket.end();
          resolve();
        }
      });
    });
    socket.on('error', reject);
    socket.on('timeout', () => {
      socket.destroy();
      reject(new Error(`Timeout al conectar con la impresora en ${ip}:${port}`));
    });
  });
}

function printViaUSB(data: Buffer, device = '/dev/usb/lp0'): void {
  fs.writeFileSync(device, data);
}

export async function POST(request: Request) {
  const body: PrintRequest = await request.json();
  const data = buildReceipt(body);

  const printerIp = process.env.PRINTER_IP;
  const printerPort = Number(process.env.PRINTER_PORT ?? 9100);
  const printerDevice = process.env.PRINTER_DEVICE ?? '/dev/usb/lp0';

  try {
    if (printerIp) {
      await printViaTCP(data, printerIp, printerPort);
    } else {
      printViaUSB(data, printerDevice);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
