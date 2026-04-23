FROM eclipse-temurin:17-jre-alpine

WORKDIR /brouter

# Download official BRouter release JAR
RUN apk add --no-cache wget && \
    wget -q "https://github.com/brouter/brouter/releases/download/brouter_1_7_9/brouter.jar" -O brouter.jar && \
    wget -q "https://github.com/brouter/brouter/raw/brouter_1_7_9/misc/profiles2/foot-all.brf" -O foot-all.brf && \
    wget -q "https://github.com/brouter/brouter/raw/brouter_1_7_9/misc/profiles2/trekking.brf" -O bicycle.brf

# Create segments directory (will be mounted as volume)
RUN mkdir -p /brouter/segments4

EXPOSE 17878

CMD ["java", "-Xmx512m", "-Xms64m", \
     "-cp", "brouter.jar", \
     "btools.server.BRouterServer", \
     "/brouter/segments4", \
     "foot-all.brf,bicycle.brf", \
     "17878", "1"]
