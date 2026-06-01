FROM eclipse-temurin:17-jre-alpine

WORKDIR /brouter

# Official releases: abrensch/brouter (not legacy brouter/brouter URLs).
ARG BROUTER_VERSION=1.7.9
ARG BROUTER_PROFILES_URL=https://brouter.de/brouter/profiles2

RUN apk add --no-cache wget unzip && \
    wget -q "https://github.com/abrensch/brouter/releases/download/v${BROUTER_VERSION}/brouter-${BROUTER_VERSION}.zip" -O /tmp/brouter.zip && \
    unzip -q /tmp/brouter.zip -d /tmp/br && \
    cp "/tmp/br/brouter-${BROUTER_VERSION}/brouter-${BROUTER_VERSION}-all.jar" brouter.jar && \
    mkdir -p profiles2 && \
    wget -q -O profiles2/lookups.dat "${BROUTER_PROFILES_URL}/lookups.dat" && \
    wget -q -O profiles2/trekking.brf "${BROUTER_PROFILES_URL}/trekking.brf" && \
    wget -q -O profiles2/trekking-nosteps.brf "${BROUTER_PROFILES_URL}/trekking-nosteps.brf" && \
    cp profiles2/trekking.brf profiles2/bicycle.brf && \
    cp profiles2/trekking-nosteps.brf profiles2/foot-all.brf && \
    rm -rf /tmp/br /tmp/brouter.zip && \
    apk del unzip

RUN mkdir -p /brouter/segments4

# Build context on Railway is repo root (dockerfilePath: infrastructure/brouter/Dockerfile).
COPY infrastructure/brouter/entrypoint.sh /brouter/entrypoint.sh
RUN chmod +x /brouter/entrypoint.sh

EXPOSE 17777

# On start: sync lookups + download Poland .rd5 if missing (entrypoint.sh).
# Mount Railway volume at /brouter/segments4 so tiles persist across deploys.
ENTRYPOINT ["/brouter/entrypoint.sh"]
