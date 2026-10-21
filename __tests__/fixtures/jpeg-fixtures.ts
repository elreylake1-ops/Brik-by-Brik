import { createHash } from "node:crypto"

// A real, decodable 1x1 JPEG. `tinyJpeg(seed)` appends seed bytes after the end-of-image marker, which decoders
// ignore, so every seed yields a distinct but valid image with a distinct checksum.
const BASE = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
  "base64"
)

export const tinyJpeg = (seed = "") => new Uint8Array(Buffer.concat([BASE, Buffer.from(seed)]))
export const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex")
