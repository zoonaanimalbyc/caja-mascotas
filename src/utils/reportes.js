import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const fmt = n => '$' + Number(n || 0).toLocaleString('es-CO');
const logo = '/caja-mascotas/logo.png';

/* ============================================================
   PDF — Reporte diario
   ============================================================ */
export async function exportarPDFDia({ sede, fecha, arqueos, movimientos, cierre, usuario }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const verde = [31, 74, 44];
  const verdeClaro = [229, 240, 224];

  // ---------- ENCABEZADO ----------
  await addLogo(doc, 14, 12, 20, 20);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...verde);
  doc.text('Arqueos Zoona Animal', 40, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 110);
  doc.text('Control de caja y turnos', 40, 25);

  // Línea separadora
  doc.setDrawColor(...verde);
  doc.setLineWidth(0.5);
  doc.line(14, 34, pageWidth - 14, 34);

  // ---------- INFO DEL REPORTE ----------
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold');
  doc.text('REPORTE DEL DÍA', pageWidth / 2, 42, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Fecha: ${fecha}`, 14, 50);
  doc.text(`Sede: ${sede}`, 14, 55);
  doc.text(`Generado: ${new Date().toLocaleString('es-CO')}`, pageWidth - 14, 50, { align: 'right' });
  doc.text(`Responsable: ${usuario || '—'}`, pageWidth - 14, 55, { align: 'right' });

  let y = 65;

  // ---------- ARQUEOS ----------
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...verde);
  doc.text('1. ARQUEOS DEL DÍA', 14, y);
  y += 3;

  if (arqueos && arqueos.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Hora', 'Tipo', 'Responsable', 'Total']],
      body: arqueos.map(a => [
        String(a.hora || '').replace("'", '').slice(0, 5),
        tipoArqueo(a.tipo),
        a.usuario_email || '—',
        fmt(a.total),
      ]),
      theme: 'striped',
      headStyles: { fillColor: verde, textColor: 255, fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 9 },
      alternateRowStyles: { fillColor: [250, 247, 240] },
      columnStyles: { 3: { halign: 'right' } },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 10;
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 140);
    doc.text('Sin arqueos registrados.', 14, y + 5);
    doc.setFont('helvetica', 'normal');
    y += 12;
  }

  // ---------- MOVIMIENTOS ----------
  if (y > pageHeight - 80) { doc.addPage(); y = 20; }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(...verde);
  doc.text('2. MOVIMIENTOS', 14, y);
  y += 3;

  if (movimientos && movimientos.length > 0) {
    autoTable(doc, {
      startY: y,
      head: [['Hora', 'Tipo', 'Descripción', 'Responsable', 'Valor']],
       body: movimientos.map(m => {
        const desc = (m.descripcion && String(m.descripcion).trim())
          ? String(m.descripcion).trim()
          : 'Sin descripción';
        return [
          String(m.hora || '').replace("'", '').slice(0, 5),
          m.tipo || '—',
          desc,
          m.responsable || '—',
          fmt(m.valor),
        ];
      }),
      theme: 'striped',
      headStyles: { fillColor: verde, textColor: 255, fontSize: 9, fontStyle: 'bold' },
      bodyStyles: { fontSize: 9 },
      alternateRowStyles: { fillColor: [250, 247, 240] },
      columnStyles: { 4: { halign: 'right' } },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 10;
  } else {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 140);
    doc.text('Sin movimientos registrados.', 14, y + 5);
    doc.setFont('helvetica', 'normal');
    y += 12;
  }

  // ---------- CIERRE ----------
  if (cierre) {
    if (y > pageHeight - 90) { doc.addPage(); y = 20; }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...verde);
    doc.text('3. CIERRE DEL DÍA', 14, y);
    y += 6;

    // Tabla de totales
    const filas = [
      ['Saldo inicial', fmt(cierre.saldo_inicial)],
      ['Ventas SIIGO', fmt(cierre.ventas_siigo)],
      ['Ingresos', '+' + fmt(cierre.total_ingresos)],
      ['Egresos', '-' + fmt(cierre.total_egresos)],
      ['Fletes', '-' + fmt(cierre.total_fletes)],
      ['SPA', '-' + fmt(cierre.total_spa)],
      ['Esperado', fmt(cierre.esperado)],
      ['Contado', fmt(cierre.contado)],
      ['DIFERENCIA', fmt(cierre.diferencia)],
    ];

    autoTable(doc, {
      startY: y,
      body: filas,
      theme: 'plain',
      styles: { fontSize: 10, cellPadding: 2 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 70, textColor: [50, 50, 40] },
        1: { halign: 'right', fontStyle: 'bold', textColor: [31, 74, 44] },
      },
      margin: { left: 14, right: 14 },
      didParseCell: function(data) {
        // Pintar la fila de DIFERENCIA según estado
        if (data.row.index === filas.length - 1) {
          if (cierre.estado === 'cuadra') {
            data.cell.styles.fillColor = [220, 245, 220];
            data.cell.styles.textColor = [20, 90, 50];
            data.cell.styles.fontSize = 12;
          } else {
            data.cell.styles.fillColor = [254, 226, 226];
            data.cell.styles.textColor = [180, 30, 30];
            data.cell.styles.fontSize = 12;
          }
        }
      },
    });

    y = doc.lastAutoTable.finalY + 6;

    // Estado llamativo
    if (cierre.estado === 'cuadra') {
      doc.setFillColor(74, 139, 94);
      doc.roundedRect(14, y, 60, 10, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('CUADRA', 44, y + 7, { align: 'center' });
    } else {
      doc.setFillColor(180, 85, 63);
      doc.roundedRect(14, y, 60, 10, 2, 2, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('DESCUADRE', 44, y + 7, { align: 'center' });
    }

    y += 18;
  }

  // ---------- FIRMAS ----------
  if (y > pageHeight - 45) { doc.addPage(); y = 20; }

  doc.setDrawColor(120, 120, 110);
  doc.setLineWidth(0.3);

  doc.line(14, y + 15, 85, y + 15);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 70);
  doc.text('Firma del cajero', 14, y + 20);
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 110);
  doc.text(`${usuario || ''}`, 14, y + 25);

  doc.line(pageWidth - 85, y + 15, pageWidth - 14, y + 15);
  doc.setFontSize(9);
  doc.setTextColor(80, 80, 70);
  doc.text('Firma del administrador', pageWidth - 85, y + 20);

  // ---------- PIE DE PÁGINA ----------
  doc.setFontSize(7.5);
  doc.setTextColor(150, 150, 140);
  doc.text(
    `Arqueos Zoona · Reporte generado automáticamente · ${new Date().toLocaleDateString('es-CO')}`,
    pageWidth / 2, pageHeight - 8, { align: 'center' }
  );

  doc.save(`reporte-dia-${sanitizar(sede)}-${fecha}.pdf`);
}

/* ============================================================
   Excel — Reporte mensual
   ============================================================ */
export function exportarExcelMes({ sede, desde, hasta, cierres }) {
  const wb = XLSX.utils.book_new();

  const rows = [
    ['Fecha', 'Turno', 'Sede', 'Saldo inicial', 'Ventas SIIGO', 'Ingresos', 'Egresos',
     'Fletes', 'SPA', 'Esperado', 'Contado', 'Diferencia', 'Estado', 'Responsable', 'Observaciones']
  ];
  (cierres || []).forEach(c => {
    rows.push([
      String(c.fecha).slice(0, 10),
      c.turno,
      c.sede,
      Number(c.saldo_inicial) || 0,
      Number(c.ventas_siigo) || 0,
      Number(c.total_ingresos) || 0,
      Number(c.total_egresos) || 0,
      Number(c.total_fletes) || 0,
      Number(c.total_spa) || 0,
      Number(c.esperado) || 0,
      Number(c.contado) || 0,
      Number(c.diferencia) || 0,
      c.estado,
      c.usuario_email,
      c.observaciones,
    ]);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Cierres');

  const totalVentas = (cierres || []).reduce((s, c) => s + (Number(c.ventas_siigo) || 0), 0);
  const totalDiferencias = (cierres || []).reduce((s, c) => s + Math.abs(Number(c.diferencia) || 0), 0);
  const numDescuadres = (cierres || []).filter(c => c.estado === 'descuadre').length;

  const resumenRows = [
    ['Reporte mensual', ''],
    ['Sede', sede],
    ['Desde', desde],
    ['Hasta', hasta],
    ['', ''],
    ['Total ventas SIIGO', totalVentas],
    ['Total diferencias (abs)', totalDiferencias],
    ['Cierres con descuadre', numDescuadres],
    ['Total de cierres', (cierres || []).length],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumenRows), 'Resumen');

  XLSX.writeFile(wb, `reporte-mes-${sanitizar(sede)}-${desde}-${hasta}.xlsx`);
}

/* ============================================================
   PDF — Reporte por cajero
   ============================================================ */
export async function exportarPDFCajero({ sede, cajero, desde, hasta, cierres }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const verde = [31, 74, 44];

  await addLogo(doc, 14, 12, 20, 20);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(...verde);
  doc.text('Arqueos Zoona Animal', 40, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 110);
  doc.text('Control de caja y turnos', 40, 25);

  doc.setDrawColor(...verde);
  doc.setLineWidth(0.5);
  doc.line(14, 34, pageWidth - 14, 34);

  const todos = !cajero || cajero.trim() === '';
  const titulo = todos ? 'REPORTE DE TODOS LOS CAJEROS' : `REPORTE DEL CAJERO: ${cajero.toUpperCase()}`;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text(titulo, pageWidth / 2, 42, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Sede: ${sede}`, 14, 50);
  doc.text(`Periodo: ${desde} a ${hasta}`, 14, 55);
  doc.text(`Generado: ${new Date().toLocaleString('es-CO')}`, pageWidth - 14, 50, { align: 'right' });

  const filtrados = todos
    ? (cierres || [])
    : (cierres || []).filter(c =>
        String(c.usuario_email || '').toLowerCase().includes(String(cajero).toLowerCase())
      );

  let y = 65;

  autoTable(doc, {
    startY: y,
    head: [['Fecha', 'Turno', 'Cajero', 'Esperado', 'Contado', 'Diferencia', 'Estado']],
    body: filtrados.map(c => [
      String(c.fecha).slice(0, 10),
      c.turno,
      c.usuario_email || '—',
      fmt(c.esperado),
      fmt(c.contado),
      fmt(c.diferencia),
      c.estado === 'cuadra' ? 'OK' : 'DESCUADRE',
    ]),
    theme: 'striped',
    headStyles: { fillColor: verde, textColor: 255, fontSize: 8.5, fontStyle: 'bold' },
    bodyStyles: { fontSize: 8.5 },
    alternateRowStyles: { fillColor: [250, 247, 240] },
    columnStyles: {
      3: { halign: 'right' },
      4: { halign: 'right' },
      5: { halign: 'right' },
    },
    margin: { left: 14, right: 14 },
    didParseCell: function(data) {
      if (data.section === 'body' && data.column.index === 6 && data.cell.raw === 'DESCUADRE') {
        data.cell.styles.textColor = [180, 30, 30];
        data.cell.styles.fontStyle = 'bold';
      }
      if (data.section === 'body' && data.column.index === 6 && data.cell.raw === 'OK') {
        data.cell.styles.textColor = [20, 90, 50];
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  y = doc.lastAutoTable.finalY + 12;

  const totalDiferencias = filtrados.reduce((s, c) => s + Math.abs(Number(c.diferencia) || 0), 0);
  const totalDescuadres = filtrados.filter(c => c.estado === 'descuadre').length;

  // Caja de totales
  doc.setFillColor(245, 245, 240);
  doc.roundedRect(14, y - 4, pageWidth - 28, 30, 2, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...verde);
  doc.text('RESUMEN', 18, y + 3);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(`Total turnos: ${filtrados.length}`, 18, y + 10);
  doc.text(`Descuadres: ${totalDescuadres}`, 18, y + 15);
  doc.text(`Total diferencias: ${fmt(totalDiferencias)}`, 18, y + 20);

  doc.setFontSize(7.5);
  doc.setTextColor(150, 150, 140);
  doc.text(
    `Arqueos Zoona · Reporte generado automáticamente`,
    pageWidth / 2, pageHeight - 8, { align: 'center' }
  );

  const nombre = todos ? 'todos-los-cajeros' : sanitizar(cajero);
  doc.save(`reporte-cajero-${nombre}-${desde}-${hasta}.pdf`);
}

/* ============================================================
   Helpers
   ============================================================ */
function tipoArqueo(t) {
  if (t === 'apertura') return 'Apertura';
  if (t === 'cierre') return 'Cierre';
  if (t === '2h') return 'Parcial 2h';
  return t;
}

function sanitizar(s) {
  return String(s || '').replace(/[^a-zA-Z0-9-_]/g, '_');
}

async function addLogo(doc, x, y, w, h) {
  try {
    const dataUrl = await loadImageAsDataUrl(logo);
    doc.addImage(dataUrl, 'PNG', x, y, w, h);
  } catch (e) {
    console.warn('No se pudo agregar el logo:', e);
  }
}

function loadImageAsDataUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = url;
  });
}