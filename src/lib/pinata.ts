// IPFS gateway helpers (using Filebase)

const IPFS_GATEWAY = "ipfs.filebase.io";

export function getIPFSUrl(cid: string): string {
  return `https://${IPFS_GATEWAY}/ipfs/${cid}`;
}
