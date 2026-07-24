import { createHmac, randomUUID } from "node:crypto";

export const API_BASE_URL = "https://openapi.dnse.com.vn";
export const API_VERSION = "2026-05-07";

export class DnseServer {
  private apiKey: string;
  private apiSecret: string;

  constructor(apiKey: string, apiSecret: string) {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
  }

  sign(method: string, path: string): { date: string; signatureHeader: string } {
    const date = new Date().toUTCString();
    const nonce = randomUUID().replace(/-/g, "");

    const signingString = `(request-target): ${method.toLowerCase()} ${path}\ndate: ${date}\nnonce: ${nonce}`;

    const mac = createHmac("sha256", this.apiSecret);
    mac.update(signingString);
    const rawSignature = mac.digest();

    const b64Signature = rawSignature.toString("base64");
    const encodedSignature = b64Signature
      .replace(/\+/g, "%2B")
      .replace(/\//g, "%2F")
      .replace(/=/g, "%3D");

    const signatureHeader = `Signature keyId="${this.apiKey}",algorithm="hmac-sha256",headers="(request-target) date",signature="${encodedSignature}",nonce="${nonce}"`;

    return { date, signatureHeader };
  }

  async getJson(path: string, url: string): Promise<string> {
    const { date, signatureHeader } = this.sign("get", path);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "X-Api-Key": this.apiKey,
        "X-Signature": signatureHeader,
        Date: date,
        version: API_VERSION,
      },
    });

    const body = await response.text();

    if (!response.ok) {
      throw new Error(`DNSE API error (${response.status}): ${body}`);
    }

    return body;
  }
}
