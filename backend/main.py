import uvicorn
from fastapi import FastAPI
from loguru import logger
from mavsdk import System
from fastapi.middleware.cors import CORSMiddleware
import subprocess
import os
import asyncio
import socketio
from src.telem import streamTelem


origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "*",  # ⚠️ Use "*" only for development; not safe in production
]

sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins=origins  )
sio_app = socketio.ASGIApp(sio)

drone=System(port=5052)

app=FastAPI()


app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # 👈 CORS for FastAPI
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/ws", sio_app)

async def log_subprocess_output(stream, logger_func):
    while True:
        line = await stream.readline()
        if line:
            logger_func(line.decode().strip())
        else:
            break

@app.on_event("startup")
async def startup_event():
    logger.info("application is starting up")
    logger.info("starting the drone sim ")
    subprocess.run(["pkill", "-f", "px4"])
    env = os.environ.copy()
    
    env["HEADLESS"] = "1"
    process = await asyncio.create_subprocess_exec(
        "make", "px4_sitl", "gazebo-classic_typhoon_h480", 
        cwd="/home/jalaj/PX4-Autopilot", 
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env=env
    )

    # Log the output from stdout and stderr in separate background tasks
    asyncio.create_task(log_subprocess_output(process.stdout, logger.info))
    asyncio.create_task(log_subprocess_output(process.stderr, logger.error))
    logger.info("started sim connecting drone")



    process2 = await asyncio.create_subprocess_exec(
        "./mediamtx", 
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )

    # # Log the output from stdout and stderr in separate background tasks
    asyncio.create_task(log_subprocess_output(process2.stdout, logger.info))
    asyncio.create_task(log_subprocess_output(process2.stderr, logger.error))
    

    process3 = await asyncio.create_subprocess_exec(
        "gst-launch-1.0", "-v", "udpsrc", "port=5600", "caps=application/x-rtp,media=video,clock-rate=90000,encoding-name=H264", "!", "queue", "!", "rtph264depay", "!", "queue", "!", "avdec_h264", "!", "queue", "!", "videoconvert", "!" ,"queue" ,"!", "x264enc", "tune=zerolatency", "bitrate=2048", "speed-preset=ultrafast", "!", "queue", "!", "mpegtsmux", "!", "queue", "!", "udpsink", "host=0.0.0.0", "port=5700", "sync=false",
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )

    # # Log the output from stdout and stderr in separate background tasks
    asyncio.create_task(log_subprocess_output(process3.stdout, logger.info))
    asyncio.create_task(log_subprocess_output(process3.stderr, logger.error))
    
    await drone.connect()
    logger.success("connected to the drone")
    logger.info("starting to stream telemetry")
    await streamTelem(drone,sio)
    




@app.get("/arm")
async def arm():
    await drone.action.arm()
    logger.info("arming the drone")

@sio.event
async def connect(sid, environ):
    print("Socket connected:", sid)

@sio.event
async def disconnect(sid):
    print("Socket disconnected:", sid)

@sio.event
async def message(sid, data):
    print(f"Message from {sid}: {data}")
    await sio.emit("message", f"Echo: {data}")

if __name__ == "__main__":
    # uvicorn.run("main:app",reload=True)
    uvicorn.run("main:app")
