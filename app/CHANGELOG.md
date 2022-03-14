# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.


## [3.0.0](https://github.com/UN-OCHA/tools-snap-service/compare/v2.8.2...v3.0.0) (2022-03-14)

### ⚠ BREAKING CHANGES

* return 400 instead of 422 for all validation errors ([b8fb1fc](https://github.com/UN-OCHA/tools-snap-service/commit/b8fb1fc6c515a10958b390093378e1bed5cc7b76))
* when hostname of `url` parameter isn't in our allow-list, return 403 ([c59b0ff](https://github.com/UN-OCHA/tools-snap-service/commit/c59b0ff96d80eec0169f9b5165b65708e53c8fb4))
* **status:** If everything is ok, we now send 200 with the number of concurrent requests, instead of the old HTTP 204. If we are at our limit for concurrent requests, we send HTTP 429. Refs: SNAP-80

### Features

* return HTTP 405 for any `GET` request to /snap ([fd0d29d](https://github.com/UN-OCHA/tools-snap-service/commit/fd0d29d94ba7c3d46383190378bb7c232ec2dd00))

### Bug Fixes

* upgrade puppteer to match latest Chromium stable ([369ea02](https://github.com/UN-OCHA/tools-snap-service/commit/369ea02b0a1c9600435b085b42588a290af5ce44))


### [2.8.2](https://github.com/UN-OCHA/tools-snap-service/compare/v2.8.1...v2.8.2) (2022-01-31)

- **security**: update ansi-regex ([3cbd72f](https://github.com/UN-OCHA/tools-snap-service/commit/3cbd72f35b308fb8cff9c63549ca18c1c535d208))
- **security**: update eslint ([e5b12d3](https://github.com/UN-OCHA/tools-snap-service/commit/e5b12d3fe12d68a208b7bbfc48be356f188d2fbb))
- **security**: update Chromium/puppeteer ([a68a469](https://github.com/UN-OCHA/tools-snap-service/commit/a68a4690134a94531dda0bf2def4e8b293070dba))

### [2.8.1](https://github.com/UN-OCHA/tools-snap-service/compare/v2.8.0...v2.8.1) (2022-01-20)


### Bug Fixes

* adjust GMS SVG ([1e4ac94](https://github.com/UN-OCHA/tools-snap-service/commit/1e4ac9431fa1bffe17794e630574fc8d906e8bb3))

## [2.8.0](https://github.com/UN-OCHA/tools-snap-service/compare/v2.3.5...v2.8.0) (2021-11-08)


### Features

* adopt standard-version to automate CHANGELOG generation ([8b05f86](https://github.com/UN-OCHA/tools-snap-service/commit/8b05f8605b0262f7dfd019a84258c11542412fba))
