# TestDriver E2B Sandbox — Linux Desktop
#
# Base desktop environment for TestDriver cloud sandboxes.
# The testdriver-runner is installed via npm, not COPY.
# dashcam and dashcam-chrome are bundled as runner dependencies.
#
# Build:  e2b template build
# Local:  docker build -t testdriver-sandbox .

FROM ubuntu:22.04

ARG TARGETARCH
ARG CACHEBUST=1
RUN echo "$CACHEBUST"

ENV DEBIAN_FRONTEND=noninteractive
ENV DEBIAN_PRIORITY=high

# ─── Base system ──────────────────────────────────────────────────────────────

RUN yes | unminimize
RUN apt-get update && apt-get --reinstall install -y python3-jwt python3-oauthlib python3-lazr.restfulclient \
    python3-launchpadlib python3-apport xserver-xorg apport xorg

RUN apt-get update && apt-get install -y \
    python3-xlib \
    x11-xserver-utils \
    xfce4 \
    xfce4-goodies \
    xvfb \
    xubuntu-icon-theme \
    scrot \
    python3-pip \
    python3-tk \
    python3-dev \
    x11-utils \
    gnumeric \
    python-is-python3 \
    build-essential \
    util-linux \
    locales \
    xauth \
    gnome-screenshot \
    xserver-xorg \
    ffmpeg \
    vim \
    xorg

RUN pip3 install mux_python requests

# ─── VS Code (amd64 only) ────────────────────────────────────────────────────

RUN if [ "$TARGETARCH" = "amd64" ] || [ -z "$TARGETARCH" ]; then \
      apt update -y \
      && apt install -y software-properties-common apt-transport-https wget \
      && wget -qO- https://packages.microsoft.com/keys/microsoft.asc | apt-key add - \
      && add-apt-repository -y "deb [arch=amd64] https://packages.microsoft.com/repos/vscode stable main" \
      && apt update -y \
      && apt install -y code; \
    else \
      echo "Skipping VS Code install on $TARGETARCH"; \
    fi
RUN mkdir -p /home/user/.config/Code/User
RUN echo "{\"files.autoSave\": \"afterDelay\", \"files.autoSaveDelay\": 200, \"security.allowHttp\": true, \"security.workspace.trust.startupPrompt\": \"never\", \"security.workspace.trust.enabled\": false, \"security.workspace.trust.banner\": \"never\", \"security.workspace.trust.emptyWindow\": false}" > /home/user/.config/Code/User/settings.json

ENV PIP_DEFAULT_TIMEOUT=100 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1 \
    DEBIAN_FRONTEND=noninteractive \
    DISPLAY=:0

# ─── Python deps ─────────────────────────────────────────────────────────────

RUN pip3 install --no-cache-dir \
    pyvirtualdisplay \
    pyscreenshot \
    pillow \
    EasyProcess \
    python-xlib \
    opencv-python \
    keyboard \
    pyautogui \
    websockets

# ─── Desktop tools ───────────────────────────────────────────────────────────

RUN apt-get update && \
    apt-get -y upgrade && \
    apt-get -y install \
    build-essential \
    xterm \
    xdotool \
    scrot \
    imagemagick \
    sudo \
    mutter \
    x11vnc \
    build-essential \
    libssl-dev  \
    zlib1g-dev \
    libbz2-dev \
    libreadline-dev \
    libsqlite3-dev \
    curl \
    git \
    libncursesw5-dev \
    xz-utils \
    tk-dev \
    libxml2-dev \
    libxmlsec1-dev \
    libffi-dev \
    liblzma-dev \
    net-tools \
    netcat \
    software-properties-common \
    libxtst-dev \
    cmake && \
    sudo add-apt-repository ppa:mozillateam/ppa && \
    sudo apt-get install -y --no-install-recommends \
    libreoffice \
    firefox-esr \
    x11-apps \
    xpdf \
    gedit \
    xpaint \
    tint2 \
    galculator \
    pcmanfm \
    unzip && \
    apt-get clean

RUN sudo ln -sf /usr/bin/xfce4-terminal.wrapper /etc/alternatives/x-terminal-emulator

RUN pip install numpy

# ─── noVNC + websockify ──────────────────────────────────────────────────────

