# sitecustomize.py — runs before any user code or imports.
# Suppresses ONNX Runtime's GPU device-discovery warning on CPU-only hosts
# (e.g. Render free tier). We use CPUExecutionProvider explicitly, so the
# "[W:onnxruntime] GPU device discovery failed" message is pure noise.
import os
os.environ.setdefault("ORT_LOGGING_LEVEL", "3")
