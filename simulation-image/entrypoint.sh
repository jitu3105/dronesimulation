#!/bin/bash
set -e

# Start PX4 SITL in background
cd /opt/px4/PX4-Autopilot
make HEADLESS=1 PX4_HOME_LAT=28.612928 PX4_HOME_LON=77.229831 PX4_HOME_ALT=0 px4_sitl_default gz_x500 &

# Optional: sleep to let PX4 initialize
sleep 5

# Start MAVSDK server (defaults to port 50051)
mavsdk_server -p 50051 &

cd /simulation 

python3 main.py & 

cd /

python3 videoforwarder.py &


# Wait for both to keep container alive
wait
