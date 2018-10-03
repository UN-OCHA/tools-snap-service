# UN OCHA PDF/PNG GNRTR

Everyone does this their own way. Do it our way!

## Install / Develop

The node container will do all the npm installation for you. No need to do it locally. Just run the Docker commands to get started.

```bash
# installation
docker-compose build

# development
docker-compose up
```

To use nodemon and have the service restart automatically as you edit the code, edit `debian-snapper-nodejs/run_node` and change the last command to `exec npm dev`.
