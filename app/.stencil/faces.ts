import { BACKEND_BASE, createBackendFetch } from "./backend";

export type FaceBox = { x: number; y: number; w: number; h: number };
export type FaceLandmarks = {
  rightEye: [number, number];
  leftEye: [number, number];
  nose: [number, number];
  mouthRight: [number, number];
  mouthLeft: [number, number];
};
export type FaceQuality = {
  /** Variance of the Laplacian over the face box: higher is sharper, under about 100 is soft. */
  sharpness: number;
  /** Mean grey level 0–255 over the face box. */
  brightness: number;
  /** The face's longer side over the image's longer side; small faces give weaker embeddings. */
  relativeSize: number;
};
export interface ExtractedFace {
  /** Position in this image's face list. */
  index: number;
  /** Pixels in the orientation-corrected image, origin top-left. */
  box: FaceBox;
  landmarks: FaceLandmarks;
  /** Detection confidence 0–1 that this is a face; it says nothing about who it is. */
  score: number;
  quality: FaceQuality;
  /**
   * 128 floats of unit length (SFace). Compare two with cosine similarity — their dot
   * product — and only when both carry the same `models.preprocessingVersion`. OpenCV's own
   * evaluation calls faces the same person above 0.363; treat that as a hint, never a proof.
   */
  embedding: number[];
}
export interface FaceExtraction {
  /** `unreadable` means the bytes did not decode as an image. */
  status: "ok" | "no_faces" | "unreadable";
  width: number | null;
  height: number | null;
  sha256: string;
  bytes: number;
  faces: ExtractedFace[];
  models: { detector: string; recognizer: string; opencv: string; preprocessingVersion: string };
}

/**
 * Detect faces in one image and get an embedding per face, proxied through the Stencil
 * backend (OpenCV YuNet and SFace). No keys. Server-side only. Nothing is stored: keep
 * the embeddings you need in your own table, with `models.preprocessingVersion` beside
 * them, and compare with cosine similarity in your own code. This never names a person.
 *
 * An app agent gets the same capability as its built-in `extract_faces` tool, which also
 * handles whole collections; reach for this one in a route that handles one upload.
 */
export function createFaces(env: Env) {
  const backendFetch = createBackendFetch(env);

  return {
    async extract(
      /** The image bytes. Max 25 MB — a larger source is rejected with a 413. */
      source: Blob | ArrayBuffer | Uint8Array,
      contentType?: string,
    ): Promise<FaceExtraction> {
      const type = contentType ?? (source instanceof Blob ? source.type : "") ?? "";
      const res = await backendFetch(`${BACKEND_BASE}/faces/extract`, {
        method: "POST",
        headers: type ? { "Content-Type": type } : {},
        // The current TS lib's generic Uint8Array<ArrayBufferLike> no longer widens to BodyInit - requires casting.
        body: source as BodyInit,
      });
      if (!res.ok) throw new Error(`Face extraction failed: ${await res.text()}`);
      return (await res.json()) as FaceExtraction;
    },
  };
}

export type Faces = ReturnType<typeof createFaces>;
