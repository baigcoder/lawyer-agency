import { Module, type DynamicModule } from '@nestjs/common';
import { DocumentsService } from './application/documents.service';
import { DocumentRequestsService } from './application/document-requests.service';
import { DocumentRequestsController } from './interface/document-requests.controller';
import { DocumentsController } from './interface/documents.controller';
import { DocumentExtractor } from './infrastructure/document-extractor';
import { RagModule } from '../rag/rag.module';
import { WhatsappPortsModule } from '../whatsapp/whatsapp-ports.module';

/**
 * Documents — tenant-scoped object storage (Supabase/S3), text extraction,
 * RAG chunking/embedding, and RBAC-protected REST surface.
 * Owns: documents, document_requests, document_chunks.
 * Publishes: document.received, document.processed, document.requested,
 * document.request.fulfilled.
 */
@Module({})
export class DocumentsModule {
  static register(role: 'api' | 'worker'): DynamicModule {
    return {
      module: DocumentsModule,
      imports: [RagModule, WhatsappPortsModule],
      controllers: role === 'api' ? [DocumentRequestsController, DocumentsController] : [],
      providers: [DocumentsService, DocumentRequestsService, DocumentExtractor],
      exports: [DocumentsService, DocumentRequestsService],
    };
  }
}
