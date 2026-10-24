import { makePanelOGImage } from "./_og/image-generator";

export const runtime = "edge";
export const alt = "NodeByte Game Server Manager — GSM";
export {
  OG_CONTENT_TYPE as contentType,
  OG_SIZE as size,
} from "./_og/image-generator";

export default function OGImage() {
  return makePanelOGImage();
}
