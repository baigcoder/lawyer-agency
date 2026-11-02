/**
 * Starter quick replies a firm can add with one click. Placeholders the
 * dashboard fills from the conversation: {client_name}, {firm_name},
 * {case_ref}, {lawyer_name}. Anything else ({date}, {amount}…) is left
 * highlighted for the lawyer to type.
 */
export interface StarterQuickReply {
  title: string;
  body: string;
  language: 'en' | 'ur';
}

export const QUICK_REPLY_STARTER_PACK: readonly StarterQuickReply[] = [
  {
    language: 'en',
    title: 'Hearing reminder',
    body: 'Assalam-o-Alaikum {client_name}, a reminder that your hearing in case {case_ref} is on {date} at {time}, {court}. Please bring your original CNIC and reach 30 minutes early. — {lawyer_name}, {firm_name}',
  },
  {
    language: 'ur',
    title: 'سماعت کی یاد دہانی',
    body: 'السلام علیکم {client_name}، یاد دہانی: کیس {case_ref} کی سماعت {date} کو {time} بجے {court} میں ہے۔ اصل شناختی کارڈ ساتھ لائیں اور 30 منٹ پہلے پہنچیں۔ — {lawyer_name}، {firm_name}',
  },
  {
    language: 'en',
    title: 'Hearing adjourned',
    body: 'Dear {client_name}, today’s hearing in case {case_ref} was adjourned. The next date is {date}. We will remind you before then. — {firm_name}',
  },
  {
    language: 'ur',
    title: 'سماعت ملتوی',
    body: 'محترم {client_name}، کیس {case_ref} کی آج کی سماعت ملتوی ہو گئی۔ اگلی تاریخ {date} ہے۔ ہم اس سے پہلے آپ کو یاد دلا دیں گے۔ — {firm_name}',
  },
  {
    language: 'en',
    title: 'Documents needed',
    body: 'Dear {client_name}, to move your matter forward please send clear photos of: {documents}. You can send them right here on WhatsApp. — {firm_name}',
  },
  {
    language: 'ur',
    title: 'درکار دستاویزات',
    body: 'محترم {client_name}، آپ کے معاملے کو آگے بڑھانے کے لیے براہ کرم ان کی واضح تصاویر بھیجیں: {documents}۔ آپ یہیں واٹس ایپ پر بھیج سکتے ہیں۔ — {firm_name}',
  },
  {
    language: 'en',
    title: 'Fee due',
    body: 'Dear {client_name}, the fee of PKR {amount} for {work} is due by {date}. You can pay by JazzCash, Easypaisa or bank transfer and send the screenshot here. — {firm_name}',
  },
  {
    language: 'ur',
    title: 'فیس واجب الادا',
    body: 'محترم {client_name}، {work} کی فیس {amount} روپے {date} تک واجب الادا ہے۔ آپ جاز کیش، ایزی پیسہ یا بینک ٹرانسفر سے ادائیگی کر کے اسکرین شاٹ یہاں بھیج سکتے ہیں۔ — {firm_name}',
  },
  {
    language: 'en',
    title: 'Payment received',
    body: 'Thank you {client_name}, we have received PKR {amount}. Your receipt will follow. — {firm_name}',
  },
  {
    language: 'ur',
    title: 'ادائیگی موصول',
    body: 'شکریہ {client_name}، ہمیں {amount} روپے موصول ہو گئے ہیں۔ رسید جلد بھیج دی جائے گی۔ — {firm_name}',
  },
  {
    language: 'en',
    title: 'Case update',
    body: 'Dear {client_name}, there is an update on your case {case_ref}: {update}. Reply here if you have any questions. — {lawyer_name}, {firm_name}',
  },
  {
    language: 'ur',
    title: 'کیس اپ ڈیٹ',
    body: 'محترم {client_name}، آپ کے کیس {case_ref} میں پیش رفت: {update}۔ کوئی سوال ہو تو یہیں جواب دیں۔ — {lawyer_name}، {firm_name}',
  },
  {
    language: 'en',
    title: 'Appointment confirmed',
    body: 'Dear {client_name}, your appointment with {lawyer_name} is confirmed for {date} at {time}. Address: {address}. — {firm_name}',
  },
  {
    language: 'ur',
    title: 'ملاقات کی تصدیق',
    body: 'محترم {client_name}، {lawyer_name} کے ساتھ آپ کی ملاقات {date} کو {time} بجے طے ہے۔ پتہ: {address}۔ — {firm_name}',
  },
  {
    language: 'en',
    title: 'Office address & timings',
    body: '{firm_name} is at {address}. Office hours: Monday to Saturday, {hours}. Please message before visiting so a lawyer is available.',
  },
  {
    language: 'ur',
    title: 'دفتر کا پتہ اور اوقات',
    body: '{firm_name} کا پتہ: {address}۔ دفتری اوقات: پیر تا ہفتہ، {hours}۔ آنے سے پہلے پیغام کر دیں تاکہ وکیل موجود ہوں۔',
  },
];
