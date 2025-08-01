from mavsdk import System
from loguru import logger
import asyncio
import json
from redis import Redis

armed=None
mode= None

def fetchArmed():
    global armed
    return armed

def fetchMode():
    global mode
    return mode


async def getPosition(drone:System,logger,redis:Redis,droneId:str):
    await drone.telemetry.set_rate_position(10)
    async for data in drone.telemetry.position():
        try:
            dta={}
            dta["lat"]=data.latitude_deg
            dta["lon"]=data.longitude_deg
            if data.relative_altitude_m<0:
                dta["agl"]=0
            else:
                dta["agl"]=data.relative_altitude_m
            dta["msl"]=data.absolute_altitude_m
            # jsondata=json.dumps(data.__dict__)
            # logger.info(jsondata)
            jsondata=json.dumps(dta)
            # logger.info(jsondata)
            redis.publish(f"telem:{droneId}",jsondata)
        except Exception as e:
            logger.error(e)




async def getStatusText(drone:System,logger,redis:Redis,droneId:str):
    async for data in drone.telemetry.status_text():
        # jsondata=json.dumps(data.__dict__)
        # logger.info(jsondata)
        dta={}
        dta["type"]=str(data.type)
        dta["text"]=str(data.text)
        jsondata=json.dumps(dta)
        # logger.info(jsondata)
        redis.publish(f"telem:{droneId}",jsondata)


async def getArmed(drone:System,logger,redis:Redis,droneId:str):
    global armed
    async for data in drone.telemetry.armed():
        # jsondata=json.dumps(data.__dict__)
        # logger.info(jsondata)
        dta={}
        dta["armed"]=data
        armed=data
        jsondata=json.dumps(dta)
        # logger.info(jsondata)
        redis.publish(f"telem:{droneId}",jsondata)


async def getFixedwingMetrics(drone:System,logger,redis:Redis,droneId:str):
    async for data in drone.telemetry.fixedwing_metrics():
        dta={}
        dta["throttle"]=data.throttle_percentage
        jsondata=json.dumps(dta)
        # logger.info(jsondata)
        redis.publish(f"telem:{droneId}",jsondata)



async def getAttitude(drone:System,logger,redis:Redis,droneId:str):
    await drone.telemetry.set_rate_attitude_euler(10)
    async for data in drone.telemetry.attitude_euler():
        dta={}
        dta["roll_deg"]=data.roll_deg
        dta["pitch_deg"]=data.pitch_deg
        dta["yaw_deg"]=data.yaw_deg
        # jsondata=json.dumps(data.__dict__)
        # logger.info(jsondata)
        jsondata=json.dumps(dta)
        # logger.info(jsondata)
        redis.publish(f"telem:{droneId}",jsondata)



async def getMode(drone:System,logger,redis:Redis,droneId:str):
    global mode
    async for data in drone.telemetry.flight_mode():
        # logger.info(jsondata)
        dta={}
        dta["mode"]=str(data)
        mode=str(data)
        jsondata=json.dumps(dta)
        # logger.info(jsondata)
        redis.publish(f"telem:{droneId}",jsondata)


async def getHeading(drone:System,logger,redis:Redis,droneId:str):
    global mode
    async for data in drone.telemetry.heading():
        dta={}
        dta["heading"]=data.heading_deg
        jsondata=json.dumps(dta)
        # logger.info(jsondata)
        redis.publish(f"telem:{droneId}",jsondata)


async def streamTelem(drone:System,logger,redis:Redis,droneId:str):
    streamPosition=asyncio.create_task(getPosition(drone,logger,redis,droneId))
    streamAttitude=asyncio.create_task(getAttitude(drone,logger,redis,droneId))
    streamMode=asyncio.create_task(getMode(drone,logger,redis,droneId))
    streamArmed=asyncio.create_task(getArmed(drone,logger,redis,droneId))
    streamStatusText=asyncio.create_task(getStatusText(drone,logger,redis,droneId))
    streamHeading=asyncio.create_task(getHeading(drone,logger,redis,droneId))
    streamFixedwingMetrics=asyncio.create_task(getFixedwingMetrics(drone,logger,redis,droneId))
    asyncio.gather(streamPosition,streamAttitude,streamMode,streamArmed,streamStatusText,streamHeading,streamFixedwingMetrics)