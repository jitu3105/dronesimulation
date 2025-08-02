import uvicorn
import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mavsdk import System
from mavsdk.offboard import VelocityBodyYawspeed
from loguru import logger
import socketio
from src.telem import streamTelem ,fetchArmed, fetchMode
import subprocess
import os
import time
import uuid
import docker
import redis.asyncio as redis
import json



sim_process = None
mediamtx_process = None
gst_process = None
last_command_time=None

redis_listener_task = None


# Allowed origins
origins = ["http://localhost:5173","http://192.168.1.11:5173","http://192.168.1.91:5173","http://jalajghuge.co.in:5173"]

# Create the drone instance
drone:System = System(port=5052)

# Create FastAPI app
fastapi_app = FastAPI()



async def log_subprocess_output(stream, logger_func):
    while True:
        line = await stream.readline()
        if line:
            logger_func(line.decode().strip())
        else:
            break



# Apply CORS middleware ONLY to FastAPI
fastapi_app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# FastAPI route
@fastapi_app.get("/arm")
async def arm():
    await drone.action.arm()
    logger.info("Arming the drone")
    return {"status": "arming"}

# Create Socket.IO server
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins=origins
)




# To keep per-client tracking info
client_tracking = {}

r = redis.Redis(host="dronesim-redis", port=6379, db=0)


async def telem_listener(sio):
    r = redis.Redis(host="dronesim-redis", port=6379, db=0, decode_responses=True)
    pubsub = r.pubsub()
    await pubsub.psubscribe("telem:*")
    await pubsub.psubscribe("status:*")
    logger.info("✅ Subscribed to telem:* channels")

    try:
        async for message in pubsub.listen():
            if message["type"] == "pmessage":
                room=message["channel"]
                data=message['data']
                # logger.info(f"📡 {room}: {data}")
                data=json.loads(data)
                if "telem" in message["channel"]:
                    await sio.emit("telem", data, room=room)
                    await sio.emit("others", {room:data})
                if "status" in message["channel"]:
                    logger.info("got Status")
                    await sio.emit("status", data, room=room)
    except asyncio.CancelledError:
        logger.warning("🛑 Redis listener cancelled")
    finally:
        logger.error("===============FINALLY OF TELEM LISTENER===============")
        await pubsub.close()


@sio.event
async def connect(sid, environ):
    logger.info(f"Socket connected: {sid}")
    logger.info(f"creating a simulation for {sid}")
    await sio.save_session(sid, {"room": [f"telem:{sid}",f"status:{sid}"]})
    await sio.enter_room(sid, f"telem:{sid}")
    await sio.enter_room(sid, f"status:{sid}")
    client = docker.from_env()
    droneId=sid
    container_name = f"drone-sim-{sid}"
    logger.info(container_name)
    try:
        client.containers.run(
            image="px4-typhoon",
            name=container_name,
            network="drone-sim-network",
            detach=True,
            remove=True,
            environment={
                "DRONE_ID": droneId
            },
        )
    except Exception as e:
        logger.error(e)



@sio.event
async def disconnect(sid):
    print(f'Client disconnected: {sid}')
    client = docker.from_env()
    container = client.containers.get(f"drone-sim-{sid}")  # use container name or ID
    container.kill()  # force stop immediately
    print("Container forcefully stopped.")
    logger.info(f"Socket disconnected: {sid}")


@sio.event
async def move(sid,data):
    global r 
    jsondata=json.dumps(data)
    channel=f"controls:{sid}"
    logger.info("channel = "+channel)
    await r.publish(channel,jsondata)
    logger.info("sending velocities commands = "+jsondata)
    


@sio.event
async def message(sid, data):
    logger.info(f"Message from {sid}: {data}")
    await sio.emit("message", f"Echo: {data}")

# Wrap both FastAPI and Socket.IO in a unified ASGI app
app = socketio.ASGIApp(
    socketio_server=sio,
    other_asgi_app=fastapi_app,
    socketio_path="/ws/socket.io"  # important
)

# You can optionally connect the drone and start telemetry here
@fastapi_app.on_event("startup")
async def on_startup():
    global redis_listener_task
    logger.info("application is starting up")
    redis_listener_task = asyncio.create_task(telem_listener(sio))


    # mediamtx_process = await asyncio.create_subprocess_exec(
    #     "./mediamtx", 
    #     stdout=asyncio.subprocess.PIPE,
    #     stderr=asyncio.subprocess.PIPE,
    # )

    # # Log the output from stdout and stderr in separate background tasks
    # asyncio.create_task(log_subprocess_output(mediamtx_process.stdout, logger.info))
    # asyncio.create_task(log_subprocess_output(mediamtx_process.stderr, logger.error))
    

    # gst_process = await asyncio.create_subprocess_exec(
    #     "gst-launch-1.0", "-v", "udpsrc", "port=5600", "caps=application/x-rtp,media=video,clock-rate=90000,encoding-name=H264", "!", "queue", "!", "rtph264depay", "!", "queue", "!", "avdec_h264", "!", "queue", "!", "videoconvert", "!" ,"queue" ,"!", "x264enc", "tune=zerolatency", "bitrate=2048", "speed-preset=ultrafast", "!", "queue", "!", "mpegtsmux", "!", "queue", "!", "udpsink", "host=0.0.0.0", "port=5700", "sync=false",
    #     stdout=asyncio.subprocess.PIPE,
    #     stderr=asyncio.subprocess.PIPE,
    # )

    # # Log the output from stdout and stderr in separate background tasks
    # asyncio.create_task(log_subprocess_output(gst_process.stdout, logger.info))
    # asyncio.create_task(log_subprocess_output(gst_process.stderr, logger.error))
    
    # await drone.connect()
    # logger.success("connected to the drone")
    # logger.info("starting to stream telemetry")
    # await streamTelem(drone,sio)


@fastapi_app.on_event("shutdown")
async def on_shutdown():
    logger.info("Shutting down gracefully...")

    for name, process in [("PX4 sim", sim_process), ("MediaMTX", mediamtx_process), ("GStreamer", gst_process)]:
        if process and process.returncode is None:
            logger.info(f"Terminating {name}")
            process.terminate()
            try:
                await asyncio.wait_for(process.wait(), timeout=5)
                logger.success(f"{name} terminated")
            except asyncio.TimeoutError:
                logger.warning(f"{name} did not exit in time, killing it")
                process.kill()

    logger.info("Shutdown complete.")

# Entry point
if __name__ == "__main__":
    try:
        # uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
        uvicorn.run("main:app", host="0.0.0.0", port=8000)
    except KeyboardInterrupt:
        logger.info("Interrupted! Exiting gracefully.")
