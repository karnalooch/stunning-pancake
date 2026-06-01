FROM eclipse-temurin:17-jre-alpine

WORKDIR /brouter

# Official releases moved to abrensch/brouter (brouter/brouter URLs return 404).
ARG BROUTER_VERSION=1.7.8

RUN apk add --no-cache wget unzip && \
    wget -q "https://github.com/abrensch/brouter/releases/download/v${BROUTER_VERSION}/brouter-${BROUTER_VERSION}.zip" -O /tmp/brouter.zip && \
    unzip -q /tmp/brouter.zip -d /tmp/br && \
    cp "/tmp/br/brouter-${BROUTER_VERSION}/brouter-${BROUTER_VERSION}-all.jar" brouter.jar && \
    cp "/tmp/br/brouter-${BROUTER_VERSION}/profiles2/trekking.brf" bicycle.brf && \
    cp "/tmp/br/brouter-${BROUTER_VERSION}/profiles2/trekking-nosteps.brf" foot-all.brf && \
    rm -rf /tmp/br /tmp/brouter.zip && \
    apk del unzip

RUN mkdir -p /brouter/segments4

COPY entrypoint.sh /brouter/entrypoint.sh
RUN chmod +x /brouter/entrypoint.sh

EXPOSE 17777

# On start: download Poland .rd5 tiles if missing (see entrypoint.sh), then run BRouter.
# Mount Railway volume at /brouter/segments4 so downloads persist across deploys.
ENTRYPOINT ["/brouter/entrypoint.sh"]
