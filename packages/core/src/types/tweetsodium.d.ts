declare module "tweetsodium" {
  export function crypto_box_seal(message: Buffer, publicKey: Buffer): Uint8Array
}
