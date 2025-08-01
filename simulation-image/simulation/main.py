import uvicorn
import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mavsdk import System
from mavsdk.offboard import VelocityBodyYawspeed
from loguru import logger
from src.telem import streamTelem ,fetchArmed, fetchMode
import subprocess
import os
import uuid
import socket
import redis

last_command_time=None



px4_sim_process = None


# Allowed origins
origins = ["http://localhost:5173","http://192.168.1.11:5173","http://192.168.1.91:5173"]

# Create FastAPI app
app = FastAPI()



async def log_subprocess_output(stream, logger_func):
    while True:
        line = await stream.readline()
        if line:
            logger_func(line.decode().strip())
        else:
            break



# Apply CORS middleware ONLY to FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def read_stream_and_log(stream, log_func, prefix="SIM"):
    """
    Asynchronously reads lines from an asyncio stream and logs them.
    """
    while True:
        try:
            line = await stream.readline()
            if not line:
                break
            try:
                decoded = line.decode("utf-8", errors="ignore").strip()
                if decoded:
                    log_func(f"[{prefix}] {decoded}")
            except Exception as decode_err:
                log_func(f"[{prefix}] Decode error: {decode_err}")
        except asyncio.CancelledError:
            break # Exit if the task is cancelled
        except Exception as e:
            log_func(f"[{prefix}] Error reading stream: {e}")
            break


# async def command_listener(sio):
#     r = redis.Redis(host="dronesim-redis", port=6379, db=0)
#     pubsub = r.pubsub()
#     await pubsub.psubscribe("command:*")
#     logger.info("✅ Subscribed to telem:* channels")

#     try:
#         async for message in pubsub.listen():
#             if message["type"] == "pmessage":
#                 room=message["channel"].decode("utf-8")
#                 data=message['data'].decode("utf-8")
#                 # logger.info(f"📡 {room}: {data}")
#                 data=json.loads(data)
#                 await sio.emit("telem", data, room=room)

#     except asyncio.CancelledError:
#         logger.warning("🛑 Redis listener cancelled")
#     finally:
#         logger.error("===============FINALLY OF TELEM LISTENER===============")
#         await pubsub.close()



def get_free_udp_port():
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        s.bind(('', 0))
        return s.getsockname()[1]

def send_px4_command(proc: subprocess.Popen, command: str):
    """
    Sends a command to the PX4 shell via stdin and optionally logs it.
    """
    if proc.stdin:
        proc.stdin.write(command + "\n")
        proc.stdin.flush()
        print(f"[PX4-CMD] Sent: {command}",flush=True)
    else:
        print("[ERROR] Cannot write to PX4 stdin.",flush=True)

async def wait_for_sim_connection( retries: int = 60, delay: float = 10.0):
    for attempt in range(retries):
        try:
            logger.info(f"trying to connect {attempt}")
            drone = System()
            await drone.connect()
            async for state in drone.core.connection_state():
                if state.is_connected:
                    logger.success(f"Connected to drone on udp://localhost:14580")
                    return drone
                else:
                    await asyncio.sleep(1)
        except Exception as e:
            logger.warning(f"sim is not up yet trying in {delay} seconds {attempt}")
            await asyncio.sleep(delay)

    raise TimeoutError("Drone sim did not come up in time")



# You can optionally connect the drone and start telemetry here
@app.on_event("startup")
async def on_startup():
    try:
        r = redis.Redis(host="dronesim-redis", port=6379, db=0)
        r.ping()
        logger.success("✅ Redis connected")
    except Exception as e:
        logger.error(f"❌ Redis connection error: {e}")
    
    logger.info("Attempting to connect to the drone's telemetry...")
    try:
        droneId = os.environ.get("DRONE_ID", uuid.uuid4().hex[:8])
        try:
            drone = await wait_for_sim_connection()
            logger.info("========drone connected=======")
            await streamTelem(drone=drone,logger=logger,redis=r,droneId=droneId)
        except TimeoutError as e:
            logger.error(e)


    except Exception as e:
        logger.error(f"Startup failed: {e}")





@app.on_event("shutdown")
async def on_shutdown():
    logger.info("Shutting down gracefully...")

    # for name, process in [("PX4 sim", sim_process), ("MediaMTX", mediamtx_process), ("GStreamer", gst_process)]:
    #     if process and process.returncode is None:
    #         logger.info(f"Terminating {name}")
    #         process.terminate()
    #         try:
    #             await asyncio.wait_for(process.wait(), timeout=5)
    #             logger.success(f"{name} terminated")
    #         except asyncio.TimeoutError:
    #             logger.warning(f"{name} did not exit in time, killing it")
    #             process.kill()
    logger.info("Shutdown complete.")

# Entry point
if __name__ == "__main__":
    try:
        uvicorn.run("main:app", host="0.0.0.0", port=8000)
    except KeyboardInterrupt:
        logger.info("Interrupted! Exiting gracefully.")
