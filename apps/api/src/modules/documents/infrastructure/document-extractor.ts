import { Injectable, Logger } from '@nestjs/common';
import { PDFParse } from 'pdf-parse';
import mammoth from 'mammoth';

@Injectable()
export class DocumentExtractor {
  private readonly logger = new Logger(DocumentExtractor.name);

  async extract(buffer: Buffer, mimeType: string, filename: string): Promise<{ text: string; confidence: number }> {
    try {
      if (mimeType === 'application/pdf' || filename.toLowerCase().endsWith('.pdf')) {
        const parser = new PDFParse({ data: new Uint8Array(buffer) });
        const result = await parser.getText();
        return { text: result.text ?? '', confidence: 0.95 };
      }
      if (
        mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        filename.toLowerCase().endsWith('.docx')
      ) {
        const result = await mammoth.extractRawText({ buffer });
        return { text: result.value ?? '', confidence: 0.95 };
      }
      if (mimeType.startsWith('text/') || filename.toLowerCase().endsWith('.txt')) {
        return { text: buffer.toString('utf-8'), confidence: 1 };
      }
      // Image OCR and other formats require Google Document AI or similar; skipped for now.
      return { text: '', confidence: 0 };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'extraction failed';
      this.logger.warn({ filename, mimeType, error: message }, 'document extraction failed');
      return { text: '', confidence: 0 };
    }
  }
}
