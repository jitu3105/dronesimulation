FROM ubuntu:20.04

# Define mount points for persistent data. Use absolute paths within the container.
VOLUME [ "/data", "/backend/simulation" ]

# Non-interactive for apt installs to prevent prompts during build
ENV DEBIAN_FRONTEND=noninteractive

# Install necessary tools: git for cloning, wget for downloads,
# python3-pip for Python packages, build-essential for compiling,
# lsb-release for the 'lsb_release' command used by PX4 setup script,
# cmake for the PX4 build system, and sudo for privilege escalation.
# Clean up apt lists to reduce image size.
RUN apt update && apt install -y \
    git \
    wget \
    python3-pip \
    build-essential \
    lsb-release \
    cmake \
    sudo \
    && rm -rf /var/lib/apt/lists/*

# Create a dedicated directory for the PX4 project and set it as the working directory.
# This provides a clean, predictable location for the cloned repository.
RUN mkdir -p /opt/px4
WORKDIR /opt/px4

# Clone PX4 source code recursively into the current working directory (/opt/px4).
# This will create /opt/px4/PX4-Autopilot.
RUN git clone https://github.com/PX4/PX4-Autopilot.git --recursive

# Now, change the working directory specifically to the cloned PX4-Autopilot repository.
# All subsequent commands will be executed from within /opt/px4/PX4-Autopilot.
WORKDIR /opt/px4/PX4-Autopilot



# Run the PX4 setup script using 'bash' explicitly, as it contains bash-specific syntax.
# This script installs additional dependencies required for building and simulating PX4.
# The script itself will use 'sudo' internally for some operations.
RUN bash ./Tools/setup/ubuntu.sh


RUN DONT_RUN=1 make px4_sitl gazebo-classic_typhoon_h480

RUN pip3 install docker>=7.1.0 fastapi>=0.116.1 loguru>=0.7.3 mavsdk==2.6.0  redis uvicorn>=0.35.0 mavproxy conan>2.0

WORKDIR  /opt

RUN  cp /usr/local/lib/python3.8/dist-packages/mavsdk/bin/mavsdk_server /usr/local/bin/


COPY simulation /simulation


RUN apt-get install -y libgstreamer1.0-dev libgstreamer-plugins-base1.0-dev libgstreamer-plugins-bad1.0-dev gstreamer1.0-plugins-base gstreamer1.0-plugins-good gstreamer1.0-plugins-bad gstreamer1.0-plugins-ugly gstreamer1.0-libav gstreamer1.0-tools gstreamer1.0-x gstreamer1.0-alsa gstreamer1.0-gl gstreamer1.0-gtk3 gstreamer1.0-qt5 gstreamer1.0-pulseaudio gstreamer1.0-rtsp  python3-gi gir1.2-gst-plugins-base-1.0 xvfb

COPY videoforwarder.py /videoforwarder.py

COPY entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh

CMD ["/entrypoint.sh"]