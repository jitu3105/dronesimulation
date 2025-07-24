from mavsdk import System
from loguru import logger
import asyncio
import json

async def getPosition(drone:System,sio):
    print(sio)
    await drone.telemetry.set_rate_position(2)
    async for data in drone.telemetry.position():
        jsondata=json.dumps(data.__dict__)
        logger.info(jsondata)
        await sio.emit("telem",jsondata)



async def getAttitude(drone:System,sio):
    print(sio)
    await drone.telemetry.set_rate_attitude_euler(2)
    async for data in drone.telemetry.attitude_euler():
        jsondata=json.dumps(data.__dict__)
        logger.info(jsondata)
        await sio.emit("telem",jsondata)


async def streamTelem(drone:System,sio):
    streamPosition=asyncio.create_task(getPosition(drone,sio))
    streamAttitude=asyncio.create_task(getAttitude(drone,sio))
    asyncio.gather(streamPosition,streamAttitude)