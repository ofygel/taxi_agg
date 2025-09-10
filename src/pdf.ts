import PDFDocument from 'pdfkit';
import type PDFKit from 'pdfkit';
import { fmtPhone } from './utils';
import { getStorageBuffer } from './modules/storage';
import { PDF_LOGO_PATH, PDF_STAMP_PATH } from './config';

export function makeReceiptText(o: any, driver: any, client: any) {
  const lines: string[] = [];
  lines.push('🧾 Квитанция');
  lines.push(`ID: ${o.id}`);
  if (o.from_text) lines.push(`Откуда: ${o.from_text}`);
  if (o.to_text) lines.push(`Куда: ${o.to_text}`);
  if (o.distance_km) lines.push(`Дистанция: ~${Number(o.distance_km).toFixed(1)} км`);
  if (o.accepted_at) lines.push(`Принят: ${new Date(o.accepted_at).toLocaleString()}`);
  if (o.arrived_at) lines.push(`Прибыл к А: ${new Date(o.arrived_at).toLocaleString()}`);
  if (o.picked_up_at) lines.push(`Пассажир в машине: ${new Date(o.picked_up_at).toLocaleString()}`);
  if (o.tracking_started_at) lines.push(`Старт поездки: ${new Date(o.tracking_started_at).toLocaleString()}`);
  if (o.completed_at) lines.push(`Завершено: ${new Date(o.completed_at).toLocaleString()}`);
  lines.push(`Итог: ${o.fare_final_tg || o.fare_fixed_tg || '-'} тг`);
  if (driver) lines.push(`Исполнитель: ${driver.first_name || driver.telegram_id} ${driver.phone ? '(' + fmtPhone(driver.phone) + ')' : ''}`);
  if (client) lines.push(`Клиент: ${client.first_name || client.telegram_id}`);
  return lines.join('\n');
}

export async function makeReceiptPDF(o: any, driver: any, client: any) {
  try {
    const logoBuf = await getStorageBuffer(PDF_LOGO_PATH);
    const stampBuf = await getStorageBuffer(PDF_STAMP_PATH);
    return await new Promise<Buffer>((resolve) => {
      const doc: PDFKit.PDFDocument = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];
      (doc as any).on('data', (c: Buffer) => chunks.push(c));
      (doc as any).on('end', () => resolve(Buffer.concat(chunks)));
      if (logoBuf) { try { (doc as any).image(logoBuf, 50, 40, { fit: [120, 60] }); } catch { } }
      (doc as any).fontSize(20).text('Квитанция по поездке/доставке', 0, 120, { align: 'center' });
      (doc as any).moveDown();
      (doc as any).fontSize(12);
      (doc as any).text(`ID заказа: ${o.id}`);
      if (o.distance_km) (doc as any).text(`Дистанция: ~${Number(o.distance_km).toFixed(1)} км`);
      (doc as any).moveDown(0.5);
      if (o.from_text) (doc as any).text(`Откуда: ${o.from_text}`);
      if (o.to_text) (doc as any).text(`Куда: ${o.to_text}`);
      (doc as any).moveDown(0.5);
      if (o.accepted_at) (doc as any).text(`Принят: ${new Date(o.accepted_at).toLocaleString()}`);
      if (o.arrived_at)  (doc as any).text(`Прибыл к А: ${new Date(o.arrived_at).toLocaleString()}`);
      if (o.picked_up_at)(doc as any).text(`Пассажир в машине: ${new Date(o.picked_up_at).toLocaleString()}`);
      if (o.tracking_started_at) (doc as any).text(`Старт поездки: ${new Date(o.tracking_started_at).toLocaleString()}`);
      if (o.completed_at) (doc as any).text(`Завершено: ${new Date(o.completed_at).toLocaleString()}`);
      (doc as any).moveDown(0.5);
      (doc as any).text(`Итоговая стоимость: ${o.fare_final_tg || o.fare_fixed_tg || '-'} тг`);
      (doc as any).moveDown();
      if (driver) (doc as any).text(`Исполнитель: ${driver.first_name || driver.telegram_id} ${driver.phone ? '(' + fmtPhone(driver.phone) + ')' : ''}`);
      if (client) (doc as any).text(`Клиент: ${client.first_name || client.telegram_id}`);
      if (stampBuf) { try { (doc as any).image(stampBuf, 400, 680, { fit: [150, 150], align: 'right' }); } catch { } }
      (doc as any).end();
    });
  } catch { return null; }
}
