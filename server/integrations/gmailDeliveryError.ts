export type GmailDeliveryOutcome = 'NOT_SENT' | 'REJECTED' | 'UNCERTAIN';

export class GmailDeliveryError extends Error {
  constructor(
    message: string,
    readonly deliveryOutcome: GmailDeliveryOutcome,
    readonly providerStatus?: number
  ) {
    super(message);
    this.name = 'GmailDeliveryError';
  }
}
