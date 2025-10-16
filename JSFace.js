import { FaceDetector, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

document.addEventListener("DOMContentLoaded", () => {
  const demosSection = document.getElementById("demos");
  const liveView = document.getElementById("liveView");
  const video = document.getElementById("webcam");
  const enableWebcamButton = document.getElementById("webcamButton");

  let faceDetector = null;
  let runningMode = "VIDEO";
  let children = [];
  let lastVideoTime = -1;

  const initializeFaceDetector = async () => {
    try {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
      );
      // tenta GPU, se falhar faz fallback para CPU
      try {
        faceDetector = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
            delegate: "GPU"
          },
          runningMode
        });
        console.log("FaceDetector: delegate GPU");
      } catch (gpuErr) {
        console.warn("GPU delegate falhou, tentando CPU", gpuErr);
        faceDetector = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite",
            delegate: "CPU"
          },
          runningMode
        });
        console.log("FaceDetector: delegate CPU");
      }
      demosSection.classList.remove("invisible");
    } catch (err) {
      console.error("Erro inicializando FaceDetector:", err);
      alert("Erro ao carregar modelo de face. Veja o console.");
    }
  };

  initializeFaceDetector();

  const hasGetUserMedia = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

  if (!hasGetUserMedia()) {
    console.warn("getUserMedia() não suportado pelo navegador");
    enableWebcamButton.disabled = true;
  } else {
    enableWebcamButton.addEventListener("click", enableCam);
  }

  function enableCam() {
    if (!faceDetector) {
      alert("Face detector ainda carregando. Aguarde e tente novamente.");
      return;
    }
    enableWebcamButton.classList.add("removed");
    const constraints = { video: true };
    navigator.mediaDevices.getUserMedia(constraints)
      .then((stream) => {
        video.srcObject = stream;
        video.addEventListener("loadeddata", () => {
          // ajusta tamanho exibido para cálculo correto
          video.play();
          window.requestAnimationFrame(predictWebcam);
        });
      })
      .catch((err) => {
        console.error("Erro ao acessar webcam:", err);
        alert("Não foi possível acessar a webcam. Verifique permissões.");
      });
  }

  async function predictWebcam() {
    if (!video || !faceDetector) {
      window.requestAnimationFrame(predictWebcam);
      return;
    }

    const startTimeMs = performance.now();

    if (video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      try {
        const result = await faceDetector.detectForVideo(video, startTimeMs);
        const detections = result?.detections || [];
        displayVideoDetections(detections);
      } catch (err) {
        console.error("Erro durante detecção:", err);
      }
    }

    window.requestAnimationFrame(predictWebcam);
  }

  function displayVideoDetections(detections) {
    // remove overlays antigos
    for (const child of children) {
      if (child && child.parentNode) child.parentNode.removeChild(child);
    }
    children = [];

    // dimensões reais do vídeo de entrada
    const vidWidth = video.videoWidth || video.offsetWidth;
    const vidHeight = video.videoHeight || video.offsetHeight;
    const dispW = video.offsetWidth;
    const dispH = video.offsetHeight;
    const scaleX = dispW / (vidWidth || dispW);
    const scaleY = dispH / (vidHeight || dispH);

    for (const det of detections) {
      // boundingBox em pixels relativos ao frame de entrada
      const bb = det.boundingBox;
      const x = (bb.originX || 0) * scaleX;
      const y = (bb.originY || 0) * scaleY;
      const w = (bb.width || 0) * scaleX;
      const h = (bb.height || 0) * scaleY;

      // criar highlighter
      const high = document.createElement("div");
      high.className = "highlighter";
      // corrige espelhamento horizontal (video rotacionado com rotateY)
      high.style.left = `${Math.max(0, dispW - (x + w))}px`;
      high.style.top = `${Math.max(0, y)}px`;
      high.style.width = `${Math.max(0, w)}px`;
      high.style.height = `${Math.max(0, h)}px`;
      high.style.position = "absolute";
      liveView.querySelector(".live-wrapper").appendChild(high);
      children.push(high);

      // criar label de confiança
      const p = document.createElement("p");
      const score = det.categories?.[0]?.score ?? 0;
      p.innerText = `Confidence: ${Math.round(score * 100)}%`;
      p.style.position = "absolute";
      p.style.left = `${Math.max(0, dispW - (x + w))}px`;
      p.style.top = `${Math.max(0, y - 22)}px`;
      p.className = "detection-label";
      liveView.querySelector(".live-wrapper").appendChild(p);
      children.push(p);

      // keypoints (se existirem) - x,y normalizados [0..1] em muitos casos
      if (det.keypoints) {
        for (const kp of det.keypoints) {
          const kpEl = document.createElement("span");
          kpEl.className = "key-point";
          // se keypoint.x/y estiverem normalizados (0..1)
          const kx = typeof kp.x === "number" && kp.x <= 1 ? kp.x * dispW : (kp.x || 0) * scaleX;
          const ky = typeof kp.y === "number" && kp.y <= 1 ? kp.y * dispH : (kp.y || 0) * scaleY;
          kpEl.style.left = `${Math.max(0, dispW - kx)}px`; // espelho
          kpEl.style.top = `${Math.max(0, ky)}px`;
          liveView.querySelector(".live-wrapper").appendChild(kpEl);
          children.push(kpEl);
        }
      }
    }
  }
});