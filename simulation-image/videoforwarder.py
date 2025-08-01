import gi
import os
import uuid
import socket 
gi.require_version('Gst', '1.0')
from gi.repository import Gst, GLib

# Initialize GStreamer
Gst.init(None)

droneId = os.environ.get("DRONE_ID", uuid.uuid4().hex[:8])
ip_address = socket.gethostbyname('dronesim-mediamtx')
# Define the GStreamer pipeline string
# pipeline_str = (
#     "videotestsrc is-live=true ! "
#     "video/x-raw,width=320,height=240,framerate=30/1 ! "
#     "x264enc tune=zerolatency ! "
#     f"rtspclientsink location=rtsp://dronesim-mediamtx:8554/live/{droneId}"
# )




# pipeline_str = (
#     "udpsrc port=5600 caps=application/x-rtp,media=video,clock-rate=90000,encoding-name=H264 ! "
#     "rtph264depay ! h264parse config-interval=1 ! "
#     f"rtspclientsink location=rtsp://dronesim-mediamtx:8554/live/{droneId}"
# )


pipeline_str = (
    "udpsrc port=5600 caps=application/x-rtp,media=video,clock-rate=90000,encoding-name=H264 ! "
    "rtph264depay ! queue ! "
    "avdec_h264 ! videoconvert ! "
    "x264enc tune=zerolatency key-int-max=15 bitrate=2048 speed-preset=ultrafast ! "
    f"rtspclientsink location=rtsp://dronesim-mediamtx:8554/live/{droneId}"
)
# pipeline_str = (
#     "udpsrc port=5600 caps=application/x-rtp,media=video,clock-rate=90000,encoding-name=H264 ! "
#     "rtph264depay ! queue ! "
#     "avdec_h264 ! videoconvert ! queue ! "
#     "x264enc tune=zerolatency bitrate=2048 speed-preset=ultrafast ! "
#     f"rtspclientsink location=rtsp://dronesim-mediamtx:8554/{droneId}"

# )


# Parse and create pipeline
pipeline = Gst.parse_launch(pipeline_str)

# Start pipeline
pipeline.set_state(Gst.State.PLAYING)

# Run GLib MainLoop to keep it alive
loop = GLib.MainLoop()
try:
    print("Streaming to RTSP server... Press Ctrl+C to stop.",flush=True)
    loop.run()
except KeyboardInterrupt:
    print("Stopping pipeline...",flush=True)
    pipeline.set_state(Gst.State.NULL)