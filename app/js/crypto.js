/* crypto.js — passphrase-based encryption for the secrets blob (pat.enc.json).
 *
 * Design (see checklist "Key management"):
 *   passphrase --Argon2id--> 256-bit key --AES-256-GCM--> ciphertext
 * The blob is PUBLIC, so the passphrase is the only guard: we use a memory-hard
 * KDF (Argon2id via hash-wasm) and a fresh random salt + IV per encryption.
 * A wrong passphrase simply fails the GCM auth tag (no false unlock).
 */
(function () {
  const GP = (window.GP = window.GP || {});
  const { bytesToB64, b64ToBytes, enc, dec } = GP.lib;

  const KDF = { m: 262144 /* KiB ~256MB */, t: 3, p: 1, hashLen: 32 };

  async function deriveKeyRaw(passphrase, saltBytes, params) {
    if (!window.hashwasm || !window.hashwasm.argon2id) {
      throw new Error("Argon2 (hash-wasm) not loaded — check your internet connection / CDN.");
    }
    const p = params || KDF;
    const raw = await window.hashwasm.argon2id({
      password: passphrase, salt: saltBytes,
      parallelism: p.p || KDF.p, iterations: p.t || KDF.t, memorySize: p.m || KDF.m,
      hashLength: KDF.hashLen, // always 32 bytes for AES-256 (blob params omit this)
      outputType: "binary",
    });
    return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  }

  async function encryptSecrets(secretsObj, passphrase) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKeyRaw(passphrase, salt, KDF);
    const plaintext = enc.encode(JSON.stringify(secretsObj));
    const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext);
    return {
      v: 1, kdf: "argon2id",
      params: { m: KDF.m, t: KDF.t, p: KDF.p },
      salt: bytesToB64(salt), iv: bytesToB64(iv),
      ciphertext: bytesToB64(new Uint8Array(ct)),
      pat_expires: secretsObj.pat_expires || null,
      created: new Date().toISOString().slice(0, 10),
    };
  }

  async function decryptSecrets(blob, passphrase) {
    const salt = b64ToBytes(blob.salt);
    const iv = b64ToBytes(blob.iv);
    const key = await deriveKeyRaw(passphrase, salt, blob.params || KDF);
    let pt;
    try {
      pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, b64ToBytes(blob.ciphertext));
    } catch (e) {
      throw new Error("Wrong passphrase (or corrupt blob).");
    }
    return JSON.parse(dec.decode(pt));
  }

  // Rough passphrase strength gate (no external lib): length + variety + word count.
  function passphraseStrength(pw) {
    if (!pw) return { score: 0, label: "empty", ok: false };
    let score = 0;
    if (pw.length >= 12) score += 2; else if (pw.length >= 8) score += 1;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score += 1;
    if (/\d/.test(pw)) score += 1;
    if (/[^A-Za-z0-9]/.test(pw)) score += 1;
    if (pw.trim().split(/\s+/).length >= 3) score += 1; // multi-word passphrase
    const labels = ["very weak", "weak", "fair", "good", "strong", "strong", "excellent", "excellent"];
    return { score, label: labels[Math.min(score, 7)], ok: score >= 3 && pw.length >= 10 };
  }

  GP.crypto = { encryptSecrets, decryptSecrets, passphraseStrength, KDF };
})();