RUN git clone --branch e2b-desktop https://github.com/e2b-dev/noVNC.git /opt/noVNC && \
    git clone --branch v0.12.0 https://github.com/novnc/websockify /opt/noVNC/utils/websockify && \
    ln -s /opt/noVNC/vnc.html /opt/noVNC/index.html
RUN sed -i 's/<div id="top_bar">/<div id="top_bar" style="display: none;">/' /opt/noVNC/vnc_lite.html || true

# ─── Chrome ──────────────────────────────────────────────────────────────────

RUN if [ "$TARGETARCH" = "arm64" ]; then \
      apt-get update && \
      apt-get -y install gnupg && \
      echo "deb http://ftp.debian.org/debian bookworm main" > /etc/apt/sources.list.d/debian-bookworm.list && \
      apt-key adv --keyserver keyserver.ubuntu.com --recv-keys 0E98404D386FA1D9 6ED0E7B82643E131 && \
      apt-get update && \
      apt-get -y -t bookworm install chromium && \
      ln -sf /usr/bin/chromium /usr/local/bin/google-chrome && \
      ln -sf /usr/bin/chromium /usr/local/bin/chrome-for-testing && \
      rm /etc/apt/sources.list.d/debian-bookworm.list && \
      apt-get update; \
    else \
      sudo apt-get -y install libxss1 libappindicator1 libindicator7 && \
      wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb && \
      sudo apt install -y ./google-chrome*.deb && \
      rm ./google-chrome*.deb && \
      wget https://storage.googleapis.com/chrome-for-testing-public/131.0.6778.87/linux64/chrome-linux64.zip && \
      unzip chrome-linux64.zip && \
      sudo mv chrome-linux64 /opt/chrome-for-testing && \
      sudo ln -s /opt/chrome-for-testing/chrome /usr/local/bin/chrome-for-testing && \
      rm chrome-linux64.zip; \
    fi

# ─── Node.js 20 ──────────────────────────────────────────────────────────────

RUN curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && \
  sudo apt-get install -y nodejs

# ─── jumpapp ─────────────────────────────────────────────────────────────────

RUN sudo apt-get install -y build-essential debhelper git pandoc shunit2 && \
    git clone https://github.com/mkropat/jumpapp.git && \
    cd jumpapp && \
    make deb && \
    sudo apt install -y ./jumpapp*.deb

# ─── TestDriver Runner (from local package) ──────────────────────────────────
# Installs @testdriverai/runner globally from the local source.
# Includes:
#   - testdriver-runner (Ably presence runner — default)
#   - testdriver-sandbox-agent (pre-provisioned sandbox agent)
#   - dashcam (screen recording CLI)
#   - dashcam-chrome (Chrome extension for console/network capture)

COPY runner/ /tmp/runner-src/
RUN cd /tmp/runner-src && npm install --production && npm install -g . && rm -rf /tmp/runner-src

# Copy desktop scripts from the installed package
RUN RUNNER_ROOT=$(node -e "console.log(require.resolve('@testdriverai/runner').replace('/index.js',''))") && \
    cp -r "$RUNNER_ROOT/scripts-desktop" /home/user/scripts && \
    chmod +x /home/user/scripts/*.sh

# Copy Polkit and Xauthority from the installed package
RUN RUNNER_ROOT=$(node -e "console.log(require.resolve('@testdriverai/runner').replace('/index.js',''))") && \
    cp "$RUNNER_ROOT/45-allow-colord.pkla" /etc/polkit-1/localauthority/50-local.d/45-allow-colord.pkla && \
    cp "$RUNNER_ROOT/Xauthority" /home/user/.Xauthority

# Desktop wallpaper from installed package
RUN RUNNER_ROOT=$(node -e "console.log(require.resolve('@testdriverai/runner').replace('/index.js',''))") && \
    cp "$RUNNER_ROOT/wallpaper.png" /usr/share/backgrounds/xfce/wallpaper.png

# ─── Cleanup ─────────────────────────────────────────────────────────────────

# Remove XFCE panel plugins that show errors in headless mode
RUN apt-get remove -y xfce4-power-manager xfce4-power-manager-plugins 2>/dev/null || true && \
    apt-get autoremove -y 2>/dev/null || true

# ─── Entrypoint ──────────────────────────────────────────────────────────────

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]


