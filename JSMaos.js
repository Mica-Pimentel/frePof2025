import { GestureRecognizer, FilesetResolver, DrawingUtils } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3";



const demosSection = document.getElementById("demos");
let gestureRecognizer;
let runningMode = "VIDEO"; // Mudado para VIDEO para consistência
let enableWebcamButton;
let webcamRunning = false;

const video = document.getElementById("webcam");
const canvasElement = document.getElementById("output_canvas");
const canvasCtx = canvasElement.getContext("2d");
const gestureOutput = document.getElementById("gesture_output");

// Função para criar o reconhecedor de gestos
const createGestureRecognizer = async () => {
    const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm");
    gestureRecognizer = await GestureRecognizer.createFromOptions(vision, {
        baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
            delegate: "GPU",
        },
        runningMode: runningMode,
        numHands: 2
    });
    demosSection.classList.remove("invisible");
};
createGestureRecognizer();

// Verifica se o acesso à webcam é suportado
function hasGetUserMedia() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}

if (hasGetUserMedia()) {
    enableWebcamButton = document.getElementById("webcamButton");
    enableWebcamButton.addEventListener("click", enableCam);
} else {
    console.warn("getUserMedia() não é suportado pelo seu navegador");
}

// Ativa a visualização da webcam e inicia a detecção.
function enableCam(event) {
    if (!gestureRecognizer) {
        alert("Por favor, aguarde o modelo carregar.");
        return;
    }
    if (webcamRunning === true) {
        webcamRunning = false;
        enableWebcamButton.innerText = "ENABLE PREDICTIONS";
        video.srcObject.getTracks().forEach(track => track.stop());
        gestureOutput.style.display = "none";
        canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

    } else {
        webcamRunning = true;
        enableWebcamButton.innerText = "DISABLE PREDICTIONS";
        const constraints = { video: true };
        navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
            video.srcObject = stream;
            video.addEventListener("loadeddata", predictWebcam);
        });
    }
}

let lastVideoTime = -1;
let results = undefined;
async function predictWebcam() {
    // Agora vamos começar a detectar o stream.
    if (runningMode === "IMAGE") { // Garante que o modo está correto
        runningMode = "VIDEO";
        await gestureRecognizer.setOptions({ runningMode: "VIDEO" });
    }
    let nowInMs = Date.now();
    if (video.currentTime !== lastVideoTime) {
        lastVideoTime = video.currentTime;
        results = gestureRecognizer.recognizeForVideo(video, nowInMs);
    }

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    const drawingUtils = new DrawingUtils(canvasCtx);

    // Ajusta o tamanho do canvas para o tamanho real do vídeo
    canvasElement.height = video.videoHeight;
    canvasElement.width = video.videoWidth;

    if (results.landmarks) {
        for (const landmarks of results.landmarks) {
            drawingUtils.drawConnectors(landmarks, GestureRecognizer.HAND_CONNECTIONS, { color: "#00FF00", lineWidth: 5 });
            drawingUtils.drawLandmarks(landmarks, { color: "#FF0000", lineWidth: 2 });
        }
    }
    canvasCtx.restore();
    
    // --- LÓGICA DE EXIBIÇÃO COM A CORREÇÃO APLICADA ---
    if (results.gestures.length > 0) {
        gestureOutput.style.display = "block";
        let outputText = "";

        for (let i = 0; i < results.gestures.length; i++) {
            const categoryName = results.gestures[i][0].categoryName;
            const categoryScore = parseFloat(results.gestures[i][0].score * 100).toFixed(2);
            let handedness = results.handednesses[i][0].displayName;

            // *** AQUI ESTÁ A CORREÇÃO PRINCIPAL ***
            // Inverte a etiqueta para corresponder à visão do usuário na imagem espelhada.
            if (handedness === "Left") {
                handedness = "Direita";
            } else if (handedness === "Right") {
                handedness = "Esquerda";
            }

            outputText += `Mão: ${handedness}\nGesto: ${categoryName}\nConfiança: ${categoryScore} %\n\n`;
        }
        gestureOutput.innerText = outputText;

    } else {
        gestureOutput.style.display = "none";
    }

    if (webcamRunning === true) {
        window.requestAnimationFrame(predictWebcam);
    }
}
