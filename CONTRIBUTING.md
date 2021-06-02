# Docs for internal development

This file contains some general instructions for getting set up, and also outlines the procedure to upgrade Chromium in order to maintain a version of Chrome with all necessary security patches.

## Install / Develop locally

The node container will do all the npm installation for you. No need to do it locally. Just run the Docker commands to get started.

```bash
# installation
vim .env # set BASEDIR and tweak MAX_CONCURRENT_REQUESTS for your hardware
docker-compose build

# development
docker-compose up
```

Now you can `POST` to `localhost:8442/snap` and it should return Snaps to you. There's also a `/status` route for pingdom that you can `GET` in order to quickly confirm it's up and running:

```sh
# Ping the service to confirm server is running. HTTP 204 is success.
curl -I http://localhost:8442/status

# Snap a PDF of example.com and save to tmp.pdf
curl -X POST http://localhost:8442/snap?url=https://example.com > tmp.pdf
```

It will probably be necessary to use an app that helps you formulate and store common queries you want to test. Command line tools like `curl` are perfectly capable, but if you want something more visual try [Insomnia](https://insomnia.rest/). It lets you configure everything and save each query for repeated use.
