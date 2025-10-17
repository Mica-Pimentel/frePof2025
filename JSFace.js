// JSFace.js - VERSÃO CORRIGIDA

import { FaceLandmarker, FilesetResolver, DrawingUtils } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";

document.addEventListener("DOMContentLoaded", () => {
    const demosSection = document.getElementById("demos");
    const video = document.getElementById("webcam");
    const enableWebcamButton = document.getElementById("webcamButton");
    
    // Obtenha o canvas e seu contexto 2D
    const canvasElement = document.getElementById("output_canvas");
    const canvasCtx = canvasElement.getContext("2d");

    let faceLandmarker = null;
    let runningMode = "VIDEO";
    let webcamRunning = false;
    let lastVideoTime = -1;

    const initialize = async () => {
        const vision = await FilesetResolver.forVisionTasks(
            "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
        );
        try {
            faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
                    delegate: "GPU"
                },
                outputFaceBlendshapes: true,
                runningMode: runningMode,
                numFaces: 1
            });
            demosSection.classList.remove("invisible");
            console.log("FaceLandmarker pronto");
        } catch (err) {
            console.error("Erro inicializando FaceLandmarker:", err);
            alert("Erro ao carregar modelo. Verifique o console.");
        }
    };
    initialize();

    const hasGetUserMedia = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

    if (hasGetUserMedia()) {
        enableWebcamButton.addEventListener("click", enableCam);
    } else {
        console.warn("getUserMedia() não é suportado pelo seu navegador");
    }

    function enableCam() {
        if (!faceLandmarker) {
            alert("Modelo ainda carregando. Aguarde.");
            return;
        }

        if (webcamRunning) {
            webcamRunning = false;
            enableWebcamButton.innerText = "ENABLE WEBCAM";
            video.srcObject.getTracks().forEach(track => track.stop());
            return;
        }

        webcamRunning = true;
        enableWebcamButton.innerText = "DISABLE WEBCAM";

        const constraints = { video: true };
        navigator.mediaDevices.getUserMedia(constraints)
            .then((stream) => {
                video.srcObject = stream;
                video.addEventListener("loadeddata", predictWebcam);
            })
            .catch((err) => {
                console.error("getUserMedia erro:", err);
            });
    }

    async function predictWebcam() {
        // Ajusta o tamanho do canvas para ser igual ao do vídeo
        canvasElement.width = video.videoWidth;
        canvasElement.height = video.videoHeight;
        
        if (runningMode === "IMAGE") {
            runningMode = "VIDEO";
            await faceLandmarker.setOptions({ runningMode: "VIDEO" });
        }

        let startTimeMs = performance.now();
        if (lastVideoTime !== video.currentTime) {
            lastVideoTime = video.currentTime;
            const results = faceLandmarker.detectForVideo(video, startTimeMs);
            displayVideoDetections(results);
        }

        if (webcamRunning) {
            window.requestAnimationFrame(predictWebcam);
        }
    }

    function displayVideoDetections(results) {
        const drawingUtils = new DrawingUtils(canvasCtx);
        canvasCtx.save();
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

        if (results.faceLandmarks) {
            for (const landmarks of results.faceLandmarks) {
                // Desenha as conexões (a malha do rosto)
                drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_TESSELATION, {
                    color: "#C0C0C070",
                    lineWidth: 1
                });
                // Desenha as linhas dos olhos, sobrancelhas e lábios
                drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE, { color: "#FF3030" });
                drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW, { color: "#FF3030" });
                drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYE, { color: "#30FF30" });
                drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW, { color: "#30FF30" });
                drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_LIPS, { color: "#E0E0E0" });
            }
        }
        canvasCtx.restore();
    }
});
