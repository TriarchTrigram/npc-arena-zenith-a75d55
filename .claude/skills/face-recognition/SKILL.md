---
name: face-recognition
description: Finding, comparing or grouping people's faces in photos — "which guests appear in which photos", "find every picture of this person", "tag people in the album", "how many different people", face-based de-duplication. Use `~stencil/faces` (one image per call, from a route) or, inside an app agent the brief already earns under the app-agents skill's gate, the built-in `extract_faces` tool for whole collections; a batch of photos with no judgement in it is a background route calling `extract` per image, not an agent. Never build a face-recognition backend, download models, call a vision vendor or run Python in the app for this.
metadata:
  agents: [chat, builder]
---

# Face recognition

Stencil runs face detection (YuNet) and face embeddings (SFace, OpenCV) on its own service.
A built app never ships models, never calls a vision vendor and never needs the app builder to
configure anything. Two doors, same output:

- **`createFaces(env).extract(bytes)`** from `~stencil/faces` — one image per call, server-side
  (an upload action, a loader, a scheduled handler). Max 25 MB.
- **`extract_faces`** — a tool every app agent already has (`app-agents` skill). It takes the
  run's whole collection at once, batches, resumes, and writes the results to a file the agent
  reads with code. Use `extract` for "the photo just uploaded" and for a batch with no
  judgement in it (a background route, one call per image); reach for an agent only when the
  brief clears the `app-agents` skill's "Try these first" gate.

Both return, per face: a bounding box and five landmarks in pixels of the orientation-corrected
image, a detection `score`, `quality` signals (`sharpness`, `brightness`, `relativeSize`) and a
128-float unit-length `embedding`, plus `models.preprocessingVersion`. Cropping a photo so the
face stays in the frame is not this skill: that is `gravity=face` on the image URL (the
`image-transform` skill), with nothing to detect or store. The platform keeps nothing:
no gallery, no person registry. The app owns its records.

## Store embeddings, compare in code

```ts
// app/routes/api.photos.upload.tsx — after the file is saved to storage
import { createFaces } from "~stencil/faces";

const { status, faces, models } = await createFaces(env).extract(await file.arrayBuffer(), file.type);
if (status === "ok") {
  await db.insert(photoFaces).values(
    faces.map((f) => ({
      id: crypto.randomUUID(),
      photoId,
      box: JSON.stringify(f.box),
      score: f.score,
      embedding: JSON.stringify(f.embedding),
      modelVersion: models.preprocessingVersion,
      personId: null, // the app user decides, never the platform
    })),
  );
}
```

Cosine similarity is the dot product of two embeddings (they are unit length). Compare only rows
with the same `modelVersion`. OpenCV's own evaluation calls faces the same person above 0.363;
treat it as a hint: merge on a clear margin (about 0.45 and up), show the app user the pairs in
between, and never chain weak matches (A≈B, B≈C does not make A and C one person). Two distinct
faces in one ordinary photo are two people. Low `score`, low `sharpness` or a tiny
`relativeSize` make an embedding weak.

Keep the person names and groups in the app's tables with a review step for the app user; the
platform never assigns names. Do not reach for `face-api.js`, TensorFlow, a Python service, AWS
Rekognition or a `/api/recognize` route built on them.
