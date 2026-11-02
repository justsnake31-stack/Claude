# On-device OCR engine

- `paddle.bundle.js` — [@paddleocr/paddleocr-js](https://www.npmjs.com/package/@paddleocr/paddleocr-js) 0.4.2 (Apache-2.0)
  bundled with OpenCV.js (Apache-2.0), clipper-lib, js-yaml and onnxruntime-web 1.31.1 (MIT, CPU/WASM build):
  `esbuild entry.js --bundle --format=esm --minify --external:fs --external:path --external:crypto --alias:onnxruntime-web=onnxruntime-web/wasm`
- `ort/` — onnxruntime-web 1.31.1 WebAssembly runtime.
- `models/` — official PaddleOCR PP-OCRv5 models (Apache-2.0): `PP-OCRv5_mobile_det` (text detection) and
  `eslav_PP-OCRv5_mobile_rec` (East Slavic: Russian/Ukrainian/Belarusian + Latin, text recognition),
  from paddle-model-ecology.bj.bcebos.com/paddlex/official_inference_model/paddle3.0.0/.
