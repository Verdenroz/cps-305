import { Buffer } from 'buffer';

export class CryptoService {
  private sessionKey: ArrayBuffer | null = null;
  private sessionId: string | null = null;

  public setSession(key: ArrayBuffer, sessionId: string) {
    this.sessionKey = key;
    this.sessionId = sessionId;
  }

  public getSessionId(): string {
    if (!this.sessionId) throw new Error("No active session");
    return this.sessionId;
  }

  async generateKeyPair() {
    // Generate DH parameters
    const p = Buffer.from('FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD129024E088A67CC74020BBEA63B139B22514A08798E3404DDEF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7EDEE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3DC2007CB8A163BF0598DA48361C55D39A69163FA8FD24CF5F83655D23DCA3AD961C62F356208552BB9ED529077096966D670C354E4ABC9804F1746C08CA18217C32905E462E36CE3BE39E772C180E86039B2783A2EC07A28FB5C55DF06F4C52C9DE2BCBF6955817183995497CEA956AE515D2261898FA051015728E5A8AACAA68FFFFFFFFFFFFFFFF', 'hex');
    const g = BigInt(2);

    // Generate private key
    const privateKeyArray = crypto.getRandomValues(new Uint8Array(32));
    const privateKey = BigInt('0x' + Buffer.from(privateKeyArray).toString('hex'));

    // Calculate public key
    const publicKey = this.modPow(g, privateKey, BigInt('0x' + p.toString('hex')));

    return { privateKey, publicKey: publicKey.toString() };
  }

  private modPow(base: bigint, exponent: bigint, modulus: bigint): bigint {
    let result = BigInt(1);
    base = base % modulus;
    while (exponent > BigInt(0)) {
      if (exponent % BigInt(2) === BigInt(1)) {
        result = (result * base) % modulus;
      }
      base = (base * base) % modulus;
      exponent = exponent / BigInt(2);
    }
    return result;
  }

  async computeSharedSecret(privateKey: bigint, serverPublicKey: string): Promise<Uint8Array> {
    const p = Buffer.from('FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD129024E088A67CC74020BBEA63B139B22514A08798E3404DDEF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7EDEE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3DC2007CB8A163BF0598DA48361C55D39A69163FA8FD24CF5F83655D23DCA3AD961C62F356208552BB9ED529077096966D670C354E4ABC9804F1746C08CA18217C32905E462E36CE3BE39E772C180E86039B2783A2EC07A28FB5C55DF06F4C52C9DE2BCBF6955817183995497CEA956AE515D2261898FA051015728E5A8AACAA68FFFFFFFFFFFFFFFF', 'hex');
    
    const serverPublicKeyBig = BigInt(serverPublicKey);
    const sharedSecretBig = this.modPow(serverPublicKeyBig, privateKey, BigInt('0x' + p.toString('hex')));
    
    // Hash the shared secret
    const encoder = new TextEncoder();
    const data = encoder.encode(sharedSecretBig.toString());
    return new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  }

  public async encryptMessage(message: string): Promise<{ encrypted: string; iv: string }> {
    if (!this.sessionKey) throw new Error("No session key available");

    const iv = crypto.getRandomValues(new Uint8Array(16));
    const key = await crypto.subtle.importKey(
      "raw",
      this.sessionKey,
      { name: "AES-CBC", length: 256 },
      false,
      ["encrypt"]
    );

    const encodedMessage = new TextEncoder().encode(message);
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-CBC", iv },
      key,
      encodedMessage
    );

    return {
      encrypted: arrayBufferToBase64(encrypted),
      iv: arrayBufferToBase64(iv)
    };
  }

  public async decryptMessage(encrypted: string, iv: string): Promise<string> {
    if (!this.sessionKey) throw new Error("No session key available");

    const key = await crypto.subtle.importKey(
      "raw",
      this.sessionKey,
      { name: "AES-CBC", length: 256 },
      false,
      ["decrypt"]
    );

    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-CBC", iv: base64ToArrayBuffer(iv) },
      key,
      base64ToArrayBuffer(encrypted)
    );

    return new TextDecoder().decode(decrypted);
  }
}

  function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    return btoa(String.fromCharCode(...bytes));
  }

  function base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  function bigIntToArrayBuffer(bigInt: bigint): ArrayBuffer {
    const hex = bigInt.toString(16).padStart(64, '0');
    const bytes = new Uint8Array(32);
    for (let i = 0; i < 32; i++) {
      bytes[i] = parseInt(hex.slice(i * 2, (i + 1) * 2), 16);
    }
    return bytes.buffer;
  }
  