import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../../../config/env';
import { UnitOfWork } from '../../../common/prisma/unit-of-work';
import { FirmProfileService } from '../../firm-profile/application/firm-profile.service';
import { WHATSAPP_CALLING, WHATSAPP_CONNECTION_REPOSITORY, type WhatsappCallingPort, type WhatsappConnectionRepository } from '../../whatsapp/application/ports';
import { SendService } from '../../whatsapp/application/send.service';
import { isWithinCallHours } from './call-hours';
import { answerWhatsappOffer, bridgeOptionsFromEnv, noopSession, type HeldRtcSession } from './webrtc-bridge';
import type { NormalizedCallEvent } from './normalize-call-event';
import { VoiceCallService } from './voice-call.service';
import { VoiceReceptionistService, type ReceptionistSession } from './voice-receptionist.service';
import { CallMediaLoop } from './call-media.loop';
import { WavoipCallService } from './wavoip-call.service';
import { CallSpeechService } from './call-speech.service';

export interface VoiceCallJob {
  kind: 'connect' | 'terminate' | 'utterance';
  tenantId: string;
  instanceName: string;
  call: NormalizedCallEvent;
  utterance?: string;
}

@Injectable()
export class VoiceSessionRunner {
  private readonly logger = new Logger(VoiceSessionRunner.name);
  private readonly sessions = new Map<string, ReceptionistSession>();
  private readonly rtc = new Map<string, HeldRtcSession>();

  constructor(
    private readonly calls: VoiceCallService,
    private readonly receptionist: VoiceReceptionistService,
    private readonly profile: FirmProfileService,
    private readonly send: SendService,
    private readonly uow: UnitOfWork,
    private readonly media: CallMediaLoop,
    private readonly speech: CallSpeechService,
    private readonly config: ConfigService<Env, true>,
    private readonly wavoip: WavoipCallService,
    @Inject(WHATSAPP_CALLING) private readonly calling: WhatsappCallingPort,
    @Inject(WHATSAPP_CONNECTION_REPOSITORY) private readonly connections: WhatsappConnectionRepository,
  ) {}

  async handle(job: VoiceCallJob): Promise<void> {
    if (job.kind === 'terminate') {
      await this.terminate(job);
      return;
    }
    if (job.kind === 'utterance') {
      await this.utterance(job);
      return;
    }
    await this.connect(job);
  }

  private async connect(job: VoiceCallJob): Promise<void> {
    const opened = await this.calls.ensureOpenConversation(job.tenantId, job.call.fromWaPhone);
    job.call.fromWaPhone = opened.fromWaPhone;
    const { conversationId, clientId } = opened;
    const ringing = await this.calls.startRinging({
      tenantId: job.tenantId,
      conversationId,
      providerCallId: job.call.providerCallId,
      fromWaPhone: job.call.fromWaPhone,
      instanceName: job.instanceName,
    });

    const connection = await this.uow.withTenant(job.tenantId, (tx) =>
      this.connections.findByTenant(tx, job.tenantId),
    );
    const settings = await this.profile.getAiSettings(job.tenantId);
    const firm = await this.profile.get(job.tenantId);

    if (settings.callsTakenBy !== 'ai') {
      await this.reject(job, ringing.id, 'REJECTED_OFF', 'The firm is not answering WhatsApp calls with AI.');
      return;
    }
    if (!isWithinCallHours(new Date(), settings.aiCallHoursStart, settings.aiCallHoursEnd, settings.aiCallHoursTimezone)) {
      await this.reject(job, ringing.id, 'OUTSIDE_HOURS', 'Outside the firm call hours.');
      return;
    }

    const connectionType = connection?.connectionType ?? 'baileys';
    if (connectionType === 'cloud_api') {
      await this.connectCloud(job, ringing.id, conversationId, clientId, firm.displayName, settings);
      return;
    }
    if (connectionType === 'baileys') {
      await this.connectBaileys(job, ringing.id, conversationId, clientId, firm.displayName, settings);
      return;
    }
    await this.reject(
      job,
      ringing.id,
      'BAILEYS_UNSUPPORTED',
      'Live AI calls need a QR/Baileys or official WhatsApp Cloud number.',
    );
  }

