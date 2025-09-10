import PDFDocument from 'pdfkit';
import { getStorageBuffer } from './storage';
import { PDF_LOGO_PATH, PDF_STAMP_PATH } from '../config';
import { fmtPhone } from '../utils';

/** Сформировать текст квитанции */
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

  if (driver)
    lines.push(`Исполнитель: ${driver.first_name || driver.telegram_id} ${
      driver.phone ? '(' + fmtPhone(driver.phone) + ')' : ''
    }`);
  if (client) lines.push(`Клиент: ${client.first_name || client.telegram_id}`);

  return lines.join('\n');
}

/** Сформировать PDF квитанцию */
export async function makeReceiptPDF(o: any, driver: any, client: any) {
  try {
    const logoBuf = await getStorageBuffer(PDF_LOGO_PATH);
    const stampBuf = await getStorageBuffer(PDF_STAMP_PATH);

    return await new Promise<Buffer>((resolve) => {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      if (logoBuf) {
        try {
          doc.image(logoBuf, 50, 40, { fit: [120, 60] });
        } catch {}
      }

      doc.fontSize(20).text('Квитанция по поездке/доставке', 0, 120, { align: 'center' });
      doc.moveDown();
      doc.fontSize(12);

      doc.text(`ID заказа: ${o.id}`);
      if (o.distance_km) doc.text(`Дистанция: ~${Number(o.distance_km).toFixed(1)} км`);

      doc.moveDown(0.5);
      if (o.from_text) doc.text(`Откуда: ${o.from_text}`);
      if (o.to_text) doc.text(`Куда: ${o.to_text}`);

      doc.moveDown(0.5);
      if (o.accepted_at) doc.text(`Принят: ${new Date(o.accepted_at).toLocaleString()}`);
      if (o.arrived_at) doc.text(`Прибыл к А: ${new Date(o.arrived_at).toLocaleString()}`);
      if (o.picked_up_at) doc.text(`Пассажир в машине: ${new Date(o.picked_up_at).toLocaleString()}`);
      if (o.tracking_started_at) doc.text(`Старт поездки: ${new Date(o.tracking_started_at).toLocaleString()}`);
      if (o.completed_at) doc.text(`Завершено: ${new Date(o.completed_at).toLocaleString()}`);

      doc.moveDown(0.5);
      doc.text(`Итоговая стоимость: ${o.fare_final_tg || o.fare_fixed_tg || '-'} тг`);

      doc.moveDown();
      if (driver)
        doc.text(
          `Исполнитель: ${driver.first_name || driver.telegram_id} ${
            driver.phone ? '(' + fmtPhone(driver.phone) + ')' : ''
          }`
        );
      if (client) doc.text(`Клиент: ${client.first_name || client.telegram_id}`);

      if (stampBuf) {
        try {
          doc.image(stampBuf, 400, 680, { fit: [150, 150], align: 'right' });
        } catch {}
      }

      doc.end();
    });
  } catch {
    return null;
  }
}
