# Docs for internal development

This file contains some general instructions for getting set up, and also outlines the procedure to upgrade Chromium in order to maintain a version of Chrome with all necessary security patches.

## Install / Develop locally

The node container will do all the npm installation for you. No need to do it locally. Just run the Docker commands to get started.

```sh
# set BASEDIR and tweak MAX_CONCURRENT_REQUESTS for your hardware
vim .env
docker-compose build

# Start the container
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

## Monthly Chromium upgrades

Whenever you build a new Docker image for Snap, the version of Chromium is dynamically fetched from Google servers. You can do this at any time on your local machine by running the following command from the repo root:

```sh
docker-compose build --no-cache
```

Watch the console output and note the STABLE version of Chrome as the logs stream by. It can help to highlight the whole log block and once you see it, copy the text as quickly as you can. There might be a smarter way to do this, but copying logs is reliable enough. Example of the log you're looking for:

![SNAP logs](https://user-images.githubusercontent.com/254753/120500125-e64ee780-c3c0-11eb-8e23-0603c1c733ef.png)

Once you have the stable version of Chromium identified, use an INCOGNITO window and visit https://pptr.dev/ to view the official Puppeteer releases. The site has aggressive caching and opening in a regular window often loads stale data.

You will see a version number in the upper left. Click that version number to see a list of releases and their associated Chromium revision. You'll want to select the version of Puppeteer that is closest to the stable release you just wrote down. In this example case from June 2021, the two versions are:

- Chromium: 91.0.4472.77-1
- Puppeteer 9.0.0, which expects Chromium 91.0.4469.0

The Puppeteer releases get tagged against dev releases of Chromium so you'll typically see a release date that lags approximately 6 weeks behind the current date. The screenshot shows 21 April and this particular Snap build was created on 31 May:

![SNAP-92-puppeteer](https://user-images.githubusercontent.com/254753/120500143-e949d800-c3c0-11eb-932b-376476331642.png)

Once the Puppeteer version is noted, go and manually update `app/package.json`inside the Snap repo, then run one the following commands to ensure the codebase is fully updated:

```sh
# Start Snap Service in case the container isn't running
docker-compose up

# Use npm to install desired version of Puppeteer
docker-compose exec snap npm install
```

Make sure to bump the `version` inside `package.json` as well. For routine updates, a patch increment is all that's needed most of the time. However if puppeteer got a major version bump, it might be necessary to compare their release notes and see what breaking changes are involved. Occasionally they affect how Snap behaves, and we might need to coordinate with teams to delay or provide guidance in order for them to upgrade. See [SNAP-85](https://humanitarian.atlassian.net/browse/SNAP-85) as an example of Puppeteer breaking changes which couldn't be remediated within Snap, that in turn affected an OCHA site.

Conversely, for the example release depicted here, the 8.0.0 to 9.0.0 only involved one method which changed from async to sync. That doesn't affect our codebase at all because we don't use it, and if it did we would probably be able to make changes that don't affect the Snap users themselves. So the 9.0.0 breaking change does NOT warrant a major version bump on our side.

Now you can run some local tests using either cURL (see installation section) or another tool of your choice, with [the API docs](README.md) as your guide to craft the requests.

Finally, please keep in mind that the Chromium version is dynamically fetched at image build time, so once you merge this to dev/master, **the work is not finalized until a release has been tagged and built by DockerHub**. Ideally, the tag should be created as soon as dev is considered to be stable, i.e. within an hour of the dev deploy. Then you have the exact same version of Chromium in the prod release as the untagged dev deploy.