  private async connectCloud(
    job: VoiceCallJob,
    voiceCallId: string,
    conversationId: string,
    clientId: string,
    firmName: string,
    settings: ReceptionistSession['settings'],
  ): Promise<void> {
    let sdpAnswer: string | undefined;
    let rtcSession: HeldRtcSession = noopSession();
    if (job.call.sdpOffer) {
      try {
        const answered = await answerWhatsappOffer(job.call.sdpOffer, this.bridgeOptions());
        sdpAnswer = answered.sdpAnswer;
        rtcSession = answered.session;
        if (rtcSession.media !== 'live') {
          this.logger.warn({ providerCallId: job.call.providerCallId }, 'SDP rewrite only — live audio unavailable');
        }
      } catch (error) {
        this.logger.warn({ err: error instanceof Error ? error.message : 'sdp' }, 'could not build SDP answer');
      }
    }

    try {
      if (sdpAnswer) {
        await this.calling.sendCallAction({
          tenantId: job.tenantId,
          instanceName: job.instanceName,
          providerCallId: job.call.providerCallId,
          action: 'pre_accept',
          sdpAnswer,
        });
      }
      await this.calling.sendCallAction({
        tenantId: job.tenantId,
        instanceName: job.instanceName,
        providerCallId: job.call.providerCallId,
        action: 'accept',
        sdpAnswer,
      });
    } catch (error) {
      this.logger.warn({ err: error instanceof Error ? error.message : 'accept' }, 'call accept failed');
      rtcSession.close();
      await this.calls.complete({
        tenantId: job.tenantId,
        voiceCallId,
        status: 'FAILED',
        disposition: 'ABANDONED',
        summary: 'Could not accept the WhatsApp call.',
        transcript: '',
      });
      return;
    }

    await this.calls.markAnswered(job.tenantId, voiceCallId);
    this.beginTalk(job, voiceCallId, conversationId, clientId, firmName, settings, rtcSession);
  }

  private async connectBaileys(
    job: VoiceCallJob,
    voiceCallId: string,
    conversationId: string,
    clientId: string,
    firmName: string,
    settings: ReceptionistSession['settings'],
  ): Promise<void> {
    // Claim SIP as soon as we know this is Baileys — do not burn ring time on
    // extra work. Wavoip often needs several seconds after CB:call to INVITE.
    const live = await this.wavoip.tryLiveSession({ fromWaPhone: job.call.fromWaPhone });
    if (live) {
      await this.calls.markAnswered(job.tenantId, voiceCallId);
      this.beginTalk(job, voiceCallId, conversationId, clientId, firmName, settings, live);
      return;
    }
    this.logger.warn(
      { providerCallId: job.call.providerCallId, fromWaPhone: job.call.fromWaPhone },
      'no Wavoip SIP INVITE — missed-call WhatsApp follow-up (not rejecting the ring)',
    );
    await this.missedCallFollowUp(job, voiceCallId, conversationId, clientId, firmName, settings);
  }

  private beginTalk(
    job: VoiceCallJob,
    voiceCallId: string,
    conversationId: string,
    clientId: string,
    firmName: string,
    settings: ReceptionistSession['settings'],
    rtcSession: HeldRtcSession,
  ): void {
    const session: ReceptionistSession = {
      tenantId: job.tenantId,
      voiceCallId,
      conversationId,
      clientId,
      fromWaPhone: job.call.fromWaPhone,
      firmName,
      settings,
      offeredSlots: null,
      transcript: [],
      disposition: 'ABANDONED',
    };
    const greet = this.receptionist.greeting(session);
    session.transcript.push({ role: 'assistant', text: greet });
    const key = sessionKey(job.tenantId, job.call.providerCallId);
    this.sessions.set(key, session);
    this.rtc.set(key, rtcSession);
    void this.media
      .run({
        session,
        rtc: rtcSession,
        greeting: greet,
        onHangUp: async () => {
          try {
            await this.calling.sendCallAction({
              tenantId: job.tenantId,
              instanceName: job.instanceName,
              providerCallId: job.call.providerCallId,
              action: 'terminate',
            });
          } catch (error) {
            this.logger.warn({ err: error instanceof Error ? error.message : 'terminate' }, 'call terminate failed');
          }
          await this.terminate(job);
        },
      })
      .catch((error: unknown) => {
        this.logger.warn(
          { err: error instanceof Error ? error.message : 'media' },
          'voice media loop failed',
        );
      });
  }

  private async missedCallFollowUp(
    job: VoiceCallJob,
    voiceCallId: string,
    conversationId: string,
    clientId: string,
    firmName: string,
    settings: ReceptionistSession['settings'],
  ): Promise<void> {
    // When Wavoip is configured, do NOT Evolution-reject: rejecting kills a
    // late SIP answer / webphone pickup. Caller can hang up; we continue on chat.
    if (!this.wavoip.isConfigured()) {
      try {
        await this.calling.sendCallAction({
          tenantId: job.tenantId,
          instanceName: job.instanceName,
          providerCallId: job.call.providerCallId,
          action: 'reject',
        });
      } catch (error) {
        this.logger.warn({ err: error instanceof Error ? error.message : 'reject' }, 'Baileys call reject failed');
      }
    }

    const session: ReceptionistSession = {
      tenantId: job.tenantId,
      voiceCallId,
      conversationId,
      clientId,
      fromWaPhone: job.call.fromWaPhone,
      firmName,
      settings,
      offeredSlots: null,
      transcript: [],
      disposition: 'INFO',
    };
    const greet = this.receptionist.greeting(session);
    const body = `${greet} I saw your call — reply here and I will help.`;
    session.transcript.push({ role: 'assistant', text: body });

    try {
      await this.send.send(job.tenantId, {
        kind: 'text',
        conversationId,
        toWaPhone: job.call.fromWaPhone,
        senderType: 'AI',
        body,
      });
    } catch (error) {
      this.logger.warn({ err: error instanceof Error ? error.message : 'send' }, 'missed-call WhatsApp text skipped');
    }

    const note = await this.speech.synthesizeWhatsappNote(body, settings);
    if (note) {
      try {
        await this.send.send(job.tenantId, {
          kind: 'audio',
          conversationId,
          toWaPhone: job.call.fromWaPhone,
          senderType: 'AI',
          body,
          audioBuffer: note.audioBuffer,
          mimeType: note.mimeType,
          audioPath: `tenants/${job.tenantId}/voice-calls/${voiceCallId}-followup.mp3`,
        });
      } catch (error) {
        this.logger.warn(
          { err: error instanceof Error ? error.message : 'audio' },
          'missed-call voice note skipped',
        );
      }
    }

    await this.calls.complete({
      tenantId: job.tenantId,
      voiceCallId,
      status: 'COMPLETED',
      disposition: 'INFO',
      summary: 'Missed WhatsApp call — AI continued on chat.',
      transcript: `assistant: ${body}`,
    });
  }

