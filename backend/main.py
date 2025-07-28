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


sim_process = None
mediamtx_process = None
gst_process = None
last_command_time=None


# Allowed origins
origins = ["http://localhost:5173","http://192.168.1.11:5173","http://192.168.1.91:5173"]

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

@sio.event
async def connect(sid, environ):
    print(f'Client connected: {sid}')
    client_tracking[sid] = {
        'last_time': time.time(),
        'tracking': False,
        'task': None
    }
    logger.info(f"Socket connected: {sid}")


@sio.event
async def disconnect(sid):
    print(f'Client disconnected: {sid}')
    if sid in client_tracking:
        task = client_tracking[sid]['task']
        if task:
            task.cancel()
        del client_tracking[sid]
    logger.info(f"Socket disconnected: {sid}")


@sio.event
async def move(sid,data):
    # now = time.time()
    # client = client_tracking.get(sid)
    # if not client:
    #     return
    # client['last_time'] = now
    # if not client['tracking']:
    #     client['tracking'] = True

    #     async def monitor():
    #         start_time = time.time()
    #         while True:
    #             await asyncio.sleep(0.1)
    #             elapsed = time.time() - start_time
    #             gap = time.time() - client['last_time']
                 
    #             if gap > 0.5:
    #                 # Too much delay between moves, reset
    #                 client['tracking'] = False
    #                 break
                
    #             if elapsed >= 3:
    #                 logger.info("hehe")
    #                 client['tracking'] = False
    #                 break
    #     client['task'] = asyncio.create_task(monitor())
    armed=fetchArmed()
    if not armed:
        print(data["dwn"] ,data["yaw"])
        if data["dwn"] < -1.5 :
            await drone.action.arm()
        # if data["dwn"] > 1.5 and data["yaw"] < -15:
        #     await drone.action.disarm()
        
    mode=fetchMode()
    if mode != "OFFBOARD":
        velocities=VelocityBodyYawspeed(0,0,0, 0)
        await drone.offboard.set_velocity_body(velocities)
        await drone.offboard.start()
    velocities=VelocityBodyYawspeed(data["fwd"],data["rgt"],data["dwn"], data["yaw"])
    await drone.offboard.set_velocity_body(velocities)
    logger.info("sending velocities commands")


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
    logger.info("application is starting up")
    logger.info("starting the drone sim ")
    subprocess.run(["pkill", "-f", "px4"])
    env = os.environ.copy()
    
    env["HEADLESS"] = "1"
    sim_process = await asyncio.create_subprocess_exec(
        "make", "px4_sitl", "gazebo-classic_typhoon_h480", 
        cwd="/home/jalaj/PX4-Autopilot", 
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        env=env
    )

    # Log the output from stdout and stderr in separate background tasks
    asyncio.create_task(log_subprocess_output(sim_process.stdout, logger.info))
    asyncio.create_task(log_subprocess_output(sim_process.stderr, logger.error))
    logger.info("started sim connecting drone")



    mediamtx_process = await asyncio.create_subprocess_exec(
        "./mediamtx", 
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )

    # # Log the output from stdout and stderr in separate background tasks
    asyncio.create_task(log_subprocess_output(mediamtx_process.stdout, logger.info))
    asyncio.create_task(log_subprocess_output(mediamtx_process.stderr, logger.error))
    

    gst_process = await asyncio.create_subprocess_exec(
        "gst-launch-1.0", "-v", "udpsrc", "port=5600", "caps=application/x-rtp,media=video,clock-rate=90000,encoding-name=H264", "!", "queue", "!", "rtph264depay", "!", "queue", "!", "avdec_h264", "!", "queue", "!", "videoconvert", "!" ,"queue" ,"!", "x264enc", "tune=zerolatency", "bitrate=2048", "speed-preset=ultrafast", "!", "queue", "!", "mpegtsmux", "!", "queue", "!", "udpsink", "host=0.0.0.0", "port=5700", "sync=false",
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )

    # # Log the output from stdout and stderr in separate background tasks
    asyncio.create_task(log_subprocess_output(gst_process.stdout, logger.info))
    asyncio.create_task(log_subprocess_output(gst_process.stderr, logger.error))
    
    await drone.connect()
    logger.success("connected to the drone")
    logger.info("starting to stream telemetry")
    await streamTelem(drone,sio)


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
