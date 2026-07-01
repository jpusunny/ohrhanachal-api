# INTERIM: deploy the image pre-built on the host with `docker build -t ohr-api:manual`.
# Coolify's own build transport gets severed on Medusa's long npm install, so we build
# the heavy image out-of-band and have Coolify just reference it (instant build).
# The full source-build Dockerfile is in git history (previous commit).
FROM ohr-api:manual
WORKDIR /app/.medusa/server
ENV NODE_ENV=production
EXPOSE 9000
CMD ["sh","-c","npx medusa db:migrate && npm run start"]