  private bridgeOptions() {
    return bridgeOptionsFromEnv({
      icePortMin: this.config.get('WEBRTC_ICE_PORT_MIN', { infer: true }),
      icePortMax: this.config.get('WEBRTC_ICE_PORT_MAX', { infer: true }),
      turnUrl: this.config.get('WEBRTC_TURN_URL', { infer: true }),
      turnUsername: this.config.get('WEBRTC_TURN_USERNAME', { infer: true }),
      turnCredential: this.config.get('WEBRTC_TURN_CREDENTIAL', { infer: true }),
    });
  }

  private async utterance(job: VoiceCallJob): Promise<void> {
    const session = this.sessions.get(sessionKey(job.tenantId, job.call.providerCallId));
    if (!session || !job.utterance) return;
    await this.receptionist.processUtterance(session, job.utterance);
    if (session.shouldHangUp) {
      try {
        await this.calling.sendCallAction({
          tenantId: job.tenantId,
          instanceName: job.instanceName,
          providerCallId: job.call.providerCallId,
          action: 'terminate',
        });
      } catch (error) {
        this.logger.warn({ err: error instanceof Error ? error.message : 'terminate' }, 'call terminate failed');
      }
      await this.terminate(job);
    }
  }

  private async terminate(job: VoiceCallJob): Promise<void> {
    const key = sessionKey(job.tenantId, job.call.providerCallId);
    const session = this.sessions.get(key);
    this.sessions.delete(key);
    this.rtc.get(key)?.close();
    this.rtc.delete(key);
    if (!session) return;
    const summary = summaryFrom(session);
    await this.calls.complete({
      tenantId: job.tenantId,
      voiceCallId: session.voiceCallId,
      status: 'COMPLETED',
      disposition: session.disposition,
      summary,
      transcript: session.transcript.map((line) => `${line.role}: ${line.text}`).join('\n'),
      appointmentId: session.appointmentId,
      escalationId: session.escalationId,
    });
    // Appointment confirmation is sent by AppointmentsService (D-109) at book time.
    // After hangup, send a WhatsApp follow-up for intake/escalation outcomes.
    if (session.disposition === 'BOOKED' || session.disposition === 'ESCALATED' || session.disposition === 'INFO') {
      try {
        await this.send.send(job.tenantId, {
          kind: 'text',
          conversationId: session.conversationId,
          toWaPhone: session.fromWaPhone,
          senderType: 'AI',
          body: `${summary} You can reply here on WhatsApp.`,
        });
      } catch (error) {
        this.logger.warn({ err: error instanceof Error ? error.message : 'send' }, 'post-call WhatsApp text skipped');
      }
    }
  }

  private async reject(
    job: VoiceCallJob,
    voiceCallId: string,
    disposition: 'REJECTED_OFF' | 'BAILEYS_UNSUPPORTED' | 'OUTSIDE_HOURS',
    summary: string,
  ): Promise<void> {
    try {
      await this.calling.sendCallAction({
        tenantId: job.tenantId,
        instanceName: job.instanceName,
        providerCallId: job.call.providerCallId,
        action: 'reject',
      });
    } catch (error) {
      this.logger.warn({ err: error instanceof Error ? error.message : 'reject' }, 'call reject failed');
    }
    await this.calls.complete({
      tenantId: job.tenantId,
      voiceCallId,
      status: 'REJECTED',
      disposition,
      summary,
      transcript: '',
    });
  }
}

function sessionKey(tenantId: string, providerCallId: string): string {
  return `${tenantId}:${providerCallId}`;
}

function summaryFrom(session: ReceptionistSession): string {
  if (session.disposition === 'BOOKED') return 'WhatsApp call: appointment booked.';
  if (session.disposition === 'ESCALATED') return 'WhatsApp call: handed to a lawyer.';
  if (session.disposition === 'INFO') return 'WhatsApp call: intake or FAQ captured.';
  return 'WhatsApp call ended.';
}
