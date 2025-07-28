from mavsdk import System
from loguru import logger
import asyncio
import json

armed=None
mode= None

def fetchArmed():
    global armed
    return armed

def fetchMode():
    global mode
    return mode


async def getPosition(drone:System,sio):
    print(sio)
    await drone.telemetry.set_rate_position(10)
    async for data in drone.telemetry.position():
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
        await sio.emit("telem",dta)




async def getStatusText(drone:System,sio):
    print(sio)
    async for data in drone.telemetry.status_text():
        # jsondata=json.dumps(data.__dict__)
        # logger.info(jsondata)
        dta={}
        dta["type"]=str(data.type)
        dta["text"]=str(data.text)
        await sio.emit("status",dta)


async def getArmed(drone:System,sio):
    global armed
    print(sio)
    async for data in drone.telemetry.armed():
        # jsondata=json.dumps(data.__dict__)
        # logger.info(jsondata)
        dta={}
        dta["armed"]=data
        armed=data
        await sio.emit("telem",dta)


async def getFixedwingMetrics(drone:System,sio):
    print(sio)
    async for data in drone.telemetry.fixedwing_metrics():
        dta={}
        dta["throttle"]=data.throttle_percentage
        await sio.emit("telem",dta)



async def getAttitude(drone:System,sio):
    print(sio)
    await drone.telemetry.set_rate_attitude_euler(10)
    async for data in drone.telemetry.attitude_euler():
        dta={}
        dta["roll_deg"]=data.roll_deg
        dta["pitch_deg"]=data.pitch_deg
        dta["yaw_deg"]=data.yaw_deg
        # jsondata=json.dumps(data.__dict__)
        # logger.info(jsondata)
        await sio.emit("telem",dta)



async def getMode(drone:System,sio):
    global mode
    print(sio)
    async for data in drone.telemetry.flight_mode():
        # jsondata=json.dumps(data.__dict__)
        # logger.info(jsondata)
        dta={}
        dta["mode"]=str(data)
        mode=str(data)
        await sio.emit("telem",dta)


async def getHeading(drone:System,sio):
    global mode
    print(sio)
    async for data in drone.telemetry.heading():
        dta={}
        dta["heading"]=data.heading_deg
        await sio.emit("telem",dta)


async def streamTelem(drone:System,sio):
    streamPosition=asyncio.create_task(getPosition(drone,sio))
    streamAttitude=asyncio.create_task(getAttitude(drone,sio))
    streamMode=asyncio.create_task(getMode(drone,sio))
    streamArmed=asyncio.create_task(getArmed(drone,sio))
    streamStatusText=asyncio.create_task(getStatusText(drone,sio))
    streamHeading=asyncio.create_task(getHeading(drone,sio))
    streamFixedwingMetrics=asyncio.create_task(getFixedwingMetrics(drone,sio))
    asyncio.gather(streamPosition,streamAttitude,streamMode,streamArmed,streamStatusText,streamHeading,streamFixedwingMetrics)