#!/bin/bash
export ANDROID_HOME=/usr/local/android-sdk
export PATH="$PATH:$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/platform-tools"
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
export CMAKE_BUILD_PARALLEL_LEVEL=2
cd /root/sport-mobile
node /usr/lib/node_modules/eas-cli/bin/run build -p android -e preview --local --non-interactive 2>&1
