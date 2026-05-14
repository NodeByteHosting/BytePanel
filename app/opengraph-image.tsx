import {
  OG_CONTENT_TYPE,
  OG_SIZE,
  makePanelOGImage,
} from "./_og/image-generator";

export const runtime = "edge";
export const alt = "NodeByte Game Server Manager — GSM";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OGImage() {
  return makePanelOGImage();
}
