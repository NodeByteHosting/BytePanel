import { makePanelOGImage } from "./_og/image-generator";

export const runtime = "nodejs";
export const alt = "BytePanel";
export {
  OG_CONTENT_TYPE as contentType,
  OG_SIZE as size,
} from "./_og/image-generator";

export default function OGImage() {
  return makePanelOGImage();
}
