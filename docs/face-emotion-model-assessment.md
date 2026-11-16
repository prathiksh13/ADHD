# Supplied face model assessment

Inspected `face_emotion_models/` on 2026-11-16. It contains only three JSON files:

- `tiny_face_detector_model-weights_manifest.json` references the absent
  `tiny_face_detector_model-shard1`.
- `face_expression_model-weights_manifest.json` references the absent
  `face_expression_model-shard1`.
- `facialemotionmodel.json` is a Keras Sequential architecture (48×48 grayscale
  input, seven output classes), without trained weights, class mapping or browser
  conversion metadata.

These files are insufficient for inference or a measured accuracy comparison.
The first two are face-api.js detection/expression manifests; neither supplies
iris landmarks or a trained gaze-distraction classifier. Their runtime requires
the corresponding trained shards, as described in the
[face-api.js model-loading documentation](https://github.com/justadudewhohacks/face-api.js#loading-the-models).
No identity recognition was added and no weights were downloaded speculatively.

The existing locally served MediaPipe FaceLandmarker remains the runtime. The
fix addresses timing resets during slow inference, personal screen-facing
calibration, roll-corrected iris geometry, blink/dropout handling and gaze
hysteresis. All processing remains in the browser, with no raw frames saved.
Synthetic regression checks verify these failure modes; they do not establish
human gaze accuracy or demonstrate superiority over a different trained model.
