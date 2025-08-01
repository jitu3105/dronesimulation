#!/bin/bash
set -e

# Start PX4 SITL in background
cd /opt/px4/PX4-Autopilot
make HEADLESS=1 px4_sitl_default gazebo-classic_typhoon_h480 &

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
