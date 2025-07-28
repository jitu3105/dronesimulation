import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { HashLoader, RingLoader } from "react-spinners";

import { toast } from "sonner";

const WebRTCPlayer: React.FC<{ stream: string }> = ({ stream }) => {
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
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

    videoElement.classList.add("w-full");
    videoElement.classList.add("h-full");
    videoElement.classList.add("object-cover");

    // videoElement.addEventListener("play", function () {
    //   // Adjust canvas size to match the video size
    //   canvasElement.width = videoElement.videoWidth;
    //   canvasElement.height = videoElement.videoHeight;

    //   // Call the function to draw the video frame on the canvas
    // });

    // element.classList.add("h-full");
    videoElement.autoplay = true;
    videoElement.muted = true;
    videoElement.controls = false;
    peerConnection.ontrack = (event) => {
      videoElement.onloadedmetadata = () => {
        if (videoContainerRef.current) {
          videoElement.play();
          videoContainerRef.current.replaceChildren(videoElement);
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
    <div className="absolute  w-full  sm:w-4/12 md:w-3/12 top-0 sm:top-4 left-0 sm:left-4 z-10 opacity-80 aspect-video bg-transparent flex rounded-lg overflow-hidden">
      <div
        className="w-full h-full bg-gray-400 flex items-center  justify-center"
        ref={videoContainerRef}
      >
        {error ? (
          <p className="text-red-600">
            {error.includes("no one is publishing to path")
              ? "Live Video Is Not Available"
              : error}
          </p>
        ) : (
          <div className="flex flex-col items-center text-white gap-8 text-2xl">
            <HashLoader size={50} color="#fff" />
            <p>Loading Video...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default WebRTCPlayer;
