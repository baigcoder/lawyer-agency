import type { PaymentMethod } from '../../../generated/prisma/client';

/**
 * Detects when a client is asking for JazzCash / Easypaisa / bank details so
 * the orchestrator can send stored account numbers instead of asking the LLM
 * (D-110 / D-120). Account numbers never enter prompts.
 */
export function isPaymentDetailsRequest(text: string): boolean {
  const normalized = text.trim().toLowerCase();
  if (normalized.length < 3) return false;
  return PAYMENT_DETAILS_RE.test(normalized);
}

export function preferredInstructionMethod(details: {
  jazzcashNumber?: string | undefined;
  easypaisaNumber?: string | undefined;
  accountNumber?: string | undefined;
  iban?: string | undefined;
}): PaymentMethod {
  if (details.jazzcashNumber?.trim()) return 'JAZZCASH';
  if (details.easypaisaNumber?.trim()) return 'EASYPAISA';
  if (details.accountNumber?.trim() || details.iban?.trim()) return 'BANK_TRANSFER';
  return 'JAZZCASH';
}

const PAYMENT_DETAILS_RE =
  /jazz\s*cash|easy\s*paisa|easypaisa|iban\b|account\s*(number|no\.?|details)|bank\s*(account|details|transfer)|payment\s*(detail|details|info|information)|send\s*(payment|account)|how\s*(do\s*i|to)\s*pay|where\s*(do\s*i|to)\s*pay|fee\s*(account|details)|ادائیگی|پیمنٹ|اکاؤنٹ|جیز\s*کیش|ایزی\s*پیسہ|بینک/;
