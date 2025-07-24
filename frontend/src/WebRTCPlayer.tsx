import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { RingLoader } from "react-spinners";

import { toast } from "sonner";
function getScaledPosition(
  clientX: number,
  clientY: number,
  canvas: HTMLCanvasElement
) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;

  return {
    mouseX: (clientX - rect.left) * scaleX,
    mouseY: (clientY - rect.top) * scaleY,
  };
}
const WebRTCPlayer: React.FC<{ stream: string }> = ({ stream }) => {
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const isDrawing = useRef(false);
  const startX = useRef(NaN);
  const startY = useRef(NaN);
  const rectX = useRef(NaN);
  const rectY = useRef(NaN);
  const rectWidth = useRef(NaN);
  const rectHeight = useRef(NaN);
  const [confirmFollow, setConfirmFollow] = useState(false);
  const isCancelled = useRef(false);
  // const socket = useSocket(DETECTIONS_URL, "/ws/detections", {
  //   streamId: stream,
  // });
  // useEffect(() => {
  //   if (socket) {
  //     socket.on("detection", (detection: any) => {
  //       console.log(detection);
  //     });
  //   }
  // }, [socket]);
  useEffect(() => {
    const peerConnection = new RTCPeerConnection();
    peerConnection.addTransceiver("video", { direction: "recvonly" });
    peerConnection.onconnectionstatechange = (state) => {
      console.log(state);
    };
    const videoElement = document.createElement("video");
    const canvasElement = document.createElement("canvas");
    const context = canvasElement.getContext("2d");

    videoElement.classList.add("w-full");
    videoElement.classList.add("max-h-full");
    videoElement.classList.add("object-contain");

    canvasElement.classList.add("w-full");
    canvasElement.classList.add("max-h-full");
    canvasElement.classList.add("object-contain");

    canvasElement.addEventListener("click", function (e) {
      const { mouseX, mouseY } = getScaledPosition(
        e.clientX,
        e.clientY,
        canvasElement
      );
      console.log(mouseX, mouseY);
      setConfirmFollow(true);
      // isDrawing.current = false; // Finish the rectangle drawing
      // setConfirmFollow(true);
    });

    videoElement.addEventListener("play", function () {
      // Adjust canvas size to match the video size
      canvasElement.width = videoElement.videoWidth;
      canvasElement.height = videoElement.videoHeight;

      // Call the function to draw the video frame on the canvas
      drawFrame();
    });

    function drawFrame() {
      if (videoElement.paused || videoElement.ended) return; // Stop if the video is paused or ended

      // Draw the current video frame on the canvas
      if (context) {
        context.drawImage(
          videoElement,
          0,
          0,
          canvasElement.width,
          canvasElement.height
        );
        if (
          isDrawing &&
          rectX.current &&
          rectY.current &&
          rectWidth.current &&
          rectHeight.current
        ) {
          context.fillStyle = "rgba(255, 0, 0, 0.5)"; // Set the fill color (red with 50% opacity)
          context.fillRect(
            rectX.current,
            rectY.current,
            rectWidth.current,
            rectHeight.current
          ); // Draw the rectangle
        }
      }

      // Call drawFrame again to keep updating the canvas
      requestAnimationFrame(drawFrame);
    }

    // element.classList.add("h-full");
    videoElement.autoplay = true;
    videoElement.muted = true;
    videoElement.controls = false;
    peerConnection.ontrack = (event) => {
      videoElement.onloadedmetadata = () => {
        if (videoContainerRef.current) {
          videoElement.play();
          videoContainerRef.current.replaceChildren(videoElement);
          // videoContainerRef.current.replaceChildren(canvasElement);
        }
      };
      videoElement.srcObject = event.streams[0];
    };

    const startWebRTC = async () => {
      try {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        peerConnection.oniceconnectionstatechange = () => {
          console.log(
            "ICE Connection State:",
            peerConnection.iceConnectionState
          );
        };
        peerConnection.onicecandidateerror = (event) => {
          console.error("ICE Candidate Error:", event.errorText);
        };
        const res = await axios.post(
          `http://${location.hostname}:8889/${stream}/whep`,
          offer.sdp, // raw string, not JSON
          {
            headers: {
              "Content-Type": "application/sdp",
              Accept: "application/sdp",
            },
            transformRequest: [(data) => data], // prevent Axios from auto-stringifying
            responseType: "text",
          }
        );
        const remoteDesc = new RTCSessionDescription({
          type: "answer",
          sdp: res.data,
        });
        await peerConnection.setRemoteDescription(remoteDesc);
      } catch (err: any) {
        if (err.response && err.response.data) {
          try {
            const data = JSON.parse(err.response.data);
            if (data.error) {
              setError(data.error);
            }
          } catch (err) {
            console.log(err);
          }
        }
        toast.warning("stream not found retrying in 5 seconds.!");
        await new Promise((resolve) =>
          setTimeout(() => {
            if (!isCancelled.current) {
              resolve(startWebRTC());
            }
            resolve(true);
          }, 5000)
        );
        console.log(err);
      }
    };
    startWebRTC();

    return () => {
      peerConnection.close();
      isCancelled.current = true;
    };
  }, [stream]);

  return (
    <div className="relative w-full h-full bg-transparent flex">
      <div
        className="w-full h-full bg-gray-900 flex items-center  justify-center"
        ref={videoContainerRef}
      >
        {error ? (
          <p className="text-red-600">
            {error.includes("no one is publishing to path")
              ? "Live Video Is Not Available"
              : error}
          </p>
        ) : (
          <RingLoader size={90} color="#fff" />
        )}
      </div>
    </div>
  );
};

export default WebRTCPlayer;
