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
import json
import redis.asyncio as redis


last_command_time=None



px4_sim_process = None


commandListenerAsync=None
streamTelemAsync=None


# Allowed origins
origins = ["http://localhost:5173","http://192.168.1.11:5173","http://192.168.1.91:5173"]

# Create FastAPI app
app = FastAPI()

drone:System =None

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

async def command_listener():
    logger.info("fetching droneId")
    droneId = os.environ.get("DRONE_ID", uuid.uuid4().hex[:8])
    logger.info("droneId = "+droneId)
    r = redis.Redis(host="dronesim-redis", port=6379, db=0, decode_responses=True)
    pubsub = r.pubsub()
    controlsChannel=f"controls:{droneId}"
    commandsChannel=f"commands:{droneId}"
    await pubsub.subscribe(commandsChannel)
    await pubsub.subscribe(controlsChannel)
    logger.info("✅ Subscribed to "+commandsChannel)
    logger.info("✅ Subscribed to "+controlsChannel)

    try:
        async for message in pubsub.listen():
            if message["type"] == "message":
                if message["channel"]==controlsChannel:
                    data=message['data']
                    logger.info("controls")
                    try:
                        data = json.loads(message['data'])
                        armed=fetchArmed()
                        if not armed:
                            print(data["dwn"] ,data["yaw"])
                            # PX4 body Z is NED: throttle-up is a negative dwn value.
                            if data["dwn"] < -1.5 :
                                await drone.action.arm()
                            # if data["dwn"] > 1.5 and data["yaw"] < -15:
                            #     await drone.action.disarm()
                            
                        mode=fetchMode()
                        if mode != "OFFBOARD":
                            velocities=VelocityBodyYawspeed(0,0,0, 0)
                            await drone.offboard.set_velocity_body(velocities)
                            try:
                                await drone.offboard.start()
                            except Exception as offboard_error:
                                logger.error(f"Offboard start failed: {offboard_error}")
                                continue
                        velocities=VelocityBodyYawspeed(data["fwd"],data["rgt"],data["dwn"],data["yaw"])
                        await drone.offboard.set_velocity_body(velocities)
                    except json.JSONDecodeError:
                        logger.warning(f"Malformed JSON in {message['channel']}: {message['data']}")
                        continue
                    logger.info(data)
                if message["channel"]==commandsChannel:
                    data=message['data'].decode("utf-8")
                    # logger.info(f"📡 {room}: {data}")
                    logger.info("command")
                    data=json.loads(data)
                    logger.info(data)

    except asyncio.CancelledError:
        logger.warning("🛑 Redis listener cancelled")
    finally:
        logger.error("===============FINALLY OF TELEM LISTENER===============")
        # await pubsub.close()



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
    global drone
    for attempt in range(retries):
        try:
            logger.info(f"trying to connect {attempt}")
            drn = System()
            await drn.connect()
            async for state in drn.core.connection_state():
                if state.is_connected:
                    logger.success(f"Connected to drone")
                    drone=drn
                    return drn
                else:
                    await asyncio.sleep(1)
        except Exception as e:
            logger.warning(f"sim is not up yet trying in {delay} seconds {attempt}")
            await asyncio.sleep(delay)

    raise TimeoutError("Drone sim did not come up in time")



# You can optionally connect the drone and start telemetry here
@app.on_event("startup")
async def on_startup():
    global commandListenerAsync
    global streamTelemAsync
    try:
        r = redis.Redis(host="dronesim-redis", port=6379, db=0)
        await r.ping()
        logger.success("✅ Redis connected")
    except Exception as e:
        logger.error(f"❌ Redis connection error: {e}")
    
    logger.info("Attempting to connect to the drone's telemetry...")
    try:
        droneId = os.environ.get("DRONE_ID", uuid.uuid4().hex[:8])
        try:
            drone = await wait_for_sim_connection()
            logger.info("========drone connected=======")
            commandListenerAsync= asyncio.create_task(command_listener())
            streamTelemAsync= asyncio.create_task(streamTelem(drone=drone,logger=logger,redis=r,droneId=droneId))
        except TimeoutError as e:
            logger.error(e)
        logger.success("✅  Startup completed...")



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
