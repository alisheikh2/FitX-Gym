import PDFDocument from 'pdfkit';

export const generateReceiptNumber = () => {
  const date = new Date();
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `RCP-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}-${rand}`;
};

export const buildReceiptPDF = (payment) => {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ size: 'A6', margin: 20 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));

    // Header
    doc.fillColor('#0A0A0A').rect(0, 0, 300, 50).fill();
    doc.fillColor('#F5811F').fontSize(18).font('Helvetica-Bold').text('FITX', 20, 15);
    doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica').text('Personal Training Studio', 60, 20);
    doc.fillColor('#B3B3B3').fontSize(7).text('Shadman Town, Sahiwal | +92 300 6900206', 60, 33);

    doc.moveDown(3);
    doc.fillColor('#0A0A0A');

    doc.fontSize(10).font('Helvetica-Bold').text('RECEIPT', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(8).font('Helvetica').text(`Receipt #: ${payment.receiptNumber}`);
    doc.text(`Date: ${new Date(payment.createdAt).toLocaleString('en-PK')}`);
    doc.text(`Member: ${payment.memberName || 'Walk-in'}`);
    if (payment.planName) doc.text(`Plan/Item: ${payment.planName}`);
    doc.text(`Method: ${payment.paymentMethod.toUpperCase()}`);
    doc.moveDown(0.5);
    doc.moveTo(20, doc.y).lineTo(280, doc.y).strokeColor('#B3B3B3').stroke();
    doc.moveDown(0.5);
    doc.fontSize(12).font('Helvetica-Bold').text(`Total: PKR ${payment.amount.toLocaleString()}`, { align: 'right' });
    doc.moveDown(1);
    doc.fontSize(7).font('Helvetica-Oblique').fillColor('#B3B3B3').text('Thank you for training with FITX. This is a computer-generated receipt.', { align: 'center' });

    doc.end();
  });
};
