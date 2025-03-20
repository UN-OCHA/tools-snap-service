docker buildx build \
  --no-cache \
  --build-arg VCS_REF=`git rev-parse --short HEAD` \
  --build-arg VCS_URL=`git config --get remote.origin.url | sed 's#git@github.com:#https://github.com/#'` \
  --build-arg BUILD_DATE=`date -u +"%Y-%m-%dT%H:%M:%SZ"` \
  --build-arg VERSION=dev-chromium \
  --build-arg EXTRAVERSION=-202503-01 \
  --tag public.ecr.aws/unocha/tools-snap-service:dev-chromium-202503-01 \
  --push \
  --platform linux/arm64,linux/amd64 \
  .

docker buildx imagetools create -t public.ecr.aws/unocha/tools-snap-service:dev-chromium public.ecr.aws/unocha/tools-snap-service:dev-chromium-202503-01
