// Pinata is used server-side only (edge functions).
// This file exports gateway helpers for the frontend.

const PINATA_GATEWAY = "blue-obvious-jackal-985.mypinata.cloud";

export function getIPFSUrl(cid: string): string {
  return `https://${PINATA_GATEWAY}/ipfs/${cid}`;
}
