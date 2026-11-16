/** Turns stored credential secrets into plaintext keys and back. */
export interface SecretCipher {
  encrypt(plaintext: string): string
  decrypt(stored: string): string
}
