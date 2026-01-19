import crypto from 'crypto';

type VerifyParams = {
  rawBody: string;
  hmacHeader: string | null;
  secret: string;
};

export function verifyShopifyWebhookHmac({ rawBody, hmacHeader, secret }: VerifyParams): boolean {
  if (!hmacHeader) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(Buffer.from(rawBody, 'utf8'))
    .digest('base64');

  const expectedBuf = Buffer.from(expected, 'utf8');
  const providedBuf = Buffer.from(hmacHeader, 'utf8');
  if (expectedBuf.length !== providedBuf.length) return false;

  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}
