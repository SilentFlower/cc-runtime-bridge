set -eu
mount --make-rprivate /
mount -t tmpfs -o size=16m,mode=1777 ccrb-empty /tmp
mount -t tmpfs -o size=1m,mode=755 ccrb-empty /root/.nvm/versions/node/v22.23.4/lib/node_modules/@anthropic-ai/claude-code
mount -t tmpfs -o size=1m,mode=755 ccrb-empty /root/project/cc-runtime-bridge/src
mount -t tmpfs -o size=1m,mode=755 ccrb-empty /root/project/cc-runtime-bridge/scripts
ip link set lo up
exec /root/.bun/bin/bun /root/project/cc-runtime-bridge/artifacts/deployment/probe.mjs /root/project/cc-runtime-bridge/runtime/claude-293 /root/project/cc-runtime-bridge/artifacts/deployment/result.json /root/.nvm/versions/node/v22.23.4/lib/node_modules/@anthropic-ai/claude-code/bin/claude.exe /root/project/cc-runtime-bridge
