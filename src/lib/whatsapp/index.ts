import "server-only";

export {
  WhatsappDeliveryError,
  whatsappErrorMessage,
  isRetryableWhatsappError,
  jitterDelay,
  type WhatsappErrorKind,
  type WhatsappSendInput,
  type WhatsappSendResult,
  type WhatsappTemplatePayload,
  type WhatsappTemplateComponent,
  type WhatsappPhoneStatus,
  type MetaMessageTemplate,
  type MetaTemplateStatus,
} from "@/lib/whatsapp/types";

export {
  isMetaConfigured as isWhatsappConfigured,
  sendViaProvider,
  sendTemplate,
  createMessageTemplate,
  editMessageTemplate,
  uploadTemplateHeaderHandle,
  type HeaderMediaFormat,
  listMessageTemplates,
  buildTemplateComponents,
  getPhoneNumberStatus,
  getWabaStatus,
  fetchMediaInfo,
  downloadMediaStream,
  verifyWebhookSignature,
  readMetaWebhookEnv,
  type MetaMediaInfo,
  type WabaStatus,
} from "@/lib/whatsapp/meta-client";

export { hasOpen24hWindow, lastInboundAt, isWithin24h } from "@/lib/whatsapp/window";
