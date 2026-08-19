import {
  ArrowLeft,
  CheckCheck,
  LockKeyhole,
  MoreVertical,
  Phone,
  Scale,
  Video,
} from 'lucide-react';

/**
 * Static WhatsApp phone mockup used on marketing pages (landing + demo).
 * Shows a realistic Urdu client conversation: AI disclosure, intake, case
 * creation, and lawyer escalation. Presentational only (aria-hidden).
 */
function ChatBubble({
  from = 'client',
  children,
  time,
}: {
  from?: 'client' | 'ai';
  children: React.ReactNode;
  time: string;
}) {
  const isAi = from === 'ai';
  return (
    <div className={`flex ${isAi ? 'justify-start' : 'justify-end'}`}>
      <div
        dir="auto"
        className={`relative max-w-[86%] rounded-lg px-2.5 pb-1.5 pt-1 text-[12px] leading-6 shadow-sm ${
          isAi
            ? "rounded-ss-none bg-[#202c33] text-[#e9edef] after:absolute after:start-[-7px] after:top-0 after:border-e-[8px] after:border-t-[8px] after:border-e-[#202c33] after:border-t-transparent after:content-['']"
            : "rounded-se-none bg-[#005c4b] text-[#e9edef] after:absolute after:end-[-7px] after:top-0 after:border-s-[8px] after:border-t-[8px] after:border-s-[#005c4b] after:border-t-transparent after:content-['']"
        }`}
      >
        <span className="font-urdu">{children}</span>
        <span
          dir="ltr"
          className="ms-3 inline-flex translate-y-1 items-center gap-0.5 text-[8px] leading-none text-[#8696a0]"
        >
          {time}
          {!isAi && <CheckCheck className="h-3 w-3 text-[#53bdeb]" aria-hidden />}
        </span>
      </div>
    </div>
  );
}

export function WhatsappPhoneMockup() {
  return (
    <div
      aria-hidden
      className="relative mx-auto w-full max-w-[320px] rounded-[2.6rem] border-[7px] border-[#050708] bg-[#0b141a] shadow-2xl shadow-black/40"
    >
      <div className="absolute left-1/2 top-0 z-20 h-5 w-24 -translate-x-1/2 rounded-b-2xl bg-[#050708]" />
      <div className="overflow-hidden rounded-[2rem]">
        <div className="flex h-7 items-center justify-between bg-[#202c33] px-5 pt-1 text-[8px] font-medium text-[#e9edef]">
          <span>11:42</span>
          <span className="tracking-wider">▮▮▮ ᯤ 82%</span>
        </div>
        <div className="flex items-center gap-1.5 bg-[#202c33] px-2 pb-2.5 pt-1 text-[#e9edef]">
          <ArrowLeft className="h-4 w-4 shrink-0" />
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#00a884] text-white">
            <Scale className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-medium">Al-Madad Law Associates</p>
            <p className="text-[9px] text-[#8696a0]">Business account</p>
          </div>
          <Video className="h-4 w-4 shrink-0" />
          <Phone className="h-3.5 w-3.5 shrink-0" />
          <MoreVertical className="h-4 w-4 shrink-0" />
        </div>
        <div
          className="min-h-[475px] space-y-2 bg-[#0b141a] px-3 pb-3 pt-3"
          style={{
            backgroundImage:
              'radial-gradient(circle at 15% 20%, rgb(134 150 160 / 7%) 0 1px, transparent 1.5px), radial-gradient(circle at 75% 65%, rgb(134 150 160 / 6%) 0 1px, transparent 1.5px)',
            backgroundSize: '32px 32px, 38px 38px',
          }}
        >
          <p className="mx-auto w-fit rounded-md bg-[#182229] px-2.5 py-1 text-center text-[8px] font-medium uppercase text-[#8696a0] shadow-sm">
            Today
          </p>
          <p className="mx-auto flex max-w-[92%] items-start justify-center gap-1.5 rounded-md bg-[#182229] px-2.5 py-1.5 text-center text-[8px] leading-3 text-[#ffd279] shadow-sm">
            <LockKeyhole className="mt-0.5 h-2.5 w-2.5 shrink-0" />
            Messages are end-to-end encrypted. No one outside this chat can read them.
          </p>
          <ChatBubble from="client" time="11:42 pm">
            السلام علیکم! میں ایک مال خانہ کیس کے بارے میں رہنمائی چاہتا ہوں
          </ChatBubble>
          <ChatBubble from="ai" time="11:42 pm">
            وعلیکم السلام! میں ویکل کا اے آئی اسسٹنٹ ہوں۔ قانونی رائے نہیں دیتا، مگر آپ کی بات وکیل
            تک پہنچاتا ہوں۔ بتائیں، آپ کس شہر سے ہیں؟
          </ChatBubble>
          <ChatBubble from="client" time="11:43 pm">
            لاہور سے ہوں۔ نام احمد رضا ہے۔
          </ChatBubble>
          <ChatBubble from="ai" time="11:43 pm">
            شکریہ احمد صاحب! کیس #1042 بنا دیا گیا — تفصیلات وکیل کو بھیج دی گئی ہیں۔
          </ChatBubble>
          <p className="mx-auto w-fit rounded-md bg-[#182229] px-2.5 py-1 text-center text-[8px] font-medium text-[#ffd279] shadow-sm">
            Wakeel flagged this chat for lawyer review
          </p>
        </div>
      </div>
    </div>
  );
}
