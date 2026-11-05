# Run npm run image:prepare first; the context contains checksum-verified binaries.
FROM alpine:3.22.2@sha256:85f2b723e106c34644cd5851d7e81ee87da98ac54672b29947c052a45d31dc2f
COPY .cache/image-root/ /
ENTRYPOINT ["/bin/sleep", "2147483647"]
