import { FaceLandmarker, FilesetResolver, DrawingUtils } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";

document.addEventListener("DOMContentLoaded", () => {
    const demosSection = document.getElementById("demos");
    const video = document.getElementById("webcam");
    const enableWebcamButton = document.getElementById("webcamButton");
    
    const canvasElement = document.getElementById("output_canvas");
    const canvasCtx = canvasElement.getContext("2d");
    
    // Elemento para mostrar a expressão
    const expressionOutput = document.getElementById("expression_output");

    let faceLandmarker = null;
    let runningMode = "VIDEO";
    let webcamRunning = false;
    let lastVideoTime = -1;

    // Função para inicializar o modelo FaceLandmarker
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
                outputFaceBlendshapes: true, // Habilitado para obter dados de expressão
                runningMode: runningMode,
                numFaces: 1
            });
            demosSection.classList.remove("invisible");
        } catch (err) {
            console.error("Erro inicializando FaceLandmarker:", err);
            alert("Erro ao carregar modelo. Verifique o console.");
        }
    };
    initialize();

    const hasGetUserMedia = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);

    if (hasGetUserMedia()) {
        enableWebcamButton.addEventListener("click", enableCam);
    }

    // Função para ligar/desligar a webcam
    function enableCam() {
        if (!faceLandmarker) {
            alert("Modelo ainda carregando. Aguarde.");
            return;
        }

        if (webcamRunning) {
            webcamRunning = false;
            enableWebcamButton.innerText = "ATIVAR WEBCAM";
            video.srcObject.getTracks().forEach(track => track.stop());
            expressionOutput.innerText = "";
            canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height); // Limpa o canvas
            return;
        }

        webcamRunning = true;
        enableWebcamButton.innerText = "DESATIVAR WEBCAM";

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

    // Loop de predição contínuo
    async function predictWebcam() {
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
            displayExpression(results.faceBlendshapes);
        }

        if (webcamRunning) {
            window.requestAnimationFrame(predictWebcam);
        }
    }

    // Função para desenhar a malha do rosto
    function displayVideoDetections(results) {
        const drawingUtils = new DrawingUtils(canvasCtx);
        canvasCtx.save();
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

        if (results.faceLandmarks) {
            for (const landmarks of results.faceLandmarks) {
                drawingUtils.drawConnectors(landmarks, FaceLandmarker.FACE_LANDMARKS_TESSELATION, { color: "#C0C0C070", lineWidth: 1 });
            }
        }
        canvasCtx.restore();
    }

    // Função para interpretar e exibir a expressão
    function displayExpression(blendshapes) {
        if (!blendshapes || blendshapes.length === 0) {
            expressionOutput.innerText = "Nenhum rosto detectado";
            return;
        }

        const categories = blendshapes[0].categories;
        
        let expression = "Neutro";
        const threshold = 0.5; // Limite para considerar uma expressão

        const smileScore = (categories.find(c => c.categoryName === 'mouthSmileLeft')?.score ?? 0) + (categories.find(c => c.categoryName === 'mouthSmileRight')?.score ?? 0);
        const jawOpenScore = categories.find(c => c.categoryName === 'jawOpen')?.score ?? 0;
        const browDownScore = (categories.find(c => c.categoryName === 'browDownLeft')?.score ?? 0) + (categories.find(c => c.categoryName === 'browDownRight')?.score ?? 0);

        if (smileScore > threshold) {
            expression = "Feliz 😄";
        } else if (jawOpenScore > 0.6) {
            expression = "Surpreso 😮";
        } else if (browDownScore > threshold) {
            expression = "Bravo 😠";
        }
        
        expressionOutput.innerText = `Expressão: ${expression}`;
    }
});
