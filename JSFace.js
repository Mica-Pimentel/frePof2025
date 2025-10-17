import { FaceLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0";

document.addEventListener("DOMContentLoaded", () => {
  const demosSection = document.getElementById("demos");
  const liveView = document.getElementById("liveView");
  const video = document.getElementById("webcam");
  const enableWebcamButton = document.getElementById("webcamButton");

  let faceLandmarker = null;
  let runningMode = "VIDEO";
  let children = [];
  let lastVideoTime = -1;

  const initialize = async () => {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
    );
    try {
      faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          // modelo que fornece landmarks (landmarker task)
          modelAssetPath:
            "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
          delegate: "CPU" // troque para "CPU" se necessário
        },
        runningMode: runningMode,
        numFaces: 1 // ajustar conforme necessidade
      });
      demosSection.classList.remove("invisible");
      console.log("FaceLandmarker ready");
    } catch (err) {
      console.error("Erro inicializando FaceLandmarker:", err);
      alert("Erro ao carregar modelo. Ver console.");
    }
  };
  initialize();

  const hasGetUserMedia = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

  if (!hasGetUserMedia()) {
    enableWebcamButton.disabled = true;
  } else {
    enableWebcamButton.addEventListener("click", enableCam);
  }

  function enableCam() {
    if (!faceLandmarker) {
      alert("Modelo ainda carregando. Aguarde.");
      return;
    }
    enableWebcamButton.classList.add("removed");
    const constraints = {
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
      audio: false
    };
    navigator.mediaDevices.getUserMedia(constraints)
      .then((stream) => {
        video.srcObject = stream;
        video.playsInline = true;
        video.play();
        video.addEventListener("loadeddata", () => {
          window.requestAnimationFrame(predictWebcam);
        });
      })
      .catch((err) => {
        console.error("getUserMedia erro:", err);
        alert("Não foi possível acessar a câmera.");
      });
  }

  async function predictWebcam() {
    if (!video || !faceLandmarker) {
      window.requestAnimationFrame(predictWebcam);
      return;
    }
    const startTimeMs = performance.now();
    if (video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      try {
        const result = await faceLandmarker.detectForVideo(video, startTimeMs);
        console.log("landmarker result:", result); // verifique aqui no console do celular / remoto
        const faces = result?.faceLandmarks || result?.faces || []; // checar estrutura
        displayVideoDetections(result);
      } catch (err) {
        console.error("Erro detectForVideo:", err);
      }
    }
    window.requestAnimationFrame(predictWebcam);
  }

  function displayVideoDetections(result) {
    // implementar renderização de bounding boxes / keypoints similar ao exemplo anterior
    // use console.log(result) para ver onde os landmarks estão no objeto retornado
  }
});
