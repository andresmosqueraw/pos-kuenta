export type PrintItem = {
  id: number;
  name: string;
  price: number;
  quantity: number;
};

export type PrintData = {
  restaurante: {
    nombre: string;
    nit?: number | null;
    direccion?: string | null;
    telefono?: string | null;
  } | null;
  cart: PrintItem[];
  total: number;
  receiptNumber: string;
  date: string;
  mesaNumero?: string | null;
};

const ESC = 0x1B;
const GS = 0x1D;

const INIT = [ESC, 0x40];
const ALIGN_CENTER = [ESC, 0x61, 0x01];
const ALIGN_LEFT = [ESC, 0x61, 0x00];
const BOLD_ON = [ESC, 0x45, 0x01];
const BOLD_OFF = [ESC, 0x45, 0x00];
const SIZE_DOUBLE = [GS, 0x21, 0x11];
const SIZE_NORMAL = [GS, 0x21, 0x00];
const FEED_CUT = [GS, 0x56, 0x41, 0x03];

const LINE = '--------------------------------\n';

function textBytes(s: string): number[] {
  return Array.from(s, ch => ch.charCodeAt(0) & 0xFF);
}

function padLine(left: string, right: string, width = 32): string {
  const spaces = width - left.length - right.length;
  return `${left + ' '.repeat(Math.max(1, spaces)) + right}\n`;
}

function formatCOP(amount: number): string {
  return `$${amount.toLocaleString('es-CO')}`;
}

export function buildReceipt(data: PrintData): Uint8Array {
  const { restaurante, cart, total, receiptNumber, date, mesaNumero } = data;
  const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);

  const bytes: number[] = [
    ...INIT,
    ...ALIGN_CENTER,
    ...SIZE_DOUBLE,
    ...BOLD_ON,
    ...textBytes(`${restaurante?.nombre ?? 'MI RESTAURANTE'}\n`),
    ...BOLD_OFF,
    ...SIZE_NORMAL,
  ];

  if (restaurante?.nit) {
    bytes.push(...textBytes(`NIT: ${restaurante.nit.toLocaleString('es-CO')}\n`));
  }
  if (restaurante?.direccion) {
    bytes.push(...textBytes(`${restaurante.direccion}\n`));
  }
  if (restaurante?.telefono) {
    bytes.push(...textBytes(`Tel: ${restaurante.telefono}\n`));
  }

  bytes.push(
    ...textBytes('\n'),
    ...BOLD_ON,
    ...textBytes('FACTURA DE VENTA\n'),
    ...BOLD_OFF,
    ...textBytes(`Recibo #${receiptNumber}\n`),
    ...textBytes(LINE),
    ...ALIGN_LEFT,
    ...textBytes(padLine('Fecha:', date)),
  );

  if (mesaNumero) {
    bytes.push(...textBytes(padLine('Mesa:', mesaNumero)));
  }

  bytes.push(
    ...textBytes(padLine('Cliente:', 'Consumidor Final')),
    ...textBytes(LINE),
  );

  for (const item of cart) {
    bytes.push(
      ...textBytes(padLine(`${item.quantity} x ${item.name}`, formatCOP(item.price * item.quantity))),
      ...textBytes(`   ${formatCOP(item.price)} c/u\n`),
    );
  }

  bytes.push(
    ...textBytes(LINE),
    ...textBytes(padLine(`${totalItems} ${totalItems === 1 ? 'articulo' : 'articulos'}`, '')),
    ...textBytes(padLine('Subtotal:', formatCOP(total))),
    ...BOLD_ON,
    ...textBytes(padLine('TOTAL:', formatCOP(total))),
    ...BOLD_OFF,
    ...textBytes(LINE),
    ...ALIGN_CENTER,
    ...textBytes('Forma de pago: Efectivo\n'),
    ...textBytes('Gracias por su compra!\n'),
    ...textBytes('\n\n\n'),
    ...FEED_CUT,
  );

  return new Uint8Array(bytes);
}

export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary);
}
