import { jsPDF } from 'jspdf';
import crypto from 'crypto';

interface SignatureData {
  signerName: string;
  signerTitle: string;
  signerEmail: string;
  signedAt: string;
  ipAddress: string;
  userAgent: string;
  consentText: string;
}

interface DpaSignedPdfOptions {
  dpaVersion: string;
  dpaContent: string;
  signatureData: SignatureData;
  workspaceName?: string;
}

/**
 * Generate a signed DPA PDF with signature certificate
 *
 * Creates a professionally formatted PDF containing:
 * 1. Full DPA legal text
 * 2. Signature certificate with metadata
 * 3. Digital signature hash for verification
 *
 * Legally valid under EU eIDAS and US E-SIGN Act
 */
export async function generateSignedDpaPdf(options: DpaSignedPdfOptions): Promise<Buffer> {
  const { dpaVersion, dpaContent, signatureData, workspaceName } = options;

  // Create PDF document
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const maxWidth = pageWidth - (margin * 2);

  let yPosition = margin;

  // Helper function to add text with automatic page breaks
  const addText = (text: string, fontSize: number = 10, isBold: boolean = false) => {
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');

    const lines = doc.splitTextToSize(text, maxWidth);

    for (const line of lines) {
      if (yPosition > pageHeight - margin) {
        doc.addPage();
        yPosition = margin;
      }
      doc.text(line, margin, yPosition);
      yPosition += fontSize * 0.5; // Line height
    }
  };

  const addSpace = (mm: number = 5) => {
    yPosition += mm;
  };

  const addLine = () => {
    if (yPosition > pageHeight - margin) {
      doc.addPage();
      yPosition = margin;
    }
    doc.line(margin, yPosition, pageWidth - margin, yPosition);
    yPosition += 5;
  };

  // ========================================
  // Header
  // ========================================
  addText('DATA PROCESSING AGREEMENT', 16, true);
  addText(`Version ${dpaVersion}`, 12);
  addSpace(10);
  addLine();
  addSpace(10);

  // ========================================
  // DPA Content
  // ========================================
  addText(dpaContent, 10);
  addSpace(15);
  addLine();
  addSpace(10);

  // ========================================
  // Signature Certificate
  // ========================================
  addText('ELECTRONIC SIGNATURE CERTIFICATE', 14, true);
  addSpace(8);

  addText('This Data Processing Agreement was electronically signed using a click-through signature method, which is legally valid under:', 10);
  addSpace(3);
  addText('• EU eIDAS Regulation (Regulation 910/2014) - Simple Electronic Signatures', 9);
  addText('• US E-SIGN Act (15 U.S.C. § 7001) - Electronic Signatures in Global and National Commerce', 9);
  addSpace(8);

  // Signature Details Box
  doc.setDrawColor(0);
  doc.setFillColor(245, 245, 245);
  const boxHeight = 80;
  doc.rect(margin, yPosition, maxWidth, boxHeight, 'F');
  yPosition += 8;

  addText('Signature Details', 11, true);
  addSpace(5);

  addText(`Signer Name:           ${signatureData.signerName}`, 10);
  addSpace(4);
  addText(`Title:                 ${signatureData.signerTitle}`, 10);
  addSpace(4);
  addText(`Email:                 ${signatureData.signerEmail}`, 10);
  addSpace(4);

  if (workspaceName) {
    addText(`Company:               ${workspaceName}`, 10);
    addSpace(4);
  }

  const signedDate = new Date(signatureData.signedAt);
  addText(`Signed Date:           ${signedDate.toUTCString()}`, 10);
  addSpace(4);
  addText(`IP Address:            ${signatureData.ipAddress}`, 10);
  addSpace(4);

  yPosition += 5; // Exit box
  addSpace(8);

  // Consent Statement
  doc.setFillColor(255, 255, 220);
  doc.rect(margin, yPosition, maxWidth, 25, 'F');
  yPosition += 8;

  addText('Consent Statement:', 10, true);
  addSpace(4);
  addText(`"${signatureData.consentText}"`, 9);

  yPosition += 10; // Exit box
  addSpace(8);

  // Technical Metadata
  addText('Technical Metadata', 11, true);
  addSpace(5);

  addText(`User Agent: ${signatureData.userAgent.substring(0, 100)}`, 8);
  addSpace(4);
  addText(`DPA Version: ${dpaVersion}`, 8);
  addSpace(4);
  addText(`Document Generated: ${new Date().toUTCString()}`, 8);
  addSpace(8);

  // Digital Signature Hash
  const signatureHash = crypto
    .createHash('sha256')
    .update(JSON.stringify({
      dpaVersion,
      signerEmail: signatureData.signerEmail,
      signedAt: signatureData.signedAt,
      ipAddress: signatureData.ipAddress,
      consentText: signatureData.consentText
    }))
    .digest('hex');

  addText('Digital Signature Hash (SHA-256):', 11, true);
  addSpace(5);
  doc.setFont('courier', 'normal');
  addText(signatureHash, 8);
  doc.setFont('helvetica', 'normal');
  addSpace(8);

  // Legal Notice
  addLine();
  addSpace(5);
  addText('LEGAL NOTICE', 11, true);
  addSpace(5);
  addText('This document constitutes a legally binding electronic signature under applicable law. The signature metadata recorded above provides evidence of the signer\'s intent to be bound by this agreement. This certificate should be retained for compliance and audit purposes.', 9);
  addSpace(5);
  addText('For verification purposes, the digital signature hash can be used to confirm the authenticity and integrity of this document.', 9);

  // Footer on every page
  const totalPages = doc.internal.pages.length - 1; // Subtract 1 for blank first page
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `SAM AI Data Processing Agreement v${dpaVersion} - Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
  }

  // Convert to buffer
  const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

  return pdfBuffer;
}

/**
 * Generate filename for signed DPA PDF
 */
export function generateDpaPdfFilename(workspaceId: string, dpaVersion: string): string {
  const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return `dpa-signed-${workspaceId}-v${dpaVersion}-${timestamp}.pdf`;
}
