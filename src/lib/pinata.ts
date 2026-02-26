import { PinataSDK } from "pinata";

export const pinata = new PinataSDK({
  pinataJwt: process.env.PINATA_JWT!,
  pinataGateway: process.env.NEXT_PUBLIC_PINATA_GATEWAY || "blue-obvious-jackal-985.mypinata.cloud",
});

export async function uploadSkillToIPFS(file: File): Promise<string> {
  const result = await pinata.upload.public.file(file);
  return result.cid;
}

export async function fetchSkillFromIPFS(cid: string): Promise<string> {
  const url = await pinata.gateways.public.convert(cid);
  const response = await fetch(url);
  return response.text();
}
